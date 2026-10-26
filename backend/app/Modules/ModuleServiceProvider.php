<?php

namespace App\Modules;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Base de los módulos del monolito modular (MR-002).
 *
 * Cada módulo vive en app/Modules/<Nombre> y aporta sus propias migraciones
 * (Database/Migrations) y rutas de API (Routes/api.php), publicadas bajo /api/v1.
 */
abstract class ModuleServiceProvider extends ServiceProvider
{
    abstract protected function modulePath(): string;

    public function boot(): void
    {
        $migrations = $this->modulePath().'/Database/Migrations';
        if (is_dir($migrations)) {
            $this->loadMigrationsFrom($migrations);
        }

        $routes = $this->modulePath().'/Routes/api.php';
        if (is_file($routes) && ! $this->app->routesAreCached()) {
            Route::middleware('api')->prefix('api/v1')->group($routes);
        }
    }
}
