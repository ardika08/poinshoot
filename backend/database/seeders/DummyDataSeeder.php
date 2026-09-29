<?php

namespace Database\Seeders;

use App\Models\Game;
use App\Models\Player;
use App\Models\Round;
use App\Support\BoardConfig;
use Illuminate\Database\Seeder;

class DummyDataSeeder extends Seeder
{
    private const NAMES = [
        'Andi Pratama', 'Siti Nurhaliza', 'Rizky Bintang', 'Dewi Sartika', 'Budi Santoso',
        'Nabila Putri', 'Fajar Ramadhan', 'Intan Permata', 'Galih Saputra', 'Ayu Lestari',
        'Bayu Nugroho', 'Citra Maharani', 'Dimas Anggara', 'Eka Wijaya', 'Farhan Alfarizi',
        'Gita Savitri', 'Hendra Kusuma', 'Indah Sari', 'Joko Widodo Jr', 'Kirana Dewi',
    ];

    /** Peluang bola masuk salah satu lubang (sisanya meleset) */
    private const HIT_CHANCE = 65;

    public function run(): void
    {
        $maxAttempts = BoardConfig::maxAttempts();
        $weighted = $this->weightedHoles();
        $waCounter = 81234567800;

        foreach (self::NAMES as $i => $name) {
            $player = Player::create([
                'name' => $name,
                'whatsapp' => '0' . ($waCounter + $i),
                'is_active' => true,
                'created_at' => now()->subDays(rand(0, 45)),
            ]);

            $roundCount = rand(1, 4);

            for ($r = 0; $r < $roundCount; $r++) {
                $playedAt = now()->subDays(rand(0, 45))->subMinutes(rand(0, 600));
                $mode = rand(0, 1) ? 'manual' : 'simulation';

                $round = Round::create([
                    'player_id' => $player->id,
                    'total_score' => 0,
                    'attempts_count' => 0,
                    'game_mode' => $mode,
                    'start_time' => $playedAt,
                    'end_time' => $playedAt->copy()->addMinutes(3),
                    'is_archived' => false,
                    'created_at' => $playedAt,
                    'updated_at' => $playedAt,
                ]);

                $total = 0;

                for ($a = 1; $a <= $maxAttempts; $a++) {
                    $successful = rand(1, 100) <= self::HIT_CHANCE;
                    $hole = $successful ? $weighted[array_rand($weighted)] : null;
                    $points = $hole['points'] ?? 0;
                    $total += $points;

                    Game::create([
                        'player_id' => $player->id,
                        'admin_id' => $mode === 'manual' ? 1 : null,
                        'round_id' => $round->id,
                        'attempt_number' => $a,
                        'is_successful' => $hole !== null,
                        'points' => $points,
                        'zone_name' => $hole['id'] ?? null,
                        'game_mode' => $mode,
                        'created_at' => $playedAt->copy()->addSeconds($a * 30),
                        'updated_at' => $playedAt->copy()->addSeconds($a * 30),
                    ]);
                }

                $round->update(['total_score' => $total, 'attempts_count' => $maxAttempts]);
            }
        }

        $best = Round::max('total_score');

        $this->command->info('Dummy data seeded:');
        $this->command->info('  Players    : ' . Player::count());
        $this->command->info('  Rounds     : ' . Round::count());
        $this->command->info('  Games      : ' . Game::count());
        $this->command->info('  Best score : ' . $best . ' / ' . BoardConfig::maxRoundScore());
    }

    /**
     * Lubang bernilai kecil lebih sering kena daripada jackpot — biar
     * distribusi skor menyerupai permainan nyata.
     *
     * Bobot: 100 -> 1x, 50/40 -> 2x, 30/20 -> 4x, 15/10 -> 5x
     */
    private function weightedHoles(): array
    {
        $pool = [];

        foreach (BoardConfig::holes() as $hole) {
            $weight = match (true) {
                $hole['is_jackpot'] => 1,
                $hole['points'] >= 40 => 2,
                $hole['points'] >= 20 => 4,
                default => 5,
            };

            for ($i = 0; $i < $weight; $i++) {
                $pool[] = $hole;
            }
        }

        return $pool;
    }
}
