<?php

namespace Database\Seeders;

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Database\Seeders\ReglasMotorSeeder;
use App\Modules\Identidad\Database\Seeders\CatalogosIdentidadSeeder;
use App\Modules\Identidad\Database\Seeders\CuentasDemoSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CatalogosIdentidadSeeder::class,
            CuentasDemoSeeder::class, // no hace nada en producción
            ParametrosCreditoSeeder::class,
            ReglasMotorSeeder::class, // RN-44: versión de reglas R-2026.10-1 del motor (T10)
        ]);
    }
}
