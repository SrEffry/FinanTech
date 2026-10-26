<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RF-04: consentimiento por finalidad. El histórico es de solo adición (RN-21):
 * cada otorgamiento o revocación es una fila nueva, y la base de datos rechaza
 * cualquier UPDATE o DELETE sobre ella.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_politicas_tratamiento', function (Blueprint $table) {
            $table->id();
            $table->string('version', 20)->unique();
            $table->date('vigente_desde');
            $table->text('resumen');
            $table->timestamps();
        });

        Schema::create('identidad_finalidades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('politica_id')->constrained('identidad_politicas_tratamiento');
            $table->string('codigo', 40);
            $table->string('nombre', 120);
            $table->text('descripcion');
            $table->boolean('necesaria');
            $table->unsignedSmallInteger('orden')->default(0);
            $table->unique(['politica_id', 'codigo']);
        });

        Schema::create('identidad_consentimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('identidad_clientes');
            $table->string('finalidad_codigo', 40);
            $table->string('accion', 10);
            $table->string('version_politica', 20);
            $table->string('canal', 20);
            $table->timestamp('registrado_en', 6);
            $table->index(['cliente_id', 'finalidad_codigo', 'registrado_en'], 'consentimientos_vigente_idx');
        });

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER identidad_consentimientos_no_update BEFORE UPDATE ON identidad_consentimientos
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identidad_consentimientos es de solo adicion (RN-21)';
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER identidad_consentimientos_no_delete BEFORE DELETE ON identidad_consentimientos
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identidad_consentimientos es de solo adicion (RN-21)';
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_consentimientos');
        Schema::dropIfExists('identidad_finalidades');
        Schema::dropIfExists('identidad_politicas_tratamiento');
    }
};
