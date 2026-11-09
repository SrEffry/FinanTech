<?php

namespace App\Modules\Desembolso\Listeners;

use App\Modules\Desembolso\Services\Ofertas;

/**
 * Escucha `Evaluacion\Events\DecisionRegistrada` (plan, tabla de contratos; firma propuesta
 * en el tablero el 07/11) y emite la oferta de una aprobación, automática o del oficial.
 * Lee el evento por sus propiedades públicas (D5: solo primitivos), sin importar nada más
 * de Evaluacion. La emisión es idempotente por `decisionId`.
 */
class EmitirOfertaAlAprobar
{
    public function __construct(private readonly Ofertas $ofertas) {}

    public function handle(object $evento): void
    {
        if (! str_starts_with((string) $evento->resultado, 'aprobada')) {
            return;
        }

        $this->ofertas->emitir(
            $evento->solicitudId,
            (string) $evento->decisionId,
            (int) $evento->monto,
            (int) $evento->plazoMeses,
            (float) $evento->tasaEa,
            $evento->motivoCondicion ?? null,
        );
    }
}
