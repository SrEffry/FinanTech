<?php

namespace App\Modules\Desembolso\Adapters;

use App\Modules\Desembolso\Contracts\FirmaElectronicaService;
use App\Shared\Exceptions\ErrorNegocio;

/**
 * Adaptador "real" mientras no haya proveedor de firma contratado (MR-004). Responde
 * siempre "no disponible" (RF-11 FA-03): la oferta sigue vigente y nunca se presenta como
 * firmado un pagaré que no lo está. Con el contrato, aquí va la integración.
 */
class FirmaElectronicaNoContratada implements FirmaElectronicaService
{
    public function firmar(string $documento, string $firmante): array
    {
        throw new ErrorNegocio(
            'firma_no_disponible',
            'En este momento no podemos firmar el pagaré. Tu oferta sigue vigente: intenta de nuevo más tarde.',
            503,
        );
    }

    public function esSimulado(): bool
    {
        return false;
    }
}
