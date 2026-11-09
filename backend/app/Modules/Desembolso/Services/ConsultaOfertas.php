<?php

namespace App\Modules\Desembolso\Services;

use App\Modules\Desembolso\Models\Oferta;

/**
 * Interfaz pública de solo lectura para otros módulos (CP0002): Originacion la usa para
 * mostrar `oferta_id` y la acción pendiente "revisa y firma tu oferta" en el seguimiento.
 */
class ConsultaOfertas
{
    /** @return array{id: string, estado: string, vence_en: string}|null la más reciente de la solicitud */
    public function deSolicitud(string $solicitudId): ?array
    {
        $oferta = Oferta::where('solicitud_id', $solicitudId)->latest('emitida_en')->first();

        return $oferta ? [
            'id' => $oferta->id,
            // RN-59: una vigente con la fecha pasada ya cuenta como vencida.
            'estado' => $oferta->estado === Oferta::VIGENTE && $oferta->vence_en->isPast() ? Oferta::VENCIDA : $oferta->estado,
            'vence_en' => $oferta->vence_en->toIso8601String(),
        ] : null;
    }
}
