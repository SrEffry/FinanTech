<?php

namespace App\Modules\Originacion\Services;

use App\Modules\Cliente\Services\CalculadoraCredito;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Modules\Originacion\Events\DocumentosEnviados;
use App\Modules\Originacion\Models\Solicitud;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Lo que el cliente hace con sus solicitudes desde el portal (RF-06, RF-07): borrador con
 * datos precargados, edición, documentos, radicación y envío de lo que faltaba (UC8).
 * Los cambios de estado los hace Solicitudes, que aplica la máquina E3 con historial.
 */
class SolicitudesCliente
{
    public function __construct(
        private readonly Solicitudes $solicitudes,
        private readonly DocumentosSolicitud $documentos,
        private readonly DirectorioClientes $clientes,
        private readonly ParametrosVigentes $parametros,
        private readonly CalculadoraCredito $calculadora,
    ) {}

    /** RN-35: solo las propias, la más reciente primero. */
    public function listar(int $clienteId): Collection
    {
        return Solicitud::where('cliente_id', $clienteId)->orderByDesc('updated_at')->orderByDesc('created_at')->get();
    }

    /**
     * RN-35: para el cliente, la solicitud de otro no existe (mismo 404 que una inexistente).
     *
     * @throws ErrorNegocio 404 no_encontrada
     */
    public function propia(int $clienteId, string $id): Solicitud
    {
        $solicitud = Solicitud::whereKey($id)->where('cliente_id', $clienteId)->first()
            ?? throw new ErrorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404);

        // RN-31: último acceso del cliente, sin mover la fecha de actualización de la solicitud.
        Solicitud::whereKey($solicitud->id)->toBase()->update(['ultimo_acceso_en' => now()]);

        return $solicitud;
    }

    /** RF-06 paso 1 y RN-32: borrador con lo que ya sabemos y los documentos de su ocupación. */
    public function crear(int $clienteId, string $producto, int $monto, int $plazoMeses, ?int $actorId): Solicitud
    {
        return DB::transaction(function () use ($clienteId, $producto, $monto, $plazoMeses, $actorId) {
            $solicitud = $this->solicitudes->crearBorrador($clienteId, $producto, $monto, $plazoMeses, $actorId);
            $this->documentos->sincronizar($solicitud);

            return $solicitud;
        });
    }

    /**
     * Guarda los cambios del borrador (`CambiosBorrador`). Si cambia el monto o el plazo, la
     * cuota se recalcula con los parámetros vigentes; si cambia la ocupación, también los
     * documentos requeridos.
     *
     * @param  array<string, mixed>  $cambios  ya validados por ActualizarBorradorRequest
     *
     * @throws ErrorNegocio 409 no_editable
     * @throws ValidationException monto o plazo fuera del rango del producto
     */
    public function actualizar(Solicitud $solicitud, array $cambios): Solicitud
    {
        return DB::transaction(function () use ($solicitud, $cambios) {
            $actual = Solicitud::whereKey($solicitud->id)->lockForUpdate()->firstOrFail();
            if ($actual->estado !== EstadoSolicitud::BORRADOR) {
                throw new ErrorNegocio('no_editable', 'Esta solicitud ya fue radicada y no se puede cambiar.', 409);
            }

            if (array_key_exists('monto', $cambios) || array_key_exists('plazo_meses', $cambios)) {
                $this->recotizar($actual, (int) ($cambios['monto'] ?? $actual->monto), (int) ($cambios['plazo_meses'] ?? $actual->plazo_meses));
            }

            $ocupacionAnterior = $actual->ocupacion;
            if (isset($cambios['laboral'])) {
                $actual->ocupacion = ($cambios['laboral']['ocupacion'] ?? null) ?: null;
                $actual->empleador = $this->texto($cambios['laboral']['empleador'] ?? null);
                $actual->antiguedad_laboral_meses = $cambios['laboral']['antiguedad_laboral_meses'] ?? null;
            }
            if (isset($cambios['financiero'])) {
                $actual->ingreso_mensual = $cambios['financiero']['ingreso_mensual'] ?? null;
                $actual->egreso_mensual = $cambios['financiero']['egreso_mensual'] ?? null;
            }
            if (isset($cambios['referencia'])) {
                $actual->referencia_nombre = $this->texto($cambios['referencia']['nombre'] ?? null);
                $actual->referencia_celular = $this->texto($cambios['referencia']['celular'] ?? null);
            }
            if (array_key_exists('acepta_consulta_centrales', $cambios) && $cambios['acepta_consulta_centrales'] !== null) {
                $actual->acepta_consulta_centrales = (bool) $cambios['acepta_consulta_centrales'];
            }

            $actual->save();
            if ($actual->ocupacion !== $ocupacionAnterior) {
                $this->documentos->sincronizar($actual);
            }

            return $actual;
        });
    }

    /**
     * RF-06 pasos 6 a 8: valida que esté completa, registra la autorización de consulta a
     * centrales (RN-33) y radica con su número FT-AAAA-NNNNNN (RN-29).
     *
     * @throws ErrorNegocio 409 no_editable, 409 identidad_no_verificada (RN-07),
     *                      422 documentos_incompletos, 422 consulta_centrales_requerida (RN-33)
     * @throws ValidationException datos laborales, financieros o de la referencia incompletos
     */
    public function radicar(Solicitud $solicitud, ?int $actorId): Solicitud
    {
        if ($solicitud->estado !== EstadoSolicitud::BORRADOR) {
            throw new ErrorNegocio('no_editable', 'Esta solicitud ya fue radicada.', 409);
        }
        if (! $this->clientes->identidadVerificada($solicitud->cliente_id)) {
            throw new ErrorNegocio('identidad_no_verificada', 'Antes de radicar necesitamos verificar tu identidad.', 409);
        }

        $this->validarCompleta($solicitud);
        $this->documentos->exigirCompletos($solicitud);

        if (! $solicitud->acepta_consulta_centrales) {
            throw new ErrorNegocio(
                'consulta_centrales_requerida',
                'Para estudiar tu solicitud necesitamos tu autorización para consultar las centrales de riesgo.',
            );
        }
        // RN-33: la casilla marcada al radicar es la autorización expresa; queda en el
        // histórico de consentimientos del cliente (RF-04, RN-21).
        if (! $this->clientes->consienteConsultaCentrales($solicitud->cliente_id)) {
            $this->clientes->registrarConsentimientoCentrales($solicitud->cliente_id);
        }

        return $this->solicitudes->radicar($solicitud, $actorId);
    }

    /**
     * UC8: el cliente ya cargó lo que le pidieron; de PENDIENTE_CLIENTE vuelve a RADICADA con
     * el mismo radicado y se reanuda el reloj de servicio.
     *
     * @throws ErrorNegocio 409 no_editable, 422 documentos_incompletos
     */
    public function enviarDocumentos(Solicitud $solicitud, ?int $actorId): Solicitud
    {
        if ($solicitud->estado !== EstadoSolicitud::PENDIENTE_CLIENTE) {
            throw new ErrorNegocio('no_editable', 'Esta solicitud no está esperando documentos.', 409);
        }
        $this->documentos->exigirCompletos($solicitud);

        return DB::transaction(function () use ($solicitud, $actorId) {
            $this->solicitudes->transicionar($solicitud, EstadoSolicitud::RADICADA, $actorId, 'El cliente envió los documentos pendientes.');
            $solicitud->estado_sla_pausado = false;
            $solicitud->save();

            DocumentosEnviados::dispatch($solicitud->id, $solicitud->radicado, $solicitud->cliente_id, now()->toIso8601String());

            return $solicitud;
        });
    }

    /** Recalcula tasa y cuota con los parámetros vigentes (RN-23: nunca sobre la máxima legal). */
    private function recotizar(Solicitud $solicitud, int $monto, int $plazoMeses): void
    {
        $producto = $this->parametros->producto($solicitud->producto_codigo)
            ?? throw new ErrorNegocio('producto_invalido', 'Este producto ya no está disponible. Simula de nuevo para elegir otro.', 409);

        $errores = [];
        if ($monto < $producto['monto_min'] || $monto > $producto['monto_max']) {
            $errores['monto'] = 'El monto está fuera del rango del producto.';
        }
        if ($plazoMeses < $producto['plazo_min'] || $plazoMeses > $producto['plazo_max']) {
            $errores['plazo_meses'] = 'El plazo está fuera del rango del producto.';
        }
        if ($errores) {
            throw ValidationException::withMessages($errores);
        }

        $credito = $this->calculadora->calcular($producto['tasa_ea'], $monto, $plazoMeses, $this->parametros->tasaMaximaLegalEa());
        $solicitud->fill([
            'monto' => $monto,
            'plazo_meses' => $plazoMeses,
            'tasa_ea' => $credito['tasa_ea'],
            'cuota_estimada' => $credito['cuota'],
            'version_parametros' => $this->parametros->version(),
        ]);
    }

    /** Lo que exige RF-06 para radicar, con las claves del formulario del portal. */
    private function validarCompleta(Solicitud $s): void
    {
        $errores = array_filter([
            'laboral.ocupacion' => in_array($s->ocupacion, CatalogoDocumentos::OCUPACIONES, true) ? null : 'Elige tu ocupación.',
            'laboral.empleador' => $s->empleador ? null : 'Escribe dónde trabajas o tu actividad.',
            'laboral.antiguedad_laboral_meses' => $s->antiguedad_laboral_meses !== null ? null : 'Indica cuánto tiempo llevas.',
            'financiero.ingreso_mensual' => $s->ingreso_mensual ? null : 'Escribe tu ingreso mensual.',
            'financiero.egreso_mensual' => $s->egreso_mensual !== null ? null : 'Escribe tus gastos mensuales.',
            'referencia.nombre' => $s->referencia_nombre ? null : 'Escribe el nombre de tu referencia.',
            'referencia.celular' => preg_match('/^3\d{9}$/', (string) $s->referencia_celular) ? null : 'Escribe un celular de 10 dígitos que empiece por 3.',
        ]);

        if ($errores) {
            throw ValidationException::withMessages($errores);
        }
    }

    private function texto(?string $valor): ?string
    {
        $valor = trim((string) $valor);

        return $valor === '' ? null : $valor;
    }
}
