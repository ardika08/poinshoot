<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminLoginRequest;
use App\Models\Admin;
use App\Models\AdminLog;
use App\Models\Game;
use App\Models\Player;
use App\Models\Round;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    /**
     * POST /api/v1/admin/login
     */
    public function login(AdminLoginRequest $request)
    {
        $admin = Admin::where('username', $request->validated('username'))->first();

        if (! $admin || ! Hash::check($request->validated('password'), $admin->password)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CREDENTIALS',
                    'message' => 'Username atau password salah',
                ],
            ], 401);
        }

        if (! $admin->is_active) {
            AdminLog::log($admin, 'login_failed', null, ['reason' => 'account_disabled']);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCOUNT_DISABLED',
                    'message' => 'Akun admin dinonaktifkan',
                ],
            ], 403);
        }

        $token = $admin->generateToken();
        AdminLog::log($admin, 'login');

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'expires_at' => $admin->token_expires_at?->toIso8601String(),
                'admin' => [
                    'id' => $admin->id,
                    'username' => $admin->username,
                    'name' => $admin->name,
                ],
            ],
            'message' => 'Login berhasil',
        ]);
    }

    /**
     * POST /api/v1/admin/logout
     */
    public function logout(Request $request)
    {
        /** @var Admin $admin */
        $admin = $request->attributes->get('current_admin');

        AdminLog::log($admin, 'logout');
        $admin->clearToken();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil',
        ]);
    }

    /**
     * GET /api/v1/admin/me — verifikasi token masih valid
     */
    public function me(Request $request)
    {
        /** @var Admin $admin */
        $admin = $request->attributes->get('current_admin');

        return response()->json([
            'success' => true,
            'data' => [
                'admin' => [
                    'id' => $admin->id,
                    'username' => $admin->username,
                    'name' => $admin->name,
                ],
                'expires_at' => $admin->token_expires_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/players — list pemain + search + pagination
     */
    public function players(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $rombel = strtoupper(trim((string) $request->query('rombel', '')));
        $perPage = min((int) $request->query('per_page', 20), 100);

        $query = Player::query()->with(['rounds' => fn ($q) => $q->select('id', 'player_id', 'game_mode', 'total_score')]);

        if ($rombel !== '') {
            $query->where('rombel', $rombel);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('whatsapp', 'like', "%{$search}%");
            });
        }

        $players = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'players' => collect($players->items())->map(function ($p) {
                    $manualRound = $p->rounds->firstWhere('game_mode', 'manual');
                    $simulationRound = $p->rounds->firstWhere('game_mode', 'simulation');
                    $manual = (int) ($manualRound?->total_score ?? 0);
                    $simulation = (int) ($simulationRound?->total_score ?? 0);
                    return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'whatsapp' => $p->whatsapp,
                    'rombel' => $p->rombel,
                    'rounds_count' => $p->rounds->count(),
                    'manual_score' => $manual,
                    'simulation_score' => $simulation,
                    'final_score' => $manual + $simulation,
                    'completion_status' => ($manualRound && $simulationRound) ? 'complete' : (($manualRound || $simulationRound) ? 'partial' : 'not_started'),
                    'is_active' => $p->is_active,
                    'created_at' => $p->created_at?->toIso8601String(),
                ]; }),
                'pagination' => [
                    'current_page' => $players->currentPage(),
                    'last_page' => $players->lastPage(),
                    'per_page' => $players->perPage(),
                    'total' => $players->total(),
                ],
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/stats — statistik dashboard
     */
    public function stats()
    {
        $totalPlayers = Player::count();
        $activeToday = Round::whereDate('created_at', today())->distinct('player_id')->count('player_id');
        $totalRounds = Round::count();
        $avgScore = round((float) Round::where('attempts_count', '>', 0)->avg('total_score'), 1);

        $topPerformers = Round::selectRaw('player_id, COUNT(*) as count')
            ->groupBy('player_id')
            ->orderByDesc('count')
            ->limit(3)
            ->with('player:id,name')
            ->get()
            ->map(fn ($r) => [
                'name' => $r->player->name ?? 'Unknown',
                'count' => (int) $r->count,
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'total_players' => $totalPlayers,
                'active_today' => $activeToday,
                'total_rounds' => $totalRounds,
                'avg_score' => $avgScore,
                'total_games' => Game::count(),
                'top_performers' => $topPerformers,
            ],
        ]);
    }

    /**
     * GET /api/v1/admin/logs — audit trail
     */
    public function logs(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 30), 100);

        $logs = AdminLog::orderByDesc('created_at')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'logs' => collect($logs->items())->map(fn ($l) => [
                    'id' => $l->id,
                    'admin_username' => $l->admin_username,
                    'action' => $l->action,
                    'target_id' => $l->target_id,
                    'details' => $l->details,
                    'ip_address' => $l->ip_address,
                    'created_at' => $l->created_at?->toIso8601String(),
                ]),
                'pagination' => [
                    'current_page' => $logs->currentPage(),
                    'last_page' => $logs->lastPage(),
                    'total' => $logs->total(),
                ],
            ],
        ]);
    }
}
