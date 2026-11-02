<?php

namespace App\Modules\Originacion\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Evento de dominio de RF-06 paso 8: "publica el evento de solicitud radicada" (CP0012).
 * Evaluacion lo escucha para disparar la evaluación automática (RF-08). Lleva solo
 * identificadores y valores, nunca modelos, para no acoplar los módulos (MR-002).
 * Se despacha después del commit: si la radicación se revierte, nadie se entera.
 */
class SolicitudRadicada implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly string $solicitudId,
        public readonly string $radicado,
        public readonly int $clienteId,
        public readonly string $producto,
        public readonly int $monto,
        public readonly int $plazoMeses,
        public readonly string $versionParametros,
        public readonly string $radicadaEn,
    ) {}
}
