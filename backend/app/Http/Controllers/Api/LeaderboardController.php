<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\Round;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function publicStats()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_players' => Player::count(),
                'active_today' => Round::whereDate('created_at', today())->distinct('player_id')->count('player_id'),
                'total_rounds' => Round::count(),
                'avg_score' => round((float) Player::withSum('rounds', 'total_score')->get()->avg('rounds_sum_total_score'), 1),
            ],
        ]);
    }

    /**
     * Leaderboard skor final = manual resmi + simulasi resmi.
     *
     * Query opsional:
     *  - rombel    : 1A-6B → batasi papan ke satu kelas (anak melihat teman sekelasnya)
     *  - player_id : id pemain yang sedang bermain → sertakan "posisi kamu"
     *  - limit     : jumlah baris yang dikirim (default 10, maks 100)
     *
     * `you` selalu ikut dikirim walau peringkatnya di luar `limit` — inilah yang
     * membuat siswa tetap menemukan skornya sendiri di papan top-10.
     */
    public function index(Request $request, string $scope)
    {
        if (! in_array($scope, ['all_time', 'weekly', 'monthly'], true)) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'INVALID_SCOPE', 'message' => 'Invalid scope. Use: all_time, weekly, monthly'],
            ], 400);
        }

        // Rombel sengaja dikunci ke 1A-6B (aturan final): kelas di luar itu tidak dikenal.
        $rombel = $request->query('rombel');
        $rombel = ($rombel === null || $rombel === '') ? null : (string) $rombel;
        if ($rombel !== null && ! preg_match('/^[1-6][AB]$/', $rombel)) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'INVALID_ROMBEL', 'message' => 'Invalid rombel. Use: 1A-6B'],
            ], 400);
        }

        $playerId = is_numeric($request->query('player_id')) ? (int) $request->query('player_id') : null;

        $rawLimit = $request->query('limit');
        $limit = max(1, min(is_numeric($rawLimit) ? (int) $rawLimit : 10, 100));

        $now = Carbon::now();
        $start = match ($scope) {
            'weekly' => $now->copy()->subDays(7),
            'monthly' => $now->copy()->subDays(30),
            default => null,
        };

        // Kandidat = pemain pada tampilan ini (seluruh sekolah, atau satu rombel saja).
        $candidates = Player::query()
            ->where('is_active', true)
            ->when($rombel !== null, fn ($q) => $q->where('rombel', $rombel))
            ->with(['rounds' => function ($q) use ($start) {
                $q->where('is_archived', false);
                if ($start) $q->where('created_at', '>=', $start);
            }])
            ->get();

        $ranked = $candidates
            ->map(function ($player) {
                $manualRound = $player->rounds->firstWhere('game_mode', 'manual');
                $simulationRound = $player->rounds->firstWhere('game_mode', 'simulation');
                $manual = (int) ($manualRound?->total_score ?? 0);
                $simulation = (int) ($simulationRound?->total_score ?? 0);
                $dates = $player->rounds->pluck('created_at')->filter();

                return [
                    'player_id' => $player->id,
                    'name' => $player->name,
                    'rombel' => $player->rombel,
                    'manual_score' => $manual,
                    'simulation_score' => $simulation,
                    'final_score' => $manual + $simulation,
                    'completion_status' => ($manualRound && $simulationRound) ? 'complete' : (($manualRound || $simulationRound) ? 'partial' : 'not_started'),
                    'achieved_date' => $dates->max(),
                ];
            })
            ->filter(fn ($item) => $item['final_score'] > 0)
            ->sort(function ($a, $b) {
                $score = $b['final_score'] <=> $a['final_score'];
                return $score !== 0 ? $score : strcmp((string) $a['achieved_date'], (string) $b['achieved_date']);
            })
            ->values()
            ->map(fn ($item, $index) => ['rank' => $index + 1, ...$item]);

        $you = null;
        if ($playerId !== null) {
            $you = $ranked->firstWhere('player_id', $playerId);

            // Terdaftar di tampilan ini tapi belum berpoin → tetap kirim, supaya
            // siswa melihat "belum bermain" alih-alih tidak muncul sama sekali.
            if ($you === null) {
                $player = $candidates->firstWhere('id', $playerId);
                if ($player) {
                    $you = [
                        'rank' => null,
                        'player_id' => $player->id,
                        'name' => $player->name,
                        'rombel' => $player->rombel,
                        'manual_score' => 0,
                        'simulation_score' => 0,
                        'final_score' => 0,
                        'completion_status' => 'not_started',
                        'achieved_date' => null,
                    ];
                }
            }
        }

        $top = $ranked
            ->take($limit)
            ->map(fn ($item) => [...$item, 'is_you' => $playerId !== null && $item['player_id'] === $playerId])
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'scope' => $scope,
                'rombel' => $rombel,
                'period' => ['start' => $start?->toIso8601String(), 'end' => $now->toIso8601String()],
                'top_players' => $top,
                'you' => $you,
                'total' => $ranked->count(),
            ],
        ]);
    }
}
