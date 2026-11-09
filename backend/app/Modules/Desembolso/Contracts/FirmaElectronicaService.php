<?php

namespace App\Modules\Desembolso\Contracts;

/**
 * Firma electrónica del pagaré con sello de tiempo (RF-11, RN-62). MR-004: hay un
 * adaptador simulado y uno "real" sin proveedor contratado, elegidos con SERVICIOS_EXTERNOS.
 */
interface FirmaElectronicaService
{
    /**
     * Firma el documento a nombre del firmante.
     *
     * @return array{huella_sha256: string, sellado_en: string, simulada: bool, proveedor: string}
     *
     * @throws \App\Shared\Exceptions\ErrorNegocio 503 firma_no_disponible (RF-11 FA-03)
     */
    public function firmar(string $documento, string $firmante): array;

    public function esSimulado(): bool;
}
