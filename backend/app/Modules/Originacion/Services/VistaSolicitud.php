<?php

namespace App\Modules\Originacion\Services;

use App\Modules\Desembolso\Services\ConsultaOfertas;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Modules\Originacion\Models\DocumentoSolicitud;
use App\Modules\Originacion\Models\HistorialEstado;
use App\Modules\Originacion\Models\Solicitud;

/**
 * Forma pública de la solicitud para el portal: `SolicitudResumen` y `SolicitudDetalle`
 * de frontend/src/lib/api/tipos.ts. El estado va con su nombre técnico; la etiqueta para
 * el cliente la pone el portal (RN-36). La usará también el expediente de la consola (T17).
 */
class VistaSolicitud
{
    /** RN-31: el borrador se conserva 30 días. */
    public const DIAS_BORRADOR = 30;

    public function __construct(
        private readonly ParametrosVigentes $parametros,
        private readonly DirectorioClientes $clientes,
        private readonly DocumentosSolicitud $documentos,
        private readonly ConsultaOfertas $ofertas,
    ) {}

    public function resumen(Solicitud $solicitud): array
    {
        return [
            'id' => $solicitud->id,
            'radicado' => $solicitud->radicado,
            'producto' => [
                'codigo' => $solicitud->producto_codigo,
                'nombre' => $this->parametros->producto($solicitud->producto_codigo)['nombre'] ?? $solicitud->producto_codigo,
            ],
            'monto' => $solicitud->monto,
            'plazo_meses' => $solicitud->plazo_meses,
            'estado' => $solicitud->estado->value,
            'creada_en' => $solicitud->created_at->toIso8601String(),
            'actualizada_en' => $solicitud->updated_at->toIso8601String(),
            'accion_pendiente' => $this->accionPendiente($solicitud),
        ];
    }

    public function detalle(Solicitud $solicitud): array
    {
        return [
            ...$this->resumen($solicitud),
            'tasa_ea' => $solicitud->tasa_ea,
            'cuota_estimada' => $solicitud->cuota_estimada,
            // RN-32: lo que ya tenemos del cliente, enmascarado (RNF-06), para no volver a pedirlo.
            'datos_conocidos' => $this->clientes->datosConocidos($solicitud->cliente_id),
            'laboral' => [
                'ocupacion' => $solicitud->ocupacion ?? '',
                'empleador' => $solicitud->empleador ?? '',
                'antiguedad_laboral_meses' => $solicitud->antiguedad_laboral_meses,
            ],
            'financiero' => [
                'ingreso_mensual' => $solicitud->ingreso_mensual,
                'egreso_mensual' => $solicitud->egreso_mensual,
            ],
            // Solo nombre y celular: sin parentesco (RN-43).
            'referencia' => [
                'nombre' => $solicitud->referencia_nombre ?? '',
                'celular' => $solicitud->referencia_celular ?? '',
            ],
            'documentos' => $solicitud->documentos()->get()
                ->map(fn (DocumentoSolicitud $d) => $this->documentos->vista($d))->all(),
            'acepta_consulta_centrales' => $solicitud->acepta_consulta_centrales,
            'capacidad_pago' => $this->capacidadPago($solicitud),
            // RF-07: hitos con fecha, del más antiguo al más reciente.
            'historial' => $solicitud->historial()->get()->map(fn (HistorialEstado $h) => [
                'estado' => $h->estado_nuevo->value,
                'fecha' => $h->registrado_en->toIso8601String(),
            ])->all(),
            'oferta_id' => $this->ofertas->deSolicitud($solicitud->id)['id'] ?? null,
            'borrador_vence_en' => $solicitud->estado === EstadoSolicitud::BORRADOR
                ? $solicitud->created_at->copy()->addDays(self::DIAS_BORRADOR)->toIso8601String()
                : null,
        ];
    }

    /**
     * RN-41 / RF-06 FA-04: cuánto del ingreso disponible se lleva la cuota. Es informativo:
     * el cliente puede radicar igual y la regla la aplica el motor (RF-08).
     */
    private function capacidadPago(Solicitud $solicitud): ?array
    {
        if ($solicitud->ingreso_mensual === null || $solicitud->egreso_mensual === null) {
            return null;
        }

        $disponible = max(0, $solicitud->ingreso_mensual - $solicitud->egreso_mensual);
        $porcentaje = $disponible > 0 ? $solicitud->cuota_estimada / $disponible * 100 : 100.0;
        $limite = $this->parametros->vigente()['limite_cuota_ingreso'];

        return [
            'cuota_estimada' => $solicitud->cuota_estimada,
            'ingreso_disponible' => $disponible,
            'porcentaje' => round($porcentaje, 1),
            'limite' => $limite,
            'supera_limite' => $porcentaje > $limite,
        ];
    }

    private function accionPendiente(Solicitud $solicitud): ?array
    {
        return match ($solicitud->estado) {
            EstadoSolicitud::BORRADOR => ['tipo' => 'borrador', 'texto' => 'Termina de llenar tu solicitud y radícala.'],
            EstadoSolicitud::PENDIENTE_CLIENTE => ['tipo' => 'documentos', 'texto' => 'Necesitamos que vuelvas a cargar un documento.'],
            EstadoSolicitud::NEGADA => ['tipo' => 'decision', 'texto' => 'Conoce por qué no fue aprobada y qué puedes hacer.'],
            EstadoSolicitud::APROBADA, EstadoSolicitud::APROBADA_CONDICIONADA => $this->accionOferta($solicitud),
            default => null,
        };
    }

    /** RF-11: con la oferta vigente, el cliente tiene que revisarla y firmarla (RN-59). */
    private function accionOferta(Solicitud $solicitud): ?array
    {
        $oferta = $this->ofertas->deSolicitud($solicitud->id);

        return $oferta && $oferta['estado'] === 'vigente'
            ? ['tipo' => 'oferta', 'texto' => 'Tienes una oferta lista para revisar y firmar.', 'oferta_id' => $oferta['id']]
            : null;
    }
}
