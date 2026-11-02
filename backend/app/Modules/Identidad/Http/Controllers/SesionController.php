<?php

namespace App\Modules\Identidad\Http\Controllers;

use App\Modules\Identidad\Models\DesafioMfa;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\Datos\UsuarioAutenticado;
use App\Modules\Identidad\Services\InicioSesion;
use App\Modules\Identidad\Services\SegundoFactor;
use App\Modules\Identidad\Services\Sesiones;
use App\Modules\Identidad\Services\SesionActual;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * RF-03: inicio de sesión con segundo factor, renovación y cierre (RN-12 a RN-17, RI-08).
 * Ningún token viaja en el cuerpo: solo en cookies httpOnly.
 */
class SesionController
{
    public function __construct(
        private readonly InicioSesion $inicio,
        private readonly SegundoFactor $segundoFactor,
        private readonly Sesiones $sesiones,
        private readonly SesionActual $sesionActual,
    ) {}

    /** Paso 1: credenciales → desafío del segundo factor (RN-15). */
    public function iniciar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'string', 'max:160'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        return response()->json($this->inicio->iniciar($datos['email'], $datos['password']));
    }

    /** Paso 2: código correcto → sesión abierta con sus cookies. */
    public function verificar(Request $request, string $desafio): JsonResponse
    {
        $datos = $request->validate(['codigo' => ['required', 'string', 'max:10']]);

        $usuarioId = $this->segundoFactor->verificar($desafio, trim($datos['codigo']), DesafioMfa::SESION);
        $usuario = Usuario::with('rol')->find($usuarioId);
        if (! $usuario || ! $usuario->estaActivo()) {
            throw new ErrorNegocio('codigo_vencido', 'El código venció. Vuelve a empezar.', 422);
        }

        $cookies = $this->sesiones->abrir($usuario, $request, $this->canal($request));

        return $this->conCookies(response()->json(['usuario' => UsuarioAutenticado::desde($usuario)->toArray()]), $cookies);
    }

    public function reenviar(string $desafio): JsonResponse
    {
        return response()->json($this->segundoFactor->reenviar($desafio, DesafioMfa::SESION));
    }

    /**
     * Sesión actual. Sin cookies responde 200 con usuario null; si el acceso venció pero
     * llega la cookie de renovación, 401 para que el portal renueve.
     */
    public function mostrar(Request $request): JsonResponse
    {
        $usuario = $this->sesionActual->usuario();
        if ($usuario) {
            return response()->json(['usuario' => $usuario->toArray()]);
        }

        if ($request->cookies->has(config('finantech.sesion.cookie_renovacion'))) {
            throw new ErrorNegocio('sin_sesion', SesionActual::SIN_SESION, 401);
        }

        return response()->json(['usuario' => null]);
    }

    /** RN-14: rota el token de renovación y emite un acceso nuevo. */
    public function renovar(Request $request): JsonResponse
    {
        $resultado = $this->sesiones->renovar($request->cookies->get(config('finantech.sesion.cookie_renovacion')));

        if ($resultado === null) {
            $error = (new ErrorNegocio('sin_sesion', SesionActual::SIN_SESION, 401))->render();

            return $this->conCookies($error, $this->sesiones->cookiesDeCierre());
        }

        [$usuario, $cookies] = $resultado;

        return $this->conCookies(response()->json(['usuario' => UsuarioAutenticado::desde($usuario)->toArray()]), $cookies);
    }

    /** Cierra la sesión en todos los canales (RF-03) y borra las cookies. Siempre 204. */
    public function cerrar(Request $request): Response
    {
        $usuarioId = Auth::id()
            ?? $this->sesiones->usuarioDeRenovacion($request->cookies->get(config('finantech.sesion.cookie_renovacion')));

        if ($usuarioId !== null) {
            $this->sesiones->cerrarTodas($usuarioId);
        }
        Auth::forgetUser();

        return $this->conCookies(response()->noContent(), $this->sesiones->cookiesDeCierre());
    }

    private function canal(Request $request): string
    {
        return $request->header('X-Canal') === 'movil' ? 'movil' : 'web';
    }

    /**
     * @template T of \Symfony\Component\HttpFoundation\Response
     *
     * @param  T  $respuesta
     * @param  list<Cookie>  $cookies
     * @return T
     */
    private function conCookies($respuesta, array $cookies)
    {
        foreach ($cookies as $cookie) {
            $respuesta->headers->setCookie($cookie);
        }

        return $respuesta;
    }
}
