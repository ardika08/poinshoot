<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Batas laju request untuk endpoint yang bisa diakses publik.
     * Kuncinya per-IP (lewat header proxy Vercel) supaya satu siswa
     * yang spam tidak memblokir siswa lain.
     */
    protected function configureRateLimiting(): void
    {
        // Login admin: batasi per kombinasi username+IP agar tidak bisa
        // ditebak berulang kali (brute force), plus batas total per IP.
        RateLimiter::for('login', function (Request $request) {
            $username = Str::lower((string) $request->input('username', ''));

            return [
                Limit::perMinute(5)->by($username . '|' . $request->ip()),
                Limit::perMinute(20)->by($request->ip()),
            ];
        });

        // Endpoint baca publik (leaderboard, stats, roster, lookup).
        // Dashboard admin melakukan polling 6x/menit, jadi 120/menit aman.
        RateLimiter::for('public-api', function (Request $request) {
            return Limit::perMinute(120)->by($request->ip());
        });

        // Kirim hasil simulasi: satu siswa hanya punya satu ronde resmi,
        // tapi tetap dibatasi supaya tidak bisa di-spam.
        RateLimiter::for('sim-round', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // Pendaftaran/pencarian pemain: dipakai berulang saat acara
        // (satu kelas mendaftar), jadi longgar tapi tetap terbatas.
        RateLimiter::for('player-write', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
