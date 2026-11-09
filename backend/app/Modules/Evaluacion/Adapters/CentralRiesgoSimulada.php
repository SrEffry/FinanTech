<?php

namespace App\Modules\Evaluacion\Adapters;

use App\Modules\Evaluacion\Contracts\CentralNoDisponible;
use App\Modules\Evaluacion\Contracts\CentralRiesgoService;

/**
 * Central de riesgo simulada (MR-003): perfil sintético y estable según el documento, igual
 * que el portal simulado (frontend/src/mocks/motor.ts), para que las demostraciones den lo
 * mismo en los dos lados. Escenarios que se pueden forzar con el documento de prueba:
 * - termina en 0: la central no responde (RF-08 FA-02);
 * - la suma de sus dígitos módulo 10 fija el perfil: 7 a 9 bueno, 4 a 6 medio, 0 a 3 malo.
 * Todo resultado sale marcado como simulado (fuente_central = simulada).
 */
class CentralRiesgoSimulada implements CentralRiesgoService
{
    public function consultar(string $tipoDocumento, #[\SensitiveParameter] string $numeroDocumento, int $ingresoMensual): array
    {
        if (str_ends_with($numeroDocumento, '0')) {
            throw new CentralNoDisponible('La central de riesgo simulada no respondió.');
        }

        $suma = array_sum(array_map(fn ($c) => ctype_digit($c) ? (int) $c : 0, str_split($numeroDocumento)));
        $perfil = ($suma % 10) / 10;

        return [
            'obligaciones_vigentes' => (int) round((1 - $perfil) * 6),
            'saldo_total' => (int) (round($ingresoMensual * (1 - $perfil) * 10 / 10_000) * 10_000),
            'mora_maxima_dias' => $perfil > 0.7 ? 0 : ($perfil > 0.4 ? 30 : 60),
            'consultas_ultimos_6_meses' => (int) round((1 - $perfil) * 6),
            'calificacion' => $perfil > 0.7 ? 'A' : ($perfil > 0.4 ? 'B' : 'C'),
        ];
    }

    public function esSimulado(): bool
    {
        return true;
    }
}
