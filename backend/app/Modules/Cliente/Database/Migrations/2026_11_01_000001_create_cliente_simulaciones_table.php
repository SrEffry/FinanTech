<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RN-26: los valores simulados se conservan 30 días. Se guarda lo necesario para
 * reconstruir la simulación (producto, monto, plazo y versión de parámetros) y su
 * resultado principal; el plan completo se recalcula si hace falta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cliente_simulaciones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('usuario_id')->nullable()->index(); // null: visitante sin sesión (RF-05 FA-02)
            $table->string('producto_codigo', 40);
            $table->unsignedBigInteger('monto');
            $table->unsignedSmallInteger('plazo_meses');
            $table->string('version_parametros', 20);
            $table->decimal('tasa_ea', 5, 2);
            $table->unsignedBigInteger('cuota');
            $table->unsignedBigInteger('costo_total');
            $table->timestamp('creada_en');
            $table->timestamp('vigente_hasta')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cliente_simulaciones');
    }
};
