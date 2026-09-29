<?php

/*
|--------------------------------------------------------------------------
| Konfigurasi Papan Target — Shoot Points
|--------------------------------------------------------------------------
|
| Sumber kebenaran tunggal untuk layout papan. Dikonsumsi oleh:
|   - GET /api/v1/simulation/config  (game canvas di HP)
|   - Validasi skor (StoreGameRequest, SimulationController)
|   - Papan visual di dashboard admin
|
| PENTING: koordinat di bawah SENGAJA literal (bukan di-random saat runtime).
| Sebaran acak di-generate sekali dengan seed tetap lalu dibekukan di sini,
| supaya tata letak di layar admin selalu identik dengan papan fisik.
| Kalau alat fisik berubah, sesuaikan x/y/radius di file ini — frontend ikut
| otomatis karena membaca dari API.
|
| Sistem koordinat: satuan canvas internal 320x400, di-scale ke lebar layar.
|
*/

return [

    // Jumlah lemparan per sesi/ronde per pemain
    'max_attempts' => 5,

    // Radius default lubang (jackpot punya radius sendiri)
    'default_hole_radius' => 18,

    // 20 lubang berpoin: 1 jackpot (100) + 19 lubang lainnya.
    // Distribusi: 100x1, 50x2, 40x3, 30x4, 20x5, 15x1, 10x4
    'holes' => [
        ['id' => 'h01', 'x' => 201.4, 'y' => 155.0, 'points' => 100, 'color' => '#2563eb', 'radius' => 12, 'is_jackpot' => true],
        ['id' => 'h02', 'x' => 141.0, 'y' => 225.1, 'points' => 20,  'color' => '#ef4444'],
        ['id' => 'h03', 'x' => 229.1, 'y' => 212.7, 'points' => 15,  'color' => '#06b6d4'],
        ['id' => 'h04', 'x' => 238.1, 'y' => 256.3, 'points' => 20,  'color' => '#f97316'],
        ['id' => 'h05', 'x' => 190.2, 'y' => 247.2, 'points' => 10,  'color' => '#eab308'],
        ['id' => 'h06', 'x' => 252.4, 'y' => 137.2, 'points' => 20,  'color' => '#22c55e'],
        ['id' => 'h07', 'x' => 142.8, 'y' => 106.3, 'points' => 40,  'color' => '#14b8a6'],
        ['id' => 'h08', 'x' => 103.5, 'y' => 314.9, 'points' => 10,  'color' => '#3b82f6'],
        ['id' => 'h09', 'x' => 102.9, 'y' => 130.8, 'points' => 50,  'color' => '#6366f1'],
        ['id' => 'h10', 'x' => 173.8, 'y' => 293.8, 'points' => 20,  'color' => '#a855f7'],
        ['id' => 'h11', 'x' => 266.1, 'y' => 296.4, 'points' => 10,  'color' => '#ec4899'],
        ['id' => 'h12', 'x' => 63.8,  'y' => 248.6, 'points' => 40,  'color' => '#84cc16'],
        ['id' => 'h13', 'x' => 66.9,  'y' => 97.3,  'points' => 30,  'color' => '#ef4444'],
        ['id' => 'h14', 'x' => 144.6, 'y' => 169.8, 'points' => 20,  'color' => '#f97316'],
        ['id' => 'h15', 'x' => 51.1,  'y' => 198.8, 'points' => 30,  'color' => '#eab308'],
        ['id' => 'h16', 'x' => 90.2,  'y' => 177.7, 'points' => 30,  'color' => '#22c55e'],
        ['id' => 'h17', 'x' => 187.7, 'y' => 73.3,  'points' => 40,  'color' => '#14b8a6'],
        ['id' => 'h18', 'x' => 265.2, 'y' => 83.6,  'points' => 50,  'color' => '#3b82f6'],
        ['id' => 'h19', 'x' => 116.4, 'y' => 271.3, 'points' => 30,  'color' => '#6366f1'],
        ['id' => 'h20', 'x' => 102.4, 'y' => 72.5,  'points' => 10,  'color' => '#a855f7'],
    ],

    // Area papan & posisi awal bola di canvas game simulasi.
    // Canvas ditinggikan (400 -> 500) supaya ada ruang tarik slingshot
    // di bawah bola; papan tetap di posisi yang sama.
    // Ruang tarik = 500 - 415 = 85px, sama dengan max_pull.
    'canvas' => [
        'width'      => 320,
        'height'     => 500,
        'board'      => ['x' => 24, 'y' => 44, 'width' => 272, 'height' => 296],
        'ball_start' => ['x' => 160, 'y' => 415],
        'ball_radius' => 11,
    ],

    // Parameter lemparan — mekanisme SLINGSHOT (seperti ketapel/Angry Birds):
    // pemain menarik bola ke arah berlawanan dari target, lalu melepas.
    //
    // Jarak bola ke lubang: terdekat ~80px, terjauh ~350px.
    // max_pull(85) x power_multiplier(4.2) = 357px -> seluruh papan terjangkau
    // bahkan dengan tarikan lurus ke bawah (ruang tarik 85px).
    'physics' => [
        'aim_mode'         => 'slingshot',
        'min_pull'         => 12,   // di bawah ini dianggap batal (cegah tap tak sengaja)
        'max_pull'         => 85,   // tarikan lebih panjang tidak menambah power
        'power_multiplier' => 4.2,  // jarak tempuh = panjang tarikan x nilai ini
        'aim_drift'        => 12,   // sebaran acak (px) supaya tetap butuh keahlian

        // Ambang warna power bar (rasio terhadap max_pull)
        'power_levels' => [
            ['max' => 0.35, 'color' => '#22c55e', 'label' => 'Lemah'],
            ['max' => 0.70, 'color' => '#f59e0b', 'label' => 'Sedang'],
            ['max' => 1.00, 'color' => '#ef4444', 'label' => 'Kuat'],
        ],
    ],

];
