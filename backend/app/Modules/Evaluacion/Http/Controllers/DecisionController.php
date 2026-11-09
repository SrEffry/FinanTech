<?php

namespace App\Modules\Evaluacion\Http\Controllers;

use App\Modules\Evaluacion\Http\Requests\RegistrarDecisionRequest;
use App\Modules\Evaluacion\Services\DecisionesCredito;
use App\Modules\Identidad\Services\SesionActual;
use Illuminate\Http\JsonResponse;

/** RF-10 / UC10: decisión del oficial de crédito. La ruta exige el rol oficial (RNF-05). */
class DecisionController
{
    public function __construct(
        private readonly DecisionesCredito $decisiones,
        private readonly SesionActual $sesion,
    ) {}

    public function contexto(string $solicitud): JsonResponse
    {
        return response()->json($this->decisiones->contexto($solicitud, $this->sesion->exigir('oficial')));
    }

    public function registrar(RegistrarDecisionRequest $request): JsonResponse
    {
        return response()->json($this->decisiones->registrar($this->sesion->exigir('oficial'), $request->validated()), 201);
    }
}
