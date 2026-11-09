<?php

namespace App\Modules\Desembolso\Http\Controllers;

use App\Modules\Desembolso\Services\Ofertas;
use App\Modules\Identidad\Services\SesionActual;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** RF-11 desde el portal del cliente: solo el titular, con su sesión (RNF-05). */
class OfertaController
{
    public function __construct(
        private readonly Ofertas $ofertas,
        private readonly SesionActual $sesion,
    ) {}

    public function mostrar(string $oferta): JsonResponse
    {
        return response()->json($this->ofertas->vista($this->propia($oferta)));
    }

    public function desafio(string $oferta): JsonResponse
    {
        return response()->json($this->ofertas->pedirCodigo($this->propia($oferta), (int) $this->sesion->id()));
    }

    public function aceptar(Request $request, string $oferta): JsonResponse
    {
        // Primero la propiedad (404 igual para la de otro, RN-35); luego los datos.
        $propia = $this->propia($oferta);
        $datos = $request->validate([
            'declaracion' => ['nullable', 'boolean'],
            'desafio_id' => ['required', 'string', 'max:64'],
            'codigo' => ['required', 'string', 'max:12'],
        ], [
            'desafio_id.required' => 'Pide el código para aceptar la oferta.',
            'codigo.required' => 'Escribe el código que te enviamos.',
        ]);

        $aceptada = $this->ofertas->aceptar(
            $propia,
            (int) $this->sesion->id(),
            ($datos['declaracion'] ?? false) === true,
            $datos['desafio_id'],
            $datos['codigo'],
        );

        return response()->json($this->ofertas->vista($aceptada));
    }

    public function rechazar(Request $request, string $oferta): JsonResponse
    {
        $propia = $this->propia($oferta);
        $datos = $request->validate(['motivo' => ['nullable', 'string', 'max:500']]);
        $rechazada = $this->ofertas->rechazar($propia, (int) $this->sesion->id(), $datos['motivo'] ?? null);

        return response()->json($this->ofertas->vista($rechazada));
    }

    private function propia(string $id): \App\Modules\Desembolso\Models\Oferta
    {
        return $this->ofertas->propia($this->sesion->exigirClienteId(), $id);
    }
}
