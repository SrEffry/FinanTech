<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RF-02: cada intento de verificación de identidad es una fila nueva (solo adición,
 * evidencia de conocimiento del cliente). Las rutas de las imágenes van cifradas y las
 * imágenes también (RN-09, RNF-06). El resultado de listas restrictivas se guarda pero
 * nunca sale al cliente (RN-10).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_verificaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('identidad_clientes');
            $table->string('resultado', 20);          // verificado, revision_manual, ilegible, en_cola, no_continua
            $table->decimal('coincidencia', 4, 3)->nullable();
            $table->string('listas_restrictivas', 20)->nullable();
            $table->string('motivo', 60)->nullable();
            $table->string('escenario', 30)->nullable();
            $table->boolean('modo_simulado');
            $table->text('rutas_imagenes')->nullable(); // cifrado
            $table->timestamp('registrado_en', 6);
            $table->index(['cliente_id', 'registrado_en']);
        });

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER identidad_verificaciones_no_update BEFORE UPDATE ON identidad_verificaciones
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identidad_verificaciones es de solo adicion (RF-02)';
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER identidad_verificaciones_no_delete BEFORE DELETE ON identidad_verificaciones
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identidad_verificaciones es de solo adicion (RF-02)';
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_verificaciones');
    }
};
