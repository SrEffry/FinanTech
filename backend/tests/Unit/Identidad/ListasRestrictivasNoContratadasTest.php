<?php

/*
 * MR-003: en modo real sin proveedor contratado, las listas restrictivas responden siempre
 * "no disponible" y no se presentan como simuladas (cobertura señalada por qa-senior, 02/11).
 */

use App\Modules\Identidad\Adapters\ListasRestrictivasNoContratadas;
use App\Modules\Identidad\Contracts\ListasRestrictivasService;

it('sin proveedor contratado responde no disponible para cualquier titular y escenario, y no es simulado', function () {
    $listas = new ListasRestrictivasNoContratadas;

    expect($listas->consultar(['tipo_documento' => 'CC', 'num_documento' => '1000000008']))
        ->toBe(ListasRestrictivasService::NO_DISPONIBLE)
        ->and($listas->consultar([], 'coincidencia'))->toBe(ListasRestrictivasService::NO_DISPONIBLE)
        ->and($listas->esSimulado())->toBeFalse();
});
