<?php

namespace App\Modules\Evaluacion\Motor;

/**
 * Todo lo que el motor puede saber de una solicitud (RN-43, CP0014): capacidad de pago,
 * endeudamiento y comportamiento. No hay campo para ningún atributo personal, así que el
 * motor no puede usarlo aunque quisiera. Se guarda tal cual en la evaluación para poder
 * reproducirla (RN-44, CP0013 paso 8).
 */
final readonly class EntradaEvaluacion
{
    public function __construct(
        public int $cuotaMensual,
        public int $ingresoMensual,
        public int $egresoMensual,
        public int $antiguedadLaboralMeses,
        public int $mesesComoCliente,
        public int $moraMaximaDias,
        public int $saldoTotal,
        public int $obligacionesVigentes,
        public int $consultasUltimos6Meses,
    ) {}

    /** @return array<string, int> */
    public function toArray(): array
    {
        return [
            'cuota_mensual' => $this->cuotaMensual,
            'ingreso_mensual' => $this->ingresoMensual,
            'egreso_mensual' => $this->egresoMensual,
            'antiguedad_laboral_meses' => $this->antiguedadLaboralMeses,
            'meses_como_cliente' => $this->mesesComoCliente,
            'mora_maxima_dias' => $this->moraMaximaDias,
            'saldo_total' => $this->saldoTotal,
            'obligaciones_vigentes' => $this->obligacionesVigentes,
            'consultas_ultimos_6_meses' => $this->consultasUltimos6Meses,
        ];
    }

    /** @param array<string, int|string|null> $datos */
    public static function desdeArray(array $datos): self
    {
        $n = fn (string $clave) => (int) ($datos[$clave] ?? 0);

        return new self(
            $n('cuota_mensual'), $n('ingreso_mensual'), $n('egreso_mensual'), $n('antiguedad_laboral_meses'),
            $n('meses_como_cliente'), $n('mora_maxima_dias'), $n('saldo_total'), $n('obligaciones_vigentes'),
            $n('consultas_ultimos_6_meses'),
        );
    }
}
