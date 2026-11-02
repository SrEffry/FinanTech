<?php

namespace App\Modules\Identidad\Http\Middleware;

use App\Modules\Identidad\Services\SesionActual;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alias `rol`: `->middleware('rol:analista,oficial')`. Sin sesión, 401 `sin_sesion`;
 * con otro rol, 403 `sin_permiso` (RBAC en el servidor, RNF-05).
 */
class ExigirRol
{
    public function __construct(private readonly SesionActual $sesion) {}

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $this->sesion->exigir(...$roles);

        return $next($request);
    }
}
