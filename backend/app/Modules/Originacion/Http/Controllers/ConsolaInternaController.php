<?php

namespace App\Modules\Originacion\Http\Controllers;

use App\Modules\Identidad\Services\SesionActual;
use App\Modules\Originacion\Services\ConsolaInterna;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * V3 (backend-senior, P9, D23): bandeja y expediente de la consola interna (RF-07, RF-10).
 * Las rutas exigen sesión y rol interno; la cola sale del rol de la sesión (RNF-05).
 */
class ConsolaInternaController
{
    public function __construct(
        private readonly ConsolaInterna $consola,
        private readonly SesionActual $sesion,
    ) {}

    public function bandeja(Request $request): JsonResponse
    {
        $filtros = $request->validate([
            'estado' => ['nullable', 'string', 'max:30'],
            'producto' => ['nullable', 'string', 'max:80'],
            'monto_min' => ['nullable', 'integer', 'min:0'],
            'monto_max' => ['nullable', 'integer', 'min:0'],
        ]);

        return response()->json($this->consola->bandeja($this->sesion->exigir('analista', 'oficial'), $filtros));
    }

    public function expediente(string $solicitud): JsonResponse
    {
        $this->sesion->exigir('analista', 'oficial');

        return response()->json($this->consola->expediente($solicitud));
    }
}
