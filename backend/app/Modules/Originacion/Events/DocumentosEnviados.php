<?php

namespace App\Modules\Originacion\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * El cliente envió lo que le faltaba (UC8): la solicitud volvió de PENDIENTE_CLIENTE a
 * RADICADA con su mismo radicado. Evaluacion (T10) o la consola (T17) deciden el paso
 * siguiente: evaluación automática si aún no tiene, o estudio con el analista asignado.
 * Solo identificadores y valores, nunca modelos (D5).
 */
class DocumentosEnviados implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly string $solicitudId,
        public readonly string $radicado,
        public readonly int $clienteId,
        public readonly string $enviadosEn,
    ) {}
}
