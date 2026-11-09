<?php

namespace App\Modules\Evaluacion;

use App\Modules\Evaluacion\Adapters\CentralRiesgoNoContratada;
use App\Modules\Evaluacion\Adapters\CentralRiesgoSimulada;
use App\Modules\Evaluacion\Adapters\SolicitudesEvaluablesOriginacion;
use App\Modules\Evaluacion\Contracts\CentralRiesgoService;
use App\Modules\Evaluacion\Contracts\SolicitudesEvaluables;
use App\Modules\Evaluacion\Listeners\EvaluarSolicitudRadicada;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\ModuleServiceProvider;
use App\Modules\Originacion\Events\SolicitudRadicada;
use Illuminate\Support\Facades\Event;

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

        // MR-003: el adaptador de la central se elige con SERVICIOS_EXTERNOS, sin cambiar código.
        $this->app->bind(CentralRiesgoService::class, fn ($app) => config('finantech.servicios_externos') !== 'real'
            ? $app->make(CentralRiesgoSimulada::class)
            : $app->make(CentralRiesgoNoContratada::class));

        // D15: la solicitud se lee y se mueve por la interfaz pública de Originacion.
        $this->app->bind(SolicitudesEvaluables::class, SolicitudesEvaluablesOriginacion::class);
    }

    public function boot(): void
    {
        // RF-08 paso 1: el motor consume el evento de solicitud radicada.
        Event::listen(SolicitudRadicada::class, EvaluarSolicitudRadicada::class);

        parent::boot();
    }
}
