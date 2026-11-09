<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * OFERTA (corrección E4): condiciones definitivas tras la aprobación, vigentes 15 días
 * (RN-59), y el pagaré con su evidencia de firma (RN-62, MR-004).
 *
 * La solicitud y la decisión se referencian por identificador, sin llave foránea física
 * entre módulos (MR-002). `decision_id` es único: la misma decisión no emite dos ofertas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('desembolso_ofertas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('solicitud_id')->index();
            $table->string('decision_id', 64)->unique();
            $table->unsignedBigInteger('cliente_id')->index();
            $table->string('radicado', 20);
            $table->string('producto_codigo', 40);
            $table->string('version_parametros', 20);
            $table->unsignedBigInteger('monto');
            $table->unsignedSmallInteger('plazo_meses');
            $table->decimal('tasa_ea', 5, 2);
            $table->unsignedBigInteger('cuota');
            $table->unsignedBigInteger('costo_total');
            $table->unsignedBigInteger('valor_a_recibir');
            $table->json('desglose');
            $table->json('plan');
            $table->json('condiciones_originales')->nullable();
            $table->string('motivo_condicion', 500)->nullable();
            $table->string('estado', 12)->index();          // vigente, firmada, rechazada, vencida
            $table->timestamp('emitida_en');
            $table->timestamp('vence_en');
            $table->string('pagare_version', 10);
            $table->text('pagare_texto');                     // cifrado: lleva el nombre del deudor
            $table->char('firma_huella_sha256', 64)->nullable();
            $table->timestamp('firma_sellada_en')->nullable();
            $table->boolean('firma_simulada')->nullable();    // MR-004
            $table->string('firma_proveedor', 40)->nullable();
            $table->timestamp('cerrada_en')->nullable();      // firmada, rechazada o vencida
            $table->string('motivo_rechazo', 500)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('desembolso_ofertas');
    }
};
