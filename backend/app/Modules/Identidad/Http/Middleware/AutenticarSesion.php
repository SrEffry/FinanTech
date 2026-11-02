<?php

namespace App\Modules\Identidad\Http\Middleware;

use App\Modules\Identidad\Services\Sesiones;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Identifica al usuario de cada petición de /api a partir de la cookie httpOnly con el
 * token de acceso (RI-08). No rechaza nada: de eso se encargan los alias `sesion` y `rol`.
 *
 * Defensa contra CSRF además de SameSite=Lax: una petición que modifica datos solo se
 * autentica si trae la cabecera X-Requested-With, que un formulario de otro sitio no
 * puede enviar y que el navegador no deja agregar sin CORS.
 */
class AutenticarSesion
{
    public const ATRIBUTO_SESION = 'identidad.sesion_id';

    public function __construct(private readonly Sesiones $sesiones) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookies->get(config('finantech.sesion.cookie_acceso'));

        if (is_string($token) && $token !== '') {
            $resuelto = $this->sesiones->resolverAcceso($token);

            if ($resuelto && ! $request->isMethodSafe() && $request->header('X-Requested-With') !== 'XMLHttpRequest') {
                $resuelto = null;
            }

            if ($resuelto) {
                [$usuario, $sesion] = $resuelto;
                Auth::setUser($usuario);
                $request->attributes->set(self::ATRIBUTO_SESION, $sesion->id);
            } else {
                Auth::forgetUser();
            }
        }

        return $next($request);
    }
}
