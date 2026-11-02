<?php

namespace App\Modules\Identidad\Adapters;

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Services\Enmascarar;
use Illuminate\Support\Facades\Log;

/**
 * Adaptador simulado: no envía nada, deja el mensaje en el log de la aplicación
 * para que el equipo pueda leer los códigos en desarrollo y en demostraciones.
 */
class SmsSimulado implements EnviadorSms
{
    public function enviar(string $telefono, string $mensaje): void
    {
        // RNF-06 (D-01): el celular va enmascarado; el código sí queda, para leerlo en desarrollo.
        Log::info('[SMS SIMULADO] a '.Enmascarar::ultimosCuatro($telefono).': '.$mensaje);
    }

    public function esSimulado(): bool
    {
        return true;
    }
}
