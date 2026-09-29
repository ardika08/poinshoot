<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Admin extends Model
{
    protected $fillable = [
        'username',
        'password',
        'name',
        'auth_token',
        'token_expires_at',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'auth_token',
    ];

    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function games(): HasMany
    {
        return $this->hasMany(Game::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(AdminLog::class);
    }

    public function generateToken(): string
    {
        $token = Str::random(80);
        $this->auth_token = $token;
        $this->token_expires_at = now()->addMinutes(120); // 2 hour session
        $this->save();
        return $token;
    }

    public function isTokenValid(): bool
    {
        return $this->token_expires_at && $this->token_expires_at->isFuture();
    }

    public function clearToken(): void
    {
        $this->auth_token = null;
        $this->token_expires_at = null;
        $this->save();
    }
}
