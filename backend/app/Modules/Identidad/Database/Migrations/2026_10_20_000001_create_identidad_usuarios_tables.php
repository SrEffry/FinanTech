<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identidad digital única: USUARIO es la credencial común de la que se
 * especializan CLIENTE y EMPLEADO (Capítulo 2, punto 1).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_roles', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 30)->unique();
            $table->string('nombre', 80);
            $table->string('descripcion')->nullable();
            $table->boolean('interno');
            $table->timestamps();
        });

        Schema::create('identidad_usuarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rol_id')->constrained('identidad_roles');
            $table->string('nombre_completo', 160);
            $table->string('email', 160)->unique();
            $table->timestamp('email_verificado_en')->nullable();
            $table->string('password');
            $table->boolean('mfa_activo')->default(true);
            $table->string('estado', 20)->default('activo');
            $table->unsignedTinyInteger('intentos_fallidos')->default(0);
            $table->timestamp('bloqueado_hasta')->nullable();
            $table->timestamp('password_cambiada_en')->nullable();
            $table->timestamp('ultimo_acceso_en')->nullable();
            $table->timestamps();
        });

        Schema::create('identidad_clientes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->unique()->constrained('identidad_usuarios');
            $table->string('tipo_documento', 4);
            // RNF-06: cifrado en reposo; la unicidad (RN-01) se verifica sobre un índice ciego HMAC.
            $table->text('num_documento');
            $table->char('num_documento_hash', 64)->unique();
            $table->string('nombres', 80);
            $table->string('apellidos', 80);
            $table->date('fecha_nacimiento');
            $table->string('telefono', 20);
            $table->timestamp('telefono_verificado_en')->nullable();
            $table->string('estado_kyc', 20)->default('pendiente');
            $table->timestamps();
        });

        Schema::create('identidad_empleados', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->unique()->constrained('identidad_usuarios');
            $table->string('cargo', 80);
            $table->string('area', 80);
            $table->decimal('atribucion_monto', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_empleados');
        Schema::dropIfExists('identidad_clientes');
        Schema::dropIfExists('identidad_usuarios');
        Schema::dropIfExists('identidad_roles');
    }
};
