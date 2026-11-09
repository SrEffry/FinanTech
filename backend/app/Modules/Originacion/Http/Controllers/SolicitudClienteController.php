<?php

namespace App\Modules\Originacion\Http\Controllers;

use App\Modules\Identidad\Services\SesionActual;
use App\Modules\Originacion\Http\Requests\ActualizarBorradorRequest;
use App\Modules\Originacion\Http\Requests\CrearSolicitudRequest;
use App\Modules\Originacion\Models\Solicitud;
use App\Modules\Originacion\Services\DocumentosSolicitud;
use App\Modules\Originacion\Services\SolicitudesCliente;
use App\Modules\Originacion\Services\VistaSolicitud;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * RF-06 y RF-07 desde el portal del cliente. Las rutas exigen sesión y rol cliente
 * (RNF-05); cada acción además busca la solicitud entre las del cliente (RN-35).
 */
class SolicitudClienteController
{
    public function __construct(
        private readonly SolicitudesCliente $solicitudes,
        private readonly DocumentosSolicitud $documentos,
        private readonly VistaSolicitud $vista,
        private readonly SesionActual $sesion,
    ) {}

    public function listar(): JsonResponse
    {
        $lista = $this->solicitudes->listar($this->sesion->exigirClienteId());

        return response()->json($lista->map(fn (Solicitud $s) => $this->vista->resumen($s))->values());
    }

    public function crear(CrearSolicitudRequest $request): JsonResponse
    {
        $datos = $request->validated();
        $solicitud = $this->solicitudes->crear(
            $this->sesion->exigirClienteId(),
            $datos['producto'],
            (int) $datos['monto'],
            (int) $datos['plazo_meses'],
            $this->sesion->id(),
        );

        return response()->json($this->vista->detalle($solicitud->refresh()), 201);
    }

    public function mostrar(string $solicitud): JsonResponse
    {
        return response()->json($this->vista->detalle($this->propia($solicitud)));
    }

    public function actualizar(ActualizarBorradorRequest $request, string $solicitud): JsonResponse
    {
        $actualizada = $this->solicitudes->actualizar($this->propia($solicitud), $request->validated());

        return response()->json($this->vista->detalle($actualizada));
    }

    public function cargarDocumento(Request $request, string $solicitud): JsonResponse
    {
        $documento = $this->documentos->cargar(
            $this->propia($solicitud),
            (string) $request->input('tipo', ''),
            $request->file('archivo'),
            $this->sesion->id(),
        );

        return response()->json($this->documentos->vista($documento));
    }

    public function radicar(string $solicitud): JsonResponse
    {
        $radicada = $this->solicitudes->radicar($this->propia($solicitud), $this->sesion->id());

        return response()->json($this->vista->detalle($radicada));
    }

    public function enviarDocumentos(string $solicitud): JsonResponse
    {
        $enviada = $this->solicitudes->enviarDocumentos($this->propia($solicitud), $this->sesion->id());

        return response()->json($this->vista->detalle($enviada));
    }

    private function propia(string $id): Solicitud
    {
        return $this->solicitudes->propia($this->sesion->exigirClienteId(), $id);
    }
}
