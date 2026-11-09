<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Motor de reglas (RF-08, T10).
 *
 * - evaluacion_reglas: REGLA_VERSION de la corrección E4. Cada versión `R-AAAA.MM-n` guarda la
 *   definición completa del puntaje (puntaje base, escala y tramos de cada variable), para que
 *   una evaluación se pueda reproducir años después (RN-44).
 * - evaluacion_evaluaciones: EVALUACION de E4. Resultado del motor con la versión de reglas y la
 *   de parámetros aplicadas, las variables determinantes, la capacidad de pago, las entradas
 *   exactas y la fuente de la central (real o simulada, MR-003). Una reevaluación es una fila
 *   nueva con la secuencia siguiente: nunca se pisa la anterior (RN-45).
 *
 * Las dos son de solo adición: trait SoloAdicion en el modelo y triggers aquí (RNF-08).
 * La solicitud se referencia por su id, sin llave foránea entre módulos (MR-002).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluacion_reglas', function (Blueprint $table) {
            $table->id();
            $table->string('version', 20)->unique();
            $table->timestamp('vigente_desde')->index();
            $table->string('publicada_por', 160);
            $table->json('definicion');
            $table->timestamp('registrado_en', 6);
        });

        Schema::create('evaluacion_evaluaciones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('solicitud_id');
            $table->unsignedSmallInteger('secuencia');            // RN-45: 1, 2… por solicitud
            $table->unsignedBigInteger('cliente_id')->index();
            $table->string('radicado', 20)->nullable();
            $table->string('version_reglas', 20);                 // RN-44
            $table->string('version_parametros', 20);             // RN-44 (umbrales y límite de cuota)
            $table->unsignedSmallInteger('puntaje');
            $table->unsignedSmallInteger('escala_min');
            $table->unsignedSmallInteger('escala_max');
            $table->string('nivel_riesgo', 10);
            $table->string('decision_sugerida', 10);              // aprobar | escalar | negar (RN-40)
            $table->string('causal', 40)->nullable();             // RF-08 FA-04
            $table->unsignedSmallInteger('umbral_aprobar');
            $table->unsignedSmallInteger('umbral_negar');
            $table->json('variables_determinantes');              // RF-08 paso 8
            $table->json('capacidad_pago');                       // RN-41
            $table->json('entradas');                             // para reproducirla (CP0013 paso 8)
            $table->string('fuente_central', 10);                 // simulada | real (MR-003)
            $table->timestamp('radicada_en')->nullable();
            $table->timestamp('evaluada_en', 6);
            $table->timestamp('registrado_en', 6);

            $table->unique(['solicitud_id', 'secuencia']);
        });

        foreach (['evaluacion_reglas', 'evaluacion_evaluaciones'] as $tabla) {
            DB::unprepared(<<<SQL
                CREATE TRIGGER {$tabla}_no_update BEFORE UPDATE ON {$tabla}
                FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$tabla} es de solo adicion (RN-44, RN-45)';
            SQL);
            DB::unprepared(<<<SQL
                CREATE TRIGGER {$tabla}_no_delete BEFORE DELETE ON {$tabla}
                FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$tabla} es de solo adicion (RN-44, RN-45)';
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluacion_evaluaciones');
        Schema::dropIfExists('evaluacion_reglas');
    }
};
