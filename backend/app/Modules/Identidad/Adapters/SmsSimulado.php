<?php

namespace App\Modules\Identidad\Adapters;

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Mail\SmsSimuladoMail;
use App\Modules\Identidad\Services\Enmascarar;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Adaptador simulado (MR-003): no envía ningún SMS. Deja el mensaje en el log de la
 * aplicación y, fuera de producción, una copia en la bandeja de desarrollo (Mailpit),
 * marcada "[SMS SIMULADO] para •••• 1234", para leer los códigos sin abrir laravel.log.
 */
class SmsSimulado implements EnviadorSms
{
    public function enviar(string $telefono, string $mensaje): void
    {
        // RNF-06 (D-01): el celular va enmascarado; el código sí queda, para leerlo en desarrollo.
        $celular = Enmascarar::ultimosCuatro($telefono) ?? '••••';
        Log::info("[SMS SIMULADO] a {$celular}: {$mensaje}");

        $buzon = config('finantech.sms_simulado.buzon');
        if ($buzon && ! app()->isProduction()) {
            Mail::to($buzon)->send(new SmsSimuladoMail($celular, $mensaje));
        }
    }

    public function esSimulado(): bool
    {
        return true;
    }
}
