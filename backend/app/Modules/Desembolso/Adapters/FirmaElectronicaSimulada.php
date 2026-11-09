<?php

namespace App\Modules\Desembolso\Adapters;

use App\Modules\Desembolso\Contracts\FirmaElectronicaService;

/**
 * MR-004 (OPC-11): calcula la huella SHA-256 del pagaré y emite un sello de tiempo local.
 * Todo sale marcado `simulada: true`: un pagaré firmado así no es un título valor.
 */
class FirmaElectronicaSimulada implements FirmaElectronicaService
{
    public function firmar(string $documento, string $firmante): array
    {
        $sello = now()->toIso8601String();

        return [
            'huella_sha256' => hash('sha256', "{$documento}\n{$firmante}\n{$sello}"),
            'sellado_en' => $sello,
            'simulada' => true,
            'proveedor' => 'simulado',
        ];
    }

    public function esSimulado(): bool
    {
        return true;
    }
}
