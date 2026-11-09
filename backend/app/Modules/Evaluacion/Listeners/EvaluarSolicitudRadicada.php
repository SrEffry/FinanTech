<?php

namespace App\Modules\Evaluacion\Listeners;

use App\Modules\Evaluacion\Services\Evaluaciones;
use App\Modules\Originacion\Events\SolicitudRadicada;

/**
 * RF-08 paso 1 (CP0013): el motor consume el evento de solicitud radicada.
 *
 * Corre después de enviar la respuesta de la radicación (defer): el cliente ve su radicado
 * de inmediato y la evaluación termina segundos después, muy por debajo de los 10 minutos de
 * RN-46, sin depender de un proceso de colas aparte.
 */
class EvaluarSolicitudRadicada
{
    public function __construct(private readonly Evaluaciones $evaluaciones) {}

    public function handle(SolicitudRadicada $evento): void
    {
        $solicitudId = $evento->solicitudId;

        defer(fn () => $this->evaluaciones->evaluarRadicadaSinFallar($solicitudId));
    }
}
