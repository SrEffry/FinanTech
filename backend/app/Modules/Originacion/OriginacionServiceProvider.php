<?php

namespace App\Modules\Originacion;

use App\Modules\ModuleServiceProvider;
use App\Modules\Originacion\Adapters\DirectorioClientesIdentidad;
use App\Modules\Originacion\Contracts\DirectorioClientes;

class OriginacionServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }

    public function register(): void
    {
        // Datos del cliente a través de la interfaz pública de Identidad (D3, CP0002).
        $this->app->bind(DirectorioClientes::class, DirectorioClientesIdentidad::class);
    }
}
