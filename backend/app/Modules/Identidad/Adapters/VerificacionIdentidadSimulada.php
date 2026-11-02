<?php

namespace App\Modules\Identidad\Adapters;

use App\Modules\Identidad\Contracts\VerificacionIdentidadService;

/**
 * Adaptador simulado (MR-003, OPC-08). No analiza las imágenes: responde el escenario
 * pedido para poder ejercitar RN-08, RN-11 y RF-02 FA-03. Todo resultado que produce se
 * marca como simulado en la respuesta y en la auditoría.
 */
class VerificacionIdentidadSimulada implements VerificacionIdentidadService
{
    public const ESCENARIOS = ['exito', 'coincidencia_baja', 'documento_ilegible', 'servicio_caido', 'lista_restrictiva'];

    public function verificar(array $titular, array $imagenes, ?string $escenario = null): array
    {
        return match ($escenario) {
            'coincidencia_baja' => ['resultado' => self::EXITO, 'coincidencia' => 0.71],
            'documento_ilegible' => ['resultado' => self::ILEGIBLE, 'coincidencia' => null],
            'servicio_caido' => ['resultado' => self::NO_DISPONIBLE, 'coincidencia' => null],
            default => ['resultado' => self::EXITO, 'coincidencia' => 0.93],
        };
    }

    public function esSimulado(): bool
    {
        return true;
    }
}
