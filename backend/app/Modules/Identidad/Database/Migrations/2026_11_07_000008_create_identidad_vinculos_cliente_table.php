<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RN-55: vínculos declarados entre un empleado y un cliente (familiar, socio u otro interés).
 * Quien tiene un vínculo con el cliente no decide sus solicitudes. Solo se guarda que el vínculo
 * existe: el tipo de relación no se registra y nunca llega al motor de reglas (RN-43).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_vinculos_cliente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('identidad_usuarios');
            $table->foreignId('cliente_id')->constrained('identidad_clientes');
            $table->timestamp('registrado_en', 6);
            $table->unique(['usuario_id', 'cliente_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_vinculos_cliente');
    }
};
