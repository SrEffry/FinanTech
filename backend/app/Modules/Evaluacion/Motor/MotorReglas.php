<?php

namespace App\Modules\Evaluacion\Motor;

use InvalidArgumentException;

/**
 * Motor de reglas de RF-08: función pura, sin base de datos ni reloj. Con la misma entrada,
 * la misma definición de reglas y la misma política da siempre el mismo resultado (RN-44,
 * CP0013 paso 8). La lógica de referencia es frontend/src/mocks/motor.ts (R-2026.10-1).
 *
 * - Puntaje = base + contribución de cada variable, acotado a la escala (F-EVA-02).
 * - RN-40: puntaje ≥ umbral de aprobación aprueba; < umbral de negación niega; en medio, escala.
 * - RN-41: si la cuota supera el límite del ingreso disponible, no se aprueba automáticamente:
 *   se escala a revisión humana.
 * - RN-43: solo variables del catálogo; una definición con otra variable se rechaza.
 *
 * Definición de reglas (JSON de evaluacion_reglas):
 * {base, escala: {min, max}, variables: [{codigo, tramos: [{min?, max?, menor_que?, puntos}]}]}.
 * El tramo que aplica es el primero cuyo valor cumple todos sus límites (min y max inclusivos,
 * menor_que exclusivo); un tramo sin límites aplica siempre.
 */
final class MotorReglas
{
    public const APROBAR = 'aprobar';
    public const ESCALAR = 'escalar';
    public const NEGAR = 'negar';

    /** RN-41: la decisión por puntaje era aprobar, pero la cuota supera el límite. */
    public const CAUSAL_CUOTA_SUPERA_LIMITE = 'cuota_supera_limite';

    /**
     * @param  array{base: int, escala: array{min: int, max: int}, variables: list<array{codigo: string, tramos: list<array<string, int|float>>}>}  $definicion
     * @param  array{umbral_aprobar: int, umbral_negar: int, limite_cuota_ingreso: float}  $politica
     * @return array{puntaje: int, escala_min: int, escala_max: int, nivel_riesgo: string, decision_sugerida: string,
     *     causal: ?string, umbrales: array{aprobar: int, negar: int}, variables: list<array{codigo: string, nombre: string, valor: string, contribucion: int}>,
     *     capacidad_pago: array{cuota_estimada: int, ingreso_disponible: int, porcentaje: float, limite: float, supera_limite: bool}}
     */
    public function evaluar(EntradaEvaluacion $entrada, array $definicion, array $politica): array
    {
        $this->validarDefinicion($definicion);

        $capacidad = $this->capacidadPago($entrada->cuotaMensual, $entrada->ingresoMensual, $entrada->egresoMensual, (float) $politica['limite_cuota_ingreso']);

        $variables = [];
        foreach ($definicion['variables'] as $regla) {
            [$valor, $texto] = $this->medir($regla['codigo'], $entrada, $capacidad);
            $variables[] = [
                'codigo' => $regla['codigo'],
                'nombre' => CatalogoVariables::VARIABLES[$regla['codigo']]['nombre'],
                'valor' => $texto,
                'contribucion' => $this->puntos($valor, $regla['tramos']),
            ];
        }
        // Variables determinantes: primero las que más pesaron (RF-08 paso 8, F-EVA-04).
        usort($variables, fn ($a, $b) => abs($b['contribucion']) <=> abs($a['contribucion']) ?: strcmp($a['codigo'], $b['codigo']));

        ['min' => $min, 'max' => $max] = $definicion['escala'];
        $puntaje = max($min, min($max, $definicion['base'] + array_sum(array_column($variables, 'contribucion'))));

        $aprobar = (int) $politica['umbral_aprobar'];
        $negar = (int) $politica['umbral_negar'];
        [$decision, $causal] = match (true) {
            $puntaje >= $aprobar && $capacidad['supera_limite'] => [self::ESCALAR, self::CAUSAL_CUOTA_SUPERA_LIMITE],
            $puntaje >= $aprobar => [self::APROBAR, null],
            $puntaje < $negar => [self::NEGAR, $this->causalPrincipal($variables)],   // RF-08 FA-04
            default => [self::ESCALAR, null],                                        // RF-08 FA-01
        };

        return [
            'puntaje' => $puntaje,
            'escala_min' => $min,
            'escala_max' => $max,
            'nivel_riesgo' => $puntaje >= $aprobar ? 'bajo' : ($puntaje >= $negar ? 'medio' : 'alto'),
            'decision_sugerida' => $decision,
            'causal' => $causal,
            'umbrales' => ['aprobar' => $aprobar, 'negar' => $negar],
            'variables' => $variables,
            'capacidad_pago' => $capacidad,
        ];
    }

    /**
     * RN-41: porcentaje de la cuota sobre el ingreso disponible (ingreso − egresos). Sin
     * ingreso disponible, la cuota ocupa el 100 %.
     *
     * @return array{cuota_estimada: int, ingreso_disponible: int, porcentaje: float, limite: float, supera_limite: bool}
     */
    public function capacidadPago(int $cuota, int $ingreso, int $egreso, float $limite): array
    {
        $disponible = max(0, $ingreso - $egreso);
        $porcentaje = $disponible > 0 ? round($cuota / $disponible * 100, 1) : 100.0;

        return [
            'cuota_estimada' => $cuota,
            'ingreso_disponible' => $disponible,
            'porcentaje' => $porcentaje,
            'limite' => $limite,
            // Se compara con el valor exacto, no con el redondeado: 40,01 % ya supera el 40 %.
            'supera_limite' => $disponible === 0 || $cuota * 100 > $limite * $disponible,
        ];
    }

    /** @throws InvalidArgumentException si la definición usa una variable fuera del catálogo (RN-43) */
    private function validarDefinicion(array $definicion): void
    {
        if (! isset($definicion['base'], $definicion['escala']['min'], $definicion['escala']['max'], $definicion['variables'])) {
            throw new InvalidArgumentException('La definición de reglas está incompleta.');
        }

        foreach ($definicion['variables'] as $regla) {
            if (! CatalogoVariables::admitida((string) ($regla['codigo'] ?? ''))) {
                throw new InvalidArgumentException('RN-43: la variable "'.($regla['codigo'] ?? '').'" no está en el catálogo del motor.');
            }
            if (empty($regla['tramos'])) {
                throw new InvalidArgumentException("La variable {$regla['codigo']} no tiene tramos.");
            }
        }
    }

    /**
     * Valor numérico de la variable (el que se compara con los tramos) y su texto para el expediente.
     *
     * @return array{0: float|int, 1: string}
     */
    private function medir(string $codigo, EntradaEvaluacion $e, array $capacidad): array
    {
        return match ($codigo) {
            'comportamiento_pago' => [
                $e->moraMaximaDias,
                $e->moraMaximaDias === 0 ? 'Al día en los últimos 24 meses' : "Mora máxima de {$e->moraMaximaDias} días",
            ],
            'cuota_ingreso' => [$capacidad['porcentaje'], self::decimal($capacidad['porcentaje']).' %'],
            'endeudamiento' => [
                $e->ingresoMensual > 0 ? $e->saldoTotal / $e->ingresoMensual : 10,
                self::moneda($e->saldoTotal).' en '.self::cantidad($e->obligacionesVigentes, 'obligación', 'obligaciones'),
            ],
            'antiguedad_laboral' => [$e->antiguedadLaboralMeses, self::cantidad($e->antiguedadLaboralMeses, 'mes', 'meses')],
            'consultas_recientes' => [$e->consultasUltimos6Meses, "{$e->consultasUltimos6Meses} en 6 meses"],
            'antiguedad_cliente' => [$e->mesesComoCliente, self::cantidad($e->mesesComoCliente, 'mes', 'meses')],
        };
    }

    /** @param list<array<string, int|float>> $tramos */
    private function puntos(float|int $valor, array $tramos): int
    {
        foreach ($tramos as $tramo) {
            if ((! isset($tramo['min']) || $valor >= $tramo['min'])
                && (! isset($tramo['max']) || $valor <= $tramo['max'])
                && (! isset($tramo['menor_que']) || $valor < $tramo['menor_que'])) {
                return (int) $tramo['puntos'];
            }
        }

        return 0; // ningún tramo aplica: la variable no suma ni resta
    }

    /** RF-08 FA-04: la causal de la negación es la variable que más restó. */
    private function causalPrincipal(array $variables): string
    {
        $peor = $variables[0];
        foreach ($variables as $variable) {
            if ($variable['contribucion'] < $peor['contribucion']) {
                $peor = $variable;
            }
        }

        return $peor['codigo'];
    }

    private static function decimal(float $numero): string
    {
        return number_format($numero, fmod($numero, 1.0) === 0.0 ? 0 : 1, ',', '.');
    }

    private static function moneda(int $pesos): string
    {
        return '$ '.number_format($pesos, 0, ',', '.');
    }

    private static function cantidad(int $n, string $singular, string $plural): string
    {
        return $n === 1 ? "1 {$singular}" : "{$n} {$plural}";
    }
}
