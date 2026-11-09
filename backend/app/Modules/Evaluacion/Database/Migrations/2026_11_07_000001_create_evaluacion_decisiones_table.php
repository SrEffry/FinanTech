<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * DECISION de E4 (RF-10, T15). Cada decisión sobre una solicitud, humana o automática del motor,
 * con su motivo (RN-54), su autor y la atribución con la que decidió (RN-53), y las condiciones
 * aprobadas (RN-57). Es de solo adición: trait SoloAdicion en el modelo y triggers aquí (RN-58).
 * La solicitud se referencia por su id, sin llave foránea entre módulos (MR-002).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluacion_decisiones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('solicitud_id')->index();
            $table->unsignedBigInteger('cliente_id');
            $table->string('radicado', 20)->nullable();
            $table->uuid('evaluacion_id')->nullable();
            $table->string('resultado', 25);                      // aprobada | aprobada_condicionada | negada | comite
            $table->string('motivo', 1000);                       // RN-54
            $table->boolean('automatizada');                      // RN-46: decisión del motor
            $table->unsignedBigInteger('autor_usuario_id')->nullable()->index();
            $table->string('autor_nombre', 160);
            $table->unsignedBigInteger('atribucion_monto')->nullable(); // RN-53, la vigente al decidir
            $table->unsignedBigInteger('monto')->nullable();      // condiciones aprobadas
            $table->unsignedSmallInteger('plazo_meses')->nullable();
            $table->decimal('tasa_ea', 5, 2)->nullable();
            $table->boolean('condicionada')->default(false);
            $table->string('estado_resultante', 30);
            $table->timestamp('registrado_en', 6);
        });

        foreach (['UPDATE' => 'update', 'DELETE' => 'delete'] as $operacion => $sufijo) {
            DB::unprepared(<<<SQL
                CREATE TRIGGER evaluacion_decisiones_no_{$sufijo} BEFORE {$operacion} ON evaluacion_decisiones
                FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'evaluacion_decisiones es de solo adicion (RN-58)';
            SQL);
        }
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS evaluacion_decisiones_no_update');
        DB::unprepared('DROP TRIGGER IF EXISTS evaluacion_decisiones_no_delete');
        Schema::dropIfExists('evaluacion_decisiones');
    }
};
