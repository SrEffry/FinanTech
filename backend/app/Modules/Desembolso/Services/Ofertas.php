<?php

namespace App\Modules\Desembolso\Services;

use App\Modules\Cliente\Services\CalculadoraCredito;
use App\Modules\Desembolso\Contracts\FirmaElectronicaService;
use App\Modules\Desembolso\Models\Oferta;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\Identidad\Services\Auditoria;
use App\Modules\Identidad\Services\PerfilCliente;
use App\Modules\Identidad\Services\SegundoFactor;
use App\Modules\Originacion\Services\SolicitudesPorId;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Oferta y pagaré (RF-11, UC12), lo vital de la primera versión (P9):
 *
 * - RN-59: la oferta vence a los 15 días calendario; el vencimiento se aplica al consultarla.
 * - RN-61: aceptarla exige el segundo factor (SegundoFactor de Identidad, propósito propio).
 * - RN-62 / MR-004: el pagaré se firma con FirmaElectronicaService; en modo simulado la
 *   firma va marcada `simulada` y queda en la auditoría con modo_simulado.
 * - E3: al aceptar, la solicitud pasa a OFERTA_ACEPTADA y luego a FORMALIZADA; al
 *   rechazar, a OFERTA_RECHAZADA; al vencer, a OFERTA_VENCIDA.
 */
class Ofertas
{
    public const DIAS_VIGENCIA = 15;
    public const PROPOSITO_MFA = 'aceptar_oferta';
    public const VERSION_PAGARE = 'PG-1.0';

    public function __construct(
        private readonly SolicitudesPorId $solicitudes,
        private readonly ParametrosVigentes $parametros,
        private readonly CalculadoraCredito $calculadora,
        private readonly PerfilCliente $perfil,
        private readonly SegundoFactor $segundoFactor,
        private readonly FirmaElectronicaService $firma,
        private readonly Auditoria $auditoria,
    ) {}

    /**
     * Emite la oferta de una aprobación con sus condiciones finales (RF-10, RF-11 paso 1).
     * Idempotente por decisión: si ya existe, devuelve la misma.
     */
    public function emitir(string $solicitudId, string $decisionId, int $monto, int $plazoMeses, float $tasaEa, ?string $motivoCondicion = null): Oferta
    {
        if ($existente = Oferta::where('decision_id', $decisionId)->first()) {
            return $existente;
        }

        $solicitud = $this->solicitudes->datosParaEvaluacion($solicitudId)
            ?? throw new ErrorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404);

        $ahora = now();
        $tasaMaxima = $this->parametros->tasaMaximaLegalEa();
        // RN-23: la calculadora nunca aplica una tasa sobre la máxima legal.
        $credito = $this->calculadora->calcular($tasaEa, $monto, $plazoMeses, $tasaMaxima, $ahora);

        $cambiada = $monto !== $solicitud['monto'] || $plazoMeses !== $solicitud['plazo_meses']
            || abs($credito['tasa_ea'] - $solicitud['tasa_ea']) > 0.001;
        $original = $cambiada ? $this->calculadora->calcular($solicitud['tasa_ea'], $solicitud['monto'], $solicitud['plazo_meses'], $tasaMaxima, $ahora) : null;

        $finales = ['monto' => $monto, 'plazo_meses' => $plazoMeses, 'tasa_ea' => $credito['tasa_ea'], 'cuota' => $credito['cuota']];

        try {
            $oferta = Oferta::create([
                'solicitud_id' => $solicitudId,
                'decision_id' => $decisionId,
                'cliente_id' => $solicitud['cliente_id'],
                'radicado' => (string) $solicitud['radicado'],
                'producto_codigo' => $solicitud['producto'],
                'version_parametros' => $this->parametros->version(),
                ...$finales,
                'costo_total' => $credito['costo_total'],
                'valor_a_recibir' => $credito['valor_a_recibir'],
                'desglose' => $credito['desglose'],
                'plan' => $credito['plan'],
                'condiciones_originales' => $original ? [
                    'monto' => $solicitud['monto'], 'plazo_meses' => $solicitud['plazo_meses'],
                    'tasa_ea' => $original['tasa_ea'], 'cuota' => $original['cuota'],
                ] : null,
                'motivo_condicion' => $cambiada ? $motivoCondicion : null,
                'estado' => Oferta::VIGENTE,
                'emitida_en' => $ahora,
                'vence_en' => $ahora->copy()->addDays(self::DIAS_VIGENCIA),
                'pagare_version' => self::VERSION_PAGARE,
                'pagare_texto' => $this->textoPagare((string) $solicitud['radicado'], $solicitud['cliente_id'], $finales),
            ]);
        } catch (UniqueConstraintViolationException) {
            return Oferta::where('decision_id', $decisionId)->firstOrFail();
        }

        $this->auditoria->registrar('desembolso.oferta_emitida', 'oferta', $oferta->id, detalle: [
            'solicitud' => $solicitudId, 'decision' => $decisionId, 'condicionada' => $cambiada,
        ]);

        return $oferta;
    }

    /**
     * La oferta del cliente de la sesión, con el vencimiento ya aplicado (RN-59).
     *
     * @throws ErrorNegocio 404 no_encontrada (también si es de otro cliente)
     */
    public function propia(int $clienteId, string $id): Oferta
    {
        $oferta = Oferta::whereKey($id)->where('cliente_id', $clienteId)->first()
            ?? throw new ErrorNegocio('no_encontrada', 'No encontramos esa oferta.', 404);

        return $this->revisarVencimiento($oferta);
    }

    /** RN-61: código al correo para aceptar esta oferta. */
    public function pedirCodigo(Oferta $oferta, int $usuarioId): array
    {
        $this->exigirVigente($oferta);

        return $this->segundoFactor->emitirDesafio($usuarioId, self::PROPOSITO_MFA, $oferta->id);
    }

    /**
     * Acepta la oferta y firma el pagaré (RF-11 pasos 3 a 6).
     *
     * @throws ErrorNegocio 409 oferta_vencida / oferta_no_vigente, 422 declaracion_requerida,
     *                      errores del código (RN-61), 503 firma_no_disponible (RF-11 FA-03)
     */
    public function aceptar(Oferta $oferta, int $usuarioId, bool $declaracion, string $desafioId, #[\SensitiveParameter] string $codigo): Oferta
    {
        $this->exigirVigente($oferta);
        if (! $declaracion) {
            throw new ErrorNegocio('declaracion_requerida', 'Confirma que leíste y aceptas las condiciones y el pagaré.');
        }

        $this->segundoFactor->verificar($desafioId, trim($codigo), self::PROPOSITO_MFA, $usuarioId, $oferta->id);

        $firma = $this->firma->firmar($oferta->pagare_texto, "cliente:{$oferta->cliente_id}");

        DB::transaction(function () use ($oferta, $usuarioId, $firma) {
            $actual = Oferta::whereKey($oferta->id)->lockForUpdate()->firstOrFail();
            $this->exigirVigente($actual);

            $actual->update([
                'estado' => Oferta::FIRMADA,
                'firma_huella_sha256' => $firma['huella_sha256'],
                'firma_sellada_en' => $firma['sellado_en'],
                'firma_simulada' => $firma['simulada'],
                'firma_proveedor' => $firma['proveedor'],
                'cerrada_en' => now(),
            ]);
            $this->solicitudes->transicionar($actual->solicitud_id, 'OFERTA_ACEPTADA', $usuarioId, 'El cliente aceptó la oferta con segundo factor.');
            $this->solicitudes->transicionar($actual->solicitud_id, 'FORMALIZADA', $usuarioId, 'Pagaré firmado.');
            $oferta->setRawAttributes($actual->getAttributes(), true);
        });

        $this->auditoria->registrar('desembolso.oferta_aceptada', 'oferta', $oferta->id, usuarioId: $usuarioId);
        // MR-004: cada llamada al tercero queda en la auditoría marcando si fue simulada.
        $this->auditoria->registrar('desembolso.pagare_firmado', 'oferta', $oferta->id, detalle: [
            'huella_sha256' => $firma['huella_sha256'], 'proveedor' => $firma['proveedor'],
        ], usuarioId: $usuarioId, modoSimulado: $firma['simulada']);

        return $oferta;
    }

    /** RF-11 FA-01: el cliente no acepta; la solicitud se cierra. */
    public function rechazar(Oferta $oferta, int $usuarioId, ?string $motivo): Oferta
    {
        $this->exigirVigente($oferta);

        DB::transaction(function () use ($oferta, $usuarioId, $motivo) {
            $actual = Oferta::whereKey($oferta->id)->lockForUpdate()->firstOrFail();
            $this->exigirVigente($actual);
            $actual->update(['estado' => Oferta::RECHAZADA, 'motivo_rechazo' => $motivo, 'cerrada_en' => now()]);
            $this->solicitudes->transicionar($actual->solicitud_id, 'OFERTA_RECHAZADA', $usuarioId, 'El cliente rechazó la oferta.');
            $oferta->setRawAttributes($actual->getAttributes(), true);
        });

        $this->auditoria->registrar('desembolso.oferta_rechazada', 'oferta', $oferta->id, usuarioId: $usuarioId);

        return $oferta;
    }

    /** Forma `Oferta` de frontend/src/lib/api/tipos.ts. */
    public function vista(Oferta $oferta): array
    {
        return [
            'id' => $oferta->id,
            'solicitud_id' => $oferta->solicitud_id,
            'radicado' => $oferta->radicado,
            'producto' => $this->parametros->producto($oferta->producto_codigo)['nombre'] ?? $oferta->producto_codigo,
            'estado' => $oferta->estado,
            'monto' => $oferta->monto,
            'plazo_meses' => $oferta->plazo_meses,
            'tasa_ea' => $oferta->tasa_ea,
            'cuota' => $oferta->cuota,
            'costo_total' => $oferta->costo_total,
            'valor_a_recibir' => $oferta->valor_a_recibir,
            'desglose' => $oferta->desglose,
            'plan' => $oferta->plan,
            'emitida_en' => $oferta->emitida_en->toIso8601String(),
            'vence_en' => $oferta->vence_en->toIso8601String(),
            'condiciones_originales' => $oferta->condiciones_originales,
            'motivo_condicion' => $oferta->motivo_condicion,
            'pagare' => ['version' => $oferta->pagare_version, 'texto' => $oferta->pagare_texto],
            'firma' => $oferta->firma_huella_sha256 ? [
                'huella_sha256' => $oferta->firma_huella_sha256,
                'sellado_en' => $oferta->firma_sellada_en->toIso8601String(),
                'simulada' => (bool) $oferta->firma_simulada,
            ] : null,
        ];
    }

    /** RN-59: pasada la fecha, la oferta vence y la solicitud pasa a OFERTA_VENCIDA. */
    public function revisarVencimiento(Oferta $oferta): Oferta
    {
        if ($oferta->estado !== Oferta::VIGENTE || $oferta->vence_en->isFuture()) {
            return $oferta;
        }

        DB::transaction(function () use ($oferta) {
            $actual = Oferta::whereKey($oferta->id)->lockForUpdate()->firstOrFail();
            if ($actual->estado !== Oferta::VIGENTE) {
                return;
            }
            $actual->update(['estado' => Oferta::VENCIDA, 'cerrada_en' => $actual->vence_en]);
            $this->solicitudes->transicionar($actual->solicitud_id, 'OFERTA_VENCIDA', null, 'La oferta venció sin respuesta (RN-59).');
            $oferta->setRawAttributes($actual->getAttributes(), true);
        });

        return $oferta;
    }

    private function exigirVigente(Oferta $oferta): void
    {
        if ($oferta->estado === Oferta::VIGENTE && $oferta->vence_en->isPast()) {
            $this->revisarVencimiento($oferta);
        }
        if ($oferta->estado === Oferta::VENCIDA) {
            throw new ErrorNegocio('oferta_vencida', 'La oferta venció. Puedes radicar una solicitud nueva cuando quieras.', 409);
        }
        if ($oferta->estado !== Oferta::VIGENTE) {
            throw new ErrorNegocio('oferta_no_vigente', 'Esta oferta ya no se puede aceptar.', 409);
        }
    }

    /** Texto del pagaré: datos del deudor enmascarados (RNF-06) y aviso de que no es un título valor (MR-004). */
    private function textoPagare(string $radicado, int $clienteId, array $c): string
    {
        $deudor = $this->perfil->datosConocidos($clienteId);
        $nombre = $deudor['nombre_completo'] ?? 'el cliente';
        $documento = substr((string) ($deudor['documento_enmascarado'] ?? ''), -4);
        $pesos = fn (int $v) => '$'.number_format($v, 0, ',', '.');
        $tasa = str_replace('.', ',', (string) round($c['tasa_ea'], 2));

        return implode("\n\n", [
            "Pagaré número {$radicado}-P. Documento de demostración generado por un sistema académico: no es un título valor.",
            "Yo, {$nombre}, con documento de identidad terminado en {$documento}, me obligo a pagar incondicionalmente a la orden de FinanTech la suma de {$pesos($c['monto'])}.",
            "Pagaré esa suma en {$c['plazo_meses']} cuotas mensuales de {$pesos($c['cuota'])}, que incluyen capital, intereses y seguro de vida deudor, con una tasa de interés remuneratoria del {$tasa} % efectiva anual, que no supera la tasa máxima legal vigente.",
            'Si me atraso en el pago, reconoceré intereses de mora a la tasa máxima legal permitida y FinanTech podrá exigir el saldo completo.',
            'Autorizo a FinanTech a llenar los espacios en blanco de este pagaré según la carta de instrucciones que hace parte de él.',
        ]);
    }
}
