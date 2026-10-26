<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RNF-08: bitácora inmutable de operaciones sensibles. La base de datos
 * rechaza UPDATE y DELETE, de modo que ningún rol puede alterarla (CP0010).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('identidad_auditoria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->nullable()->index();
            $table->string('accion', 60);
            $table->string('entidad', 60)->nullable();
            $table->string('id_entidad', 60)->nullable();
            $table->string('resultado', 20);
            $table->string('origen_ip', 45)->nullable();
            $table->json('detalle')->nullable();
            $table->boolean('modo_simulado')->default(false);
            $table->timestamp('registrado_en', 6)->index();
            $table->index(['entidad', 'id_entidad']);
        });

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER identidad_auditoria_no_update BEFORE UPDATE ON identidad_auditoria
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identidad_auditoria es de solo adicion (RNF-08)';
        SQL);
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER identidad_auditoria_no_delete BEFORE DELETE ON identidad_auditoria
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'identidad_auditoria es de solo adicion (RNF-08)';
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('identidad_auditoria');
    }
};
