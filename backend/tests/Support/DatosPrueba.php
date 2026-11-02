<?php

namespace Tests\Support;

use App\Modules\Identidad\Mail\CodigoVerificacionMail;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Datos sintéticos y utilidades compartidas por las pruebas de QA.
 * Solo datos inventados (RNF-06): nunca datos de personas reales.
 */
final class DatosPrueba
{
    public const PASSWORD = 'Clave-Segura-2026';

    /** Cuerpo válido de POST clientes/registro (RF-01). */
    public static function registro(array $cambios = []): array
    {
        return array_merge([
            'tipo_documento' => 'CC',
            'num_documento' => '1067123456',
            'nombres' => 'María José',
            'apellidos' => 'Pérez Díaz',
            'fecha_nacimiento' => now()->subYears(30)->toDateString(),
            'email' => 'maria.perez@example.com',
            'telefono' => '3001234567',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
            'acepta_politica' => true,
            'finalidades_opcionales' => [],
        ], $cambios);
    }

    /** Último código de correo enviado con Mail::fake(). */
    public static function codigoCorreo(): ?string
    {
        $codigo = null;
        Mail::assertSent(CodigoVerificacionMail::class, function (CodigoVerificacionMail $mail) use (&$codigo) {
            $codigo = $mail->codigo;

            return true;
        });

        return $codigo;
    }

    /** Crea un usuario sintético con el rol indicado, y su cliente si el rol es cliente. */
    public static function usuario(string $rol = Rol::CLIENTE, array $cambios = []): Usuario
    {
        static $consecutivo = 0;
        $consecutivo++;

        $usuario = Usuario::create(array_merge([
            'rol_id' => Rol::where('codigo', $rol)->value('id'),
            'nombre_completo' => "Persona Prueba {$consecutivo}",
            'email' => "{$rol}{$consecutivo}@example.com",
            'email_verificado_en' => now(),
            'password' => self::PASSWORD,
            'mfa_activo' => true,
            'password_cambiada_en' => now(),
        ], $cambios));

        if ($rol === Rol::CLIENTE) {
            Cliente::create([
                'usuario_id' => $usuario->id,
                'tipo_documento' => 'CC',
                'num_documento' => (string) (1000000000 + $consecutivo),
                'nombres' => 'Persona',
                'apellidos' => "Prueba {$consecutivo}",
                'fecha_nacimiento' => '1990-01-01',
                'telefono' => '30000000'.str_pad((string) ($consecutivo % 100), 2, '0', STR_PAD_LEFT),
                'telefono_verificado_en' => now(),
            ]);
        }

        return $usuario;
    }

    /**
     * Todo lo que quedó en el log como texto: mensaje, contexto y la traza de la
     * excepción tal como la escribiría el formateador (con sus argumentos).
     *
     * @param  list<MessageLogged>  $eventos
     */
    public static function textoDelLog(array $eventos): string
    {
        return collect($eventos)->map(function (MessageLogged $e) {
            $contexto = collect($e->context)->map(fn ($v) => $v instanceof Throwable
                ? $v->getMessage()."\n".$v->getTraceAsString()
                : json_encode($v, JSON_UNESCAPED_UNICODE));

            return $e->level.' '.$e->message.' '.$contexto->implode(' ');
        })->implode("\n");
    }
}
