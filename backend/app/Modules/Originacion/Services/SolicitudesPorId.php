<?php

namespace App\Modules\Originacion\Services;

use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Modules\Originacion\Models\Solicitud;

/**
 * Operaciones por id para otros módulos, sin exponer el modelo (CP0002, D15). Las usa el
 * motor de Evaluacion (T10) a través de su puerto SolicitudesEvaluables.
 *
 * Archivo de fullstack-senior (dueño de Originacion), escrito por backend-senior con
 * permiso del gerente (D15): solo lee y delega en Solicitudes::transicionar(), que valida
 * la máquina E3 y deja historial y auditoría. Si cambian las columnas laborales o
 * financieras (T11), se actualiza aquí.
 */
class SolicitudesPorId
{
    public function __construct(private readonly Solicitudes $solicitudes) {}

    /**
     * Lo que el motor necesita (RF-08 pasos 4 a 6). Solo primitivos y ninguna variable de
     * RN-43: no salen la referencia personal, el empleador ni la ocupación, que el motor no usa.
     *
     * @return array{id: string, cliente_id: int, radicado: ?string, producto: string, monto: int,
     *     plazo_meses: int, tasa_ea: float, cuota_estimada: int, version_parametros: string, estado: string,
     *     radicada_en: ?string, antiguedad_laboral_meses: ?int, ingreso_mensual: ?int,
     *     egreso_mensual: ?int}|null
     */
    public function datosParaEvaluacion(string $solicitudId): ?array
    {
        $solicitud = Solicitud::find($solicitudId);
        if (! $solicitud) {
            return null;
        }

        return [
            'id' => $solicitud->id,
            'cliente_id' => $solicitud->cliente_id,
            'radicado' => $solicitud->radicado,
            'producto' => $solicitud->producto_codigo,
            'monto' => $solicitud->monto,
            'plazo_meses' => $solicitud->plazo_meses,
            'tasa_ea' => $solicitud->tasa_ea,
            'cuota_estimada' => $solicitud->cuota_estimada,
            'version_parametros' => $solicitud->version_parametros,
            'estado' => $solicitud->estado->value,
            'radicada_en' => $solicitud->radicada_en?->toIso8601String(),
            'antiguedad_laboral_meses' => $solicitud->antiguedad_laboral_meses,
            'ingreso_mensual' => $solicitud->ingreso_mensual,
            'egreso_mensual' => $solicitud->egreso_mensual,
        ];
    }

    /**
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     * @throws \App\Shared\Exceptions\ErrorNegocio 409 transicion_invalida
     */
    public function transicionar(string $solicitudId, string $estado, ?int $actorId = null, ?string $motivo = null): string
    {
        $solicitud = Solicitud::findOrFail($solicitudId);
        $this->solicitudes->transicionar($solicitud, EstadoSolicitud::from($estado), $actorId, $motivo);

        return $solicitud->estado->value;
    }
}
