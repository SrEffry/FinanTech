<?php

namespace App\Shared\Eloquent;

use LogicException;

/**
 * Modelos de solo adición: auditoría, consentimientos, evaluaciones, decisiones
 * y asientos. Una corrección se registra como una fila nueva, nunca modificando
 * la existente. La base de datos lo refuerza con triggers.
 */
trait SoloAdicion
{
    public static function bootSoloAdicion(): void
    {
        static::updating(function () {
            throw new LogicException(static::class.' es de solo adición: no admite modificaciones.');
        });

        static::deleting(function () {
            throw new LogicException(static::class.' es de solo adición: no admite borrado.');
        });
    }
}
