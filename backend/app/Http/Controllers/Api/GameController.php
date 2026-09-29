<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGameRequest;
use App\Models\Admin;
use App\Models\AdminLog;
use App\Models\Game;
use App\Models\Round;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameController extends Controller
{
    /**
     * POST /api/v1/admin/games — input skor manual per attempt (admin only)
     * Flow: pilih user -> input attempt 1..5 (form stay di user yang sama)
     */
    public function store(StoreGameRequest $request)
    {
        /** @var Admin $admin */
        $admin = $request->attributes->get('current_admin');
        $data = $request->validated();

        $result = DB::transaction(function () use ($data, $admin) {
            // Pakai round aktif (belum 5 attempt) atau buat baru
            $round = Round::where('player_id', $data['player_id'])
                ->where('is_archived', false)
                ->whereNull('end_time')
                ->where('game_mode', $data['game_mode'])
                ->orderByDesc('created_at')
                ->first();

            if (! $round) {
                $round = Round::create([
                    'player_id' => $data['player_id'],
                    'total_score' => 0,
                    'attempts_count' => 0,
                    'game_mode' => $data['game_mode'],
                    'start_time' => now(),
                ]);
            }

            // Cegah duplikat attempt_number dalam satu ronde
            $existing = Game::where('round_id', $round->id)
                ->where('attempt_number', $data['attempt_number'])
                ->first();

            if ($existing) {
                // Update attempt yang sudah ada (koreksi salah input)
                $existing->update([
                    'is_successful' => $data['is_successful'],
                    'points' => $data['points'],
                    'zone_name' => $data['zone_name'] ?? null,
                    'admin_id' => $admin->id,
                ]);
                $game = $existing;
            } else {
                $game = Game::create([
                    'player_id' => $data['player_id'],
                    'admin_id' => $admin->id,
                    'round_id' => $round->id,
                    'attempt_number' => $data['attempt_number'],
                    'is_successful' => $data['is_successful'],
                    'points' => $data['points'],
                    'zone_name' => $data['zone_name'] ?? null,
                    'game_mode' => $data['game_mode'],
                ]);
            }

            // Recalculate dari sumber kebenaran (games), bukan increment
            $round->total_score = (int) $round->games()->sum('points');
            $round->attempts_count = (int) $round->games()->count();

            if ($round->attempts_count >= \App\Support\BoardConfig::maxAttempts()) {
                $round->end_time = now();
            }

            $round->save();

            return ['game' => $game, 'round' => $round->fresh()];
        });

        AdminLog::log($admin, 'submit_game', $result['game']->id, [
            'player_id' => $data['player_id'],
            'attempt_number' => $data['attempt_number'],
            'points' => $data['points'],
            'is_successful' => $data['is_successful'],
        ]);

        $round = $result['round'];
        $maxAttempts = \App\Support\BoardConfig::maxAttempts();
        $isComplete = $round->attempts_count >= $maxAttempts;

        return response()->json([
            'success' => true,
            'data' => [
                'game' => [
                    'id' => $result['game']->id,
                    'attempt_number' => $result['game']->attempt_number,
                    'is_successful' => $result['game']->is_successful,
                    'points' => $result['game']->points,
                    'zone_name' => $result['game']->zone_name,
                ],
                'round' => [
                    'id' => $round->id,
                    'player_id' => $round->player_id,
                    'total_score' => $round->total_score,
                    'attempts_count' => $round->attempts_count,
                    'is_complete' => $isComplete,
                ],
                'score_progress' => [
                    'attempt_number' => $round->attempts_count,
                    'max_attempts' => $maxAttempts,
                    'remaining' => max(0, $maxAttempts - $round->attempts_count),
                    'round_total_score' => $round->total_score,
                ],
            ],
            'message' => $isComplete
                ? 'Ronde selesai! Total skor: ' . $round->total_score
                : 'Skor tersimpan',
        ], 201);
    }

    /**
     * GET /api/v1/admin/games/player/{playerId} — riwayat attempt pemain
     */
    public function index(Request $request, string $playerId)
    {
        $games = Game::with(['player:id,name', 'admin:id,username'])
            ->where('player_id', $playerId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn ($g) => [
                'id' => $g->id,
                'round_id' => $g->round_id,
                'attempt_number' => $g->attempt_number,
                'is_successful' => $g->is_successful,
                'points' => $g->points,
                'zone_name' => $g->zone_name,
                'game_mode' => $g->game_mode,
                'created_at' => $g->created_at?->toIso8601String(),
                'player_name' => $g->player->name ?? 'Unknown',
                'admin_username' => $g->admin?->username,
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'player_id' => (int) $playerId,
                'games' => $games,
                'total' => $games->count(),
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/games/recent — game terbaru untuk dashboard
     */
    public function recent(Request $request)
    {
        $limit = min((int) $request->query('limit', 15), 50);

        $rounds = Round::with('player:id,name')
            ->whereNotNull('end_time')
            ->orderByDesc('end_time')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'player_name' => $r->player->name ?? 'Unknown',
                'total_score' => $r->total_score,
                'attempts_count' => $r->attempts_count,
                'game_mode' => $r->game_mode,
                'created_at' => $r->created_at?->toIso8601String(),
                'end_time' => $r->end_time?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'data' => ['rounds' => $rounds, 'total' => $rounds->count()],
        ]);
    }

    /**
     * DELETE /api/v1/admin/rounds/{id} — hapus ronde (koreksi salah input)
     */
    public function destroyRound(Request $request, string $id)
    {
        /** @var Admin $admin */
        $admin = $request->attributes->get('current_admin');

        $round = Round::find($id);

        if (! $round) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'ROUND_NOT_FOUND', 'message' => 'Ronde tidak ditemukan'],
            ], 404);
        }

        AdminLog::log($admin, 'delete_round', $round->id, [
            'player_id' => $round->player_id,
            'total_score' => $round->total_score,
        ]);

        $round->games()->delete();
        $round->delete();

        return response()->json([
            'success' => true,
            'message' => 'Ronde berhasil dihapus',
        ]);
    }
}
