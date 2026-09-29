<?php

namespace App\Support;

/**
 * Akses terpusat ke konfigurasi papan target (config/board.php).
 *
 * Semua validasi skor dan endpoint config membaca dari sini, supaya
 * layout papan hanya didefinisikan di satu tempat.
 */
class BoardConfig
{
    /**
     * Semua lubang dengan field lengkap (radius & flag terisi default).
     *
     * @return array<int, array{
     *     id: string, x: float, y: float, radius: int, points: int,
     *     color: string, is_jackpot: bool
     * }>
     */
    public static function holes(): array
    {
        $defaultRadius = (int) config('board.default_hole_radius', 18);

        return array_map(static fn (array $hole): array => [
            'id'         => $hole['id'],
            'x'          => (float) $hole['x'],
            'y'          => (float) $hole['y'],
            'radius'     => (int) ($hole['radius'] ?? $defaultRadius),
            'points'     => (int) $hole['points'],
            'color'      => $hole['color'],
            'is_jackpot' => (bool) ($hole['is_jackpot'] ?? false),
        ], config('board.holes', []));
    }

    /**
     * Cari satu lubang berdasarkan id. Null kalau tidak dikenal.
     */
    public static function find(?string $id): ?array
    {
        if ($id === null || $id === '') {
            return null;
        }

        foreach (self::holes() as $hole) {
            if ($hole['id'] === $id) {
                return $hole;
            }
        }

        return null;
    }

    /**
     * Daftar id lubang valid — dipakai untuk Rule::in().
     *
     * @return array<int, string>
     */
    public static function ids(): array
    {
        return array_column(config('board.holes', []), 'id');
    }

    /**
     * Poin resmi sebuah lubang. Null kalau lubang tidak dikenal.
     */
    public static function pointsFor(?string $id): ?int
    {
        return self::find($id)['points'] ?? null;
    }

    public static function maxAttempts(): int
    {
        return (int) config('board.max_attempts', 5);
    }

    /**
     * Skor maksimal yang mungkin dicapai dalam satu ronde.
     */
    public static function maxRoundScore(): int
    {
        $points = array_column(self::holes(), 'points');

        return ($points ? max($points) : 0) * self::maxAttempts();
    }
}
