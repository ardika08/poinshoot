<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Game extends Model
{
    protected $fillable = [
        'player_id',
        'admin_id',
        'round_id',
        'attempt_number',
        'is_successful',
        'points',
        'zone_name',
        'game_mode',
        'device_info',
    ];

    protected function casts(): array
    {
        return [
            'is_successful' => 'boolean',
            'attempt_number' => 'integer',
            'points' => 'integer',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class);
    }

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }
}
