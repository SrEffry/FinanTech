<?php

use App\Modules\Desembolso\Http\Controllers\OfertaController;
use Illuminate\Support\Facades\Route;

// RF-11: oferta y pagaré, solo el cliente titular con su sesión (RNF-05).
Route::middleware(['sesion', 'rol:cliente'])->prefix('desembolso/ofertas')->group(function () {
    Route::get('{oferta}', [OfertaController::class, 'mostrar']);
    // RN-61: el código del segundo factor sale al correo; el contador propio frena el abuso.
    Route::post('{oferta}/desafio-mfa', [OfertaController::class, 'desafio'])->middleware('throttle:10,1,oferta-mfa');
    Route::post('{oferta}/aceptar', [OfertaController::class, 'aceptar'])->middleware('throttle:20,1,oferta-aceptar');
    Route::post('{oferta}/rechazar', [OfertaController::class, 'rechazar']);
});
