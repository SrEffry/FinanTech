<?php

namespace App\Modules\Identidad\Contracts;

/**
 * Proveedor de mensajería de texto (dependencia externa, sección 6.5.2).
 */
interface EnviadorSms
{
    public function enviar(string $telefono, string $mensaje): void;

    public function esSimulado(): bool;
}
