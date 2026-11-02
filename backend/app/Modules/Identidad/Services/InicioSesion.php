<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Models\DesafioMfa;
use App\Modules\Identidad\Models\IntentoAcceso;
use App\Modules\Identidad\Models\Usuario;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;

/**
 * RF-03 pasos 2 a 6: valida las credenciales y emite el desafío del segundo factor.
 *
 * - RN-12: 5 intentos fallidos bloquean 30 minutos. El contador es por identificador
 *   (HMAC del correo), así que corre igual para correos que no existen.
 * - RN-15: el segundo factor se exige siempre a los roles internos. Los clientes también
 *   lo tienen activo (mfa_activo), de modo que hoy toda sesión pasa por él.
 * - RN-17 / CP0009: el mensaje es el mismo exista o no el usuario, se calcula el hash de
 *   la contraseña en ambos casos y toda respuesta fallida tarda al menos un tiempo fijo.
 */
class InicioSesion
{
    public const CREDENCIALES_INVALIDAS = 'El correo o la contraseña no son correctos.';
    public const CUENTA_BLOQUEADA = 'Por seguridad bloqueamos el ingreso con estos datos durante 30 minutos. '
        .'Mientras tanto puedes recuperar tu contraseña.';

    public function __construct(
        private readonly SegundoFactor $segundoFactor,
        private readonly Auditoria $auditoria,
    ) {}

    /** @return array{desafio_id: string, enviado_a: string, expira_en: string, reenvio_disponible_en: string} */
    public function iniciar(string $email, #[\SensitiveParameter] string $password): array
    {
        $usuario = (new Timebox)->call(
            fn (Timebox $timebox) => $this->validarCredenciales($email, $password, $timebox),
            $this->microsegundosMinimos(),
        );

        return $this->segundoFactor->emitirDesafio($usuario->id, DesafioMfa::SESION);
    }

    /**
     * RF-03 FA-04 / RN-17: la respuesta es la misma exista o no el correo. Si existe y la
     * cuenta está activa, se envía el enlace para crear una contraseña nueva.
     */
    public function solicitarRecuperacion(string $email, RecuperacionContrasena $recuperacion): void
    {
        (new Timebox)->call(function () use ($email, $recuperacion) {
            $correo = mb_strtolower(trim($email));
            $usuario = $correo === '' ? null : Usuario::where('email', $correo)->first();

            if ($usuario && $usuario->estaActivo()) {
                $recuperacion->enviarEnlace($usuario);
            }

            $this->auditoria->registrar('sesion.recuperacion_solicitada', 'usuario', $usuario?->id, usuarioId: $usuario?->id);
        }, $this->microsegundosMinimos());
    }

    private function validarCredenciales(string $email, #[\SensitiveParameter] string $password, Timebox $timebox): Usuario
    {
        $correo = mb_strtolower(trim($email));
        $intento = IntentoAcceso::firstOrNew(['identificador_hash' => IndiceCiego::correo($correo)]);
        $minutosBloqueo = (int) config('finantech.sesion.minutos_bloqueo');

        // RN-12: durante el bloqueo ni las credenciales correctas permiten el acceso.
        if ($intento->bloqueado_hasta?->isFuture()) {
            $this->auditoria->registrar('sesion.inicio', 'sesion', null, Auditoria::RECHAZO, ['motivo' => 'cuenta_bloqueada']);

            throw new ErrorNegocio('cuenta_bloqueada', self::CUENTA_BLOQUEADA, 423);
        }

        // Bloqueo cumplido o fallos viejos: el contador vuelve a empezar.
        if ($intento->bloqueado_hasta || $intento->ultimo_fallo_en?->lt(now()->subMinutes($minutosBloqueo))) {
            $intento->fill(['fallidos' => 0, 'bloqueado_hasta' => null]);
        }

        $usuario = $correo === '' ? null : Usuario::with('rol')->where('email', $correo)->first();
        // Se verifica contra un hash señuelo si el usuario no existe: el costo es el mismo.
        $hashSenuelo = $this->hashSenuelo();
        $passwordCorrecta = Hash::check($password, $usuario?->password ?? $hashSenuelo);

        if (! $usuario || ! $passwordCorrecta || ! $usuario->estaActivo()) {
            $intento->fallidos++;
            $intento->ultimo_fallo_en = now();
            $bloquear = $intento->fallidos >= (int) config('finantech.sesion.max_intentos');
            if ($bloquear) {
                $intento->fallidos = 0;
                $intento->bloqueado_hasta = now()->addMinutes($minutosBloqueo);
            }
            $intento->save();

            $this->auditoria->registrar('sesion.inicio', 'sesion', null, Auditoria::RECHAZO, [
                'motivo' => $bloquear ? 'bloqueo_por_intentos' : 'credenciales_invalidas',
            ], $usuario?->id);

            throw $bloquear
                ? new ErrorNegocio('cuenta_bloqueada', self::CUENTA_BLOQUEADA, 423)
                : new ErrorNegocio('credenciales_invalidas', self::CREDENCIALES_INVALIDAS, 401);
        }

        if ($intento->exists) {
            $intento->delete();
        }

        // Con la contraseña correcta no hay nada que ocultar: no hace falta esperar.
        $timebox->returnEarly();

        return $usuario;
    }

    /** Hash de una contraseña aleatoria con el mismo algoritmo y costo que las reales. */
    private function hashSenuelo(): string
    {
        $clave = 'identidad.hash_senuelo.'.config('hashing.driver').'.'.config('hashing.bcrypt.rounds');

        return Cache::rememberForever($clave, fn () => Hash::make(Str::random(40)));
    }

    private function microsegundosMinimos(): int
    {
        return max(0, (int) config('finantech.sesion.tiempo_minimo_respuesta_ms')) * 1000;
    }
}
