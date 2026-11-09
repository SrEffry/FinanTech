<?php

use App\Modules\Evaluacion\Http\Controllers\DecisionController;
use App\Modules\Evaluacion\Http\Controllers\EvaluacionController;
use Illuminate\Support\Facades\Route;

// RF-08 / UC7 / UC10: solo la consola interna (RNF-05).
Route::middleware('rol:analista,oficial')->group(function () {
    Route::get('evaluacion/solicitudes/{solicitud}/evaluacion', [EvaluacionController::class, 'mostrar'])
        ->whereUuid('solicitud');
});

// RF-10 / UC10 (T15): solo el oficial decide; las reglas las verifica DecisionesCredito.
Route::middleware('rol:oficial')->prefix('evaluacion/decisiones')->group(function () {
    Route::get('contexto/{solicitud}', [DecisionController::class, 'contexto'])->whereUuid('solicitud');
    Route::post('/', [DecisionController::class, 'registrar']);
});
