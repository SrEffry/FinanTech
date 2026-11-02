<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\PoliticaTratamiento;
use App\Shared\Exceptions\ErrorNegocio;

/**
 * RF-04: consentimiento por finalidad, "Mis datos y privacidad".
 *
 * - RN-04: cada cambio queda con fecha y hora, canal y versión de la política.
 * - RN-18: las finalidades necesarias no se revocan desde aquí (exigen terminar el producto).
 * - RN-21: el histórico es de solo adición; el estado vigente es el último movimiento.
 * - RN-19: PerfilCliente::tieneConsentimiento() lee el mismo estado para la consulta a centrales.
 */
class Consentimientos
{
    public function __construct(private readonly Auditoria $auditoria) {}

    /**
     * Estado con la forma `Consentimientos` del contrato.
     *
     * @return array{politica: array{version: string, vigente_desde: string}, finalidades: list<array<string, mixed>>, historial: list<array<string, mixed>>}
     */
    public function estado(int $clienteId): array
    {
        $politica = PoliticaTratamiento::vigente()->load('finalidades');
        $movimientos = Consentimiento::where('cliente_id', $clienteId)->orderBy('registrado_en')->orderBy('id')->get();
        $nombres = $politica->finalidades->pluck('nombre', 'codigo');

        return [
            'politica' => [
                'version' => $politica->version,
                'vigente_desde' => $politica->vigente_desde->toDateString(),
            ],
            'finalidades' => $politica->finalidades->map(function ($finalidad) use ($movimientos) {
                $ultimo = $movimientos->where('finalidad_codigo', $finalidad->codigo)->last();

                return [
                    'codigo' => $finalidad->codigo,
                    'nombre' => $finalidad->nombre,
                    'descripcion' => $finalidad->descripcion,
                    'necesaria' => $finalidad->necesaria,
                    'otorgada' => $ultimo?->accion === Consentimiento::OTORGA,
                    'actualizada_en' => $ultimo?->registrado_en->toIso8601String(),
                ];
            })->values()->all(),
            'historial' => $movimientos->reverse()->map(fn (Consentimiento $c) => [
                'id' => $c->id,
                'finalidad' => $c->finalidad_codigo,
                'nombre_finalidad' => $nombres[$c->finalidad_codigo] ?? $c->finalidad_codigo,
                'accion' => $c->accion,
                'canal' => $c->canal,
                'version_politica' => $c->version_politica,
                'fecha_registro' => $c->registrado_en->toIso8601String(),
            ])->values()->all(),
        ];
    }

    /** Otorga o revoca una finalidad opcional. Si ya estaba así, no registra nada. */
    public function registrar(int $clienteId, int $usuarioId, string $finalidad, string $accion, string $canal): array
    {
        $politica = PoliticaTratamiento::vigente()->load('finalidades');
        $definicion = $politica->finalidades->firstWhere('codigo', $finalidad);

        if (! $definicion || ! in_array($accion, [Consentimiento::OTORGA, Consentimiento::REVOCA], true)) {
            throw new ErrorNegocio('finalidad_invalida', 'Esa finalidad no existe en la política vigente.', 422);
        }

        // RN-18 / RF-04 FA-01: revocar una necesaria equivale a terminar la relación del producto.
        if ($definicion->necesaria && $accion === Consentimiento::REVOCA) {
            throw new ErrorNegocio(
                'finalidad_necesaria',
                'Esta autorización es necesaria para prestarte el servicio. Para retirarla debes terminar tu relación con FinanTech; comunícate con nuestros canales de atención.',
                422,
            );
        }

        $vigente = Consentimiento::where('cliente_id', $clienteId)->where('finalidad_codigo', $finalidad)
            ->orderByDesc('registrado_en')->orderByDesc('id')->value('accion');
        $otorgada = $vigente === Consentimiento::OTORGA;

        if ($otorgada !== ($accion === Consentimiento::OTORGA)) {
            // RN-21: solo adición; el movimiento anterior nunca se modifica.
            $movimiento = Consentimiento::create([
                'cliente_id' => $clienteId,
                'finalidad_codigo' => $finalidad,
                'accion' => $accion,
                'version_politica' => $politica->version,
                'canal' => $canal,
                'registrado_en' => now(),
            ]);

            $this->auditoria->registrar(
                $accion === Consentimiento::OTORGA ? 'consentimiento.otorgado' : 'consentimiento.revocado',
                'consentimiento',
                $movimiento->id,
                detalle: ['finalidad' => $finalidad, 'canal' => $canal, 'version_politica' => $politica->version],
                usuarioId: $usuarioId,
            );
        }

        return $this->estado($clienteId);
    }
}
