<?php

namespace Database\Seeders;

use App\Modules\Identidad\Database\Seeders\CatalogosIdentidadSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CatalogosIdentidadSeeder::class,
        ]);
    }
}
