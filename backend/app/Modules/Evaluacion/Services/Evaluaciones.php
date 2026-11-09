<?php

namespace App\Modules\Evaluacion\Services;

use App\Modules\Evaluacion\Contracts\CentralNoDisponible;
use App\Modules\Evaluacion\Contracts\CentralRiesgoService;
use App\Modules\Evaluacion\Contracts\SolicitudesEvaluables;
use App\Modules\Evaluacion\Events\EvaluacionCompletada;
use App\Modules\Evaluacion\Models\Evaluacion;
use App\Modules\Evaluacion\Motor\EntradaEvaluacion;
use App\Modules\Evaluacion\Motor\MotorReglas;
use App\Modules\Identidad\Services\Auditoria;
use App\Modules\Identidad\Services\PerfilCliente;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Evaluación automática de RF-08 (UC9, SEC-02) e interfaz pública del módulo sobre las
 * evaluaciones.
 *
 * Flujo: la solicitud RADICADA pasa a EN_EVALUACION; se consulta la central (hasta 3 intentos,
 * FA-02), se arma la entrada del motor (solo capacidad de pago, endeudamiento y comportamiento,
 * RN-43), se calcula con la versión de reglas vigente al radicar y la versión de parámetros de
 * la solicitud (RN-44), se guarda la evaluación (solo adición) y la solicitud pasa a APROBADA,
 * NEGADA o EN_ESTUDIO (RN-40, RN-41, FA-01). Si no se puede consultar la central o falta la
 * autorización, pasa a EN_ESTUDIO: **nunca se niega por un tercero** (FA-02). En la primera
 * versión, EN_ESTUDIO sigue enseguida a EN_DECISION (D20, P9). El motor actúa
 * como el sistema, no como el usuario que radicó (D15).
 */
class Evaluaciones
{
    public const MOTIVO_CONCEPTO_POSTERGADO = 'Concepto del analista postergado en la primera versión (P9)';

    public const INTENTOS_CENTRAL = 3; // RF-08 FA-02

    public function __construct(
        private readonly SolicitudesEvaluables $solicitudes,
        private readonly CentralRiesgoService $central,
        private readonly PerfilCliente $clientes,
        private readonly ParametrosVigentes $parametros,
        private readonly ReglasVigentes $reglas,
        private readonly MotorReglas $motor,
        private readonly Auditoria $auditoria,
        private readonly DecisionesCredito $decisiones,
    ) {}

    /**
     * Evalúa una solicitud recién radicada. Devuelve la evaluación guardada, o null si se derivó
     * a evaluación manual o no se pudo evaluar.
     *
     * @return array<string, mixed>|null
     */
    public function evaluarRadicada(string $solicitudId): ?array
    {
        return $this->comoSistema(function () use ($solicitudId) {
            $datos = $this->solicitudes->datos($solicitudId);
            if (! $datos || $datos['estado'] !== 'RADICADA') {
                $this->auditoria->registrar('evaluacion.omitida', 'solicitud', $solicitudId, Auditoria::RECHAZO, [
                    'estado' => $datos['estado'] ?? null,
                ]);

                return null;
            }

            $radicadaEn = CarbonImmutable::parse($datos['radicada_en'] ?? now());
            $reglas = $this->reglas->vigente($radicadaEn);
            $politica = $this->parametros->porVersion($datos['version_parametros']);
            if (! $reglas || ! $politica) {
                // Precondición de RF-08 sin cumplir (despliegue incompleto): se deja RADICADA y se avisa.
                $this->auditoria->registrar('evaluacion.sin_version', 'solicitud', $solicitudId, Auditoria::FALLO, [
                    'reglas' => $reglas['version'] ?? null,
                    'parametros' => $datos['version_parametros'],
                ]);
                report(new \RuntimeException("RF-08: no hay versión de reglas o de parámetros para evaluar la solicitud {$solicitudId}."));

                return null;
            }

            $this->solicitudes->moverA($solicitudId, 'EN_EVALUACION');

            $central = $this->consultarCentral($datos);
            if ($central === null) {
                return null;
            }

            $entrada = new EntradaEvaluacion(
                cuotaMensual: (int) $datos['cuota_estimada'],
                ingresoMensual: (int) ($datos['ingreso_mensual'] ?? 0),
                egresoMensual: (int) ($datos['egreso_mensual'] ?? 0),
                antiguedadLaboralMeses: (int) ($datos['antiguedad_laboral_meses'] ?? 0),
                mesesComoCliente: $this->mesesComoCliente($datos['cliente_id'], $radicadaEn),
                moraMaximaDias: $central['mora_maxima_dias'],
                saldoTotal: $central['saldo_total'],
                obligacionesVigentes: $central['obligaciones_vigentes'],
                consultasUltimos6Meses: $central['consultas_ultimos_6_meses'],
            );

            $evaluacion = $this->registrar($datos, $entrada, $reglas, $politica, $radicadaEn);
            $this->aplicarDecision($evaluacion);

            return $this->formatear($evaluacion);
        });
    }

    /**
     * Igual que evaluarRadicada(), pero un error inesperado no se propaga: se informa y la
     * solicitud pasa a evaluación manual (RNF-09). Es lo que corre la escucha del evento.
     */
    public function evaluarRadicadaSinFallar(string $solicitudId): void
    {
        try {
            $this->evaluarRadicada($solicitudId);
        } catch (Throwable $error) {
            report($error);
            $this->comoSistema(function () use ($solicitudId) {
                try {
                    $estado = $this->solicitudes->datos($solicitudId)['estado'] ?? null;
                    if ($estado === 'EN_EVALUACION') {
                        $this->derivarAManual($solicitudId, 'error_motor', 'La evaluación automática no se pudo completar. La solicitud pasó a estudio manual.');
                    }
                } catch (Throwable $otro) {
                    report($otro);
                }
            });
        }
    }

    /**
     * CP0013 paso 8 / RN-45: vuelve a calcular una evaluación con su misma entrada y sus mismas
     * versiones y la guarda como una fila nueva (la anterior no cambia). No mueve la solicitud.
     *
     * @return array<string, mixed>
     */
    public function reevaluar(string $evaluacionId, ?int $actorId = null): array
    {
        $anterior = Evaluacion::findOrFail($evaluacionId);
        $reglas = $this->reglas->porVersion($anterior->version_reglas);
        $politica = $this->parametros->porVersion($anterior->version_parametros);

        $nueva = $this->registrar(
            [
                'id' => $anterior->solicitud_id,
                'cliente_id' => $anterior->cliente_id,
                'radicado' => $anterior->radicado,
                'fuente_central' => $anterior->fuente_central,
            ],
            EntradaEvaluacion::desdeArray($anterior->entradas),
            $reglas,
            $politica,
            $anterior->radicada_en ? CarbonImmutable::instance($anterior->radicada_en) : null,
        );

        $this->auditoria->registrar('evaluacion.reevaluada', 'solicitud', $anterior->solicitud_id, detalle: [
            'anterior' => $anterior->id,
            'nueva' => $nueva->id,
            'mismo_resultado' => $nueva->puntaje === $anterior->puntaje && $nueva->decision_sugerida === $anterior->decision_sugerida,
        ], usuarioId: $actorId);

        return $this->formatear($nueva);
    }

    /**
     * La última evaluación de la solicitud, con la forma `Evaluacion` del contrato (siempre con
     * version_reglas, RN-44), o null si no tiene (por ejemplo, la central no respondió).
     *
     * @return array<string, mixed>|null
     */
    public function ultima(string $solicitudId): ?array
    {
        $evaluacion = Evaluacion::where('solicitud_id', $solicitudId)->orderByDesc('secuencia')->first();

        return $evaluacion ? $this->formatear($evaluacion) : null;
    }

    /**
     * Lo que respondió la central en la última evaluación, con la forma `ConsultaCentral` de
     * tipos.ts, para el expediente del oficial (V3). Null si no hubo evaluación automática.
     *
     * @return array<string, mixed>|null
     */
    public function consultaCentral(string $solicitudId): ?array
    {
        $evaluacion = Evaluacion::where('solicitud_id', $solicitudId)->orderByDesc('secuencia')->first();
        if (! $evaluacion) {
            return null;
        }
        $entradas = $evaluacion->entradas;

        return [
            'fuente' => $evaluacion->fuente_central,
            'consultada_en' => $evaluacion->evaluada_en->toIso8601String(),
            'obligaciones_vigentes' => (int) ($entradas['obligaciones_vigentes'] ?? 0),
            'saldo_total' => (int) ($entradas['saldo_total'] ?? 0),
            'mora_maxima_dias' => (int) ($entradas['mora_maxima_dias'] ?? 0),
            'consultas_ultimos_6_meses' => (int) ($entradas['consultas_ultimos_6_meses'] ?? 0),
            // La calificación de la central no es variable del motor y no se guarda en la evaluación.
            'calificacion' => 'No informada',
        ];
    }

    /** @return array{obligaciones_vigentes: int, saldo_total: int, mora_maxima_dias: int, consultas_ultimos_6_meses: int, calificacion: string}|null */
    private function consultarCentral(array $datos): ?array
    {
        $clienteId = (int) $datos['cliente_id'];

        // RN-19 / RN-33: sin autorización vigente no se consulta.
        if (! $this->clientes->tieneConsentimiento($clienteId, 'consulta_centrales')) {
            $this->derivarAManual($datos['id'], 'sin_autorizacion_centrales', 'No hay autorización vigente para consultar centrales. La solicitud pasó a estudio manual.');

            return null;
        }

        $documento = $this->clientes->documentoParaCentrales($clienteId);
        $simulado = $this->central->esSimulado();

        for ($intento = 1; $documento && $intento <= self::INTENTOS_CENTRAL; $intento++) {
            try {
                $resultado = $this->central->consultar($documento['tipo'], $documento['numero'], (int) ($datos['ingreso_mensual'] ?? 0));
                // MR-003: cada llamada al tercero queda en la auditoría, marcada si es simulada.
                $this->auditoria->registrar('evaluacion.consulta_central', 'solicitud', $datos['id'], detalle: [
                    'intento' => $intento,
                ], modoSimulado: $simulado);

                return $resultado;
            } catch (CentralNoDisponible) {
                $this->auditoria->registrar('evaluacion.consulta_central', 'solicitud', $datos['id'], Auditoria::FALLO, [
                    'intento' => $intento,
                ], modoSimulado: $simulado);
            }
        }

        $this->derivarAManual($datos['id'], 'central_no_disponible', 'La central de riesgo no respondió. La solicitud pasó a estudio manual sin evaluación automática (RF-08 FA-02).');

        return null;
    }

    /**
     * D20 (P9): el concepto del analista se posterga en la primera versión, así que la solicitud
     * que queda EN_ESTUDIO pasa enseguida a EN_DECISION por E3, para que llegue a la bandeja del oficial.
     */
    private function pasarAEstudio(string $solicitudId, string $texto): void
    {
        $this->solicitudes->moverA($solicitudId, 'EN_ESTUDIO', $texto);
        $this->solicitudes->moverA($solicitudId, 'EN_DECISION', self::MOTIVO_CONCEPTO_POSTERGADO);
    }

    private function derivarAManual(string $solicitudId, string $motivo, string $texto): void
    {
        $this->pasarAEstudio($solicitudId, $texto);
        $this->auditoria->registrar('evaluacion.derivada_a_manual', 'solicitud', $solicitudId, detalle: ['motivo' => $motivo]);
    }

    private function registrar(array $datos, EntradaEvaluacion $entrada, array $reglas, array $politica, ?CarbonImmutable $radicadaEn): Evaluacion
    {
        $resultado = $this->motor->evaluar($entrada, $reglas['definicion'], $politica);

        $evaluacion = DB::transaction(function () use ($datos, $entrada, $reglas, $politica, $radicadaEn, $resultado) {
            $secuencia = (int) Evaluacion::where('solicitud_id', $datos['id'])->lockForUpdate()->max('secuencia') + 1;

            return Evaluacion::create([
                'solicitud_id' => $datos['id'],
                'secuencia' => $secuencia,
                'cliente_id' => $datos['cliente_id'],
                'radicado' => $datos['radicado'] ?? null,
                'version_reglas' => $reglas['version'],
                'version_parametros' => $politica['version'],
                'puntaje' => $resultado['puntaje'],
                'escala_min' => $resultado['escala_min'],
                'escala_max' => $resultado['escala_max'],
                'nivel_riesgo' => $resultado['nivel_riesgo'],
                'decision_sugerida' => $resultado['decision_sugerida'],
                'causal' => $resultado['causal'],
                'umbral_aprobar' => $resultado['umbrales']['aprobar'],
                'umbral_negar' => $resultado['umbrales']['negar'],
                'variables_determinantes' => $resultado['variables'],
                'capacidad_pago' => $resultado['capacidad_pago'],
                'entradas' => $entrada->toArray(),
                'fuente_central' => $datos['fuente_central'] ?? ($this->central->esSimulado() ? 'simulada' : 'real'),
                'radicada_en' => $radicadaEn,
                'evaluada_en' => now(),
                'registrado_en' => now(),
            ]);
        });

        $this->auditoria->registrar('evaluacion.registrada', 'solicitud', $evaluacion->solicitud_id, detalle: [
            'evaluacion' => $evaluacion->id,
            'puntaje' => $evaluacion->puntaje,
            'decision' => $evaluacion->decision_sugerida,
            'version_reglas' => $evaluacion->version_reglas,
        ], modoSimulado: $evaluacion->fuente_central === 'simulada');

        return $evaluacion;
    }

    /** RN-40 / RN-41 / RF-08 FA-01 y FA-04: la decisión del motor mueve la solicitud. */
    private function aplicarDecision(Evaluacion $evaluacion): void
    {
        [$estado, $motivo] = match ($evaluacion->decision_sugerida) {
            MotorReglas::APROBAR => ['APROBADA', 'Aprobación automática del motor de reglas'],
            MotorReglas::NEGAR => ['NEGADA', 'Negación automática del motor de reglas'],
            default => ['EN_ESTUDIO', 'El motor de reglas escaló la solicitud a revisión humana'],
        };

        $texto = "{$motivo}: puntaje {$evaluacion->puntaje} ({$evaluacion->version_reglas}).";
        if ($estado === 'EN_ESTUDIO') {
            $this->pasarAEstudio($evaluacion->solicitud_id, $texto);
        } else {
            $this->solicitudes->moverA($evaluacion->solicitud_id, $estado, $texto);
            // RN-46: la decisión automática queda registrada y Desembolso emite la oferta (T18).
            $this->decisiones->registrarAutomatica(
                $evaluacion->solicitud_id, $evaluacion->id, $estado === 'APROBADA' ? 'aprobada' : 'negada', $texto,
            );
        }

        EvaluacionCompletada::dispatch(
            $evaluacion->solicitud_id, $evaluacion->id, $evaluacion->cliente_id, $evaluacion->decision_sugerida,
            $evaluacion->puntaje, $evaluacion->version_reglas, $evaluacion->fuente_central === 'simulada',
        );
    }

    private function mesesComoCliente(int $clienteId, CarbonImmutable $momento): int
    {
        $desde = $this->clientes->clienteDesde($clienteId);

        return $desde ? intdiv((int) max(0, CarbonImmutable::parse($desde)->diffInDays($momento)), 30) : 0;
    }

    /** Forma `Evaluacion` de frontend/src/lib/api/tipos.ts. */
    private function formatear(Evaluacion $e): array
    {
        return [
            'id' => $e->id,
            'solicitud_id' => $e->solicitud_id,
            'secuencia' => $e->secuencia,
            'puntaje' => $e->puntaje,
            'escala_min' => $e->escala_min,
            'escala_max' => $e->escala_max,
            'nivel_riesgo' => $e->nivel_riesgo,
            'decision_sugerida' => $e->decision_sugerida,
            'causal' => $e->causal,
            'umbrales' => ['aprobar' => $e->umbral_aprobar, 'negar' => $e->umbral_negar],
            'version_reglas' => $e->version_reglas,
            'version_parametros' => $e->version_parametros,
            'evaluada_en' => $e->evaluada_en->toIso8601String(),
            // RN-46: desde la radicación hasta el resultado.
            'duracion_segundos' => $e->radicada_en ? (int) max(0, $e->radicada_en->diffInSeconds($e->evaluada_en)) : 0,
            'variables' => $e->variables_determinantes,
            'capacidad_pago' => $e->capacidad_pago,
            'fuente_central' => $e->fuente_central,
        ];
    }

    /**
     * El motor actúa como el sistema: la auditoría de sus cambios no queda a nombre de la
     * persona cuya petición lo disparó (D15). Se restaura al terminar.
     *
     * @template T
     *
     * @param  callable(): T  $accion
     * @return T
     */
    private function comoSistema(callable $accion): mixed
    {
        $previo = Auth::user();
        Auth::forgetUser();

        try {
            return $accion();
        } finally {
            if ($previo) {
                Auth::setUser($previo);
            }
        }
    }
}
