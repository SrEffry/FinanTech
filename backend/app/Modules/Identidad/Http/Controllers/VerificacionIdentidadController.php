<?php

namespace App\Modules\Identidad\Http\Controllers;

use App\Modules\Identidad\Adapters\VerificacionIdentidadSimulada;
use App\Modules\Identidad\Services\SesionActual;
use App\Modules\Identidad\Services\VerificacionIdentidadCliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** RF-02: verificación de identidad del cliente con su propia sesión. */
class VerificacionIdentidadController
{
    public function __construct(
        private readonly VerificacionIdentidadCliente $verificacion,
        private readonly SesionActual $sesion,
    ) {}

    public function mostrar(): JsonResponse
    {
        return response()->json($this->verificacion->estado($this->sesion->exigirClienteId()));
    }

    public function verificar(Request $request): JsonResponse
    {
        $imagen = ['required', 'file', 'mimes:jpg,jpeg,png', 'max:10240'];
        $datos = $request->validate([
            'documento_frente' => $imagen,
            'documento_reverso' => $imagen,
            'rostro' => $imagen,
            // MR-003: solo lo usa el adaptador simulado; con proveedores reales se ignora.
            'escenario' => ['nullable', 'string', Rule::in(VerificacionIdentidadSimulada::ESCENARIOS)],
        ], [
            'documento_frente.required' => 'Falta la foto del frente del documento.',
            'documento_reverso.required' => 'Falta la foto del reverso del documento.',
            'rostro.required' => 'Falta la foto de tu rostro.',
            '*.mimes' => 'La foto debe ser JPG o PNG.',
            '*.max' => 'La foto no puede pesar más de 10 MB.',
        ]);

        return response()->json($this->verificacion->verificar(
            $this->sesion->exigirClienteId(),
            [
                'documento_frente' => $request->file('documento_frente'),
                'documento_reverso' => $request->file('documento_reverso'),
                'rostro' => $request->file('rostro'),
            ],
            $datos['escenario'] ?? null,
        ));
    }
}
