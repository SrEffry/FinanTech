<?php

namespace App\Modules\Desembolso;

use App\Modules\Desembolso\Adapters\FirmaElectronicaNoContratada;
use App\Modules\Desembolso\Adapters\FirmaElectronicaSimulada;
use App\Modules\Desembolso\Contracts\FirmaElectronicaService;
use App\Modules\Desembolso\Listeners\EmitirOfertaAlAprobar;
use App\Modules\ModuleServiceProvider;
use Illuminate\Support\Facades\Event;

class DesembolsoServiceProvider extends ModuleServiceProvider
{
    /** Evento de Evaluacion que emite la oferta (V3/V4, P9). Se nombra como texto: D5. */
    public const EVENTO_DECISION = 'App\Modules\Evaluacion\Events\DecisionRegistrada';

    protected function modulePath(): string
    {
        return __DIR__;
    }

    public function register(): void
    {
        // MR-004: el adaptador se elige con SERVICIOS_EXTERNOS, sin cambiar código.
        $this->app->bind(FirmaElectronicaService::class, fn ($app) => config('finantech.servicios_externos') !== 'real'
            ? $app->make(FirmaElectronicaSimulada::class)
            : $app->make(FirmaElectronicaNoContratada::class));
    }

    public function boot(): void
    {
        parent::boot();

        Event::listen(self::EVENTO_DECISION, [EmitirOfertaAlAprobar::class, 'handle']);
    }
}
