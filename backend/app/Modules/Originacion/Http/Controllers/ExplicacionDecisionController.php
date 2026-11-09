<?php

namespace App\Modules\Originacion\Http\Controllers;

use App\Modules\Desembolso\Services\ConsultaOfertas;
use App\Modules\Evaluacion\Services\ExplicacionesDecision;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Modules\Identidad\Services\SesionActual;
use App\Modules\Originacion\Services\SolicitudesCliente;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Http\JsonResponse;

/**
 * D26 (T16 mínimo): RF-09, la explicación de la decisión para su titular (RN-35). Forma
 * `ExplicacionDecision` de tipos.ts. La reconsideración sigue postergada (T23, P9).
 */
class ExplicacionDecisionController
{
    public function __construct(
        private readonly SolicitudesCliente $solicitudes,
        private readonly ExplicacionesDecision $explicaciones,
        private readonly ParametrosVigentes $parametros,
        private readonly ConsultaOfertas $ofertas,
        private readonly SesionActual $sesion,
    ) {}

    public function mostrar(string $solicitud): JsonResponse
    {
        $propia = $this->solicitudes->propia($this->sesion->exigirClienteId(), $solicitud);
        $explicacion = $this->explicaciones->paraCliente($propia->id)
            ?? throw new ErrorNegocio('sin_decision', 'Esta solicitud todavía no tiene una decisión.', 404);

        return response()->json([
            ...$explicacion,
            'reconsideracion' => null,
            'puede_reconsiderar' => false,
            'reconsideracion_vence_en' => null,
            'radicado' => $propia->radicado,
            'producto' => $this->parametros->producto($propia->producto_codigo)['nombre'] ?? $propia->producto_codigo,
            'oferta_id' => $this->ofertas->deSolicitud($propia->id)['id'] ?? null,
        ]);
    }
}
