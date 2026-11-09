<?php

namespace App\Modules\Evaluacion\Contracts;

/**
 * Central de información crediticia (RF-08 paso 2, MR-003). Dos implementaciones, elegidas
 * con SERVICIOS_EXTERNOS: la simulada y la "no contratada" (que nunca responde, así que
 * toda solicitud pasa a evaluación manual: RF-08 FA-02).
 */
interface CentralRiesgoService
{
    /**
     * @return array{obligaciones_vigentes: int, saldo_total: int, mora_maxima_dias: int,
     *     consultas_ultimos_6_meses: int, calificacion: string}
     *
     * @throws CentralNoDisponible si el tercero no responde
     */
    public function consultar(string $tipoDocumento, #[\SensitiveParameter] string $numeroDocumento, int $ingresoMensual): array;

    public function esSimulado(): bool;
}
