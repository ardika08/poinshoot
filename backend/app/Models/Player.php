<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Player extends Model
{
    protected $fillable = [
        'name',
        'rombel',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function games(): HasMany
    {
        return $this->hasMany(Game::class);
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(Round::class);
    }

    public function bestRound(): ?Round
    {
        return $this->rounds()->orderByDesc('total_score')->first();
    }

    public function totalGames(): int
    {
        return $this->games()->count();
    }

    public function avgScore(): float
    {
        return (float) $this->rounds()->avg('total_score') ?? 0;
    }

    public function officialScore(string $mode): int
    {
        return (int) ($this->rounds()->where('game_mode', $mode)->value('total_score') ?? 0);
    }

    public function finalScore(): int
    {
        return $this->officialScore('manual') + $this->officialScore('simulation');
    }
}
