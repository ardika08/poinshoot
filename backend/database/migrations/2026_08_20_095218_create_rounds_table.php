<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('players')->cascadeOnDelete();
            $table->unsignedInteger('total_score')->default(0);
            $table->unsignedTinyInteger('attempts_count')->default(5);
            $table->enum('game_mode', ['manual', 'simulation'])->default('manual');
            $table->timestamp('start_time')->useCurrent();
            $table->timestamp('end_time')->nullable();
            $table->boolean('is_archived')->default(false);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index('player_id');
            $table->index('total_score');
            $table->index('created_at');
            $table->index('is_archived');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rounds');
    }
};
