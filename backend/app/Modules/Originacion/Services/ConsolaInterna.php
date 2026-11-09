<?php

namespace App\Modules\Originacion\Services;

use App\Modules\Evaluacion\Services\DecisionesCredito;
use App\Modules\Evaluacion\Services\Evaluaciones;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\Identidad\Services\Datos\UsuarioAutenticado;
use App\Modules\Identidad\Services\Enmascarar;
use App\Modules\Identidad\Services\PerfilCliente;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Modules\Originacion\Models\HistorialEstado;
use App\Modules\Originacion\Models\Solicitud;
use App\Shared\Exceptions\ErrorNegocio;
use Carbon\CarbonImmutable;

/**
 * V3 (backend-senior, P9, D23): bandeja y expediente de la consola interna (RF-07, RF-10),
 * con las formas `Bandeja` y `Expediente` de frontend/src/lib/api/tipos.ts.
 *
 * Primera versión: el oficial ve EN_DECISION y EN_COMITE. El concepto del analista, las
 * observaciones, la reasignación y la reconsideración llegan con T17 y T23 (fullstack-senior).
 * El cliente se muestra enmascarado (RNF-06).
 */
class ConsolaInterna
{
    /** Colas por rol (RF-07). */
    public const COLAS = [
        'oficial' => [EstadoSolicitud::EN_DECISION, EstadoSolicitud::EN_COMITE],
        'analista' => [EstadoSolicitud::EN_ESTUDIO, EstadoSolicitud::PENDIENTE_CLIENTE],
    ];

    /** Horas de atención por estado para el semáforo; las mismas del portal simulado. */
    public const SLA_HORAS = [
        'EN_ESTUDIO' => 24,
        'EN_DECISION' => 24,
        'EN_COMITE' => 48,
        'PENDIENTE_CLIENTE' => 15 * 24, // UC8: 15 días para cargar el documento
    ];

    public function __construct(
        private readonly VistaSolicitud $vista,
        private readonly DirectorioClientes $clientes,
        private readonly PerfilCliente $perfil,
        private readonly ParametrosVigentes $parametros,
    ) {}

    /**
     * @param  array{estado?: ?string, producto?: ?string, monto_min?: ?int, monto_max?: ?int}  $filtros
     * @return array{indicadores: array<string, int>, solicitudes: list<array<string, mixed>>}
     */
    public function bandeja(UsuarioAutenticado $usuario, array $filtros = []): array
    {
        $cola = self::COLAS[$usuario->rol] ?? [];
        $items = Solicitud::whereIn('estado', array_map(fn (EstadoSolicitud $e) => $e->value, $cola))
            ->whereNotNull('radicado')
            ->get()
            ->map(fn (Solicitud $s) => $this->item($s));

        $filtradas = $items->filter(fn (array $i) => $this->cumple($i, $filtros))
            ->sortBy('sla_vence_en')->values();
        $pendiente = $cola[0]->value ?? null;

        return [
            'indicadores' => [
                'asignadas' => $items->count(),
                'atendidas_hoy' => $usuario->rol === 'oficial' ? app(DecisionesCredito::class)->atendidasHoy($usuario->id) : 0,
                'pendientes' => $items->where('estado', $pendiente)->count(),
                'proximas_a_vencer' => $items->where('semaforo', '!=', 'a_tiempo')->count(),
            ],
            'solicitudes' => $filtradas->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ErrorNegocio 404 no_encontrada
     */
    public function expediente(string $solicitudId): array
    {
        $solicitud = Solicitud::whereKey($solicitudId)->whereNotNull('radicado')->first()
            ?? throw new ErrorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404);
        // El expediente necesita más que RN-32 (estado_kyc, cliente_desde): se lee de Identidad, ya enmascarado.
        $cliente = $this->perfil->datosConocidos($solicitud->cliente_id)
            ?? throw new ErrorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404);
        [, $vence, $semaforo] = $this->sla($solicitud);

        return [
            'solicitud' => $this->vista->detalle($solicitud),
            'solicitante' => [
                'nombre_completo' => $cliente['nombre_completo'],
                'documento_enmascarado' => $cliente['documento_enmascarado'],
                'edad' => CarbonImmutable::parse($cliente['fecha_nacimiento'])->age,
                'email' => Enmascarar::correo($cliente['email']),
                'telefono_enmascarado' => $cliente['telefono_enmascarado'],
                'cliente_desde' => $cliente['cliente_desde'],
                'estado_kyc' => $cliente['estado_kyc'],
            ],
            'historial_finantech' => Solicitud::where('cliente_id', $solicitud->cliente_id)
                ->whereKeyNot($solicitud->id)->whereNotNull('radicado')->orderByDesc('radicada_en')->get()
                ->map(fn (Solicitud $s) => [
                    'radicado' => $s->radicado,
                    'producto' => $this->nombreProducto($s->producto_codigo),
                    'monto' => $s->monto,
                    'estado' => $s->estado->value,
                    'fecha' => ($s->radicada_en ?? $s->created_at)->toIso8601String(),
                ])->all(),
            'central' => app(Evaluaciones::class)->consultaCentral($solicitud->id),
            'observaciones' => [],   // T17
            'concepto' => null,      // postergado en la primera versión (P9, D20)
            'analista' => null,
            'sla_vence_en' => $vence,
            'semaforo' => $semaforo,
            'reconsideracion' => null, // T23
        ];
    }

    /** @return array<string, mixed> */
    private function item(Solicitud $solicitud): array
    {
        $cliente = $this->clientes->datosConocidos($solicitud->cliente_id);
        [$desde, $vence, $semaforo] = $this->sla($solicitud);

        return [
            'id' => $solicitud->id,
            'radicado' => $solicitud->radicado,
            'cliente' => $cliente['nombre_completo'],
            'documento_enmascarado' => $cliente['documento_enmascarado'],
            'producto' => $this->nombreProducto($solicitud->producto_codigo),
            'producto_codigo' => $solicitud->producto_codigo,
            'monto' => $solicitud->monto,
            'estado' => $solicitud->estado->value,
            'en_cola_desde' => $desde,
            'sla_vence_en' => $vence,
            'semaforo' => $semaforo,
            'reconsideracion' => false, // T23
        ];
    }

    private function cumple(array $item, array $filtros): bool
    {
        $producto = $filtros['producto'] ?? null;

        return (empty($filtros['estado']) || $item['estado'] === $filtros['estado'])
            && (empty($producto) || $item['producto'] === $producto || $item['producto_codigo'] === $producto)
            && $item['monto'] >= (int) ($filtros['monto_min'] ?? 0)
            && (! isset($filtros['monto_max']) || $item['monto'] <= (int) $filtros['monto_max']);
    }

    /**
     * Desde cuándo está en su estado actual, cuándo vence y el semáforo (RF-07):
     * vencida si pasó el plazo; por vencer si le queda el 25 % o menos.
     *
     * @return array{0: string, 1: string, 2: string}
     */
    private function sla(Solicitud $solicitud): array
    {
        $entrada = $solicitud->historial()->get()
            ->last(fn (HistorialEstado $h) => $h->estado_nuevo === $solicitud->estado);
        $desde = CarbonImmutable::parse($entrada?->registrado_en ?? $solicitud->updated_at);
        $vence = $desde->addHours(self::SLA_HORAS[$solicitud->estado->value] ?? 24);

        $total = $vence->getTimestamp() - $desde->getTimestamp();
        $restante = $vence->getTimestamp() - now()->getTimestamp();
        $semaforo = match (true) {
            $restante <= 0 => 'vencida',
            $restante / $total <= 0.25 => 'por_vencer',
            default => 'a_tiempo',
        };

        return [$desde->toIso8601String(), $vence->toIso8601String(), $semaforo];
    }

    private function nombreProducto(string $codigo): string
    {
        return $this->parametros->producto($codigo)['nombre'] ?? $codigo;
    }
}
