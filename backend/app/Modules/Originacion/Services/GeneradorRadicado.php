<?php

namespace App\Modules\Originacion\Services;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * RN-29: radicado `FT-AAAA-NNNNNN`, único, secuencial por año y no reutilizable.
 *
 * El contador del año se incrementa en UNA sola sentencia
 * (INSERT … ON DUPLICATE KEY UPDATE con LAST_INSERT_ID), que toma de entrada el candado
 * exclusivo de la fila: dos radicaciones simultáneas se ordenan y nunca obtienen el mismo
 * número. No se usa "insertar si no existe y luego SELECT … FOR UPDATE", porque con la
 * primera radicación del año varias transacciones quedan con candado compartido sobre la
 * fila nueva y InnoDB las aborta por interbloqueo. LAST_INSERT_ID() es propio de cada
 * conexión, así que cada petición lee su número. El índice único de `radicado` es la
 * segunda barrera.
 *
 * El año es el de Colombia, no el de UTC: una solicitud radicada el 31 de diciembre a las
 * 8 p. m. pertenece a ese año.
 */
class GeneradorRadicado
{
    public const ZONA_HORARIA = 'America/Bogota';

    public function siguiente(?CarbonInterface $momento = null): string
    {
        $anio = (int) ($momento ?? now())->copy()->setTimezone(self::ZONA_HORARIA)->format('Y');

        DB::statement(
            'INSERT INTO originacion_secuencias_radicado (anio, ultimo) VALUES (?, LAST_INSERT_ID(1))
             ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)',
            [$anio],
        );
        $numero = (int) DB::selectOne('SELECT LAST_INSERT_ID() AS numero')->numero;

        return sprintf('FT-%04d-%06d', $anio, $numero);
    }
}
