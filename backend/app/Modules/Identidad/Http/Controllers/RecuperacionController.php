<?php

namespace App\Modules\Identidad\Http\Controllers;

use App\Modules\Identidad\Services\InicioSesion;
use App\Modules\Identidad\Services\RecuperacionContrasena;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

/** Recuperación de contraseña (RF-03 FA-04). */
class RecuperacionController
{
    public const MENSAJE = 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. '
        .'Revisa tu bandeja de entrada y la de spam.';

    public function __construct(
        private readonly InicioSesion $inicio,
        private readonly RecuperacionContrasena $recuperacion,
    ) {}

    /** RN-17: siempre 202 con el mismo mensaje, exista o no el correo. */
    public function solicitar(Request $request): JsonResponse
    {
        $datos = $request->validate(['email' => ['required', 'string', 'max:160']]);

        $this->inicio->solicitarRecuperacion($datos['email'], $this->recuperacion);

        return response()->json(['mensaje' => self::MENSAJE], 202);
    }

    public function confirmar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'string', 'max:160'],
            'token' => ['required', 'string', 'max:100'],
            // RNF-05: la misma política de contraseñas del registro.
            'password' => ['required', 'confirmed', Password::min(10)->mixedCase()->numbers()->symbols()->uncompromised()],
        ]);

        $this->recuperacion->restablecer($datos['email'], $datos['token'], $datos['password']);

        return response()->json(['mensaje' => 'Listo. Ya puedes ingresar con tu contraseña nueva.']);
    }
}
