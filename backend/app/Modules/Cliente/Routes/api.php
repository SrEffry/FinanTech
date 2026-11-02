<?php

use App\Modules\Cliente\Http\Controllers\SimulacionController;
use Illuminate\Support\Facades\Route;

// RF-05: públicos (FA-02). El portal pide la simulación al soltar el deslizador, así que el
// límite es holgado para una persona y corta el abuso automatizado. El prefijo le da un
// contador propio: sin él compartiría el de las demás rutas con throttle (p. ej. el registro).
Route::middleware('throttle:60,1,simulador')->group(function () {
    Route::get('cliente/productos', [SimulacionController::class, 'productos']);
    Route::post('cliente/simulaciones', [SimulacionController::class, 'simular']);
});
