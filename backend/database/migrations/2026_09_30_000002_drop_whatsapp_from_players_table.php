<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hapus kolom whatsapp dari tabel players.
 *
 * Registrasi siswa sekarang hanya butuh Nama + Kelas/Rombel (siswa SD mendaftar
 * dari tablet bersama sekolah, tidak semua punya nomor HP sendiri).
 * Identitas pemain = nama + rombel, ditegakkan di StorePlayerRequest.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Fresh install (kolom tidak ada) — tidak perlu apa-apa.
        if (! Schema::hasColumn('players', 'whatsapp')) {
            return;
        }

        // Lepas index dulu supaya DROP COLUMN jalan di SQLite & MySQL.
        Schema::table('players', function (Blueprint $table) {
            try {
                $table->dropUnique('players_whatsapp_unique');
            } catch (\Throwable $e) {
                // index unique tidak ada — abaikan
            }

            try {
                $table->dropIndex('players_whatsapp_index');
            } catch (\Throwable $e) {
                // index biasa tidak ada — abaikan
            }
        });

        Schema::table('players', function (Blueprint $table) {
            $table->dropColumn('whatsapp');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('players', 'whatsapp')) {
            return;
        }

        Schema::table('players', function (Blueprint $table) {
            $table->string('whatsapp', 20)->nullable()->unique()->after('name');
        });
    }
};
