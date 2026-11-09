<?php

use App\Modules\Identidad\Http\Controllers\ConsentimientoController;
use App\Modules\Identidad\Http\Controllers\RecuperacionController;
use App\Modules\Identidad\Http\Controllers\RegistroClienteController;
use App\Modules\Identidad\Http\Controllers\SesionController;
use App\Modules\Identidad\Http\Controllers\SistemaController;
use App\Modules\Identidad\Http\Controllers\VerificacionIdentidadController;
use Illuminate\Support\Facades\Route;

Route::get('sistema/estado', [SistemaController::class, 'estado']);

Route::get('identidad/politica-vigente', [RegistroClienteController::class, 'politicaVigente']);

// RF-01 (RNF-07): límite por IP con contador propio, que no comparte con otras rutas (D8)
Route::middleware('throttle:identidad-registro')->group(function () {
    Route::post('clientes/registro', [RegistroClienteController::class, 'iniciar']);
    Route::post('clientes/registro/{registro}/reenviar', [RegistroClienteController::class, 'reenviar']);
    Route::post('clientes/registro/{registro}/verificar', [RegistroClienteController::class, 'verificar']);
});

// RF-03: inicio de sesión con segundo factor (RN-12 a RN-17, RI-08)
Route::middleware('throttle:identidad-sesion')->group(function () {
    Route::post('identidad/sesiones', [SesionController::class, 'iniciar']);
    Route::post('identidad/sesiones/{desafio}/verificar', [SesionController::class, 'verificar']);
    Route::post('identidad/sesiones/{desafio}/reenviar', [SesionController::class, 'reenviar']);
    Route::post('identidad/sesion/renovar', [SesionController::class, 'renovar']);
});
Route::get('identidad/sesion', [SesionController::class, 'mostrar']);
Route::delete('identidad/sesion', [SesionController::class, 'cerrar']);

// RF-02 y RF-04: solo el titular, con su sesión
Route::middleware('rol:cliente')->group(function () {
    Route::get('clientes/verificacion-identidad', [VerificacionIdentidadController::class, 'mostrar']);
    Route::post('clientes/verificacion-identidad', [VerificacionIdentidadController::class, 'verificar'])
        ->middleware('throttle:identidad-verificacion');
    Route::get('identidad/consentimientos', [ConsentimientoController::class, 'mostrar']);
    Route::post('identidad/consentimientos', [ConsentimientoController::class, 'registrar']);
});

// RF-03 FA-04
Route::middleware('throttle:identidad-recuperacion')->group(function () {
    Route::post('identidad/recuperacion', [RecuperacionController::class, 'solicitar']);
    Route::post('identidad/recuperacion/confirmar', [RecuperacionController::class, 'confirmar']);
});
