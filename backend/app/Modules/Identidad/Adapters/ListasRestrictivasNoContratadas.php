<?php

namespace App\Modules\Identidad\Adapters;

use App\Modules\Identidad\Contracts\ListasRestrictivasService;

/** Adaptador "real" sin proveedor contratado (MR-003): siempre "no disponible". */
class ListasRestrictivasNoContratadas implements ListasRestrictivasService
{
    public function consultar(array $titular, ?string $escenario = null): string
    {
        return self::NO_DISPONIBLE;
    }

    public function esSimulado(): bool
    {
        return false;
    }
}
