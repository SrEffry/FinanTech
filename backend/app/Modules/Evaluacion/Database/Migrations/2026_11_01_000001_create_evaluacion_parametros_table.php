<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Versiones de parámetros de crédito (REGLA_VERSION de la corrección E4, F-ADM-02).
 *
 * Cada versión `P-AAAA.MM-n` fija la tasa máxima legal, los umbrales del motor y el
 * catálogo de productos con su tasa y sus rangos. Es la fuente única del catálogo:
 * la simulación (Cliente) y la solicitud (Originacion) la leen por el servicio público
 * ParametrosVigentes. Es de solo adición: una evaluación debe poder reproducirse con la
 * versión que aplicó (RN-44), así que una versión publicada nunca cambia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluacion_parametros', function (Blueprint $table) {
            $table->id();
            $table->string('version', 20)->unique();
            $table->timestamp('vigente_desde')->index();
            $table->foreignId('publicado_por_id')->nullable();
            $table->string('publicado_por', 160);
            $table->decimal('tasa_maxima_legal_ea', 5, 2);       // RN-23
            $table->unsignedSmallInteger('umbral_aprobar');       // RN-40: ≥ aprueba
            $table->unsignedSmallInteger('umbral_negar');         // RN-40: < niega
            $table->decimal('limite_cuota_ingreso', 5, 2);       // RN-41: % del ingreso disponible
            $table->json('productos');
            $table->timestamp('registrado_en', 6);
        });

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER evaluacion_parametros_no_update BEFORE UPDATE ON evaluacion_parametros
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'evaluacion_parametros es de solo adicion (RN-44)';
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER evaluacion_parametros_no_delete BEFORE DELETE ON evaluacion_parametros
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'evaluacion_parametros es de solo adicion (RN-44)';
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluacion_parametros');
    }
};
