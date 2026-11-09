<?php

namespace App\Modules\Evaluacion\Services;

use App\Modules\Evaluacion\Contracts\SolicitudesEvaluables;
use App\Modules\Evaluacion\Events\DecisionRegistrada;
use App\Modules\Evaluacion\Models\Decision;
use App\Modules\Evaluacion\Models\VersionParametros;
use App\Modules\Evaluacion\Motor\CatalogoExplicaciones;
use App\Modules\Identidad\Services\Auditoria;
use App\Modules\Identidad\Services\Datos\UsuarioAutenticado;
use App\Modules\Identidad\Services\PerfilCliente;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\DB;

/**
 * Decisión del oficial de crédito (RF-10, UC10, T15) e interfaz pública del módulo sobre las
 * decisiones. Todas las reglas se verifican aquí, en el servidor (RNF-05):
 *
 * - RN-54: el motivo es obligatorio.
 * - RN-53: quien aprueba tiene atribución para el monto; si no, va al comité.
 * - RN-55: nadie decide sobre sí mismo ni sobre un cliente con el que declaró un vínculo.
 * - RN-56: quien publicó parámetros de crédito no decide (segregación de funciones).
 * - RN-57: la tasa aprobada no pasa de la máxima legal vigente; monto y plazo, en el rango del producto.
 * - RN-58: la decisión es de solo adición (trait y triggers).
 *
 * Toda decisión final publica DecisionRegistrada; Desembolso la escucha para emitir la oferta (T18).
 */
class DecisionesCredito
{
    public const RESULTADOS = ['aprobada', 'aprobada_condicionada', 'negada', 'comite'];

    public const MOTIVO_MINIMO = 10;

    public const AUTOR_MOTOR = 'Motor de reglas';

    private const ESTADO_RESULTANTE = [
        'aprobada' => 'APROBADA',
        'aprobada_condicionada' => 'APROBADA_CONDICIONADA',
        'negada' => 'NEGADA',
        'comite' => 'EN_COMITE',
    ];

    public function __construct(
        private readonly SolicitudesEvaluables $solicitudes,
        private readonly PerfilCliente $clientes,
        private readonly ParametrosVigentes $parametros,
        private readonly Auditoria $auditoria,
    ) {}

    /**
     * Forma `ContextoDecision` de tipos.ts: lo que el oficial necesita antes de decidir.
     *
     * @return array<string, mixed>
     *
     * @throws ErrorNegocio 404 no_encontrada
     */
    public function contexto(string $solicitudId, UsuarioAutenticado $oficial): array
    {
        $solicitud = $this->solicitud($solicitudId);

        return [
            'atribucion_monto' => $oficial->atribucionMonto ?? 0,
            'tasa_maxima_legal_ea' => $this->parametros->tasaMaximaLegalEa(),
            'bloqueo' => $this->bloqueo($oficial, $solicitud['cliente_id']),
            'decisiones_previas' => Decision::where('solicitud_id', $solicitudId)
                ->orderBy('registrado_en')->get()
                ->map(fn (Decision $d) => [
                    'resultado' => $d->resultado,
                    'motivo' => $d->motivo,
                    'autor' => $d->autor_nombre,
                    'fecha' => $d->registrado_en->toIso8601String(),
                    'automatizada' => $d->automatizada,
                ])->all(),
        ];
    }

    /**
     * Registra la decisión del oficial y mueve la solicitud (RF-10). Devuelve el expediente.
     *
     * @param  array{solicitud_id: string, resultado?: ?string, motivo?: ?string,
     *     ajustes?: ?array{monto: int, plazo_meses: int, tasa_ea: float}}  $datos
     * @return array<string, mixed>
     *
     * @throws ErrorNegocio
     */
    public function registrar(UsuarioAutenticado $oficial, array $datos): array
    {
        $solicitud = $this->solicitud($datos['solicitud_id']);
        $id = $solicitud['id'];

        if ($solicitud['estado'] === 'EN_COMITE') {
            throw new ErrorNegocio('en_comite', 'Esta solicitud la decide el comité de crédito.', 409);
        }
        if ($solicitud['estado'] !== 'EN_DECISION') {
            throw new ErrorNegocio('estado_invalido', 'Esta solicitud ya no está esperando decisión.', 409);
        }

        $motivo = trim((string) ($datos['motivo'] ?? ''));
        if (mb_strlen($motivo) < self::MOTIVO_MINIMO) {
            throw new ErrorNegocio('motivo_requerido', 'Escribe el motivo de la decisión (al menos 10 caracteres).', 422);
        }

        $resultado = (string) ($datos['resultado'] ?? '');
        if (! in_array($resultado, self::RESULTADOS, true)) {
            throw new ErrorNegocio('resultado_invalido', 'Elige aprobar, aprobar con condiciones, negar o enviar a comité.', 422);
        }

        if ($bloqueo = $this->bloqueo($oficial, $solicitud['cliente_id'])) {
            $this->rechazar($oficial, $id, $bloqueo['codigo']);
            throw new ErrorNegocio($bloqueo['codigo'], $bloqueo['mensaje'], 403);
        }

        $condiciones = null;
        if (in_array($resultado, ['aprobada', 'aprobada_condicionada'], true)) {
            $condiciones = $this->condiciones($oficial, $solicitud, $resultado, $datos['ajustes'] ?? null);
        }

        return $this->guardar($solicitud, $resultado, $motivo, $condiciones, $oficial);
    }

    /**
     * RN-46: la aprobación o negación automática del motor también queda como decisión, con el
     * motor como autor, y publica DecisionRegistrada para que Desembolso emita la oferta.
     */
    public function registrarAutomatica(string $solicitudId, string $evaluacionId, string $resultado, string $motivo): void
    {
        $solicitud = $this->solicitud($solicitudId);
        $condiciones = $resultado === 'aprobada' ? [
            'monto' => (int) $solicitud['monto'],
            'plazo_meses' => (int) $solicitud['plazo_meses'],
            'tasa_ea' => (float) $solicitud['tasa_ea'],
        ] : null;

        $this->guardar($solicitud, $resultado, $motivo, $condiciones, null, $evaluacionId, moverSolicitud: false);
    }

    /** Decisiones que tomó hoy este usuario (indicador de la bandeja, RF-07). */
    public function atendidasHoy(int $usuarioId): int
    {
        return Decision::where('autor_usuario_id', $usuarioId)
            ->where('registrado_en', '>=', now()->startOfDay())
            ->count();
    }

    /**
     * RN-55 y RN-56. Null si puede decidir.
     *
     * @return array{codigo: string, mensaje: string}|null
     */
    public function bloqueo(UsuarioAutenticado $usuario, int $clienteId): ?array
    {
        if ($this->clientes->tieneVinculo($usuario->id, $clienteId)) {
            return [
                'codigo' => 'conflicto_interes',
                'mensaje' => 'Tienes un vínculo registrado con este cliente, así que no puedes decidir esta solicitud. Pide que la reasignen a otro oficial.',
            ];
        }
        if (VersionParametros::where('publicado_por_id', $usuario->id)->exists()) {
            return [
                'codigo' => 'segregacion',
                'mensaje' => 'Publicaste parámetros de crédito, así que no puedes decidir solicitudes (segregación de funciones).',
            ];
        }

        return null;
    }

    /**
     * RN-53 y RN-57. Sin ajustes se aprueba lo que pidió el cliente, a la tasa de su solicitud.
     *
     * @return array{monto: int, plazo_meses: int, tasa_ea: float}
     */
    private function condiciones(UsuarioAutenticado $oficial, array $solicitud, string $resultado, ?array $ajustes): array
    {
        $condiciones = $resultado === 'aprobada_condicionada' && $ajustes
            ? ['monto' => (int) $ajustes['monto'], 'plazo_meses' => (int) $ajustes['plazo_meses'], 'tasa_ea' => (float) $ajustes['tasa_ea']]
            : ['monto' => (int) $solicitud['monto'], 'plazo_meses' => (int) $solicitud['plazo_meses'], 'tasa_ea' => (float) $solicitud['tasa_ea']];

        $atribucion = $oficial->atribucionMonto ?? 0;
        if ($condiciones['monto'] > $atribucion) {
            $this->rechazar($oficial, $solicitud['id'], 'fuera_de_atribucion');
            throw new ErrorNegocio(
                'fuera_de_atribucion',
                'El monto supera tu atribución de $ '.number_format($atribucion, 0, ',', '.').'. Envía la solicitud al comité.',
                403,
            );
        }

        $maxima = $this->parametros->tasaMaximaLegalEa();
        if ($condiciones['tasa_ea'] > $maxima) {
            throw new ErrorNegocio(
                'tasa_supera_maxima',
                'La tasa no puede pasar de la máxima legal ('.number_format($maxima, 2, ',', '.').' % E.A.).',
                422,
            );
        }

        $producto = $this->parametros->producto($solicitud['producto']);
        if ($producto && (
            $condiciones['monto'] < $producto['monto_min'] || $condiciones['monto'] > $producto['monto_max']
            || $condiciones['plazo_meses'] < $producto['plazo_min'] || $condiciones['plazo_meses'] > $producto['plazo_max']
            || $condiciones['tasa_ea'] <= 0
        )) {
            throw new ErrorNegocio('ajuste_fuera_de_rango', 'El monto o el plazo ajustados están fuera del rango del producto.', 422);
        }

        return $condiciones;
    }

    /** @return array<string, mixed> */
    private function guardar(
        array $solicitud,
        string $resultado,
        string $motivo,
        ?array $condiciones,
        ?UsuarioAutenticado $autor,
        ?string $evaluacionId = null,
        bool $moverSolicitud = true,
    ): array {
        $estado = self::ESTADO_RESULTANTE[$resultado];

        $decision = DB::transaction(function () use ($solicitud, $resultado, $motivo, $condiciones, $autor, $evaluacionId, $estado, $moverSolicitud) {
            $decision = Decision::create([
                'solicitud_id' => $solicitud['id'],
                'cliente_id' => $solicitud['cliente_id'],
                'radicado' => $solicitud['radicado'],
                'evaluacion_id' => $evaluacionId,
                'resultado' => $resultado,
                'motivo' => $motivo,
                'automatizada' => $autor === null,
                'autor_usuario_id' => $autor?->id,
                'autor_nombre' => $autor?->nombreCompleto ?? self::AUTOR_MOTOR,
                'atribucion_monto' => $autor?->atribucionMonto,
                'monto' => $condiciones['monto'] ?? null,
                'plazo_meses' => $condiciones['plazo_meses'] ?? null,
                'tasa_ea' => $condiciones['tasa_ea'] ?? null,
                'condicionada' => $resultado === 'aprobada_condicionada',
                'estado_resultante' => $estado,
                'registrado_en' => now(),
            ]);

            // E3: la máquina de estados de Originacion bloquea la fila; si otro oficial decidió
            // primero, la transición falla y esta decisión no se guarda.
            if ($moverSolicitud) {
                $this->solicitudes->moverA($solicitud['id'], $estado, "Decisión del oficial: {$motivo}", $autor?->id);
            }

            if ($resultado !== 'comite') {
                $finales = $condiciones ?? ['monto' => (int) $solicitud['monto'], 'plazo_meses' => (int) $solicitud['plazo_meses'], 'tasa_ea' => (float) $solicitud['tasa_ea']];
                DecisionRegistrada::dispatch(
                    $solicitud['id'], $decision->id, (int) $solicitud['cliente_id'], $resultado,
                    $finales['monto'], $finales['plazo_meses'], $finales['tasa_ea'], $autor === null,
                    // D6/UX-03: llega al cliente en la oferta; el motivo del oficial es interno (RN-54).
                    $resultado === 'aprobada_condicionada' ? CatalogoExplicaciones::APROBADA_CONDICIONADA : null,
                    $decision->registrado_en->toIso8601String(),
                );
            }

            return $decision;
        });

        $this->auditoria->registrar('decision.registrada', 'solicitud', $solicitud['id'], detalle: [
            'decision' => $decision->id,
            'resultado' => $resultado,
            'automatizada' => $decision->automatizada,
            'monto' => $decision->monto,
        ], usuarioId: $autor?->id);

        return $moverSolicitud ? $this->solicitudes->expediente($solicitud['id']) : [];
    }

    private function rechazar(UsuarioAutenticado $oficial, string $solicitudId, string $codigo): void
    {
        $this->auditoria->registrar('decision.rechazada', 'solicitud', $solicitudId, Auditoria::RECHAZO, ['codigo' => $codigo], $oficial->id);
    }

    /** @throws ErrorNegocio 404 no_encontrada */
    private function solicitud(string $solicitudId): array
    {
        $datos = $this->solicitudes->datos($solicitudId);
        if (! $datos || ($datos['radicado'] ?? null) === null) {
            throw new ErrorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404);
        }

        return $datos;
    }
}
