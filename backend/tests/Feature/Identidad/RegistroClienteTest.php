<?php

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Mail\CodigoVerificacionMail;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\RegistroPendiente;
use App\Modules\Identidad\Models\Usuario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\Support\SmsFalso;

beforeEach(function () {
    Mail::fake();
    Http::fake(); // contraste de contraseñas filtradas (RNF-05) sin salir a internet
    $this->sms = new SmsFalso;
    $this->app->instance(EnviadorSms::class, $this->sms);
});

function datosRegistro(array $cambios = []): array
{
    return array_merge([
        'tipo_documento' => 'CC',
        'num_documento' => '1067123456',
        'nombres' => 'María José',
        'apellidos' => 'Pérez Díaz',
        'fecha_nacimiento' => now()->subYears(30)->toDateString(),
        'email' => 'maria.perez@example.com',
        'telefono' => '3001234567',
        'password' => 'Clave-Segura-2026',
        'password_confirmation' => 'Clave-Segura-2026',
        'acepta_politica' => true,
        'finalidades_opcionales' => [],
    ], $cambios);
}

function codigoCorreoEnviado(): string
{
    $codigo = null;
    Mail::assertSent(CodigoVerificacionMail::class, function ($mail) use (&$codigo) {
        $codigo = $mail->codigo;

        return true;
    });

    return $codigo;
}

describe('CP0004 — registro y vinculación del cliente (RF-01)', function () {
    it('crea el cliente con identificador único después de verificar correo y teléfono', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro(['finalidades_opcionales' => ['ofertas_comerciales']]))
            ->assertCreated()
            ->assertJsonStructure(['registro_id', 'codigos_expiran_en', 'reenvio_disponible_en']);

        expect(Cliente::count())->toBe(0); // nada se crea antes de verificar

        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ])->assertCreated()->assertJson(['estado_kyc' => 'pendiente', 'siguiente_paso' => 'verificacion_identidad']);

        $cliente = Cliente::sole();
        expect($cliente->num_documento)->toBe('1067123456')
            ->and($cliente->usuario->rol->codigo)->toBe('cliente')
            ->and($cliente->usuario->email_verificado_en)->not->toBeNull()
            ->and($cliente->telefono_verificado_en)->not->toBeNull()
            ->and(RegistroPendiente::count())->toBe(0);
    });

    it('guarda el documento cifrado y la contraseña con función de derivación (RNF-06, RN-06)', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ])->assertCreated();

        $fila = DB::table('identidad_clientes')->first();
        expect($fila->num_documento)->not->toContain('1067123456');

        $password = DB::table('identidad_usuarios')->value('password');
        expect($password)->not->toBe('Clave-Segura-2026')
            ->and(Hash::isHashed($password))->toBeTrue()
            ->and(Hash::check('Clave-Segura-2026', $password))->toBeTrue();
    });

    it('registra el consentimiento con fecha, canal y versión de la política (RN-04)', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro(['finalidades_opcionales' => ['ofertas_comerciales']]));
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ]);

        $consentimientos = Consentimiento::orderBy('id')->get();
        expect($consentimientos->pluck('finalidad_codigo')->all())
            ->toBe(['gestion_cliente', 'verificacion_identidad', 'ofertas_comerciales']);

        $consentimientos->each(fn ($c) => expect($c->accion)->toBe('otorga')
            ->and($c->canal)->toBe('web')
            ->and($c->version_politica)->toBe('1.0')
            ->and($c->registrado_en)->not->toBeNull());
    });

    it('deja constancia del registro en la bitácora de auditoría', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ]);

        $registro = RegistroAuditoria::where('accion', 'cliente.registrado')->sole();
        expect($registro->entidad)->toBe('cliente')
            ->and($registro->id_entidad)->toBe((string) Cliente::sole()->id)
            ->and($registro->resultado)->toBe('exito');
    });
});

describe('CP0005 — validaciones de registro (RN-01, RN-03)', function () {
    it('rechaza un documento ya registrado sin revelar datos de la cuenta', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ]);

        $respuesta = $this->postJson('/api/v1/clientes/registro', datosRegistro(['email' => 'otra@example.com']))
            ->assertStatus(409)
            ->assertJson(['codigo' => 'cuenta_existente']);

        expect($respuesta->getContent())->not->toContain('maria.perez')->not->toContain('María');
        expect(Cliente::count())->toBe(1)->and(RegistroPendiente::count())->toBe(0);
    });

    it('rechaza un correo ya registrado con el mismo mensaje', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ]);

        $this->postJson('/api/v1/clientes/registro', datosRegistro(['num_documento' => '1099999999']))
            ->assertStatus(409)
            ->assertJson(['codigo' => 'cuenta_existente']);
    });

    it('rechaza a un menor de 18 años sin crear registros', function () {
        $this->postJson('/api/v1/clientes/registro', datosRegistro([
            'fecha_nacimiento' => now()->subYears(18)->addDay()->toDateString(),
        ]))->assertUnprocessable()->assertJsonValidationErrors(['fecha_nacimiento']);

        expect(RegistroPendiente::count())->toBe(0)->and(Usuario::count())->toBe(0);
    });

    it('acepta a quien cumple 18 años hoy', function () {
        $this->postJson('/api/v1/clientes/registro', datosRegistro([
            'fecha_nacimiento' => now()->subYears(18)->toDateString(),
        ]))->assertCreated();
    });

    it('exige aceptar la política de tratamiento', function () {
        $this->postJson('/api/v1/clientes/registro', datosRegistro(['acepta_politica' => false]))
            ->assertUnprocessable()->assertJsonValidationErrors(['acepta_politica']);
    });

    it('exige una contraseña de al menos 10 caracteres con mezcla de tipos (RNF-05)', function () {
        $this->postJson('/api/v1/clientes/registro', datosRegistro(['password' => 'corta1A!', 'password_confirmation' => 'corta1A!']))
            ->assertUnprocessable()->assertJsonValidationErrors(['password']);
    });
});

describe('CP0006 — consentimiento sin preselección (RN-05)', function () {
    it('expone las finalidades opcionales separadas de las necesarias', function () {
        $finalidades = collect($this->getJson('/api/v1/identidad/politica-vigente')->assertOk()->json('finalidades'));

        expect($finalidades->where('necesaria', true)->pluck('codigo')->all())
            ->toBe(['gestion_cliente', 'verificacion_identidad'])
            ->and($finalidades->where('necesaria', false))->toHaveCount(3);
    });

    it('sin selección del titular solo se otorgan las finalidades necesarias', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ]);

        expect(Consentimiento::orderBy('id')->pluck('finalidad_codigo')->all())->toBe(['gestion_cliente', 'verificacion_identidad']);
    });

    it('ignora códigos de finalidad que no son opcionales en la política', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro([
            'finalidades_opcionales' => ['inventada', 'gestion_cliente', 'encuestas_satisfaccion'],
        ]));
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => codigoCorreoEnviado(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ]);

        expect(Consentimiento::orderBy('id')->pluck('finalidad_codigo')->all())
            ->toBe(['gestion_cliente', 'verificacion_identidad', 'encuestas_satisfaccion']);
    });
});

describe('códigos de verificación (RF-01 FA-02)', function () {
    it('informa los intentos restantes ante un código incorrecto', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());

        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => '000000', 'codigo_telefono' => '000000',
        ])->assertUnprocessable()->assertJson(['codigo' => 'codigo_incorrecto', 'datos' => ['intentos_restantes' => 4]]);
    });

    it('anula el registro al agotar los intentos', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $url = "/api/v1/clientes/registro/{$inicio['registro_id']}/verificar";

        foreach (range(1, 4) as $_) {
            $this->postJson($url, ['codigo_email' => '000000', 'codigo_telefono' => '000000'])->assertUnprocessable();
        }
        $this->postJson($url, ['codigo_email' => '000000', 'codigo_telefono' => '000000'])
            ->assertJson(['codigo' => 'intentos_agotados']);

        expect(RegistroPendiente::count())->toBe(0);
    });

    it('no reenvía antes de 60 segundos y permite máximo 3 reenvíos por hora', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $url = "/api/v1/clientes/registro/{$inicio['registro_id']}/reenviar";

        $this->postJson($url)->assertStatus(429)->assertJson(['codigo' => 'reenvio_muy_pronto']);

        foreach (range(1, 3) as $_) {
            $this->travel(61)->seconds();
            $this->postJson($url)->assertOk();
        }

        $this->travel(61)->seconds();
        $this->postJson($url)->assertStatus(429)->assertJson(['codigo' => 'reenvios_agotados']);
    });

    it('invalida los códigos anteriores al reenviar', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', datosRegistro());
        $codigoViejo = $this->sms->ultimoCodigo();

        $this->travel(61)->seconds();
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/reenviar")->assertOk();

        if ($codigoViejo !== $this->sms->ultimoCodigo()) {
            $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
                'codigo_email' => '000000', 'codigo_telefono' => $codigoViejo,
            ])->assertJson(['codigo' => 'codigo_incorrecto']);
        }
        expect(Cliente::count())->toBe(0);
    });
});
