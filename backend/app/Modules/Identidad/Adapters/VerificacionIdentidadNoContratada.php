<?php

namespace App\Modules\Identidad\Adapters;

use App\Modules\Identidad\Contracts\VerificacionIdentidadService;

/**
 * Adaptador "real" mientras no haya proveedor contratado (MR-003). Responde siempre
 * "no disponible": con SERVICIOS_EXTERNOS=real la verificación queda en cola (RF-02 FA-03)
 * y nunca se presenta como verificada una identidad que no lo está. Cuando exista el
 * contrato, aquí va la integración (HTTP, credenciales solo en .env).
 */
class VerificacionIdentidadNoContratada implements VerificacionIdentidadService
{
    public function verificar(array $titular, array $imagenes, ?string $escenario = null): array
    {
        return ['resultado' => self::NO_DISPONIBLE, 'coincidencia' => null];
    }

    public function esSimulado(): bool
    {
        return false;
    }
}
