<?php

namespace App\Modules\Identidad\Contracts;

/**
 * Proveedor externo de contraste documental y prueba de vida (RF-02 pasos 2 a 6, MR-003).
 * Tiene un adaptador simulado y uno real; se elige con SERVICIOS_EXTERNOS.
 */
interface VerificacionIdentidadService
{
    public const EXITO = 'exito';
    public const ILEGIBLE = 'ilegible';
    public const NO_DISPONIBLE = 'no_disponible';

    /**
     * @param  array{tipo_documento: string, num_documento: string, nombres: string, apellidos: string, fecha_nacimiento: string}  $titular
     * @param  array{documento_frente: string, documento_reverso: string, rostro: string}  $imagenes  contenido binario
     * @param  string|null  $escenario  solo lo usa el simulado (MR-003)
     * @return array{resultado: string, coincidencia: float|null}
     */
    public function verificar(array $titular, array $imagenes, ?string $escenario = null): array;

    public function esSimulado(): bool;
}
