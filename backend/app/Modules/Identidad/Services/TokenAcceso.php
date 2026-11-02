<?php

namespace App\Modules\Identidad\Services;

use Illuminate\Support\Str;

/**
 * Token de acceso firmado (JWT HS256, RI-08) con vigencia de 15 minutos (RN-13).
 *
 * El algoritmo es fijo: se ignora el que diga la cabecera, así que no se aceptan
 * tokens "none" ni de otro algoritmo. El token lleva el id de la sesión (`sid`),
 * que se comprueba en cada petición para que el cierre de sesión surta efecto al
 * instante en todos los canales.
 */
final class TokenAcceso
{
    private const CABECERA = ['alg' => 'HS256', 'typ' => 'JWT'];

    public function emitir(int $usuarioId, string $sesionId, string $rol): string
    {
        $ahora = now()->getTimestamp();
        $carga = [
            'iss' => (string) config('app.url'),
            'sub' => (string) $usuarioId,
            'sid' => $sesionId,
            'rol' => $rol,
            'iat' => $ahora,
            'exp' => $ahora + $this->segundosVigencia(),
            'jti' => (string) Str::uuid(),
        ];

        $sinFirma = $this->codificar(self::CABECERA).'.'.$this->codificar($carga);

        return $sinFirma.'.'.$this->firmar($sinFirma);
    }

    /**
     * Devuelve la carga si la firma es válida y el token no ha vencido; si no, null.
     *
     * @return array{sub: string, sid: string, rol: string, iat: int, exp: int}|null
     */
    public function validar(?string $token): ?array
    {
        if ($token === null || substr_count($token, '.') !== 2) {
            return null;
        }

        [$cabecera, $carga, $firma] = explode('.', $token);
        if (! hash_equals($this->firmar($cabecera.'.'.$carga), $firma)) {
            return null;
        }
        if ($this->decodificar($cabecera) !== self::CABECERA) {
            return null;
        }

        $datos = $this->decodificar($carga);
        if (! is_array($datos) || ! isset($datos['sub'], $datos['sid'], $datos['exp'], $datos['rol'])) {
            return null;
        }
        if (($datos['iss'] ?? null) !== (string) config('app.url') || $datos['exp'] <= now()->getTimestamp()) {
            return null;
        }

        return $datos;
    }

    public function segundosVigencia(): int
    {
        return (int) config('finantech.sesion.minutos_acceso') * 60;
    }

    private function firmar(string $contenido): string
    {
        return $this->base64Url(hash_hmac('sha256', $contenido, $this->clave(), true));
    }

    private function clave(): string
    {
        // Clave propia si existe; si no, una derivada de APP_KEY para no reutilizarla tal cual.
        return (string) (config('finantech.sesion.clave_firma')
            ?: hash_hmac('sha256', 'finantech.token-acceso', (string) config('app.key'), true));
    }

    private function codificar(array $datos): string
    {
        return $this->base64Url(json_encode($datos, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    private function decodificar(string $parte): mixed
    {
        $json = base64_decode(strtr($parte, '-_', '+/'), true);

        return $json === false ? null : json_decode($json, true);
    }

    private function base64Url(string $binario): string
    {
        return rtrim(strtr(base64_encode($binario), '+/', '-_'), '=');
    }
}
