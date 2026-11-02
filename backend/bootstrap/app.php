<?php

use App\Modules\Identidad\Http\Middleware\AutenticarSesion;
use App\Modules\Identidad\Http\Middleware\ExigirRol;
use App\Modules\Identidad\Http\Middleware\ExigirSesion;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use App\Shared\Exceptions\ErrorNegocio;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// RNF-06 (D-02): las trazas de excepción no guardan los argumentos de las funciones
// (contraseñas, códigos). También va en docker/php/php.ini cuando se reconstruya la imagen.
ini_set('zend.exception_ignore_args', '1');

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // RI-08: toda petición de /api se identifica por la cookie httpOnly del token de acceso.
        $middleware->api(append: AutenticarSesion::class);

        // RNF-05: autorización en el servidor. En las rutas de cualquier módulo:
        // ->middleware('sesion') o ->middleware('rol:analista,oficial').
        $middleware->alias([
            'sesion' => ExigirSesion::class,
            'rol' => ExigirRol::class,
        ]);

        // 401/403 antes de resolver los modelos de la ruta: un 404 no debe revelar qué existe.
        foreach ([AutenticarSesion::class, ExigirSesion::class, ExigirRol::class] as $sesion) {
            $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: $sesion);
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // RNF-06 (D-02): un error de negocio es una respuesta esperada, no un fallo de la
        // aplicación: no se escribe en el log (su traza llevaría contraseñas o códigos).
        $exceptions->dontReport(ErrorNegocio::class);

        // RNF-07 (D-03): un 404 no expone nombres internos (clase del modelo, ruta).
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'codigo' => 'no_encontrado',
                    'mensaje' => 'No encontramos lo que buscas. Puede que ya no exista.',
                ], 404);
            }
        });
    })->create();
