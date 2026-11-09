<?php

namespace App\Modules\Evaluacion\Database\Seeders;

use App\Modules\Evaluacion\Models\VersionReglas;
use Illuminate\Database\Seeder;

/**
 * Versión inicial de las reglas del puntaje (RN-44). Es la misma lógica del portal
 * simulado (frontend/src/mocks/motor.ts, R-2026.10-1): pesos sintéticos de demostración,
 * no un modelo de riesgo calibrado. La tabla es de solo adición: una versión ya sembrada
 * no se toca; un cambio de pesos se publica como R-AAAA.MM-n nueva.
 */
class ReglasMotorSeeder extends Seeder
{
    public const VERSION_INICIAL = 'R-2026.10-1';

    /** Puntaje base 600 sobre 0-1000; cada variable suma o resta según su tramo. */
    public const DEFINICION_INICIAL = [
        'base' => 600,
        'escala' => ['min' => 0, 'max' => 1000],
        'variables' => [
            ['codigo' => 'comportamiento_pago', 'tramos' => [            // días de mora máxima
                ['max' => 0, 'puntos' => 140], ['max' => 30, 'puntos' => 30], ['puntos' => -160]]],
            ['codigo' => 'cuota_ingreso', 'tramos' => [                  // % del ingreso disponible
                ['max' => 20, 'puntos' => 110], ['max' => 30, 'puntos' => 60], ['max' => 40, 'puntos' => 10], ['puntos' => -170]]],
            ['codigo' => 'endeudamiento', 'tramos' => [                  // saldo / ingreso mensual
                ['menor_que' => 3, 'puntos' => 50], ['menor_que' => 6, 'puntos' => 0], ['puntos' => -60]]],
            ['codigo' => 'antiguedad_laboral', 'tramos' => [             // meses
                ['min' => 24, 'puntos' => 60], ['min' => 12, 'puntos' => 30], ['puntos' => -30]]],
            ['codigo' => 'consultas_recientes', 'tramos' => [            // consultas en 6 meses
                ['max' => 2, 'puntos' => 20], ['max' => 4, 'puntos' => 0], ['puntos' => -40]]],
            ['codigo' => 'antiguedad_cliente', 'tramos' => [             // meses con FinanTech
                ['min' => 6, 'puntos' => 20], ['puntos' => 0]]],
        ],
    ];

    public function run(): void
    {
        VersionReglas::firstOrCreate(['version' => self::VERSION_INICIAL], [
            'vigente_desde' => '2026-10-01 00:00:00',
            'publicada_por' => 'Parametrización inicial (datos sintéticos)',
            'definicion' => self::DEFINICION_INICIAL,
            'registrado_en' => now(),
        ]);
    }
}
