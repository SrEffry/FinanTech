<?php

namespace Database\Seeders;

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
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
        ]);
    }
}
