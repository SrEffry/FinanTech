<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Mail\AvisoIntentoRegistroMail;
use App\Modules\Identidad\Mail\CodigoVerificacionMail;
use App\Modules\Identidad\Mail\RegistroNoDisponibleMail;
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
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Timebox;

/**
 * RF-01: registro y vinculación digital del cliente.
 *
 * Paso 1 (iniciar): valida unicidad, guarda los datos cifrados y envía un código
 * al correo y otro al teléfono. Paso 2 (verificar): con ambos códigos correctos
 * crea el usuario, el cliente y su consentimiento.
 *
 * P3 / RN-17 (manda sobre RF-01 FA-01, CP0005): si el documento o el correo ya tienen
 * cuenta, la respuesta es la de un registro nuevo (mismo código, mismo cuerpo y al
 * menos el mismo tiempo). Se crea un registro "señuelo" que nunca se puede verificar y
 * el aviso real llega por correo al titular de la cuenta. Los mensajes salen después de
 * enviar la respuesta (defer), para que su número no cambie el tiempo de respuesta.
 */
class RegistroCliente
{
    public function __construct(
        private readonly EnviadorSms $sms,
        private readonly Auditoria $auditoria,
    ) {}

    /** @param array<string, mixed> $datos datos validados del formulario */
    public function iniciar(#[\SensitiveParameter] array $datos): RegistroPendiente
    {
        return (new Timebox)->call(fn () => $this->iniciarSinMedir($datos), $this->microsegundosMinimos());
    }

    private function iniciarSinMedir(#[\SensitiveParameter] array $datos): RegistroPendiente
    {
        $hashDocumento = IndiceCiego::documento($datos['num_documento']);
        $email = mb_strtolower($datos['email']);

        // RN-01 / RN-02: titulares de las cuentas que ya tienen este documento o este correo.
        $titulares = Usuario::query()
            ->whereIn('id', Cliente::where('num_documento_hash', $hashDocumento)->select('usuario_id'))
            ->orWhere('email', $email)
            ->get(['id', 'email']);

        $politica = PoliticaTratamiento::vigente();
        $opcionalesValidas = $politica->finalidades->where('necesaria', false)->pluck('codigo')->all();
        $opcionales = array_values(array_intersect($datos['finalidades_opcionales'] ?? [], $opcionalesValidas));

        // Un registro anterior sin terminar con el mismo documento o correo se reemplaza.
        RegistroPendiente::where('num_documento_hash', $hashDocumento)->orWhere('email', $email)->delete();

        [$codigoEmail, $codigoTelefono] = [$this->generarCodigo(), $this->generarCodigo()];
        // La derivación de la contraseña se hace siempre: cuesta lo mismo con o sin cuenta previa.
        $passwordHash = Hash::make($datos['password']);
        $senuelo = $titulares->isNotEmpty();

        $registro = RegistroPendiente::create([
            'datos' => $senuelo
                ? ['senuelo' => true, 'telefono' => $datos['telefono'], 'canal' => $datos['canal'] ?? 'web']
                : [
                    'tipo_documento' => $datos['tipo_documento'],
                    'num_documento' => $datos['num_documento'],
                    'nombres' => $datos['nombres'],
                    'apellidos' => $datos['apellidos'],
                    'fecha_nacimiento' => $datos['fecha_nacimiento'],
                    'email' => $email,
                    'telefono' => $datos['telefono'],
                    'password_hash' => $passwordHash,
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

        if ($senuelo) {
            // Sin datos personales en la auditoría (RNF-06): solo que hubo un intento.
            $this->auditoria->registrar('cliente.registro', 'cliente', null, Auditoria::RECHAZO, ['motivo' => 'cuenta_existente']);
            $this->avisarTitulares($titulares->all(), $email, $datos['telefono'], $codigoTelefono);
        } else {
            $this->enviarCodigos($registro, $codigoEmail, $codigoTelefono);
        }

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

        if ($this->esSenuelo($registro)) {
            $this->enviarSms($registro->datos['telefono'], $codigoTelefono);
        } else {
            $this->enviarCodigos($registro, $codigoEmail, $codigoTelefono);
        }

        return $registro;
    }

    public function verificar(RegistroPendiente $registro, #[\SensitiveParameter] string $codigoEmail, #[\SensitiveParameter] string $codigoTelefono): Cliente
    {
        $this->asegurarVigente($registro);

        if ($registro->codigos_expiran_en->isPast()) {
            throw new ErrorNegocio('codigos_vencidos', 'Los códigos vencieron. Pide que te enviemos unos nuevos.', 422);
        }

        // P3: el señuelo nunca se verifica; responde igual que un código equivocado.
        $correctos = Hash::check($codigoEmail, $registro->codigo_email_hash)
            && Hash::check($codigoTelefono, $registro->codigo_telefono_hash)
            && ! $this->esSenuelo($registro);

        if (! $correctos) {
            $registro->increment('intentos');
            $restantes = config('finantech.registro.max_intentos_codigo') - $registro->intentos;

            if ($restantes <= 0) {
                $registro->delete();
                throw new ErrorNegocio('intentos_agotados', 'Superaste los intentos permitidos. Vuelve a iniciar el registro.', 422);
            }

            throw new ErrorNegocio('codigo_incorrecto', 'Alguno de los códigos no es correcto.', 422, ['intentos_restantes' => $restantes]);
        }

        try {
            return DB::transaction(fn () => $this->crearCliente($registro));
        } catch (ErrorNegocio $error) {
            // D-04: el borrado del pendiente va fuera de la transacción revertida.
            if ($error->codigo === 'cuenta_existente') {
                $registro->delete();
            }
            throw $error;
        }
    }

    private function crearCliente(RegistroPendiente $registro): Cliente
    {
        $datos = $registro->datos;

        // La unicidad pudo cambiar mientras el registro esperaba la verificación.
        if (Cliente::where('num_documento_hash', $registro->num_documento_hash)->exists()
            || Usuario::where('email', $datos['email'])->exists()) {
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

    private function enviarCodigos(RegistroPendiente $registro, #[\SensitiveParameter] string $codigoEmail, #[\SensitiveParameter] string $codigoTelefono): void
    {
        $minutos = config('finantech.registro.vigencia_codigos_minutos');
        $email = $registro->email;

        defer(fn () => Mail::to($email)->send(new CodigoVerificacionMail($codigoEmail, $minutos)));
        $this->enviarSms($registro->datos['telefono'], $codigoTelefono);
    }

    private function enviarSms(string $telefono, #[\SensitiveParameter] string $codigo): void
    {
        $minutos = config('finantech.registro.vigencia_codigos_minutos');

        defer(fn () => $this->sms->enviar(
            $telefono,
            "FinanTech: tu código de verificación es {$codigo}. Vence en {$minutos} minutos.",
        ));
    }

    /**
     * P3: el titular de cada cuenta recibe el aviso (como mucho 3 por hora, para que nadie
     * lo use para llenarle el buzón). Si el correo escrito no es de ningún titular (solo el
     * documento existía), ese correo recibe un mensaje que no confirma la cuenta. El SMS sale
     * igual que en un registro nuevo: quien escribió el celular no nota ninguna diferencia.
     *
     * @param  list<Usuario>  $titulares
     */
    private function avisarTitulares(array $titulares, string $emailEscrito, string $telefono, #[\SensitiveParameter] string $codigoTelefono): void
    {
        $portal = (string) config('finantech.recuperacion.url_portal');
        $momento = now()->timezone('America/Bogota')->format('d/m/Y').' a las '.now()->timezone('America/Bogota')->format('H:i');

        foreach ($titulares as $titular) {
            $avisar = RateLimiter::attempt('registro-aviso|'.$titular->id, 3, fn () => true, 3600);
            if ($avisar) {
                $correo = $titular->email;
                defer(fn () => Mail::to($correo)->send(new AvisoIntentoRegistroMail($portal, $momento)));
            }
            $this->auditoria->registrar('cliente.registro_aviso_titular', 'usuario', $titular->id, usuarioId: $titular->id, detalle: [
                'enviado' => $avisar,
            ]);
        }

        if (! collect($titulares)->contains(fn (Usuario $u) => $u->email === $emailEscrito)) {
            defer(fn () => Mail::to($emailEscrito)->send(new RegistroNoDisponibleMail($portal)));
        }

        $this->enviarSms($telefono, $codigoTelefono);
    }

    private function esSenuelo(RegistroPendiente $registro): bool
    {
        return (bool) ($registro->datos['senuelo'] ?? false);
    }

    private function microsegundosMinimos(): int
    {
        return max(0, (int) config('finantech.registro.tiempo_minimo_respuesta_ms')) * 1000;
    }

    private function generarCodigo(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
