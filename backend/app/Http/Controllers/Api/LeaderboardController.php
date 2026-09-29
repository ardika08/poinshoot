<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Player;
use App\Models\Round;
use Illuminate\Http\Request;
use Carbon\Carbon;

class LeaderboardController extends Controller
{
    /**
     * GET /api/v1/stats — statistik agregat publik (tanpa data personal)
     */
    public function publicStats()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_players' => Player::count(),
                'active_today' => Round::whereDate('created_at', today())
                    ->distinct('player_id')->count('player_id'),
                'total_rounds' => Round::count(),
                'avg_score' => round((float) Round::where('attempts_count', '>', 0)->avg('total_score'), 1),
            ],
        ]);
    }

    public function index(string $scope)
    {
        $now = Carbon::now();

        // Filter rounds by scope
        $query = Round::with('player')->where('is_archived', false);

        if ($scope === 'all_time') {
            // All active rounds
        } elseif ($scope === 'weekly') {
            $weekAgo = $now->copy()->subDays(7);
            $query->where('created_at', '>=', $weekAgo);
        } elseif ($scope === 'monthly') {
            $monthAgo = $now->copy()->subDays(30);
            $query->where('created_at', '>=', $monthAgo);
        } else {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_SCOPE',
                    'message' => 'Invalid scope. Use: all_time, weekly, monthly',
                ],
            ], 400);
        }

        $rounds = $query->orderByDesc('total_score')->get();

        // Group by player and get highest score (first to achieve wins tie-breaker)
        $playerScores = [];

        foreach ($rounds as $round) {
            $playerId = $round->player_id;

            if (!isset($playerScores[$playerId])) {
                $playerScores[$playerId] = [
                    'player_id' => $playerId,
                    'name' => $round->player->name ?? 'Unknown',
                    'whatsapp' => $round->player->whatsapp,
                    'total_score' => $round->total_score,
                    'achieved_date' => $round->created_at,
                ];
            } else {
                // Update if new round has higher score
                if ($round->total_score > $playerScores[$playerId]['total_score']) {
                    $playerScores[$playerId] = [
                        ...$playerScores[$playerId],
                        'total_score' => $round->total_score,
                        'achieved_date' => $round->created_at,
                    ];
                }
            }
        }

        // Sort by score (desc), then by date (asc for tie-breaker)
        $leaderboard = collect($playerScores)
            ->values()
            ->sortByDesc(function ($item) {
                return [$item['total_score'], $item['achieved_date']];
            })
            ->values()
            ->map(fn($item, $index) => [
                'rank' => $index + 1,
                'player_id' => $item['player_id'],
                'name' => $item['name'],
                'total_score' => $item['total_score'],
                'achieved_date' => $item['achieved_date'],
            ])
            ->take(10)
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'scope' => $scope,
                'period' => [
                    'start' => $scope === 'all_time' ? null : $now->copy()->subDays($scope === 'weekly' ? 7 : 30)->toIso8601String(),
                    'end' => $now->toIso8601String(),
                ],
                'top_players' => $leaderboard,
                'total' => $leaderboard->count(),
            ],
        ]);
    }
}
