<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('players')->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->foreignId('round_id')->nullable()->constrained('rounds')->nullOnDelete();
            $table->unsignedTinyInteger('attempt_number'); // 1-5
            $table->boolean('is_successful')->default(false);
            $table->unsignedInteger('points')->default(0);
            $table->string('zone_name', 50)->nullable();
            $table->enum('game_mode', ['manual', 'simulation'])->default('manual');
            $table->string('device_info')->nullable();
            $table->timestamps();

            $table->index('player_id');
            $table->index('round_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('games');
    }
};
