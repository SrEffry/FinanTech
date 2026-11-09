<?php

namespace App\Modules\Evaluacion\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * RF-08 paso 9: "publica el evento de evaluación concluida". Solo identificadores y valores
 * (D5). `decision` es la sugerida por el motor: aprobar, escalar o negar. Desembolso puede
 * escucharlo para emitir la oferta de una aprobación automática (T18).
 */
class EvaluacionCompletada implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly string $solicitudId,
        public readonly string $evaluacionId,
        public readonly int $clienteId,
        public readonly string $decision,
        public readonly int $puntaje,
        public readonly string $versionReglas,
        public readonly bool $simulada,
    ) {}
}
