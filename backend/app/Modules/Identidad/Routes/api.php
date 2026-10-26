<?php

use App\Modules\Identidad\Http\Controllers\RegistroClienteController;
use Illuminate\Support\Facades\Route;

Route::get('identidad/politica-vigente', [RegistroClienteController::class, 'politicaVigente']);

// RF-01
Route::middleware('throttle:10,1')->group(function () {
    Route::post('clientes/registro', [RegistroClienteController::class, 'iniciar']);
    Route::post('clientes/registro/{registro}/reenviar', [RegistroClienteController::class, 'reenviar']);
    Route::post('clientes/registro/{registro}/verificar', [RegistroClienteController::class, 'verificar']);
});
