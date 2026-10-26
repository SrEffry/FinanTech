<?php

namespace App\Shared\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Regla de negocio incumplida. Se responde con un cuerpo de error con código
 * y mensaje legible, sin detalles técnicos (RI-07, RI-04).
 */
class ErrorNegocio extends RuntimeException
{
    public function __construct(
        public readonly string $codigo,
        string $mensaje,
        public readonly int $estadoHttp = 422,
        public readonly array $datos = [],
    ) {
        parent::__construct($mensaje);
    }

    public function render(): JsonResponse
    {
        return response()->json(array_filter([
            'codigo' => $this->codigo,
            'mensaje' => $this->getMessage(),
            'datos' => $this->datos ?: null,
        ]), $this->estadoHttp);
    }
}
