<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Contracts\ListasRestrictivasService;
use App\Modules\Identidad\Contracts\VerificacionIdentidadService;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\VerificacionIdentidad;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * RF-02: verificación de identidad del cliente con contraste documental y prueba de vida.
 *
 * - RN-08: coincidencia de 0,85 o más para verificar; por debajo, revisión manual (FA-02).
 * - RN-11 / FA-01: tras 5 capturas ilegibles, revisión manual.
 * - FA-03: si el proveedor no responde, queda en cola; nunca se niega por eso.
 * - FA-04 / RN-10: con coincidencia en listas restrictivas no continúa, sin decir por qué,
 *   y se deja una alerta para cumplimiento en la auditoría.
 * - RN-09: las imágenes se guardan cifradas, y sus rutas también.
 * - MR-003: cada llamada al proveedor queda auditada con su modo (simulado o real).
 */
class VerificacionIdentidadCliente
{
    public const UMBRAL_COINCIDENCIA = 0.85;   // RN-08
    public const MAXIMO_INTENTOS = 5;          // RN-11

    private const MENSAJES = [
        VerificacionIdentidad::VERIFICADO => 'Verificamos tu identidad. Ya puedes solicitar créditos.',
        VerificacionIdentidad::REVISION_MANUAL => 'No pudimos confirmar que tu foto coincide con el documento. Una persona de nuestro equipo lo revisará y te avisaremos por correo en máximo un día hábil.',
        'revision_por_intentos' => 'Hiciste varios intentos sin que pudiéramos leer el documento. Una persona de nuestro equipo lo revisará y te avisaremos por correo.',
        VerificacionIdentidad::ILEGIBLE => 'No pudimos leer tu documento: la foto salió borrosa o con reflejos. Tómala de nuevo sobre una superficie oscura y con buena luz.',
        VerificacionIdentidad::EN_COLA => 'El servicio de verificación no responde en este momento. Guardamos tus fotos y lo intentaremos de nuevo; te avisaremos por correo.',
        VerificacionIdentidad::NO_CONTINUA => 'No podemos continuar con tu vinculación en este momento. Si necesitas más información, comunícate con nuestros canales de atención.',
    ];

    public function __construct(
        private readonly VerificacionIdentidadService $proveedor,
        private readonly ListasRestrictivasService $listas,
        private readonly Auditoria $auditoria,
    ) {}

    /** Estado con la forma `VerificacionIdentidad` del contrato, sin un intento en curso. */
    public function estado(int $clienteId): array
    {
        $cliente = Cliente::findOrFail($clienteId);

        return $this->respuesta($cliente, null, null, null);
    }

    /** @param array{documento_frente: UploadedFile, documento_reverso: UploadedFile, rostro: UploadedFile} $imagenes */
    public function verificar(int $clienteId, array $imagenes, ?string $escenario): array
    {
        $cliente = Cliente::findOrFail($clienteId);

        if ($cliente->estado_kyc === Cliente::KYC_VERIFICADO) {
            throw new ErrorNegocio('identidad_ya_verificada', 'Tu identidad ya está verificada.', 409);
        }
        // En revisión manual o bloqueado, el cliente no puede reintentar por su cuenta.
        if (in_array($cliente->estado_kyc, [Cliente::KYC_REVISION_MANUAL, Cliente::KYC_BLOQUEADO], true)) {
            return $this->respuesta($cliente, null, null, null);
        }

        $escenario = $this->proveedor->esSimulado() ? $escenario : null;
        $titular = [
            'tipo_documento' => $cliente->tipo_documento,
            'num_documento' => $cliente->num_documento,
            'nombres' => $cliente->nombres,
            'apellidos' => $cliente->apellidos,
            'fecha_nacimiento' => $cliente->fecha_nacimiento->toDateString(),
        ];

        $rutas = $this->guardarImagenes($cliente->id, $imagenes);
        $contraste = $this->proveedor->verificar($titular, array_map(fn (UploadedFile $f) => $f->get(), $imagenes), $escenario);
        $this->auditarLlamada('identidad.proveedor_verificacion', $cliente, $contraste['resultado'], $this->proveedor->esSimulado());

        $coincidencia = $contraste['coincidencia'];
        $listas = null;
        $mensaje = null;

        if ($contraste['resultado'] === VerificacionIdentidadService::NO_DISPONIBLE) {
            $resultado = VerificacionIdentidad::EN_COLA;                       // FA-03
        } elseif ($contraste['resultado'] === VerificacionIdentidadService::ILEGIBLE) {
            $resultado = VerificacionIdentidad::ILEGIBLE;                      // FA-01
            if ($this->ilegibles($cliente->id) + 1 >= self::MAXIMO_INTENTOS) {
                $resultado = VerificacionIdentidad::REVISION_MANUAL;           // RN-11
                $mensaje = self::MENSAJES['revision_por_intentos'];
            }
        } elseif ($coincidencia === null || $coincidencia < self::UMBRAL_COINCIDENCIA) {
            $resultado = VerificacionIdentidad::REVISION_MANUAL;               // RN-08, FA-02
        } else {
            $listas = $this->listas->consultar($titular, $escenario);           // paso 7
            $this->auditarLlamada('identidad.listas_restrictivas', $cliente, $listas, $this->listas->esSimulado());
            $resultado = match ($listas) {
                ListasRestrictivasService::COINCIDENCIA => VerificacionIdentidad::NO_CONTINUA,      // FA-04
                ListasRestrictivasService::NO_DISPONIBLE => VerificacionIdentidad::REVISION_MANUAL, // nunca se niega por caída
                default => VerificacionIdentidad::VERIFICADO,
            };
        }

        $estadoKyc = match ($resultado) {
            VerificacionIdentidad::VERIFICADO => Cliente::KYC_VERIFICADO,
            VerificacionIdentidad::REVISION_MANUAL => Cliente::KYC_REVISION_MANUAL,
            VerificacionIdentidad::NO_CONTINUA => Cliente::KYC_BLOQUEADO,
            default => $cliente->estado_kyc,
        };

        DB::transaction(function () use ($cliente, $resultado, $coincidencia, $listas, $escenario, $rutas, $estadoKyc) {
            VerificacionIdentidad::create([
                'cliente_id' => $cliente->id,
                'resultado' => $resultado,
                'coincidencia' => $coincidencia,
                'listas_restrictivas' => $listas,
                'escenario' => $escenario,
                'modo_simulado' => $this->proveedor->esSimulado(),
                'rutas_imagenes' => $rutas,
                'registrado_en' => now(),
            ]);
            $cliente->update(['estado_kyc' => $estadoKyc]);
        });

        $this->auditoria->registrar(
            'identidad.verificacion',
            'cliente',
            $cliente->id,
            $resultado === VerificacionIdentidad::VERIFICADO ? Auditoria::EXITO : Auditoria::RECHAZO,
            ['resultado' => $resultado, 'coincidencia' => $coincidencia],
            $cliente->usuario_id,
            $this->proveedor->esSimulado(),
        );

        if ($resultado === VerificacionIdentidad::NO_CONTINUA) {
            // RF-02 FA-04: alerta al área de cumplimiento (por ahora, en la bitácora).
            $this->auditoria->registrar('cumplimiento.alerta_listas', 'cliente', $cliente->id, Auditoria::RECHAZO,
                ['origen' => 'verificacion_identidad'], $cliente->usuario_id, $this->listas->esSimulado());
        }

        return $this->respuesta($cliente->refresh(), $resultado, $coincidencia, $mensaje ?? self::MENSAJES[$resultado]);
    }

    private function respuesta(Cliente $cliente, ?string $resultado, ?float $coincidencia, ?string $mensaje): array
    {
        return [
            'estado_kyc' => $cliente->estado_kyc,
            'resultado' => $resultado,
            // RN-10: con listas restrictivas no se muestra ni la coincidencia.
            'coincidencia' => $resultado === VerificacionIdentidad::NO_CONTINUA ? null : $coincidencia,
            'mensaje' => $mensaje,
            'intentos_restantes' => $cliente->estado_kyc === Cliente::KYC_PENDIENTE
                ? max(0, self::MAXIMO_INTENTOS - $this->ilegibles($cliente->id))
                : 0,
            'simulado' => $this->proveedor->esSimulado(),
        ];
    }

    private function ilegibles(int $clienteId): int
    {
        return VerificacionIdentidad::where('cliente_id', $clienteId)->where('resultado', VerificacionIdentidad::ILEGIBLE)->count();
    }

    /** RN-09: cifradas en reposo, en el disco privado. Devuelve las rutas (que se guardan cifradas). */
    private function guardarImagenes(int $clienteId, array $imagenes): array
    {
        $rutas = [];
        foreach ($imagenes as $tipo => $archivo) {
            $ruta = "identidad/{$clienteId}/".Str::uuid().'.cifrado';
            Storage::disk('local')->put($ruta, Crypt::encryptString($archivo->get()));
            $rutas[$tipo] = $ruta;
        }

        return $rutas;
    }

    private function auditarLlamada(string $accion, Cliente $cliente, string $resultado, bool $simulado): void
    {
        $this->auditoria->registrar($accion, 'cliente', $cliente->id, Auditoria::EXITO, ['respuesta' => $resultado], $cliente->usuario_id, $simulado);
    }
}
