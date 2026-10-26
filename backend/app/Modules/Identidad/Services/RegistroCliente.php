<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Mail\CodigoVerificacionMail;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\PoliticaTratamiento;
use App\Modules\Identidad\Models\RegistroPendiente;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * RF-01: registro y vinculación digital del cliente.
 *
 * Paso 1 (iniciar): valida unicidad, guarda los datos cifrados y envía un código
 * al correo y otro al teléfono. Paso 2 (verificar): con ambos códigos correctos
 * crea el usuario, el cliente y su consentimiento.
 */
class RegistroCliente
{
    public function __construct(
        private readonly EnviadorSms $sms,
        private readonly Auditoria $auditoria,
    ) {}

    /** @param array<string, mixed> $datos datos validados del formulario */
    public function iniciar(array $datos): RegistroPendiente
    {
        $hashDocumento = IndiceCiego::documento($datos['num_documento']);
        $email = mb_strtolower($datos['email']);

        // RF-01 FA-01 / RN-01 / RN-02. El mensaje no revela de quién es la cuenta.
        $existe = Cliente::where('num_documento_hash', $hashDocumento)->exists()
            || Usuario::where('email', $email)->exists();
        if ($existe) {
            $this->auditoria->registrar('cliente.registro', 'cliente', null, Auditoria::RECHAZO, ['motivo' => 'cuenta_existente']);

            throw new ErrorNegocio(
                'cuenta_existente',
                'Ya existe una cuenta con estos datos. Si es tuya, recupera el acceso desde "¿Olvidaste tu contraseña?".',
                409,
            );
        }

        $politica = PoliticaTratamiento::vigente();
        $opcionalesValidas = $politica->finalidades->where('necesaria', false)->pluck('codigo')->all();
        $opcionales = array_values(array_intersect($datos['finalidades_opcionales'] ?? [], $opcionalesValidas));

        // Un registro anterior sin terminar con el mismo documento o correo se reemplaza.
        RegistroPendiente::where('num_documento_hash', $hashDocumento)->orWhere('email', $email)->delete();

        [$codigoEmail, $codigoTelefono] = [$this->generarCodigo(), $this->generarCodigo()];

        $registro = RegistroPendiente::create([
            'datos' => [
                'tipo_documento' => $datos['tipo_documento'],
                'num_documento' => $datos['num_documento'],
                'nombres' => $datos['nombres'],
                'apellidos' => $datos['apellidos'],
                'fecha_nacimiento' => $datos['fecha_nacimiento'],
                'email' => $email,
                'telefono' => $datos['telefono'],
                'password_hash' => Hash::make($datos['password']),
                'finalidades_opcionales' => $opcionales,
                'version_politica' => $politica->version,
                'canal' => $datos['canal'] ?? 'web',
            ],
            'num_documento_hash' => $hashDocumento,
            'email' => $email,
            'codigo_email_hash' => Hash::make($codigoEmail),
            'codigo_telefono_hash' => Hash::make($codigoTelefono),
            'reenvios' => [],
            'codigos_expiran_en' => now()->addMinutes(config('finantech.registro.vigencia_codigos_minutos')),
            'expira_en' => now()->addMinutes(config('finantech.registro.vigencia_registro_minutos')),
        ]);

        $this->enviarCodigos($registro, $codigoEmail, $codigoTelefono);

        return $registro;
    }

    /** RF-01 FA-02: reenvío después de 60 segundos, máximo 3 por hora. */
    public function reenviar(RegistroPendiente $registro): RegistroPendiente
    {
        $this->asegurarVigente($registro);

        $reenvios = collect($registro->reenvios ?? [])->map(fn ($t) => now()->parse($t));
        $ultimoEnvio = $reenvios->max() ?? $registro->created_at;

        $espera = config('finantech.registro.espera_reenvio_segundos');
        if ($ultimoEnvio->diffInSeconds(now()) < $espera) {
            throw new ErrorNegocio('reenvio_muy_pronto', "Espera {$espera} segundos antes de pedir otro código.", 429);
        }
        if ($reenvios->filter(fn ($t) => $t->gt(now()->subHour()))->count() >= config('finantech.registro.max_reenvios_por_hora')) {
            throw new ErrorNegocio('reenvios_agotados', 'Alcanzaste el máximo de reenvíos por hora. Intenta más tarde.', 429);
        }

        [$codigoEmail, $codigoTelefono] = [$this->generarCodigo(), $this->generarCodigo()];

        $registro->update([
            'codigo_email_hash' => Hash::make($codigoEmail),
            'codigo_telefono_hash' => Hash::make($codigoTelefono),
            'intentos' => 0,
            'reenvios' => [...($registro->reenvios ?? []), now()->toIso8601String()],
            'codigos_expiran_en' => now()->addMinutes(config('finantech.registro.vigencia_codigos_minutos')),
        ]);

        $this->enviarCodigos($registro, $codigoEmail, $codigoTelefono);

        return $registro;
    }

    public function verificar(RegistroPendiente $registro, string $codigoEmail, string $codigoTelefono): Cliente
    {
        $this->asegurarVigente($registro);

        if ($registro->codigos_expiran_en->isPast()) {
            throw new ErrorNegocio('codigos_vencidos', 'Los códigos vencieron. Pide que te enviemos unos nuevos.', 422);
        }

        $correctos = Hash::check($codigoEmail, $registro->codigo_email_hash)
            && Hash::check($codigoTelefono, $registro->codigo_telefono_hash);

        if (! $correctos) {
            $registro->increment('intentos');
            $restantes = config('finantech.registro.max_intentos_codigo') - $registro->intentos;

            if ($restantes <= 0) {
                $registro->delete();
                throw new ErrorNegocio('intentos_agotados', 'Superaste los intentos permitidos. Vuelve a iniciar el registro.', 422);
            }

            throw new ErrorNegocio('codigo_incorrecto', 'Alguno de los códigos no es correcto.', 422, ['intentos_restantes' => $restantes]);
        }

        return DB::transaction(fn () => $this->crearCliente($registro));
    }

    private function crearCliente(RegistroPendiente $registro): Cliente
    {
        $datos = $registro->datos;

        // La unicidad pudo cambiar mientras el registro esperaba la verificación.
        if (Cliente::where('num_documento_hash', $registro->num_documento_hash)->exists()
            || Usuario::where('email', $datos['email'])->exists()) {
            $registro->delete();
            throw new ErrorNegocio('cuenta_existente', 'Ya existe una cuenta con estos datos. Si es tuya, recupera el acceso.', 409);
        }

        $usuario = Usuario::create([
            'rol_id' => Rol::where('codigo', Rol::CLIENTE)->value('id'),
            'nombre_completo' => trim($datos['nombres'].' '.$datos['apellidos']),
            'email' => $datos['email'],
            'email_verificado_en' => now(),
            'password' => $datos['password_hash'],
            'mfa_activo' => true,
            'password_cambiada_en' => now(),
        ]);

        $cliente = Cliente::create([
            'usuario_id' => $usuario->id,
            'tipo_documento' => $datos['tipo_documento'],
            'num_documento' => $datos['num_documento'],
            'nombres' => $datos['nombres'],
            'apellidos' => $datos['apellidos'],
            'fecha_nacimiento' => $datos['fecha_nacimiento'],
            'telefono' => $datos['telefono'],
            'telefono_verificado_en' => now(),
            'estado_kyc' => Cliente::KYC_PENDIENTE,
        ]);

        // RN-04: cada finalidad con fecha y hora, canal y versión de la política.
        $politica = PoliticaTratamiento::where('version', $datos['version_politica'])->firstOrFail();
        $otorgadas = $politica->finalidades
            ->filter(fn ($f) => $f->necesaria || in_array($f->codigo, $datos['finalidades_opcionales'], true));

        foreach ($otorgadas as $finalidad) {
            Consentimiento::create([
                'cliente_id' => $cliente->id,
                'finalidad_codigo' => $finalidad->codigo,
                'accion' => Consentimiento::OTORGA,
                'version_politica' => $politica->version,
                'canal' => $datos['canal'],
                'registrado_en' => now(),
            ]);
        }

        $registro->delete();

        $this->auditoria->registrar('cliente.registrado', 'cliente', $cliente->id, usuarioId: $usuario->id, detalle: [
            'canal' => $datos['canal'],
            'finalidades' => $otorgadas->pluck('codigo')->values()->all(),
        ]);

        return $cliente;
    }

    private function asegurarVigente(RegistroPendiente $registro): void
    {
        if ($registro->expira_en->isPast()) {
            $registro->delete();
            throw new ErrorNegocio('registro_vencido', 'El registro venció. Vuelve a iniciarlo.', 410);
        }
    }

    private function enviarCodigos(RegistroPendiente $registro, string $codigoEmail, string $codigoTelefono): void
    {
        $minutos = config('finantech.registro.vigencia_codigos_minutos');

        Mail::to($registro->email)->send(new CodigoVerificacionMail($codigoEmail, $minutos));
        $this->sms->enviar(
            $registro->datos['telefono'],
            "FinanTech: tu código de verificación es {$codigoTelefono}. Vence en {$minutos} minutos.",
        );
    }

    private function generarCodigo(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
