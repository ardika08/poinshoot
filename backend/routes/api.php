<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\SimulationController;

/*
|--------------------------------------------------------------------------
| API Routes — Shoot Points
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // ---------- PUBLIC ----------
    Route::post('/players', [PlayerController::class, 'store']);
    Route::get('/players/lookup', [PlayerController::class, 'lookup']);
    // Daftar nama per rombel — dipakai lapangan B: siswa pilih nama, tidak mengetik
    Route::get('/players/roster', [PlayerController::class, 'roster']);
    Route::get('/players/{id}', [PlayerController::class, 'show'])->whereNumber('id');
    Route::put('/players/{id}', [PlayerController::class, 'update'])->whereNumber('id');

    Route::get('/leaderboard/{scope}', [LeaderboardController::class, 'index'])
        ->where('scope', 'all_time|weekly|monthly');

    // Statistik publik untuk homepage (angka agregat saja, tanpa data personal)
    Route::get('/stats', [LeaderboardController::class, 'publicStats']);

    // Mode 2: game simulasi di HP (tanpa login)
    Route::get('/simulation/config', [SimulationController::class, 'config']);
    Route::post('/simulation/rounds', [SimulationController::class, 'store']);

    // ---------- ADMIN ----------
    Route::prefix('admin')->group(function () {
        Route::post('/login', [AdminController::class, 'login']);

        Route::middleware('admin')->group(function () {
            Route::post('/logout', [AdminController::class, 'logout']);
            Route::get('/me', [AdminController::class, 'me']);

            Route::get('/stats', [AdminController::class, 'stats']);
            Route::get('/players', [AdminController::class, 'players']);
            // Tambah siswa manual (satu atau banyak sekaligus) sebelum acara
            Route::post('/players', [AdminController::class, 'storePlayers']);
            // Import massal: tempel dari Excel atau unggah .xlsx/.csv
            Route::post('/players/import', [AdminController::class, 'importPlayers']);
            Route::get('/logs', [AdminController::class, 'logs']);

            // Mode 1: input skor manual
            Route::post('/games', [GameController::class, 'store']);
            Route::get('/games/recent', [GameController::class, 'recent']);
            Route::get('/games/player/{playerId}', [GameController::class, 'index'])->whereNumber('playerId');

            Route::delete('/rounds/{id}', [GameController::class, 'destroyRound'])->whereNumber('id');
        });
    });
});
