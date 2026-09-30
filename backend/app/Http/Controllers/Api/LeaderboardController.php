<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\Round;
use Carbon\Carbon;

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

    /** Leaderboard skor final = manual resmi + simulasi resmi. */
    public function index(string $scope)
    {
        if (! in_array($scope, ['all_time', 'weekly', 'monthly'], true)) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'INVALID_SCOPE', 'message' => 'Invalid scope. Use: all_time, weekly, monthly'],
            ], 400);
        }

        $now = Carbon::now();
        $start = match ($scope) {
            'weekly' => $now->copy()->subDays(7),
            'monthly' => $now->copy()->subDays(30),
            default => null,
        };

        $players = Player::query()
            ->where('is_active', true)
            ->with(['rounds' => function ($q) use ($start) {
                $q->where('is_archived', false);
                if ($start) $q->where('created_at', '>=', $start);
            }])
            ->get()
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
            ->take(10)
            ->map(fn ($item, $index) => ['rank' => $index + 1, ...$item])
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'scope' => $scope,
                'period' => ['start' => $start?->toIso8601String(), 'end' => $now->toIso8601String()],
                'top_players' => $players,
                'total' => $players->count(),
            ],
        ]);
    }
}
