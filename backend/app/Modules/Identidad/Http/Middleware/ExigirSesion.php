<?php

namespace App\Modules\Identidad\Http\Middleware;

use App\Modules\Identidad\Services\SesionActual;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Alias `sesion`: sin sesión responde 401 `sin_sesion` (RNF-05). */
class ExigirSesion
{
    public function __construct(private readonly SesionActual $sesion) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->sesion->exigir();

        return $next($request);
    }
}
