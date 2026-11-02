<?php

namespace App\Modules\Evaluacion\Services;

use App\Modules\Evaluacion\Models\VersionParametros;
use App\Shared\Exceptions\ErrorNegocio;
use Carbon\CarbonInterface;

/**
 * Interfaz pública del módulo de Evaluacion para leer los parámetros de crédito
 * vigentes: tasa máxima legal, umbrales del motor y catálogo de productos (F-ADM-02).
 *
 * Es la fuente única del catálogo: Cliente (simulación, RF-05) y Originacion
 * (solicitud, RF-06) lo consultan aquí y no guardan copia propia. Devuelve arreglos
 * simples para no exponer el modelo fuera del módulo (CP0002).
 *
 * @phpstan-type Producto array{codigo: string, nombre: string, descripcion: string, tasa_ea: float,
 *     monto_min: int, monto_max: int, plazo_min: int, plazo_max: int, paso_monto: int}
 */
class ParametrosVigentes
{
    /** @var array<string, array<string, mixed>> versiones ya leídas en esta petición */
    private array $memoria = [];

    /**
     * La versión vigente en el momento dado: la última cuya fecha de vigencia ya llegó.
     *
     * @return array{version: string, vigente_desde: string, publicado_por: string,
     *     tasa_maxima_legal_ea: float, umbral_aprobar: int, umbral_negar: int,
     *     limite_cuota_ingreso: float, productos: list<Producto>}
     */
    public function vigente(?CarbonInterface $momento = null): array
    {
        $momento ??= now();
        $clave = $momento->format('Y-m-d H:i');

        return $this->memoria[$clave] ??= $this->leer($momento);
    }

    public function version(?CarbonInterface $momento = null): string
    {
        return $this->vigente($momento)['version'];
    }

    public function tasaMaximaLegalEa(?CarbonInterface $momento = null): float
    {
        return $this->vigente($momento)['tasa_maxima_legal_ea'];
    }

    /** @return list<Producto> */
    public function productos(?CarbonInterface $momento = null): array
    {
        return $this->vigente($momento)['productos'];
    }

    /** @return Producto|null */
    public function producto(string $codigo, ?CarbonInterface $momento = null): ?array
    {
        foreach ($this->productos($momento) as $producto) {
            if ($producto['codigo'] === $codigo) {
                return $producto;
            }
        }

        return null;
    }

    private function leer(CarbonInterface $momento): array
    {
        $version = VersionParametros::where('vigente_desde', '<=', $momento)
            ->orderByDesc('vigente_desde')
            ->orderByDesc('id')
            ->first();

        if (! $version) {
            throw new ErrorNegocio(
                'parametros_no_disponibles',
                'Por ahora no podemos mostrar los productos. Intenta de nuevo en unos minutos.',
                503,
            );
        }

        return [
            'version' => $version->version,
            'vigente_desde' => $version->vigente_desde->toIso8601String(),
            'publicado_por' => $version->publicado_por,
            'tasa_maxima_legal_ea' => $version->tasa_maxima_legal_ea,
            'umbral_aprobar' => $version->umbral_aprobar,
            'umbral_negar' => $version->umbral_negar,
            'limite_cuota_ingreso' => $version->limite_cuota_ingreso,
            'productos' => array_map(fn (array $p) => [
                'codigo' => (string) $p['codigo'],
                'nombre' => (string) $p['nombre'],
                'descripcion' => (string) $p['descripcion'],
                'tasa_ea' => (float) $p['tasa_ea'],
                'monto_min' => (int) $p['monto_min'],
                'monto_max' => (int) $p['monto_max'],
                'plazo_min' => (int) $p['plazo_min'],
                'plazo_max' => (int) $p['plazo_max'],
                'paso_monto' => (int) $p['paso_monto'],
            ], $version->productos),
        ];
    }
}
