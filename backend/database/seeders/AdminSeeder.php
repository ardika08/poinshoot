<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // updateOrCreate = idempotent: aman dijalankan berkali-kali
        // (redeploy Coolify re-seed tanpa crash UNIQUE constraint).
        Admin::updateOrCreate(
            ['username' => 'admin'],
            [
                'password' => Hash::make('admin123'),
                'name' => 'Administrator',
                'is_active' => true,
            ]
        );

        $this->command->info('Admin account ready! (admin / admin123)');
    }
}
