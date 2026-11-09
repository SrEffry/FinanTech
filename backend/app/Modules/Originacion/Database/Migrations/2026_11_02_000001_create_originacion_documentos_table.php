<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Documentos de soporte de la solicitud (RF-06 paso 5, RN-30, UC8).
 *
 * Una fila por documento requerido según la ocupación. El archivo se guarda cifrado en el
 * disco privado; su ruta y su nombre original se guardan cifrados (cast `encrypted`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('originacion_documentos', function (Blueprint $table) {
            $table->id();
            $table->uuid('solicitud_id');
            $table->string('tipo', 40);
            $table->boolean('requerido')->default(true);
            $table->string('estado', 12)->default('pendiente');   // pendiente, cargado, rechazado, aprobado
            $table->string('motivo_rechazo', 500)->nullable();     // UC8: lo escribe el analista (T17)
            $table->text('archivo_nombre')->nullable();            // cifrado
            $table->unsignedInteger('archivo_tamano')->nullable();
            $table->string('archivo_mime', 40)->nullable();
            $table->text('ruta')->nullable();                      // cifrada (RN-30)
            $table->char('huella_sha256', 64)->nullable();         // integridad del archivo recibido
            $table->timestamp('cargado_en')->nullable();
            $table->timestamps();
            $table->unique(['solicitud_id', 'tipo']);
            $table->foreign('solicitud_id')->references('id')->on('originacion_solicitudes');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('originacion_documentos');
    }
};
