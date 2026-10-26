<?php

namespace App\Modules\Identidad\Http\Controllers;

use App\Modules\Identidad\Http\Requests\IniciarRegistroRequest;
use App\Modules\Identidad\Models\PoliticaTratamiento;
use App\Modules\Identidad\Models\RegistroPendiente;
use App\Modules\Identidad\Services\RegistroCliente;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegistroClienteController
{
    public function __construct(private readonly RegistroCliente $registro) {}

    /** Política vigente con sus finalidades; el portal muestra las opcionales sin marcar (RN-05). */
    public function politicaVigente(): JsonResponse
    {
        $politica = PoliticaTratamiento::vigente()->load('finalidades');

        return response()->json([
            'version' => $politica->version,
            'vigente_desde' => $politica->vigente_desde->toDateString(),
            'resumen' => $politica->resumen,
            'finalidades' => $politica->finalidades->map(fn ($f) => [
                'codigo' => $f->codigo,
                'nombre' => $f->nombre,
                'descripcion' => $f->descripcion,
                'necesaria' => $f->necesaria,
            ]),
        ]);
    }

    public function iniciar(IniciarRegistroRequest $request): JsonResponse
    {
        $pendiente = $this->registro->iniciar($request->validated());

        return response()->json($this->respuestaPendiente($pendiente), 201);
    }

    public function reenviar(RegistroPendiente $registro): JsonResponse
    {
        return response()->json($this->respuestaPendiente($this->registro->reenviar($registro)));
    }

    public function verificar(Request $request, RegistroPendiente $registro): JsonResponse
    {
        $datos = $request->validate([
            'codigo_email' => ['required', 'digits:6'],
            'codigo_telefono' => ['required', 'digits:6'],
        ]);

        $cliente = $this->registro->verificar($registro, $datos['codigo_email'], $datos['codigo_telefono']);

        return response()->json([
            'cliente_id' => $cliente->id,
            'estado_kyc' => $cliente->estado_kyc,
            'siguiente_paso' => 'verificacion_identidad',
        ], 201);
    }

    private function respuestaPendiente(RegistroPendiente $pendiente): array
    {
        return [
            'registro_id' => $pendiente->id,
            'codigos_expiran_en' => $pendiente->codigos_expiran_en->toIso8601String(),
            'reenvio_disponible_en' => now()->addSeconds(config('finantech.registro.espera_reenvio_segundos'))->toIso8601String(),
        ];
    }
}
