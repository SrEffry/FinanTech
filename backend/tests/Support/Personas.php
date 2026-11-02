<?php

namespace Tests\Support;

use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Empleado;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\Sesiones;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

/**
 * Personas sintéticas para las pruebas y forma de abrirles sesión sin pasar por el
 * segundo factor. Requiere los catálogos de Identidad sembrados (tests/Pest.php).
 *
 *     $cliente = Personas::cliente(['estado_kyc' => 'verificado']);
 *     $cookies = Personas::cookiesDe($cliente);
 *     $this->call('GET', '/api/v1/...', [], $cookies, [], Personas::cabeceras());
 *
 * También sirve `$this->actingAs($usuario)` cuando la prueba no necesita las cookies.
 */
final class Personas
{
    public const CLAVE = 'Clave-Segura-2026';

    /** @param array<string, mixed> $cliente atributos de identidad_clientes */
    public static function cliente(array $cliente = [], array $usuario = []): Usuario
    {
        $nombres = $cliente['nombres'] ?? 'Ana María';
        $apellidos = $cliente['apellidos'] ?? 'Prueba Sintética';
        $creado = self::usuario(Rol::CLIENTE, array_merge(['nombre_completo' => "{$nombres} {$apellidos}"], $usuario));

        Cliente::create(array_merge([
            'usuario_id' => $creado->id,
            'tipo_documento' => 'CC',
            'num_documento' => (string) random_int(1_000_000_000, 1_099_999_999),
            'nombres' => $nombres,
            'apellidos' => $apellidos,
            'fecha_nacimiento' => now()->subYears(30)->toDateString(),
            'telefono' => '300'.random_int(1_000_000, 9_999_999),
            'telefono_verificado_en' => now(),
            'estado_kyc' => Cliente::KYC_PENDIENTE,
        ], $cliente));

        return $creado->fresh(['rol', 'cliente']);
    }

    public static function interno(string $rol, array $usuario = [], array $empleado = []): Usuario
    {
        $creado = self::usuario($rol, $usuario);

        Empleado::create(array_merge([
            'usuario_id' => $creado->id,
            'cargo' => 'Cargo de prueba',
            'area' => 'Área de prueba',
            'atribucion_monto' => 0,
        ], $empleado));

        return $creado->fresh(['rol', 'empleado']);
    }

    /**
     * Abre una sesión real (como tras el segundo factor) y devuelve sus cookies.
     *
     * @return array<string, string> nombre => valor
     */
    public static function cookiesDe(Usuario $usuario): array
    {
        $cookies = app(Sesiones::class)->abrir($usuario->loadMissing('rol'), request());

        $resultado = [];
        foreach ($cookies as $cookie) {
            $resultado[$cookie->getName()] = (string) $cookie->getValue();
        }

        return $resultado;
    }

    /** @return array<string, string> cookies vigentes que fijó una respuesta */
    public static function cookiesDeRespuesta(TestResponse $respuesta): array
    {
        $resultado = [];
        foreach ($respuesta->headers->getCookies() as $cookie) {
            if (! $cookie->isCleared() && $cookie->getValue() !== '' && $cookie->getValue() !== null) {
                $resultado[$cookie->getName()] = (string) $cookie->getValue();
            }
        }

        return $resultado;
    }

    /** Cabeceras que manda el portal en cada petición (server params de $this->call). */
    public static function cabeceras(): array
    {
        return ['HTTP_ACCEPT' => 'application/json', 'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest'];
    }

    private static function usuario(string $rol, array $datos): Usuario
    {
        return Usuario::create(array_merge([
            'rol_id' => Rol::where('codigo', $rol)->value('id'),
            'nombre_completo' => 'Persona Sintética',
            'email' => Str::lower(Str::random(10)).'@prueba.finantech.co',
            'email_verificado_en' => now(),
            'password' => Hash::make(self::CLAVE),
            'mfa_activo' => true,
            'password_cambiada_en' => now(),
        ], $datos));
    }
}
