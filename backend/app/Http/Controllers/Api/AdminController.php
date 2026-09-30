<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminImportPlayersRequest;
use App\Http\Requests\AdminLoginRequest;
use App\Http\Requests\AdminStorePlayersRequest;
use App\Models\Admin;
use App\Models\AdminLog;
use App\Models\Game;
use App\Models\Player;
use App\Models\Round;
use App\Services\StudentListParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

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
        $perPage = min((int) $request->query('per_page', 100), 1000);

        $query = Player::query()->with(['rounds' => fn ($q) => $q->select('id', 'player_id', 'game_mode', 'total_score')]);

        if ($rombel !== '') {
            $query->where('rombel', $rombel);
        }

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
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
     * POST /api/v1/admin/players — tambah siswa dari dashboard (admin).
     *
     * Dipakai untuk menyiapkan daftar nama+rombel sebelum acara, supaya:
     * - guru bisa input skor manual di lapangan A walau siswa belum pernah
     *   membuka app (akun sudah ada),
     * - siswa di lapangan B tinggal memilih namanya dari daftar.
     *
     * Idempotent: nama+rombel yang sudah ada tidak dibuat ulang, hanya
     * dilaporkan sebagai duplikat. Nama < 3 karakter dilaporkan sebagai invalid.
     */
    public function storePlayers(AdminStorePlayersRequest $request)
    {
        $rombel = $request->validated('rombel');
        $names = $request->validated('names');

        $pairs = array_map(
            fn ($name) => ['name' => (string) $name, 'rombel' => $rombel],
            $names
        );

        $result = $this->persistStudentRecords($pairs);

        $totalInRombel = Player::where('rombel', $rombel)->count();

        /** @var Admin $admin */
        $admin = $request->attributes->get('current_admin');

        AdminLog::log($admin, 'add_players', null, [
            'rombel' => $rombel,
            'added' => count($result['added']),
            'duplicate' => count($result['duplicate']),
            'invalid' => count($result['invalid']),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'rombel' => $rombel,
                'added' => count($result['added']),
                'duplicate' => count($result['duplicate']),
                'invalid' => count($result['invalid']),
                'added_names' => $result['added'],
                'duplicate_names' => $result['duplicate'],
                'invalid_names' => $result['invalid'],
                'total_in_rombel' => $totalInRombel,
            ],
            'message' => count($result['added']).' siswa ditambahkan ke rombel '.$rombel,
        ], 201);
    }

    /**
     * POST /api/v1/admin/players/import — tambah banyak siswa sekaligus.
     *
     * Menerima tempelan dari Excel / Google Sheets ATAU unggahan berkas
     * (.xlsx / .csv / .txt). Rombel boleh ikut di dalam data — satu file bisa
     * memuat beberapa rombel sekaligus — atau diambil dari `rombel` sebagai
     * nilai bawaan untuk baris yang tidak menyebut rombelnya.
     *
     * Idempotent seperti storePlayers: nama+rombel yang sudah ada dilaporkan
     * sebagai duplikat, bukan error.
     */
    public function importPlayers(AdminImportPlayersRequest $request)
    {
        $parser = app(StudentListParser::class);
        $dryRun = $request->boolean('dry_run');
        $hasFile = $request->hasFile('file');

        try {
            $rows = $hasFile
                ? $parser->rowsFromFile($request->file('file'))
                : $parser->rowsFromText((string) $request->input('text', ''));
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'IMPORT_UNREADABLE',
                    'message' => $e->getMessage(),
                ],
            ], 422);
        }

        $parsed = $parser->normalize($rows, $request->input('rombel'));

        if ($parsed['records'] === [] && $parsed['invalid'] === []) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'IMPORT_EMPTY',
                    'message' => 'Tidak ada nama siswa yang terbaca. Pastikan ada kolom nama, '
                        .'dan kolom rombel — atau pilih rombel dulu di atas.',
                ],
            ], 422);
        }

        $result = $this->persistStudentRecords($parsed['records'], $dryRun);

        // Siswa yang namanya terbaca tapi rombelnya tidak diketahui
        $invalidNames = array_merge($result['invalid'], array_column($parsed['invalid'], 'name'));

        // Jumlah per rombel: berguna untuk memastikan operator menempel ke
        // rombel yang benar sebelum menyimpan.
        $byRombel = [];

        foreach ($parsed['records'] as $record) {
            $byRombel[$record['rombel']] = ($byRombel[$record['rombel']] ?? 0) + 1;
        }

        ksort($byRombel);

        if (! $dryRun) {
            /** @var Admin $admin */
            $admin = $request->attributes->get('current_admin');

            AdminLog::log($admin, 'import_players', null, [
                'source' => $hasFile ? 'file' : 'paste',
                'filename' => $hasFile ? $request->file('file')->getClientOriginalName() : null,
                'added' => count($result['added']),
                'duplicate' => count($result['duplicate']),
                'invalid' => count($invalidNames),
                'by_rombel' => $byRombel,
            ]);
        }

        $addedCount = count($result['added']);

        return response()->json([
            'success' => true,
            'data' => [
                'dry_run' => $dryRun,
                'added' => $addedCount,
                'duplicate' => count($result['duplicate']),
                'invalid' => count($invalidNames),
                'by_rombel' => $byRombel,
                'added_names' => $result['added'],
                'duplicate_names' => $result['duplicate'],
                // Dibatasi supaya respons tidak membengkak untuk daftar panjang
                'invalid_names' => array_slice($invalidNames, 0, 20),
                'total_rows' => count($parsed['records']),
            ],
            'message' => $dryRun
                ? $addedCount.' siswa siap ditambahkan — belum disimpan'
                : $addedCount.' siswa ditambahkan',
        ], $dryRun ? 200 : 201);
    }

    /**
     * Simpan pasangan nama+rombel ke tabel players.
     *
     * Dipakai bersama oleh storePlayers (satu rombel) dan importPlayers
     * (banyak rombel) supaya aturannya persis sama:
     * - nama < 3 karakter dilaporkan invalid,
     * - nama+rombel yang sudah ada (atau kembar di dalam satu kiriman)
     *   dilaporkan sebagai duplikat, bukan error,
     * - `$dryRun` melakukan semua pemeriksaan tanpa menulis apa pun, supaya
     *   operator bisa melihat hasilnya dulu sebelum menyimpan.
     *
     * @param  array<int, array{name: string, rombel: string}>  $pairs
     * @return array{added: array<int, string>, duplicate: array<int, string>, invalid: array<int, string>}
     */
    private function persistStudentRecords(array $pairs, bool $dryRun = false): array
    {
        $added = [];
        $duplicates = [];
        $invalid = [];
        $seen = [];

        $process = function () use ($pairs, $dryRun, &$added, &$duplicates, &$invalid, &$seen) {
            foreach ($pairs as $pair) {
                $name = trim((string) ($pair['name'] ?? ''));
                $rombel = trim((string) ($pair['rombel'] ?? ''));
                $key = $rombel.'|'.mb_strtolower($name);

                if (mb_strlen($name) < 3) {
                    $invalid[] = $name;

                    continue;
                }

                // Nama sama dua kali di dalam satu kiriman
                if (isset($seen[$key])) {
                    $duplicates[] = $name;

                    continue;
                }

                $seen[$key] = true;

                $exists = Player::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->where('rombel', $rombel)
                    ->exists();

                if ($exists) {
                    $duplicates[] = $name;

                    continue;
                }

                if (! $dryRun) {
                    Player::create([
                        'name' => $name,
                        'rombel' => $rombel,
                        'is_active' => true,
                    ]);
                }

                $added[] = $name;
            }
        };

        // Pemeriksaan (dry run) tidak menulis apa pun, jadi tidak perlu transaksi
        $dryRun ? $process() : DB::transaction($process);

        return ['added' => $added, 'duplicate' => $duplicates, 'invalid' => $invalid];
    }

    /**
     * DELETE /api/v1/admin/players/{id} — hapus pemain beserta seluruh riwayatnya.
     *
     * Dipakai untuk membuang data uji atau salah input (mis. siswa salah rombel).
     * Ronde dan game ikut dihapus — kalau tidak, baris yatim masih terbaca
     * leaderboard dan skornya jadi "hantu" yang tak bisa dibersihkan dari UI.
     */
    public function destroyPlayer(Request $request, string $id)
    {
        /** @var Admin $admin */
        $admin = $request->attributes->get('current_admin');

        $player = Player::withCount(['rounds', 'games'])->find($id);

        if (! $player) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'PLAYER_NOT_FOUND', 'message' => 'Pemain tidak ditemukan'],
            ], 404);
        }

        $deleted = [
            'player_id' => $player->id,
            'name' => $player->name,
            'rombel' => $player->rombel,
            'rounds' => $player->rounds_count,
            'games' => $player->games_count,
        ];

        AdminLog::log($admin, 'delete_player', $player->id, $deleted);

        DB::transaction(function () use ($player) {
            $player->games()->delete();
            $player->rounds()->delete();
            $player->delete();
        });

        return response()->json([
            'success' => true,
            'data' => $deleted,
            'message' => 'Pemain '.$deleted['name'].' beserta riwayatnya dihapus',
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
