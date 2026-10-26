<?php

use App\Modules\Identidad\Database\Seeders\CatalogosIdentidadSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->beforeEach(fn () => $this->seed(CatalogosIdentidadSeeder::class))
    ->in('Feature');
