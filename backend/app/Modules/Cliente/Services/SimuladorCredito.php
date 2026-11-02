<?php

namespace App\Modules\Cliente\Services;

use App\Modules\Cliente\Models\Simulacion;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Shared\Exceptions\ErrorNegocio;

/**
 * RF-05: catálogo de productos y simulación de crédito, públicos (FA-02: el visitante
 * también simula). El catálogo y las tasas salen de los parámetros vigentes de Evaluacion,
 * que es su única fuente; aquí no se guarda copia.
 */
class SimuladorCredito
{
    /** RN-26: los valores simulados se conservan 30 días. */
    public const DIAS_VIGENCIA = 30;

    public function __construct(
        private readonly ParametrosVigentes $parametros,
        private readonly CalculadoraCredito $calculadora,
    ) {}

    /**
     * Productos vigentes. RN-23: la tasa que se anuncia nunca supera la máxima legal.
     *
     * @return list<array<string, mixed>>
     */
    public function productos(): array
    {
        $maxima = $this->parametros->tasaMaximaLegalEa();

        return array_map(
            fn (array $p) => ['tasa_ea' => min($p['tasa_ea'], $maxima)] + $p,
            $this->parametros->productos(),
        );
    }

    /** @return array<string, mixed> cuerpo `Simulacion` del contrato */
    public function simular(string $codigo, int $monto, int $plazoMeses, ?int $usuarioId = null): array
    {
        $vigentes = $this->parametros->vigente();
        $producto = $this->parametros->producto($codigo);

        if (! $producto) {
            throw new ErrorNegocio('producto_invalido', 'Elige uno de los productos disponibles.');
        }

        // RF-05 FA-01: fuera de rango se informa el rango para que el portal ajuste el valor.
        if ($monto < $producto['monto_min'] || $monto > $producto['monto_max']) {
            throw new ErrorNegocio(
                'fuera_de_rango',
                'El monto debe estar entre '.$this->moneda($producto['monto_min']).' y '.$this->moneda($producto['monto_max']).'.',
                422,
                ['campo' => 'monto', 'minimo' => $producto['monto_min'], 'maximo' => $producto['monto_max']],
            );
        }
        if ($plazoMeses < $producto['plazo_min'] || $plazoMeses > $producto['plazo_max']) {
            throw new ErrorNegocio(
                'fuera_de_rango',
                "El plazo debe estar entre {$producto['plazo_min']} y {$producto['plazo_max']} meses.",
                422,
                ['campo' => 'plazo_meses', 'minimo' => $producto['plazo_min'], 'maximo' => $producto['plazo_max']],
            );
        }

        $ahora = now();
        $credito = $this->calculadora->calcular(
            $producto['tasa_ea'], $monto, $plazoMeses, $vigentes['tasa_maxima_legal_ea'], $ahora,
        );

        $simulacion = Simulacion::create([
            'usuario_id' => $usuarioId,
            'producto_codigo' => $producto['codigo'],
            'monto' => $monto,
            'plazo_meses' => $plazoMeses,
            'version_parametros' => $vigentes['version'],
            'tasa_ea' => $credito['tasa_ea'],
            'cuota' => $credito['cuota'],
            'costo_total' => $credito['costo_total'],
            'creada_en' => $ahora,
            'vigente_hasta' => $ahora->copy()->addDays(self::DIAS_VIGENCIA),
        ]);

        return [
            'id' => $simulacion->id,
            'producto' => ['codigo' => $producto['codigo'], 'nombre' => $producto['nombre']],
            'monto' => $monto,
            'plazo_meses' => $plazoMeses,
            ...$credito,
            'tasa_maxima_legal_ea' => $vigentes['tasa_maxima_legal_ea'],
            'vigente_hasta' => $simulacion->vigente_hasta->toIso8601String(),
        ];
    }

    /** 1000000 → "$1.000.000", como lo muestra el portal. */
    private function moneda(int $valor): string
    {
        return '$'.number_format($valor, 0, ',', '.');
    }
}
