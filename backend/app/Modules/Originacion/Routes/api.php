<?php

use App\Modules\Originacion\Http\Controllers\ConsolaInternaController;
use App\Modules\Originacion\Http\Controllers\ExplicacionDecisionController;
use App\Modules\Originacion\Http\Controllers\SolicitudClienteController;
use Illuminate\Support\Facades\Route;

// RF-06 y RF-07: solo el cliente titular, con su sesión (RNF-05, RN-35).
// `decision` y `reconsideraciones` llegan con T16 y T23.
Route::middleware(['sesion', 'rol:cliente'])->prefix('originacion/solicitudes')->group(function () {
    Route::get('/', [SolicitudClienteController::class, 'listar']);
    Route::post('/', [SolicitudClienteController::class, 'crear']);
    Route::get('{solicitud}', [SolicitudClienteController::class, 'mostrar']);
    Route::patch('{solicitud}', [SolicitudClienteController::class, 'actualizar']);
    // RN-30: el contador propio evita que la carga de archivos comparta límite con otras rutas.
    Route::post('{solicitud}/documentos', [SolicitudClienteController::class, 'cargarDocumento'])
        ->middleware('throttle:30,1,originacion-documentos');
    Route::post('{solicitud}/radicar', [SolicitudClienteController::class, 'radicar']);
    Route::post('{solicitud}/enviar-documentos', [SolicitudClienteController::class, 'enviarDocumentos']);
});

// D26 (backend-senior, P9): RF-09, explicación de la decisión para su titular (RN-35). `reconsideraciones` llega con T23.
Route::middleware(['sesion', 'rol:cliente'])->prefix('originacion/solicitudes')->group(function () {
    Route::get('{solicitud}/decision', [ExplicacionDecisionController::class, 'mostrar']);
});

// V3 (backend-senior, P9): consola interna mínima (RF-07, RF-10, D23). Bandeja por rol y expediente.
Route::middleware(['sesion', 'rol:analista,oficial'])->prefix('originacion')->group(function () {
    Route::get('bandeja', [ConsolaInternaController::class, 'bandeja']);
    Route::get('expedientes/{solicitud}', [ConsolaInternaController::class, 'expediente'])->whereUuid('solicitud');
});
