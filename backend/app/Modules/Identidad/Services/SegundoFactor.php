<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Mail\CodigoSegundoFactorMail;
use App\Modules\Identidad\Models\DesafioMfa;
use App\Modules\Identidad\Models\Usuario;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Interfaz pública del segundo factor: código de 6 dígitos al correo, de un solo uso.
 *
 * Lo usan el inicio de sesión (RN-15) y, desde Desembolso, la aceptación de la oferta
 * (RN-61). Cada propósito tiene sus propios desafíos: un código emitido para la sesión
 * no sirve para firmar, ni el de una oferta para otra (`referencia`).
 *
 * La respuesta de emitir() y reenviar() tiene la forma `DesafioMfa` del contrato.
 * Nunca incluye el código (en desarrollo queda en laravel.log por MAIL_MAILER=log).
 */
class SegundoFactor
{
    private const MOTIVOS = [
        DesafioMfa::SESION => 'ingresar',
        'aceptar_oferta' => 'aceptar tu oferta de crédito',
    ];

    public function __construct(private readonly Auditoria $auditoria) {}

    /** @return array{desafio_id: string, enviado_a: string, expira_en: string, reenvio_disponible_en: string} */
    public function emitirDesafio(int $usuarioId, string $proposito, ?string $referencia = null): array
    {
        $usuario = Usuario::findOrFail($usuarioId);

        // Un desafío nuevo anula los anteriores del mismo propósito.
        DesafioMfa::where('usuario_id', $usuarioId)->where('proposito', $proposito)->delete();

        $codigo = $this->generarCodigo();
        $desafio = DesafioMfa::create([
            'usuario_id' => $usuarioId,
            'proposito' => $proposito,
            'referencia' => $referencia,
            'codigo_hash' => Hash::make($codigo),
            'expira_en' => now()->addMinutes($this->config('vigencia_minutos')),
            'reenvio_disponible_en' => now()->addSeconds($this->config('espera_reenvio_segundos')),
        ]);

        $this->enviar($usuario, $codigo, $proposito);
        $this->auditoria->registrar('mfa.desafio_emitido', 'usuario', $usuarioId, usuarioId: $usuarioId, detalle: [
            'proposito' => $proposito,
        ]);

        return $this->publicar($desafio, $usuario);
    }

    /** @return array{desafio_id: string, enviado_a: string, expira_en: string, reenvio_disponible_en: string} */
    public function reenviar(string $desafioId, string $proposito): array
    {
        $desafio = $this->buscar($desafioId, $proposito);
        if (! $desafio) {
            throw new ErrorNegocio('codigo_vencido', 'El código venció. Vuelve a empezar.', 410);
        }

        $espera = $this->config('espera_reenvio_segundos');
        if ($desafio->reenvio_disponible_en->isFuture()) {
            throw new ErrorNegocio('reenvio_muy_pronto', "Espera {$espera} segundos antes de pedir otro código.", 429);
        }
        if ($desafio->reenvios >= $this->config('max_reenvios')) {
            throw new ErrorNegocio('reenvios_agotados', 'Alcanzaste el máximo de reenvíos. Vuelve a empezar.', 429);
        }

        $codigo = $this->generarCodigo();
        $desafio->update([
            'codigo_hash' => Hash::make($codigo),
            'intentos' => 0,
            'reenvios' => $desafio->reenvios + 1,
            'expira_en' => now()->addMinutes($this->config('vigencia_minutos')),
            'reenvio_disponible_en' => now()->addSeconds($espera),
        ]);

        $this->enviar($desafio->usuario, $codigo, $proposito);

        return $this->publicar($desafio, $desafio->usuario);
    }

    /**
     * Valida el código y consume el desafío. Devuelve el id del usuario dueño del desafío.
     * Si se pasa $usuarioId o $referencia, el desafío debe ser de ese usuario y esa referencia.
     *
     * @throws ErrorNegocio codigo_vencido, codigo_incorrecto (datos.intentos_restantes) o intentos_agotados
     */
    public function verificar(
        string $desafioId,
        #[\SensitiveParameter] string $codigo,
        string $proposito,
        ?int $usuarioId = null,
        ?string $referencia = null,
    ): int {
        $desafio = $this->buscar($desafioId, $proposito);

        if (! $desafio
            || ($usuarioId !== null && $desafio->usuario_id !== $usuarioId)
            || ($referencia !== null && $desafio->referencia !== $referencia)) {
            throw new ErrorNegocio('codigo_vencido', 'El código venció. Pide uno nuevo.', 422);
        }

        if (! preg_match('/^\d{6}$/', $codigo) || ! Hash::check($codigo, $desafio->codigo_hash)) {
            $desafio->increment('intentos');
            $restantes = $this->config('max_intentos') - $desafio->intentos;
            $this->auditoria->registrar('mfa.codigo_incorrecto', 'usuario', $desafio->usuario_id, Auditoria::RECHAZO, [
                'proposito' => $proposito,
            ], $desafio->usuario_id);

            if ($restantes <= 0) {
                $desafio->delete();
                throw new ErrorNegocio('intentos_agotados', 'Superaste los intentos permitidos. Vuelve a empezar.', 422);
            }

            throw new ErrorNegocio('codigo_incorrecto', 'El código no es correcto.', 422, ['intentos_restantes' => $restantes]);
        }

        $desafio->delete();

        return $desafio->usuario_id;
    }

    private function buscar(string $desafioId, string $proposito): ?DesafioMfa
    {
        if (! Str::isUuid($desafioId)) {
            return null;
        }

        $desafio = DesafioMfa::with('usuario')->where('id', $desafioId)->where('proposito', $proposito)->first();
        if ($desafio && $desafio->expira_en->isPast()) {
            $desafio->delete();

            return null;
        }

        return $desafio;
    }

    private function publicar(DesafioMfa $desafio, Usuario $usuario): array
    {
        return [
            'desafio_id' => $desafio->id,
            'enviado_a' => Enmascarar::correo($usuario->email),
            'expira_en' => $desafio->expira_en->toIso8601String(),
            'reenvio_disponible_en' => $desafio->reenvio_disponible_en->toIso8601String(),
        ];
    }

    private function enviar(Usuario $usuario, string $codigo, string $proposito): void
    {
        Mail::to($usuario->email)->send(new CodigoSegundoFactorMail(
            $codigo,
            $this->config('vigencia_minutos'),
            self::MOTIVOS[$proposito] ?? 'confirmar la operación',
        ));
    }

    private function generarCodigo(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function config(string $clave): int
    {
        return (int) config("finantech.segundo_factor.{$clave}");
    }
}
