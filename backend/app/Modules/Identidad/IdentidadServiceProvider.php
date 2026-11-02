<?php

namespace App\Modules\Identidad;

use App\Modules\Identidad\Adapters\ListasRestrictivasNoContratadas;
use App\Modules\Identidad\Adapters\ListasRestrictivasSimuladas;
use App\Modules\Identidad\Adapters\SmsSimulado;
use App\Modules\Identidad\Adapters\VerificacionIdentidadNoContratada;
use App\Modules\Identidad\Adapters\VerificacionIdentidadSimulada;
use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Contracts\ListasRestrictivasService;
use App\Modules\Identidad\Contracts\VerificacionIdentidadService;
use App\Modules\ModuleServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class IdentidadServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }

    public function register(): void
    {
        // Todavía no hay proveedor de SMS contratado: en todos los modos se usa el simulado.
        $this->app->bind(EnviadorSms::class, SmsSimulado::class);

        // MR-003: el adaptador se elige con SERVICIOS_EXTERNOS, sin cambiar código.
        $simulado = fn () => config('finantech.servicios_externos') !== 'real';
        $this->app->bind(VerificacionIdentidadService::class, fn ($app) => $simulado()
            ? $app->make(VerificacionIdentidadSimulada::class)
            : $app->make(VerificacionIdentidadNoContratada::class));
        $this->app->bind(ListasRestrictivasService::class, fn ($app) => $simulado()
            ? $app->make(ListasRestrictivasSimuladas::class)
            : $app->make(ListasRestrictivasNoContratadas::class));
    }

    public function boot(): void
    {
        // El middleware de sesión (AutenticarSesion en el grupo api y los alias `sesion` y
        // `rol`) se registra en bootstrap/app.php, que es donde el kernel HTTP lo lee.

        // Límites por IP; el bloqueo por cuenta (RN-12) es aparte y no depende de la IP.
        RateLimiter::for('identidad-sesion', fn (Request $request) => Limit::perMinute(30)->by('sesion|'.$request->ip()));
        RateLimiter::for('identidad-verificacion', fn (Request $request) => Limit::perMinute(10)->by('verificacion|'.$request->ip()));
        RateLimiter::for('identidad-recuperacion',fn (Request $request) => Limit::perMinute(5)->by('recuperacion|'.$request->ip()));

        parent::boot();
    }
}
