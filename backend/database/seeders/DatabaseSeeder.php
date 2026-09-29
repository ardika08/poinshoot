<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Wajib selalu: akun admin default.
        $this->call([AdminSeeder::class]);

        // Data dummy hanya untuk dev — JANGAN jalankan di produksi.
        // Dev : php artisan db:seed --class=DummyDataSeeder
        // Prod: cukup AdminSeeder (DatabaseSeeder) saja, mulai kosong.
        if ($this->command->confirm('Seed data dummy juga? (dev saja)', false)) {
            $this->call([DummyDataSeeder::class]);
        }
    }
}
