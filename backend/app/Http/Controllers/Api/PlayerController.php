<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePlayerRequest;
use App\Http\Requests\UpdatePlayerRequest;
use App\Models\Player;
use Illuminate\Http\Request;

class PlayerController extends Controller
{
    /**
     * POST /api/v1/players — registrasi pemain (public, tanpa login)
     */
    public function store(StorePlayerRequest $request)
    {
        $player = Player::create([
            'name' => $request->validated('name'),
            'whatsapp' => $request->validated('whatsapp'),
            'rombel' => $request->validated('rombel'),
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->transform($player),
            'message' => 'Registrasi berhasil',
        ], 201);
    }

    /**
     * PUT /api/v1/players/{id} — edit data pemain (boleh setelah registrasi)
     */
    public function update(UpdatePlayerRequest $request, string $id)
    {
        $player = Player::find($id);

        if (! $player) {
            return $this->notFound();
        }

        $player->update($request->validated());

        return response()->json([
            'success' => true,
            'data' => $this->transform($player->fresh()),
            'message' => 'Data pemain berhasil diperbarui',
        ]);
    }

    /**
     * GET /api/v1/players/{id} — detail pemain + riwayat ronde
     */
    public function show(string $id)
    {
        $player = Player::with(['rounds' => fn ($q) => $q->orderByDesc('created_at')->limit(20)])->find($id);

        if (! $player) {
            return $this->notFound();
        }

        $manualRound = $player->rounds->firstWhere('game_mode', 'manual');
        $simulationRound = $player->rounds->firstWhere('game_mode', 'simulation');
        $manualScore = (int) ($manualRound?->total_score ?? 0);
        $simulationScore = (int) ($simulationRound?->total_score ?? 0);

        return response()->json([
            'success' => true,
            'data' => [
                ...$this->transform($player),
                'stats' => [
                    'total_rounds' => $player->rounds()->count(),
                    'manual_score' => $manualScore,
                    'simulation_score' => $simulationScore,
                    'final_score' => $manualScore + $simulationScore,
                    'completion_status' => ($manualRound && $simulationRound) ? 'complete' : (($manualRound || $simulationRound) ? 'partial' : 'not_started'),
                    'avg_score' => round((float) $player->rounds()->avg('total_score'), 1),
                ],
                'rounds' => $player->rounds->map(fn ($r) => [
                    'id' => $r->id,
                    'total_score' => $r->total_score,
                    'attempts_count' => $r->attempts_count,
                    'game_mode' => $r->game_mode,
                    'created_at' => $r->created_at?->toIso8601String(),
                ]),
            ],
        ]);
    }

    /**
     * GET /api/v1/players/lookup?whatsapp=08xxx — cek nomor sudah terdaftar
     */
    public function lookup(Request $request)
    {
        $wa = preg_replace('/[^0-9+]/', '', (string) $request->query('whatsapp', ''));
        $wa = preg_replace('/^\+?62/', '0', $wa);

        if (! $wa) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Parameter whatsapp wajib diisi'],
            ], 422);
        }

        $player = Player::where('whatsapp', $wa)->first();

        return response()->json([
            'success' => true,
            'data' => [
                'exists' => (bool) $player,
                'player' => $player ? $this->transform($player) : null,
            ],
        ]);
    }

    private function transform(Player $player): array
    {
        return [
            'id' => $player->id,
            'name' => $player->name,
            'whatsapp' => $player->whatsapp,
            'rombel' => $player->rombel,
            'is_active' => $player->is_active,
            'created_at' => $player->created_at?->toIso8601String(),
        ];
    }

    private function notFound()
    {
        return response()->json([
            'success' => false,
            'error' => ['code' => 'PLAYER_NOT_FOUND', 'message' => 'Pemain tidak ditemukan'],
        ], 404);
    }
}
