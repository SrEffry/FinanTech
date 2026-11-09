<?php

namespace App\Modules\Evaluacion\Adapters;

use App\Modules\Evaluacion\Contracts\SolicitudesEvaluables;
use App\Modules\Originacion\Services\ConsolaInterna;
use App\Modules\Originacion\Services\SolicitudesPorId;

/** Puerto SolicitudesEvaluables sobre la interfaz pública de Originacion (D15, CP0002). */
class SolicitudesEvaluablesOriginacion implements SolicitudesEvaluables
{
    public function __construct(private readonly SolicitudesPorId $solicitudes) {}

    public function datos(string $solicitudId): ?array
    {
        return $this->solicitudes->datosParaEvaluacion($solicitudId);
    }

    public function moverA(string $solicitudId, string $estado, ?string $motivo = null, ?int $actorId = null): void
    {
        $this->solicitudes->transicionar($solicitudId, $estado, $actorId, $motivo);
    }

    public function expediente(string $solicitudId): array
    {
        // Se resuelve al usarla: ConsolaInterna usa servicios de Evaluacion y así no hay ciclo.
        return app(ConsolaInterna::class)->expediente($solicitudId);
    }
}
