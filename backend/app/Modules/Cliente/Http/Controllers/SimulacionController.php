<?php

namespace App\Modules\Cliente\Http\Controllers;

use App\Modules\Cliente\Http\Requests\SimularCreditoRequest;
use App\Modules\Cliente\Services\SimuladorCredito;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

/** RF-05: catálogo y simulador, abiertos también al visitante sin sesión (FA-02). */
class SimulacionController
{
    public function __construct(private readonly SimuladorCredito $simulador) {}

    public function productos(): JsonResponse
    {
        return response()->json($this->simulador->productos());
    }

    public function simular(SimularCreditoRequest $request): JsonResponse
    {
        $datos = $request->validated();

        return response()->json($this->simulador->simular(
            $datos['producto'],
            (int) $datos['monto'],
            (int) $datos['plazo_meses'],
            Auth::id(),
        ));
    }
}
