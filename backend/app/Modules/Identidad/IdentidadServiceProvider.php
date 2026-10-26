<?php

namespace App\Modules\Identidad;

use App\Modules\Identidad\Adapters\SmsSimulado;
use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\ModuleServiceProvider;

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
    }
}
