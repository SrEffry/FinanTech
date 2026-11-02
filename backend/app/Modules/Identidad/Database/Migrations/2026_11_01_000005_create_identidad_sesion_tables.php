<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RF-03 / RI-08: sesiones con token de acceso (15 min, RN-13) y token de renovación
 * (7 días con rotación, RN-14), desafíos del segundo factor (RN-15) y contador de
 * intentos fallidos por identificador, exista o no el usuario (RN-12, RN-17).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_sesiones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('usuario_id')->constrained('identidad_usuarios');
            // Solo se guarda la huella SHA-256 del token de renovación, nunca el token.
            $table->char('renovacion_hash', 64)->unique();
            $table->char('renovacion_anterior_hash', 64)->nullable()->index();
            $table->timestamp('rotada_en')->nullable();
            $table->timestamp('renovacion_expira_en');
            $table->timestamp('ultima_actividad_en');
            $table->string('canal', 20)->default('web');
            $table->string('origen_ip', 45)->nullable();
            $table->string('agente', 255)->nullable();
            $table->timestamp('cerrada_en')->nullable();
            $table->string('motivo_cierre', 40)->nullable();
            $table->timestamps();
            $table->index(['usuario_id', 'cerrada_en']);
        });

        Schema::create('identidad_desafios_mfa', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('usuario_id')->constrained('identidad_usuarios');
            $table->string('proposito', 30);
            $table->string('referencia', 60)->nullable();
            $table->string('codigo_hash');
            $table->unsignedTinyInteger('intentos')->default(0);
            $table->unsignedTinyInteger('reenvios')->default(0);
            $table->timestamp('expira_en');
            $table->timestamp('reenvio_disponible_en');
            $table->timestamps();
            $table->index(['usuario_id', 'proposito']);
        });

        Schema::create('identidad_intentos_acceso', function (Blueprint $table) {
            $table->id();
            // HMAC del correo normalizado: el contador corre igual para correos que no existen.
            $table->char('identificador_hash', 64)->unique();
            $table->unsignedTinyInteger('fallidos')->default(0);
            $table->timestamp('ultimo_fallo_en')->nullable();
            $table->timestamp('bloqueado_hasta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_intentos_acceso');
        Schema::dropIfExists('identidad_desafios_mfa');
        Schema::dropIfExists('identidad_sesiones');
    }
};
