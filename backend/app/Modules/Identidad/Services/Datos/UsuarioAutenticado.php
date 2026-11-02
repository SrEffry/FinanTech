<?php

namespace App\Modules\Identidad\Services\Datos;

use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\Enmascarar;

/**
 * Usuario de la sesión tal como lo ven los demás módulos (MR-002): datos de solo
 * lectura, sin el modelo de Identidad. `toArray()` tiene la forma `Usuario` del
 * contrato del portal (frontend/src/lib/api/tipos.ts), con el documento ya
 * enmascarado (RNF-06).
 */
final readonly class UsuarioAutenticado
{
    public function __construct(
        public int $id,
        public string $rol,
        public bool $esInterno,
        public string $nombreCompleto,
        public string $nombreCorto,
        public string $email,
        /** Id de identidad_clientes; solo para el rol cliente. */
        public ?int $clienteId = null,
        public ?string $estadoKyc = null,
        public ?string $documentoEnmascarado = null,
        public ?string $cargo = null,
        public ?string $area = null,
        /** Atribución por monto en pesos enteros (RN-53); solo empleados. */
        public ?int $atribucionMonto = null,
    ) {}

    public static function desde(Usuario $usuario): self
    {
        $usuario->loadMissing('rol', 'cliente', 'empleado');
        $cliente = $usuario->cliente;
        $empleado = $usuario->empleado;
        $primerNombre = $cliente?->nombres ?? $usuario->nombre_completo;

        return new self(
            id: $usuario->id,
            rol: $usuario->rol->codigo,
            esInterno: $usuario->esInterno(),
            nombreCompleto: $usuario->nombre_completo,
            nombreCorto: explode(' ', trim($primerNombre))[0],
            email: $usuario->email,
            clienteId: $cliente?->id,
            estadoKyc: $cliente?->estado_kyc,
            documentoEnmascarado: $cliente ? Enmascarar::ultimosCuatro($cliente->num_documento) : null,
            cargo: $empleado?->cargo,
            area: $empleado?->area,
            atribucionMonto: $empleado ? (int) round((float) $empleado->atribucion_monto) : null,
        );
    }

    public function tieneRol(string ...$roles): bool
    {
        return in_array($this->rol, $roles, true);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return array_filter([
            'id' => $this->id,
            'nombre_completo' => $this->nombreCompleto,
            'nombre_corto' => $this->nombreCorto,
            'email' => $this->email,
            'rol' => $this->rol,
            'estado_kyc' => $this->estadoKyc,
            'documento_enmascarado' => $this->documentoEnmascarado,
            'cargo' => $this->cargo,
            'area' => $this->area,
            'atribucion_monto' => $this->atribucionMonto,
        ], fn ($valor) => $valor !== null);
    }
}
