<?php

namespace App\Modules\Originacion\Adapters;

use App\Modules\Identidad\Services\Consentimientos;
use App\Modules\Identidad\Services\PerfilCliente;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Shared\Exceptions\ErrorNegocio;

/**
 * DirectorioClientes sobre el servicio público PerfilCliente de Identidad (D3).
 * `$clienteId` es el id de identidad_clientes, el mismo de SesionActual::clienteId().
 */
class DirectorioClientesIdentidad implements DirectorioClientes
{
    /** Código de la finalidad de RN-33 en el catálogo de Identidad (RF-04). */
    public const FINALIDAD_CENTRALES = 'consulta_centrales';

    public function __construct(
        private readonly PerfilCliente $perfil,
        private readonly Consentimientos $consentimientos,
    ) {}

    public function identidadVerificada(int $clienteId): bool
    {
        return $this->perfil->identidadVerificada($clienteId);
    }

    public function consienteConsultaCentrales(int $clienteId): bool
    {
        return $this->perfil->tieneConsentimiento($clienteId, self::FINALIDAD_CENTRALES);
    }

    public function registrarConsentimientoCentrales(int $clienteId): void
    {
        $usuarioId = $this->perfil->usuarioId($clienteId)
            ?? throw new ErrorNegocio('cliente_no_encontrado', 'No encontramos tus datos de cliente. Vuelve a ingresar.', 404);

        // Consentimientos no registra nada si ya estaba otorgada (RN-21) y deja la auditoría.
        $this->consentimientos->registrar($clienteId, $usuarioId, self::FINALIDAD_CENTRALES, 'otorga', 'web');
    }

    public function datosConocidos(int $clienteId): array
    {
        $datos = $this->perfil->datosConocidos($clienteId)
            ?? throw new ErrorNegocio('cliente_no_encontrado', 'No encontramos tus datos de cliente. Vuelve a ingresar.', 404);

        return [
            'nombre_completo' => $datos['nombre_completo'],
            'documento_enmascarado' => (string) $datos['documento_enmascarado'],
            'fecha_nacimiento' => $datos['fecha_nacimiento'],
            'email' => $datos['email'],
            'telefono_enmascarado' => (string) $datos['telefono_enmascarado'],
        ];
    }
}
