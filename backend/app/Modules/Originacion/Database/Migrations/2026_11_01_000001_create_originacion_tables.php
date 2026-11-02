<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Originacion (RF-06, RF-07). Tabla SOLICITUD con los ajustes de la corrección
 * E4, historial de estados de solo adición y secuencia del radicado por año (RN-29).
 *
 * `cliente_id` referencia al cliente de Identidad por identificador, sin llave foránea
 * física entre módulos (MR-002).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('originacion_solicitudes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('cliente_id')->index();
            $table->string('producto_codigo', 40);
            $table->unsignedBigInteger('monto');
            $table->unsignedSmallInteger('plazo_meses');
            $table->string('version_parametros', 20);
            $table->decimal('tasa_ea', 5, 2);
            $table->unsignedBigInteger('cuota_estimada');
            $table->string('estado', 30)->index();
            // RN-28: "cliente:producto" mientras la solicitud está activa y NULL cuando se cierra.
            // El índice único lo impone la base de datos, también ante peticiones simultáneas.
            $table->string('clave_activa', 80)->nullable()->unique();
            $table->string('radicado', 20)->nullable()->unique();         // RN-29
            $table->timestamp('radicada_en')->nullable();
            // E4: datos laborales y financieros (RN-41). Sin sexo, estado civil ni salud (RN-43).
            $table->string('ocupacion', 20)->nullable();
            $table->string('empleador', 120)->nullable();
            $table->unsignedSmallInteger('antiguedad_laboral_meses')->nullable();
            $table->unsignedBigInteger('ingreso_mensual')->nullable();
            $table->unsignedBigInteger('egreso_mensual')->nullable();
            // Referencia personal: solo nombre y celular, cifrados; sin parentesco (RN-43).
            $table->text('referencia_nombre')->nullable();
            $table->text('referencia_celular')->nullable();
            $table->boolean('acepta_consulta_centrales')->default(false); // RN-33
            $table->unsignedBigInteger('consentimiento_centrales_id')->nullable();
            $table->boolean('estado_sla_pausado')->default(false);        // UC8
            $table->timestamp('ultimo_acceso_en')->nullable();            // RN-31
            $table->timestamps();
            $table->index(['cliente_id', 'producto_codigo']);
        });

        Schema::create('originacion_historial_estados', function (Blueprint $table) {
            $table->id();
            $table->uuid('solicitud_id')->index();
            $table->string('estado_anterior', 30)->nullable();
            $table->string('estado_nuevo', 30);
            $table->foreignId('actor_usuario_id')->nullable();
            $table->string('motivo', 500)->nullable();
            $table->timestamp('registrado_en', 6);
            $table->foreign('solicitud_id')->references('id')->on('originacion_solicitudes');
        });

        // RN-29: un contador por año; el número nunca se reutiliza.
        Schema::create('originacion_secuencias_radicado', function (Blueprint $table) {
            $table->unsignedSmallInteger('anio')->primary();
            $table->unsignedInteger('ultimo');
        });

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER originacion_historial_estados_no_update BEFORE UPDATE ON originacion_historial_estados
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'originacion_historial_estados es de solo adicion';
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER originacion_historial_estados_no_delete BEFORE DELETE ON originacion_historial_estados
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'originacion_historial_estados es de solo adicion';
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('originacion_secuencias_radicado');
        Schema::dropIfExists('originacion_historial_estados');
        Schema::dropIfExists('originacion_solicitudes');
    }
};
