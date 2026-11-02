<?php

namespace App\Modules\Identidad\Http\Controllers;

use App\Modules\Identidad\Services\Consentimientos;
use App\Modules\Identidad\Services\SesionActual;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** RF-04: "Mis datos y privacidad". Solo el titular, con su propia sesión. */
class ConsentimientoController
{
    public function __construct(
        private readonly Consentimientos $consentimientos,
        private readonly SesionActual $sesion,
    ) {}

    public function mostrar(): JsonResponse
    {
        return response()->json($this->consentimientos->estado($this->sesion->exigirClienteId()));
    }

    public function registrar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'finalidad' => ['required', 'string', 'max:40'],
            'accion' => ['required', 'string'],
            'canal' => ['sometimes', Rule::in(['web', 'movil'])],
        ]);

        return response()->json($this->consentimientos->registrar(
            $this->sesion->exigirClienteId(),
            $this->sesion->id(),
            $datos['finalidad'],
            $datos['accion'],
            $datos['canal'] ?? 'web',
        ));
    }
}
