<?php

namespace App\Modules\Evaluacion\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * RF-10: se registró una decisión final sobre la solicitud, del oficial o automática del motor
 * (RN-46). Solo primitivos (D5). Firma acordada con fullstack-senior en el tablero (07/11):
 * Desembolso la escucha para emitir la oferta (RF-11, T18) cuando `resultado` empieza por
 * `aprobada`, de forma idempotente por `decisionId`.
 *
 * `monto`, `plazoMeses` y `tasaEa` son las condiciones finales: las ajustadas si fue
 * condicionada, las de la solicitud si se aprobó tal cual (en una negada, las pedidas).
 * `motivoCondicion` solo viene en una aprobación condicionada y es texto de catálogo para el
 * cliente, nunca el motivo interno del oficial (D6/UX-03). El envío a comité no la publica.
 */
class DecisionRegistrada implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly string $solicitudId,
        public readonly string $decisionId,
        public readonly int $clienteId,
        public readonly string $resultado, // aprobada | aprobada_condicionada | negada
        public readonly int $monto,
        public readonly int $plazoMeses,
        public readonly float $tasaEa,
        public readonly bool $automatizada,
        public readonly ?string $motivoCondicion,
        public readonly string $decididaEn, // ISO 8601
    ) {}
}
