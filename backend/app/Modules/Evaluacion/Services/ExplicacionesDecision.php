<?php

namespace App\Modules\Evaluacion\Services;

use App\Modules\Evaluacion\Models\Decision;
use App\Modules\Evaluacion\Models\Evaluacion;
use App\Modules\Evaluacion\Motor\CatalogoExplicaciones;

/**
 * Lo que el cliente puede saber de la decisión sobre su solicitud (RF-09, D26). Todo sale de
 * CatalogoExplicaciones: nunca el motivo interno del oficial (RN-54, D6/UX-03) ni códigos,
 * pesos, puntaje o versión de reglas (RN-52). `simulado` viene de la evaluación (MR-004).
 */
class ExplicacionesDecision
{
    private const MAXIMO_VARIABLES = 3;

    /** @return array<string, mixed>|null null si todavía no hay decisión (el comité no cuenta) */
    public function paraCliente(string $solicitudId): ?array
    {
        $decision = Decision::where('solicitud_id', $solicitudId)->where('resultado', '!=', 'comite')
            ->orderByDesc('registrado_en')->first();
        if (! $decision) {
            return null;
        }
        $evaluacion = Evaluacion::where('solicitud_id', $solicitudId)->orderByDesc('secuencia')->first();

        return [
            'resultado' => $decision->resultado,
            'automatizada' => $decision->automatizada,
            'motivo_principal' => $this->motivoPrincipal($decision, $evaluacion),
            'variables' => $this->variables($decision, $evaluacion),
            'decidida_en' => $decision->registrado_en->toIso8601String(),
            'condicion' => $this->condicion($decision),
            'simulado' => $evaluacion?->fuente_central === 'simulada',
        ];
    }

    private function motivoPrincipal(Decision $decision, ?Evaluacion $evaluacion): string
    {
        return match (true) {
            $decision->resultado === 'aprobada' => CatalogoExplicaciones::APROBADA,
            $decision->resultado === 'aprobada_condicionada' => CatalogoExplicaciones::APROBADA_CONDICIONADA,
            $decision->automatizada => CatalogoExplicaciones::motivoDeCausal($evaluacion?->causal),
            default => CatalogoExplicaciones::NEGADA_OFICIAL,
        };
    }

    /** @return list<array{nombre: string, efecto: string, explicacion: string}> */
    private function variables(Decision $decision, ?Evaluacion $evaluacion): array
    {
        return collect($evaluacion?->variables_determinantes ?? [])
            // Lo que no sumó ni restó no explica nada; en una negación solo cuenta lo que restó.
            ->filter(fn (array $v) => $decision->resultado === 'negada' ? $v['contribucion'] < 0 : $v['contribucion'] !== 0)
            ->take(self::MAXIMO_VARIABLES)
            ->map(fn (array $v) => [
                'nombre' => $v['nombre'],
                'efecto' => $v['contribucion'] > 0 ? 'favorable' : 'desfavorable',
                'explicacion' => CatalogoExplicaciones::explicacion($v['codigo'], $v['contribucion'] > 0),
            ])
            ->filter(fn (array $v) => $v['explicacion'] !== null)
            ->values()->all();
    }

    private function condicion(Decision $decision): ?string
    {
        if (! $decision->condicionada) {
            return null;
        }

        return 'Te aprobamos $ '.number_format((int) $decision->monto, 0, ',', '.')." a {$decision->plazo_meses} meses, con una tasa de "
            .number_format((float) $decision->tasa_ea, 2, ',', '.').' % E.A.';
    }
}
