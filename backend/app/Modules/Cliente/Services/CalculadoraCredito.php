<?php

namespace App\Modules\Cliente\Services;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Cálculo financiero del crédito de consumo: cuota fija (sistema francés), plan de pagos
 * y desglose de costos (RF-05). Es la fuente de verdad del cálculo; el portal solo muestra
 * lo que recibe. Interfaz pública del módulo: Originacion (cuota estimada) y Desembolso
 * (oferta) la reutilizan para que la cuota sea la misma en todo el recorrido.
 *
 * Reglas que garantiza:
 * - RN-23: la TEA aplicada nunca supera la tasa máxima legal vigente.
 * - RN-24 / CP0011: el desglose incluye todos los costos y su suma ES el costo total.
 *
 * Los costos distintos del interés son sintéticos (la ERS no los fija) y coinciden con los
 * de la API simulada del portal (frontend/src/mocks/calculos.ts).
 */
class CalculadoraCredito
{
    /** Seguro de vida deudor: 0,09 % mensual sobre el monto desembolsado. */
    public const TASA_SEGURO_MENSUAL = 0.0009;

    /** Estudio de crédito: 1,5 % del monto, entre $60.000 y $450.000. */
    public const ESTUDIO_PORCENTAJE = 0.015;
    public const ESTUDIO_MINIMO = 60_000;
    public const ESTUDIO_MAXIMO = 450_000;

    /** TEA en porcentaje (18,9) → tasa mensual vencida en decimal (0,01455…). */
    public function tasaMensual(float $teaPorcentaje): float
    {
        return (1 + $teaPorcentaje / 100) ** (1 / 12) - 1;
    }

    /** Cuota fija de capital e intereses, sin seguro. */
    public function cuotaFija(int $monto, float $tasaMes, int $plazoMeses): float
    {
        if ($tasaMes == 0.0) {
            return $monto / $plazoMeses;
        }

        return $monto * $tasaMes / (1 - (1 + $tasaMes) ** -$plazoMeses);
    }

    public function valorEstudio(int $monto): int
    {
        return (int) round(min(self::ESTUDIO_MAXIMO, max(self::ESTUDIO_MINIMO, $monto * self::ESTUDIO_PORCENTAJE)));
    }

    /**
     * Plan de pagos completo, en pesos enteros.
     *
     * @return array{tasa_ea: float, tasa_mensual: float, cuota: int, costo_total: int, total_a_pagar: int, valor_a_recibir: int,
     *     desglose: list<array{concepto: string, descripcion: string, valor: int}>,
     *     plan: list<array{numero: int, fecha: string, cuota: int, capital: int, interes: int, seguro: int, saldo: int}>}
     */
    public function calcular(
        float $tasaProductoEa,
        int $monto,
        int $plazoMeses,
        float $tasaMaximaLegalEa,
        ?CarbonInterface $desde = null,
    ): array {
        $desde = CarbonImmutable::instance($desde ?? now());

        // RN-23: si la tasa del producto quedara por encima del tope legal, se aplica el tope.
        $tea = min($tasaProductoEa, $tasaMaximaLegalEa);
        $i = $this->tasaMensual($tea);
        $base = (int) round($this->cuotaFija($monto, $i, $plazoMeses));
        $seguro = (int) round($monto * self::TASA_SEGURO_MENSUAL);

        $plan = [];
        $saldo = $monto;
        $intereses = 0;
        for ($numero = 1; $numero <= $plazoMeses; $numero++) {
            $interes = (int) round($saldo * $i);
            // La última cuota cancela el saldo exacto que dejó el redondeo.
            $capital = $numero === $plazoMeses ? $saldo : $base - $interes;
            $saldo -= $capital;
            $intereses += $interes;
            $plan[] = [
                'numero' => $numero,
                'fecha' => $desde->addMonthsNoOverflow($numero)->toIso8601String(),
                'cuota' => $capital + $interes + $seguro,
                'capital' => $capital,
                'interes' => $interes,
                'seguro' => $seguro,
                'saldo' => $saldo,
            ];
        }

        // RN-24: todo costo asociado aparece aquí, con una explicación sin jerga.
        $desglose = [
            [
                'concepto' => 'Intereses',
                'descripcion' => 'Lo que pagas por usar el dinero, a una tasa del '.$this->porcentaje($tea).' % efectiva anual.',
                'valor' => $intereses,
            ],
            [
                'concepto' => 'Seguro de vida deudor',
                'descripcion' => 'Cubre el saldo de la deuda si falleces o quedas con una incapacidad. Se cobra en cada cuota.',
                'valor' => $seguro * $plazoMeses,
            ],
            [
                'concepto' => 'Estudio de crédito',
                'descripcion' => 'Pago único por analizar tu solicitud. Se descuenta del valor que recibes.',
                'valor' => $this->valorEstudio($monto),
            ],
        ];

        // CP0011: el costo total se calcula como la suma del desglose, así que nunca difieren.
        $costoTotal = array_sum(array_column($desglose, 'valor'));

        return [
            'tasa_ea' => $tea,
            'tasa_mensual' => round($i * 100, 4),
            'cuota' => $base + $seguro,
            'costo_total' => $costoTotal,
            'total_a_pagar' => $monto + $costoTotal,
            // UX-15 / RNF-20: lo que efectivamente recibe el cliente, porque el estudio se descuenta del desembolso.
            'valor_a_recibir' => $monto - $this->valorEstudio($monto),
            'desglose' => $desglose,
            'plan' => $plan,
        ];
    }

    /** 18.9 → "18,9"; 25.0 → "25" (como lo escribe una persona en Colombia). */
    private function porcentaje(float $valor): string
    {
        return str_replace('.', ',', (string) round($valor, 3));
    }
}
