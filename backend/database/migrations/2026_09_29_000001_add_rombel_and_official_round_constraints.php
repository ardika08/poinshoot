<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->string('rombel', 10)->nullable()->after('whatsapp')->index();
        });

        // Satu ronde resmi per mode ditegakkan di controller. Tidak memakai
        // unique index agar data dev lama yang sudah punya duplikat tidak rusak.
        // Database produksi mulai kosong dan tetap dibatasi controller.
    }

    public function down(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->dropIndex(['rombel']);
            $table->dropColumn('rombel');
        });
    }
};
