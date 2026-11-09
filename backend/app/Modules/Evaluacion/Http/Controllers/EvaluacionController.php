<?php

namespace App\Modules\Evaluacion\Http\Controllers;

use App\Modules\Evaluacion\Services\Evaluaciones;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Http\JsonResponse;

class EvaluacionController
{
    public function __construct(private readonly Evaluaciones $evaluaciones) {}

    /** UC7 / UC10: el expediente muestra el resultado del motor, siempre con su versión de reglas (RN-44). */
    public function mostrar(string $solicitud): JsonResponse
    {
        $evaluacion = $this->evaluaciones->ultima($solicitud)
            ?? throw new ErrorNegocio(
                'sin_evaluacion',
                'Esta solicitud no tiene evaluación automática. Puede que la central de riesgo no haya respondido y pasara a estudio manual.',
                404,
            );

        return response()->json($evaluacion);
    }
}
