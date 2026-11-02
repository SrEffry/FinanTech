<?php

namespace App\Modules\Identidad\Contracts;

/**
 * Consulta de listas restrictivas, prevención de lavado de activos (RF-02 paso 7, RI-10, MR-003).
 * El resultado nunca se revela al cliente (RN-10).
 */
interface ListasRestrictivasService
{
    public const SIN_COINCIDENCIA = 'sin_coincidencia';
    public const COINCIDENCIA = 'coincidencia';
    public const NO_DISPONIBLE = 'no_disponible';

    /**
     * @param  array{tipo_documento: string, num_documento: string, nombres: string, apellidos: string}  $titular
     * @return string una de las constantes
     */
    public function consultar(array $titular, ?string $escenario = null): string;

    public function esSimulado(): bool;
}
