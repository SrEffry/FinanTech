<?php

namespace App\Modules\Evaluacion\Database\Seeders;

use App\Modules\Evaluacion\Models\VersionParametros;
use Illuminate\Database\Seeder;

/**
 * Parámetros iniciales de crédito (F-ADM-02) con datos sintéticos: las tasas, rangos y la
 * tasa máxima legal son de demostración, no cifras reales. Son los mismos del portal
 * simulado (frontend/src/mocks/semilla.ts) para que ambos lados muestren lo mismo.
 *
 * Como la tabla es de solo adición (RN-44), una versión ya sembrada no se toca.
 */
class ParametrosCreditoSeeder extends Seeder
{
    public const VERSION_INICIAL = 'P-2026.10-1';

    /** Catálogo sintético de productos de crédito de consumo. */
    public const PRODUCTOS = [
        ['codigo' => 'libre_inversion', 'nombre' => 'Libre inversión',
            'descripcion' => 'Para lo que necesites, sin justificar el uso del dinero.',
            'tasa_ea' => 18.9, 'monto_min' => 1_000_000, 'monto_max' => 50_000_000, 'plazo_min' => 12, 'plazo_max' => 60, 'paso_monto' => 100_000],
        ['codigo' => 'libranza', 'nombre' => 'Libranza',
            'descripcion' => 'La cuota se descuenta de tu nómina o pensión, con una tasa más baja.',
            'tasa_ea' => 14.9, 'monto_min' => 2_000_000, 'monto_max' => 80_000_000, 'plazo_min' => 12, 'plazo_max' => 72, 'paso_monto' => 500_000],
        ['codigo' => 'educacion', 'nombre' => 'Crédito educativo',
            'descripcion' => 'Matrículas, cursos y posgrados, en Colombia o en el exterior.',
            'tasa_ea' => 15.5, 'monto_min' => 1_000_000, 'monto_max' => 30_000_000, 'plazo_min' => 6, 'plazo_max' => 48, 'paso_monto' => 100_000],
        ['codigo' => 'compra_cartera', 'nombre' => 'Compra de cartera',
            'descripcion' => 'Une tus deudas de otras entidades en una sola cuota.',
            'tasa_ea' => 17.2, 'monto_min' => 5_000_000, 'monto_max' => 80_000_000, 'plazo_min' => 12, 'plazo_max' => 72, 'paso_monto' => 500_000],
        ['codigo' => 'tecnologia_hogar', 'nombre' => 'Tecnología y hogar',
            'descripcion' => 'Computadores, celulares, electrodomésticos y muebles.',
            'tasa_ea' => 21.4, 'monto_min' => 500_000, 'monto_max' => 8_000_000, 'plazo_min' => 6, 'plazo_max' => 24, 'paso_monto' => 50_000],
        ['codigo' => 'viajes', 'nombre' => 'Viajes y experiencias',
            'descripcion' => 'Tiquetes, alojamiento y planes turísticos.',
            'tasa_ea' => 22.6, 'monto_min' => 1_000_000, 'monto_max' => 15_000_000, 'plazo_min' => 6, 'plazo_max' => 36, 'paso_monto' => 100_000],
    ];

    public function run(): void
    {
        $comunes = [
            'publicado_por' => 'Parametrización inicial (datos sintéticos)',
            'tasa_maxima_legal_ea' => 25.8,
            'umbral_negar' => 500,
            'limite_cuota_ingreso' => 40,
        ];

        // Versión anterior, para que haya historial: tasas 0,4 puntos más altas y umbral más exigente.
        $this->sembrar('P-2026.09-1', '2026-09-01 05:00:00', $comunes + [
            'umbral_aprobar' => 720,
            'productos' => array_map(fn (array $p) => ['tasa_ea' => round($p['tasa_ea'] + 0.4, 2)] + $p, self::PRODUCTOS),
        ]);

        // Vigente: umbrales de RN-40 (≥ 700 aprueba, 500–699 escala, < 500 niega).
        $this->sembrar(self::VERSION_INICIAL, '2026-10-01 05:00:00', $comunes + [
            'umbral_aprobar' => 700,
            'productos' => self::PRODUCTOS,
        ]);
    }

    private function sembrar(string $version, string $vigenteDesde, array $datos): void
    {
        VersionParametros::firstOrCreate(['version' => $version], $datos + [
            'vigente_desde' => $vigenteDesde,
            'registrado_en' => now(),
        ]);
    }
}
