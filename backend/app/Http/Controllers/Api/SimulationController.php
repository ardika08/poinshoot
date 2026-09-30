<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\Round;
use App\Support\BoardConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SimulationController extends Controller
{
    /**
     * POST /api/v1/simulation/rounds — submit hasil 1 ronde game simulasi.
     * Public: pemain main langsung di HP tanpa login.
     *
     * Poin TIDAK diambil dari kiriman klien — selalu dihitung ulang dari
     * config/board.php berdasarkan zone_name, supaya skor tidak bisa
     * dimanipulasi lewat DevTools.
     */
    public function store(Request $request)
    {
        $maxAttempts = BoardConfig::maxAttempts();

        $validator = Validator::make($request->all(), [
            'player_id' => ['required', 'integer', 'exists:players,id'],
            'attempts' => ['required', 'array', 'size:' . $maxAttempts],
            'attempts.*.attempt_number' => ['required', 'integer', 'min:1', 'max:' . $maxAttempts],
            'attempts.*.is_successful' => ['required', 'boolean'],
            'attempts.*.zone_name' => ['nullable', 'string', Rule::in(BoardConfig::ids())],
        ], [
            'attempts.size' => "Harus tepat {$maxAttempts} percobaan",
            'attempts.*.zone_name.in' => 'Lubang tidak dikenal',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $validator->errors()->first(),
                    'errors' => $validator->errors()->toArray(),
                ],
            ], 422);
        }

        $data = $validator->validated();

        if (Round::where('player_id', $data['player_id'])->where('game_mode', 'simulation')->exists()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'SIMULATION_ALREADY_COMPLETED',
                    'message' => 'Ronde simulasi resmi siswa ini sudah pernah diselesaikan',
                ],
            ], 409);
        }

        $round = DB::transaction(function () use ($data, $request) {
            $round = Round::create([
                'player_id' => $data['player_id'],
                'total_score' => 0,
                'attempts_count' => 0,
                'game_mode' => 'simulation',
                'start_time' => now(),
            ]);

            foreach ($data['attempts'] as $attempt) {
                // Sumber kebenaran poin = config, bukan kiriman klien.
                $hole = BoardConfig::find($attempt['zone_name'] ?? null);
                $successful = ((bool) $attempt['is_successful']) && $hole !== null;

                Game::create([
                    'player_id' => $data['player_id'],
                    'admin_id' => null,
                    'round_id' => $round->id,
                    'attempt_number' => $attempt['attempt_number'],
                    'is_successful' => $successful,
                    'points' => $successful ? $hole['points'] : 0,
                    'zone_name' => $successful ? $hole['id'] : null,
                    'game_mode' => 'simulation',
                    'device_info' => substr((string) $request->userAgent(), 0, 255),
                ]);
            }

            $round->total_score = (int) $round->games()->sum('points');
            $round->attempts_count = (int) $round->games()->count();
            $round->end_time = now();
            $round->save();

            return $round->fresh();
        });

        // Perkiraan peringkat all-time berdasarkan skor ronde ini
        $rank = Round::where('total_score', '>', $round->total_score)
            ->where('is_archived', false)
            ->distinct('player_id')
            ->count('player_id') + 1;

        return response()->json([
            'success' => true,
            'data' => [
                'round' => [
                    'id' => $round->id,
                    'player_id' => $round->player_id,
                    'total_score' => $round->total_score,
                    'attempts_count' => $round->attempts_count,
                    'game_mode' => $round->game_mode,
                    'created_at' => $round->created_at?->toIso8601String(),
                ],
                'estimated_rank' => $rank,
                'is_podium' => $rank <= 3,
            ],
            'message' => 'Skor tersimpan! Total: ' . $round->total_score,
        ], 201);
    }

    /**
     * GET /api/v1/simulation/config — layout papan, area canvas, dan physics.
     */
    public function config()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'max_attempts' => BoardConfig::maxAttempts(),
                'max_round_score' => BoardConfig::maxRoundScore(),
                'canvas' => config('board.canvas'),
                'physics' => config('board.physics'),
                'holes' => BoardConfig::holes(),
            ],
        ]);
    }
}
