<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RF-01 pasos 6–8: el cliente solo se crea después de verificar correo y teléfono.
 * Mientras tanto, los datos capturados esperan aquí, cifrados.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_registros_pendientes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('datos');
            $table->char('num_documento_hash', 64)->index();
            $table->string('email', 160)->index();
            $table->string('codigo_email_hash');
            $table->string('codigo_telefono_hash');
            $table->unsignedTinyInteger('intentos')->default(0);
            $table->json('reenvios')->nullable();
            $table->timestamp('codigos_expiran_en');
            $table->timestamp('expira_en');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_registros_pendientes');
    }
};
