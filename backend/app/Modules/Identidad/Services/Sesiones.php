<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Models\Sesion;
use App\Modules\Identidad\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Ciclo de vida de la sesión (RF-03, RI-08).
 *
 * - Token de acceso: JWT firmado de 15 minutos (RN-13) en la cookie httpOnly `ft_acceso`,
 *   Path=/api, SameSite=Lax.
 * - Token de renovación: aleatorio de 7 días (RN-14) en la cookie httpOnly `ft_renovacion`,
 *   Path=/api/v1/identidad/sesion, SameSite=Strict. Rota en cada uso; si alguien presenta
 *   uno ya rotado fuera de la ventana de gracia, se cierra la sesión (posible robo).
 * - Consola interna: la sesión vence tras 15 minutos sin actividad (RN-16).
 * - El portal nunca ve un token: no viajan en el cuerpo de ninguna respuesta.
 */
class Sesiones
{
    public const CIERRE_USUARIO = 'cierre_usuario';
    public const CIERRE_INACTIVIDAD = 'inactividad';
    public const CIERRE_REUSO = 'reuso_renovacion';

    public function __construct(
        private readonly TokenAcceso $tokens,
        private readonly Auditoria $auditoria,
    ) {}

    /**
     * Abre una sesión nueva y devuelve las cookies que hay que adjuntar a la respuesta.
     *
     * @return list<Cookie>
     */
    public function abrir(Usuario $usuario, Request $request, string $canal = 'web'): array
    {
        $renovacion = $this->tokenAleatorio();

        $sesion = Sesion::create([
            'usuario_id' => $usuario->id,
            'renovacion_hash' => $this->huella($renovacion),
            'renovacion_expira_en' => now()->addDays($this->dias()),
            'ultima_actividad_en' => now(),
            'canal' => $canal,
            'origen_ip' => $request->ip(),
            'agente' => Str::limit((string) $request->userAgent(), 250, ''),
        ]);

        $usuario->forceFill(['ultimo_acceso_en' => now()])->save();

        $this->auditoria->registrar('sesion.inicio', 'sesion', $sesion->id, usuarioId: $usuario->id, detalle: [
            'canal' => $canal,
            'rol' => $usuario->rol->codigo,
        ]);

        return [
            $this->cookieAcceso($this->tokens->emitir($usuario->id, $sesion->id, $usuario->rol->codigo)),
            $this->cookieRenovacion($renovacion),
        ];
    }

    /**
     * Valida el token de acceso de la petición. Devuelve el usuario y su sesión, o null.
     * Comprueba la sesión en la base: cerrarla invalida el acceso al instante.
     *
     * @return array{0: Usuario, 1: Sesion}|null
     */
    public function resolverAcceso(?string $tokenAcceso): ?array
    {
        $carga = $this->tokens->validar($tokenAcceso);
        if ($carga === null) {
            return null;
        }

        $sesion = Sesion::with('usuario.rol')->find($carga['sid']);
        if (! $sesion || ! $sesion->estaAbierta() || (string) $sesion->usuario_id !== $carga['sub']) {
            return null;
        }

        $usuario = $sesion->usuario;
        if (! $usuario->estaActivo()) {
            return null;
        }

        if ($this->vencidaPorInactividad($sesion, $usuario)) {
            $this->cerrarSesion($sesion, self::CIERRE_INACTIVIDAD);

            return null;
        }

        // RN-16: la actividad se anota como mucho una vez por minuto para no escribir en cada petición.
        if ($sesion->ultima_actividad_en->lt(now()->subMinute())) {
            $sesion->forceFill(['ultima_actividad_en' => now()])->save();
        }

        return [$usuario, $sesion];
    }

    /**
     * RN-14: canjea el token de renovación por un acceso nuevo y un token de renovación nuevo.
     *
     * @return array{0: Usuario, 1: list<Cookie>}|null null si no hay sesión válida
     */
    public function renovar(?string $tokenRenovacion): ?array
    {
        if ($tokenRenovacion === null || $tokenRenovacion === '') {
            return null;
        }

        $huella = $this->huella($tokenRenovacion);
        $sesion = Sesion::with('usuario.rol')->where('renovacion_hash', $huella)->first();

        if (! $sesion) {
            return $this->renovarConTokenRotado($huella);
        }

        $usuario = $sesion->usuario;
        if (! $sesion->estaAbierta() || ! $usuario->estaActivo()) {
            return null;
        }
        if ($this->vencidaPorInactividad($sesion, $usuario)) {
            $this->cerrarSesion($sesion, self::CIERRE_INACTIVIDAD);

            return null;
        }

        $nuevo = $this->tokenAleatorio();
        // Actualización condicional: si dos peticiones rotan a la vez, solo una gana.
        $rotada = DB::table('identidad_sesiones')
            ->where('id', $sesion->id)
            ->where('renovacion_hash', $huella)
            ->update([
                'renovacion_hash' => $this->huella($nuevo),
                'renovacion_anterior_hash' => $huella,
                'rotada_en' => now(),
                'renovacion_expira_en' => now()->addDays($this->dias()),
                'ultima_actividad_en' => now(),
                'updated_at' => now(),
            ]);

        if ($rotada === 0) {
            return $this->renovarConTokenRotado($huella);
        }

        $this->auditoria->registrar('sesion.renovada', 'sesion', $sesion->id, usuarioId: $usuario->id);

        return [$usuario, [
            $this->cookieAcceso($this->tokens->emitir($usuario->id, $sesion->id, $usuario->rol->codigo)),
            $this->cookieRenovacion($nuevo),
        ]];
    }

    /**
     * Cierra todas las sesiones abiertas del usuario: el cierre se propaga a todos los
     * canales (RF-03, CP0008 paso 8).
     */
    public function cerrarTodas(int $usuarioId, string $motivo = self::CIERRE_USUARIO): int
    {
        $cerradas = Sesion::where('usuario_id', $usuarioId)->whereNull('cerrada_en')
            ->update(['cerrada_en' => now(), 'motivo_cierre' => $motivo]);

        if ($cerradas > 0) {
            $this->auditoria->registrar('sesion.cierre', 'usuario', $usuarioId, usuarioId: $usuarioId, detalle: [
                'motivo' => $motivo,
                'sesiones' => $cerradas,
            ]);
        }

        return $cerradas;
    }

    /** Usuario dueño del token de renovación, si la sesión sigue abierta (para el cierre sin acceso vigente). */
    public function usuarioDeRenovacion(?string $tokenRenovacion): ?int
    {
        if (! $tokenRenovacion) {
            return null;
        }

        return Sesion::where('renovacion_hash', $this->huella($tokenRenovacion))->whereNull('cerrada_en')->value('usuario_id');
    }

    /** @return list<Cookie> cookies vencidas que borran la sesión del navegador */
    public function cookiesDeCierre(): array
    {
        return [
            $this->cookie(config('finantech.sesion.cookie_acceso'), '', -1, config('finantech.sesion.ruta_cookie_acceso'), Cookie::SAMESITE_LAX),
            $this->cookie(config('finantech.sesion.cookie_renovacion'), '', -1, config('finantech.sesion.ruta_cookie_renovacion'), Cookie::SAMESITE_STRICT),
        ];
    }

    /**
     * El token presentado ya había rotado. Dentro de la ventana de gracia (otra pestaña
     * renovó primero) solo se emite un acceso nuevo: el navegador ya tiene la renovación
     * vigente. Fuera de ella es reutilización de un token viejo y se cierra la sesión.
     *
     * @return array{0: Usuario, 1: list<Cookie>}|null
     */
    private function renovarConTokenRotado(string $huella): ?array
    {
        $sesion = Sesion::with('usuario.rol')->where('renovacion_anterior_hash', $huella)->first();
        if (! $sesion || ! $sesion->estaAbierta() || ! $sesion->usuario->estaActivo()) {
            return null;
        }

        $gracia = (int) config('finantech.sesion.gracia_rotacion_segundos');
        if ($sesion->rotada_en && $sesion->rotada_en->gt(now()->subSeconds($gracia))) {
            $usuario = $sesion->usuario;

            return [$usuario, [$this->cookieAcceso($this->tokens->emitir($usuario->id, $sesion->id, $usuario->rol->codigo))]];
        }

        $this->cerrarSesion($sesion, self::CIERRE_REUSO);
        $this->auditoria->registrar('sesion.reuso_renovacion', 'sesion', $sesion->id, Auditoria::RECHAZO, usuarioId: $sesion->usuario_id);

        return null;
    }

    private function vencidaPorInactividad(Sesion $sesion, Usuario $usuario): bool
    {
        $minutos = (int) config('finantech.sesion.minutos_inactividad_interna');

        return $usuario->esInterno() && $sesion->ultima_actividad_en->lt(now()->subMinutes($minutos));
    }

    private function cerrarSesion(Sesion $sesion, string $motivo): void
    {
        $sesion->forceFill(['cerrada_en' => now(), 'motivo_cierre' => $motivo])->save();
        $this->auditoria->registrar('sesion.cierre', 'sesion', $sesion->id, usuarioId: $sesion->usuario_id, detalle: ['motivo' => $motivo]);
    }

    private function cookieAcceso(string $jwt): Cookie
    {
        return $this->cookie(
            config('finantech.sesion.cookie_acceso'),
            $jwt,
            (int) config('finantech.sesion.minutos_acceso'),
            config('finantech.sesion.ruta_cookie_acceso'),
            Cookie::SAMESITE_LAX,
        );
    }

    private function cookieRenovacion(string $token): Cookie
    {
        return $this->cookie(
            config('finantech.sesion.cookie_renovacion'),
            $token,
            $this->dias() * 24 * 60,
            config('finantech.sesion.ruta_cookie_renovacion'),
            Cookie::SAMESITE_STRICT,
        );
    }

    private function cookie(string $nombre, string $valor, int $minutos, string $ruta, string $sameSite): Cookie
    {
        return Cookie::create(
            name: $nombre,
            value: $valor,
            expire: $minutos < 0 ? 1 : now()->addMinutes($minutos)->getTimestamp(),
            path: $ruta,
            domain: null,
            secure: (bool) config('finantech.sesion.cookie_segura'),
            httpOnly: true,
            raw: false,
            sameSite: $sameSite,
        );
    }

    private function tokenAleatorio(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }

    private function huella(string $token): string
    {
        return hash('sha256', $token);
    }

    private function dias(): int
    {
        return (int) config('finantech.sesion.dias_renovacion');
    }
}
