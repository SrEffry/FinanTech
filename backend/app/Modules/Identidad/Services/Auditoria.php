<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Models\RegistroAuditoria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Interfaz pública del módulo de Identidad para la bitácora inmutable (RNF-08).
 * Los demás módulos registran sus operaciones sensibles a través de este servicio.
 */
class Auditoria
{
    public const EXITO = 'exito';
    public const FALLO = 'fallo';
    public const RECHAZO = 'rechazo';

    public function __construct(private readonly Request $request) {}

    public function registrar(
        string $accion,
        ?string $entidad = null,
        string|int|null $idEntidad = null,
        string $resultado = self::EXITO,
        array $detalle = [],
        ?int $usuarioId = null,
        bool $modoSimulado = false,
    ): void {
        RegistroAuditoria::create([
            'usuario_id' => $usuarioId ?? Auth::id(),
            'accion' => $accion,
            'entidad' => $entidad,
            'id_entidad' => $idEntidad === null ? null : (string) $idEntidad,
            'resultado' => $resultado,
            'origen_ip' => $this->request->ip(),
            'detalle' => $detalle ?: null,
            'modo_simulado' => $modoSimulado,
            'registrado_en' => now(),
        ]);
    }
}
