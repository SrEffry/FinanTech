<?php

namespace App\Modules\Evaluacion\Contracts;

/**
 * Puerto de Evaluacion hacia la solicitud, que es de Originacion (D15, CP0002). Solo
 * primitivos: Evaluacion no conoce el modelo. Ningún dato de RN-43 cruza este puerto.
 */
interface SolicitudesEvaluables
{
    /**
     * @return array{id: string, cliente_id: int, radicado: ?string, producto: string, monto: int,
     *     plazo_meses: int, tasa_ea: float, cuota_estimada: int, version_parametros: string, estado: string,
     *     radicada_en: ?string, antiguedad_laboral_meses: ?int, ingreso_mensual: ?int,
     *     egreso_mensual: ?int}|null
     */
    public function datos(string $solicitudId): ?array;

    /**
     * Cambia el estado por la máquina E3 de Originacion (historial y auditoría incluidos).
     * Sin `$actorId`, el actor es el sistema (el motor); con él, quien decide (RF-10).
     *
     * @throws \App\Shared\Exceptions\ErrorNegocio 409 transicion_invalida
     */
    public function moverA(string $solicitudId, string $estado, ?string $motivo = null, ?int $actorId = null): void;

    /**
     * Expediente de la consola interna (forma `Expediente` de tipos.ts), ya enmascarado (RNF-06).
     *
     * @return array<string, mixed>
     */
    public function expediente(string $solicitudId): array;
}
