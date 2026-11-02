<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Mail\RecuperacionContrasenaMail;
use App\Modules\Identidad\Models\IntentoAcceso;
use App\Modules\Identidad\Models\Usuario;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Recuperación de contraseña (RF-03 FA-04). El enlace lleva un token de un solo uso
 * que vence en 60 minutos; en la base solo queda su huella.
 */
class RecuperacionContrasena
{
    private const TABLA = 'password_reset_tokens';

    public function __construct(
        private readonly Sesiones $sesiones,
        private readonly Auditoria $auditoria,
    ) {}

    public function enviarEnlace(Usuario $usuario): void
    {
        $token = Str::random(64);

        DB::table(self::TABLA)->updateOrInsert(
            ['email' => $usuario->email],
            ['token' => hash('sha256', $token), 'created_at' => now()],
        );

        $enlace = rtrim((string) config('finantech.recuperacion.url_portal'), '/')
            .'/recuperar/nueva?'.http_build_query(['token' => $token, 'email' => $usuario->email]);

        Mail::to($usuario->email)->send(new RecuperacionContrasenaMail($enlace, $this->minutos()));
    }

    /**
     * Cambia la contraseña con un token vigente. Cierra todas las sesiones abiertas y
     * levanta el bloqueo por intentos, porque el titular acaba de demostrar su identidad.
     */
    public function restablecer(string $email, #[\SensitiveParameter] string $token, #[\SensitiveParameter] string $password): void
    {
        $correo = mb_strtolower(trim($email));
        $fila = DB::table(self::TABLA)->where('email', $correo)->first();

        $valido = $fila
            && hash_equals($fila->token, hash('sha256', $token))
            && now()->parse($fila->created_at)->gt(now()->subMinutes($this->minutos()));

        $usuario = $valido ? Usuario::where('email', $correo)->first() : null;
        if (! $usuario || ! $usuario->estaActivo()) {
            throw new ErrorNegocio('enlace_invalido', 'El enlace no es válido o ya venció. Pide uno nuevo.', 422);
        }

        DB::transaction(function () use ($usuario, $password, $correo) {
            $usuario->forceFill(['password' => Hash::make($password), 'password_cambiada_en' => now()])->save();
            DB::table(self::TABLA)->where('email', $correo)->delete();
            IntentoAcceso::where('identificador_hash', IndiceCiego::correo($correo))->delete();
        });

        $this->sesiones->cerrarTodas($usuario->id, 'cambio_contrasena');
        $this->auditoria->registrar('sesion.contrasena_restablecida', 'usuario', $usuario->id, usuarioId: $usuario->id);
    }

    private function minutos(): int
    {
        return (int) config('finantech.recuperacion.vigencia_minutos');
    }
}
