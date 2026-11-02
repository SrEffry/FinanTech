<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RF-04 / D6 (UX-04): el titular debe poder leer la política completa antes de aceptarla,
 * no solo el resumen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('identidad_politicas_tratamiento', function (Blueprint $table) {
            $table->longText('texto')->nullable()->after('resumen');
        });
    }

    public function down(): void
    {
        Schema::table('identidad_politicas_tratamiento', function (Blueprint $table) {
            $table->dropColumn('texto');
        });
    }
};
