<?php

namespace App\Modules\Evaluacion;

use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\ModuleServiceProvider;

class EvaluacionServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }

    public function register(): void
    {
        // Una sola lectura de los parámetros por petición, compartida por todos los módulos.
        $this->app->scoped(ParametrosVigentes::class);
    }
}
