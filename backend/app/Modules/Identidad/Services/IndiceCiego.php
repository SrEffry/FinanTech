<?php

namespace App\Modules\Identidad\Services;

/**
 * Huella HMAC determinista de un dato cifrado, para poder exigir unicidad y
 * buscarlo sin descifrar la columna (RN-01, RNF-06).
 */
final class IndiceCiego
{
    public static function documento(string $numero): string
    {
        $normalizado = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', $numero));

        return hash_hmac('sha256', 'documento:'.$normalizado, (string) config('finantech.indice_ciego_clave'));
    }
}
