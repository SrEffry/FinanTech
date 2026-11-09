<?php

namespace App\Modules\Evaluacion\Services;

use App\Modules\Evaluacion\Models\VersionReglas;
use Carbon\CarbonInterface;

/**
 * Versiones publicadas de las reglas del puntaje (F-EVA-01, RN-44). Devuelve arreglos,
 * nunca el modelo (CP0002).
 */
class ReglasVigentes
{
    /** @return array{version: string, vigente_desde: string, definicion: array}|null la última vigente en ese momento */
    public function vigente(?CarbonInterface $momento = null): ?array
    {
        $fila = VersionReglas::where('vigente_desde', '<=', $momento ?? now())
            ->orderByDesc('vigente_desde')
            ->orderByDesc('id')
            ->first();

        return $fila ? $this->formatear($fila) : null;
    }

    /** @return array{version: string, vigente_desde: string, definicion: array}|null */
    public function porVersion(string $version): ?array
    {
        $fila = VersionReglas::where('version', $version)->first();

        return $fila ? $this->formatear($fila) : null;
    }

    private function formatear(VersionReglas $fila): array
    {
        return [
            'version' => $fila->version,
            'vigente_desde' => $fila->vigente_desde->toIso8601String(),
            'definicion' => $fila->definicion,
        ];
    }
}
