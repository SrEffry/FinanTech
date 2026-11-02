<?php

namespace App\Modules\Identidad\Services;

/** RNF-06: en pantalla solo se muestran los últimos 4 dígitos. */
final class Enmascarar
{
    public static function ultimosCuatro(?string $valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        $limpio = preg_replace('/\s+/', '', $valor);

        return mb_strlen($limpio) <= 4 ? '••••' : '•••• '.mb_substr($limpio, -4);
    }

    /** l•••@dominio.co */
    public static function correo(string $correo): string
    {
        [$usuario, $dominio] = array_pad(explode('@', $correo, 2), 2, null);

        return $dominio === null ? '••••' : mb_substr($usuario, 0, 1).'•••@'.$dominio;
    }
}
