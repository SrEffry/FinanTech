<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\VinculoCliente;
use App\Shared\Exceptions\ErrorNegocio;

/**
 * Interfaz pública del módulo de Identidad sobre el cliente (MR-002), para Originacion
 * y los demás módulos. `$clienteId` es el id de identidad_clientes, el mismo que da
 * SesionActual::clienteId(). Los datos salen ya enmascarados (RNF-06).
 */
class PerfilCliente
{
    /** RN-07: solo con identidad verificada se puede radicar. */
    public function identidadVerificada(int $clienteId): bool
    {
        return Cliente::whereKey($clienteId)->value('estado_kyc') === Cliente::KYC_VERIFICADO;
    }

    /** @throws ErrorNegocio 409 identidad_no_verificada (RN-07) */
    public function exigirIdentidadVerificada(int $clienteId): void
    {
        if (! $this->identidadVerificada($clienteId)) {
            throw new ErrorNegocio(
                'identidad_no_verificada',
                'Antes de solicitar un crédito necesitamos verificar tu identidad.',
                409,
            );
        }
    }

    /**
     * Datos que ya tenemos del cliente, para no volver a pedirlos (RN-32).
     *
     * @return array{nombre_completo: string, nombres: string, apellidos: string, tipo_documento: string,
     *     documento_enmascarado: ?string, fecha_nacimiento: string, email: string,
     *     telefono_enmascarado: ?string, estado_kyc: string, cliente_desde: string}|null
     */
    public function datosConocidos(int $clienteId): ?array
    {
        $cliente = Cliente::with('usuario')->find($clienteId);
        if (! $cliente) {
            return null;
        }

        return [
            'nombre_completo' => trim($cliente->nombres.' '.$cliente->apellidos),
            'nombres' => $cliente->nombres,
            'apellidos' => $cliente->apellidos,
            'tipo_documento' => $cliente->tipo_documento,
            'documento_enmascarado' => Enmascarar::ultimosCuatro($cliente->num_documento),
            'fecha_nacimiento' => $cliente->fecha_nacimiento->toDateString(),
            'email' => $cliente->usuario->email,
            'telefono_enmascarado' => Enmascarar::ultimosCuatro($cliente->telefono),
            'estado_kyc' => $cliente->estado_kyc,
            'cliente_desde' => $cliente->created_at->toIso8601String(),
        ];
    }

    /**
     * Documento completo, solo para consultar a la central de riesgo (RF-08 paso 2) con la
     * autorización del titular (RN-33). Nunca se muestra, se guarda ni se registra en el log
     * fuera de Identidad (RNF-06).
     *
     * @return array{tipo: string, numero: string}|null
     */
    public function documentoParaCentrales(int $clienteId): ?array
    {
        $cliente = Cliente::find($clienteId, ['id', 'tipo_documento', 'num_documento']);

        return $cliente ? ['tipo' => $cliente->tipo_documento, 'numero' => $cliente->num_documento] : null;
    }

    /** Desde cuándo es cliente (RF-08 paso 3), sin ningún otro dato personal (RN-43). */
    public function clienteDesde(int $clienteId): ?string
    {
        return Cliente::find($clienteId, ['id', 'created_at'])?->created_at?->toIso8601String();
    }

    /** Id del usuario (credencial) del cliente, para auditoría y notificaciones. */
    public function usuarioId(int $clienteId): ?int
    {
        return Cliente::whereKey($clienteId)->value('usuario_id');
    }

    /**
     * RN-55: ¿el usuario es el propio cliente o declaró un vínculo con él? Si es así, no puede
     * decidir sus solicitudes. No dice cuál es el vínculo.
     */
    public function tieneVinculo(int $usuarioId, int $clienteId): bool
    {
        return $this->usuarioId($clienteId) === $usuarioId
            || VinculoCliente::where('usuario_id', $usuarioId)->where('cliente_id', $clienteId)->exists();
    }

    /**
     * RN-19 / RN-33: ¿el titular tiene vigente su consentimiento para esta finalidad?
     * Vale el último movimiento registrado (el histórico es de solo adición, RN-21).
     */
    public function tieneConsentimiento(int $clienteId, string $finalidad): bool
    {
        return Consentimiento::where('cliente_id', $clienteId)
            ->where('finalidad_codigo', $finalidad)
            ->orderByDesc('registrado_en')
            ->orderByDesc('id')
            ->value('accion') === Consentimiento::OTORGA;
    }
}
