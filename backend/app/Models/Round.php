<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Round extends Model
{
    protected $fillable = [
        'player_id',
        'total_score',
        'attempts_count',
        'game_mode',
        'start_time',
        'end_time',
        'is_archived',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'total_score' => 'integer',
            'attempts_count' => 'integer',
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'is_archived' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    public function games(): HasMany
    {
        return $this->hasMany(Game::class);
    }

    public function complete(): void
    {
        $this->end_time = now();
        $this->total_score = $this->games()->sum('points');
        $this->attempts_count = $this->games()->count();
        $this->save();
    }
}
