<?php

namespace App\Modules\Identidad\Adapters;

use App\Modules\Identidad\Contracts\ListasRestrictivasService;

/** Adaptador simulado (MR-003): coincidencia positiva solo con el escenario `lista_restrictiva`. */
class ListasRestrictivasSimuladas implements ListasRestrictivasService
{
    public function consultar(array $titular, ?string $escenario = null): string
    {
        return $escenario === 'lista_restrictiva' ? self::COINCIDENCIA : self::SIN_COINCIDENCIA;
    }

    public function esSimulado(): bool
    {
        return true;
    }
}
