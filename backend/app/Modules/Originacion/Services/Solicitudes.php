<?php

namespace App\Modules\Originacion\Services;

use App\Modules\Cliente\Services\CalculadoraCredito;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\Identidad\Services\Auditoria;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Modules\Originacion\Events\SolicitudRadicada;
use App\Modules\Originacion\Models\HistorialEstado;
use App\Modules\Originacion\Models\Solicitud;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Interfaz pública del módulo de Originacion para el ciclo de vida de la solicitud
 * (RF-06, RF-07). Es el único lugar donde cambia el estado: aplica la máquina E3, deja
 * historial de solo adición y auditoría (RNF-08). Evaluacion y Desembolso mueven la
 * solicitud llamando a transicionar(); no tocan el modelo (CP0002).
 */
class Solicitudes
{
    public function __construct(
        private readonly DirectorioClientes $clientes,
        private readonly ParametrosVigentes $parametros,
        private readonly CalculadoraCredito $calculadora,
        private readonly GeneradorRadicado $radicados,
        private readonly Auditoria $auditoria,
    ) {}

    /**
     * Crea la solicitud en BORRADOR con los valores de la simulación (RF-06 paso 1).
     *
     * @throws ErrorNegocio 409 identidad_no_verificada (RN-07), 422 producto_invalido,
     *                      409 solicitud_activa (RN-28)
     */
    public function crearBorrador(int $clienteId, string $codigoProducto, int $monto, int $plazoMeses, ?int $actorId = null): Solicitud
    {
        $this->exigirIdentidadVerificada($clienteId);

        $producto = $this->parametros->producto($codigoProducto);
        if (! $producto) {
            throw new ErrorNegocio('producto_invalido', 'Elige uno de los productos disponibles.');
        }

        $this->exigirSinSolicitudActiva($clienteId, $producto);

        // RF-05 FA-01: los valores se llevan al rango del producto, como en el simulador.
        $monto = min($producto['monto_max'], max($producto['monto_min'], $monto));
        $plazoMeses = min($producto['plazo_max'], max($producto['plazo_min'], $plazoMeses));
        $credito = $this->calculadora->calcular($producto['tasa_ea'], $monto, $plazoMeses, $this->parametros->tasaMaximaLegalEa());

        // RN-32: lo que el cliente ya entregó en su última solicitud se reutiliza.
        $anterior = Solicitud::where('cliente_id', $clienteId)->latest()->latest('id')->first();
        $precargados = $anterior?->only([
            'ocupacion', 'empleador', 'antiguedad_laboral_meses', 'ingreso_mensual',
            'egreso_mensual', 'referencia_nombre', 'referencia_celular',
        ]) ?? [];

        try {
            $solicitud = DB::transaction(function () use ($clienteId, $producto, $monto, $plazoMeses, $credito, $precargados, $actorId) {
                $solicitud = Solicitud::create([
                    'cliente_id' => $clienteId,
                    'producto_codigo' => $producto['codigo'],
                    'monto' => $monto,
                    'plazo_meses' => $plazoMeses,
                    'version_parametros' => $this->parametros->version(),
                    'tasa_ea' => $credito['tasa_ea'],
                    'cuota_estimada' => $credito['cuota'],
                    'estado' => EstadoSolicitud::BORRADOR,
                    'clave_activa' => Solicitud::claveActiva($clienteId, $producto['codigo']),
                    'acepta_consulta_centrales' => $this->clientes->consienteConsultaCentrales($clienteId),
                    'ultimo_acceso_en' => now(),
                    ...$precargados,
                ]);
                $this->registrarHistorial($solicitud, null, EstadoSolicitud::BORRADOR, $actorId, null);

                return $solicitud;
            });
        } catch (UniqueConstraintViolationException) {
            // Otra petición simultánea creó la solicitud activa entre la verificación y el insert.
            $this->exigirSinSolicitudActiva($clienteId, $producto);
            throw new ErrorNegocio('solicitud_activa', 'Ya tienes una solicitud de este producto en curso.', 409);
        }

        $this->auditoria->registrar('originacion.borrador_creado', 'solicitud', $solicitud->id, usuarioId: $actorId, detalle: [
            'producto' => $producto['codigo'],
        ]);

        return $solicitud;
    }

    /**
     * Radica el borrador (RF-06 pasos 7 y 8): asigna el radicado, pasa a RADICADA y
     * publica SolicitudRadicada después del commit.
     *
     * Pendiente para el endpoint (T11): validar datos laborales, financieros, referencia
     * y documentos requeridos antes de llamar aquí.
     *
     * @throws ErrorNegocio 409 transicion_invalida, 409 identidad_no_verificada (RN-07),
     *                      422 consulta_centrales_requerida (RN-33)
     */
    public function radicar(Solicitud $solicitud, ?int $actorId = null): Solicitud
    {
        $this->exigirIdentidadVerificada($solicitud->cliente_id);

        if (! $solicitud->acepta_consulta_centrales) {
            throw new ErrorNegocio(
                'consulta_centrales_requerida',
                'Para radicar debes autorizar la consulta a centrales de información crediticia.',
            );
        }

        $radicada = $this->enTransaccion($solicitud, EstadoSolicitud::RADICADA, function () use ($solicitud, $actorId) {
            $actual = $this->bloquear($solicitud);
            $this->exigirTransicion($actual, EstadoSolicitud::RADICADA);
            if ($actual->estado !== EstadoSolicitud::BORRADOR) {
                // Desde PENDIENTE_CLIENTE se vuelve a RADICADA con el mismo radicado (enviar-documentos).
                throw new ErrorNegocio('no_editable', 'Esta solicitud ya fue radicada.', 409);
            }

            $actual->radicado = $this->radicados->siguiente();
            $actual->radicada_en = now();

            $this->aplicar($actual, EstadoSolicitud::RADICADA, $actorId, null);

            SolicitudRadicada::dispatch(
                $actual->id, $actual->radicado, $actual->cliente_id, $actual->producto_codigo,
                $actual->monto, $actual->plazo_meses, $actual->version_parametros,
                $actual->radicada_en->toIso8601String(),
            );

            return $actual;
        });

        $solicitud->setRawAttributes($radicada->getAttributes(), true);

        return $solicitud;
    }

    /**
     * Cambia el estado según la máquina E3 y deja historial y auditoría.
     *
     * @throws ErrorNegocio 409 transicion_invalida, 409 solicitud_activa (RN-28, p. ej. al
     *                      reabrir una NEGADA por reconsideración si ya hay otra activa)
     */
    public function transicionar(Solicitud $solicitud, EstadoSolicitud $destino, ?int $actorId = null, ?string $motivo = null): Solicitud
    {
        $actualizada = $this->enTransaccion($solicitud, $destino, function () use ($solicitud, $destino, $actorId, $motivo) {
            $actual = $this->bloquear($solicitud);
            $this->exigirTransicion($actual, $destino);
            if ($destino === EstadoSolicitud::RADICADA && $actual->radicado === null) {
                throw new ErrorNegocio('transicion_invalida', 'Esta solicitud todavía no se ha radicado.', 409);
            }
            $this->aplicar($actual, $destino, $actorId, $motivo);

            return $actual;
        });

        $solicitud->setRawAttributes($actualizada->getAttributes(), true);

        return $solicitud;
    }

    private function exigirIdentidadVerificada(int $clienteId): void
    {
        if (! $this->clientes->identidadVerificada($clienteId)) {
            throw new ErrorNegocio(
                'identidad_no_verificada',
                'Antes de solicitar un crédito necesitamos verificar tu identidad. Te toma unos minutos.',
                409,
            );
        }
    }

    /** RN-28 / RF-06 FA-03: una sola solicitud activa por producto. */
    private function exigirSinSolicitudActiva(int $clienteId, array $producto): void
    {
        $activa = Solicitud::where('clave_activa', Solicitud::claveActiva($clienteId, $producto['codigo']))->first();
        if ($activa) {
            throw new ErrorNegocio(
                'solicitud_activa',
                'Ya tienes una solicitud de '.mb_strtolower($producto['nombre']).' en curso. Puedes seguirla desde tus solicitudes.',
                409,
                ['solicitud_id' => $activa->id, 'estado' => $activa->estado->value],
            );
        }
    }

    /** Relee la fila con bloqueo: el estado que vale es el de la base, no el del objeto en memoria. */
    private function bloquear(Solicitud $solicitud): Solicitud
    {
        return Solicitud::whereKey($solicitud->getKey())->lockForUpdate()->firstOrFail();
    }

    /**
     * Ejecuta el cambio en una transacción. Si la máquina de estados lo rechaza, el intento
     * se audita después del rollback, para que el registro no se pierda con él (RNF-08).
     *
     * @param  callable(): Solicitud  $cambio
     */
    private function enTransaccion(Solicitud $solicitud, EstadoSolicitud $destino, callable $cambio): Solicitud
    {
        try {
            return DB::transaction($cambio);
        } catch (ErrorNegocio $error) {
            if ($error->codigo === 'transicion_invalida') {
                $this->auditoria->registrar('originacion.transicion_rechazada', 'solicitud', $solicitud->id, Auditoria::RECHAZO, [
                    'desde' => $error->datos['estado'] ?? null,
                    'hacia' => $destino->value,
                ]);
            }
            throw $error;
        }
    }

    private function exigirTransicion(Solicitud $solicitud, EstadoSolicitud $destino): void
    {
        if (! $solicitud->estado->puedePasarA($destino)) {
            throw new ErrorNegocio(
                'transicion_invalida',
                'La solicitud no puede pasar a ese estado desde el estado en que está.',
                409,
                ['estado' => $solicitud->estado->value],
            );
        }
    }

    private function aplicar(Solicitud $solicitud, EstadoSolicitud $destino, ?int $actorId, ?string $motivo): void
    {
        $origen = $solicitud->estado;
        $solicitud->estado = $destino;
        // RN-28: al cerrarse libera el producto; al reabrirse lo vuelve a ocupar.
        $solicitud->clave_activa = $destino->esActiva()
            ? Solicitud::claveActiva($solicitud->cliente_id, $solicitud->producto_codigo)
            : null;

        try {
            $solicitud->save();
        } catch (UniqueConstraintViolationException) {
            throw new ErrorNegocio(
                'solicitud_activa',
                'Ya hay otra solicitud de este producto en curso. Ciérrala antes de reabrir esta.',
                409,
            );
        }

        $this->registrarHistorial($solicitud, $origen, $destino, $actorId, $motivo);
        $this->auditoria->registrar('originacion.cambio_estado', 'solicitud', $solicitud->id, usuarioId: $actorId, detalle: array_filter([
            'desde' => $origen->value,
            'hacia' => $destino->value,
            'radicado' => $solicitud->radicado,
        ]));
    }

    private function registrarHistorial(Solicitud $solicitud, ?EstadoSolicitud $origen, EstadoSolicitud $destino, ?int $actorId, ?string $motivo): void
    {
        HistorialEstado::create([
            'solicitud_id' => $solicitud->id,
            'estado_anterior' => $origen,
            'estado_nuevo' => $destino,
            'actor_usuario_id' => $actorId,
            'motivo' => $motivo,
            'registrado_en' => now(),
        ]);
    }
}
