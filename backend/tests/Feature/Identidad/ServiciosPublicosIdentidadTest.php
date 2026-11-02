<?php

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Database\Seeders\CuentasDemoSeeder;
use App\Modules\Identidad\Mail\CodigoVerificacionMail;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\PerfilCliente;
use App\Modules\Identidad\Services\SegundoFactor;
use App\Modules\Identidad\Services\SesionActual;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Personas;
use Tests\Support\SmsFalso;

beforeEach(function () {
    Mail::fake();
});

describe('SesionActual: quién hace la petición (MR-002)', function () {
    it('expone al cliente de la sesión sin el modelo de Identidad', function () {
        $usuario = Personas::cliente(['nombres' => 'Laura Sofía', 'num_documento' => '1020456782', 'estado_kyc' => 'verificado']);
        $this->actingAs($usuario);

        $sesion = app(SesionActual::class);
        $dto = $sesion->usuario();

        expect($dto->id)->toBe($usuario->id)
            ->and($dto->rol)->toBe('cliente')
            ->and($dto->esInterno)->toBeFalse()
            ->and($dto->clienteId)->toBe($usuario->cliente->id)
            ->and($sesion->clienteId())->toBe($usuario->cliente->id)
            ->and($sesion->exigirClienteId())->toBe($usuario->cliente->id)
            ->and($dto->toArray())->toMatchArray([
                'nombre_corto' => 'Laura',
                'estado_kyc' => 'verificado',
                'documento_enmascarado' => '•••• 6782',
            ])
            ->and($dto->toArray())->not->toHaveKey('cargo');
    });

    it('exige sesión y rol: 401 sin sesión, 403 con otro rol', function () {
        $sesion = app(SesionActual::class);
        expect($sesion->usuario())->toBeNull()->and($sesion->id())->toBeNull()->and($sesion->clienteId())->toBeNull();

        expect(fn () => $sesion->exigir())->toThrow(fn (ErrorNegocio $e) => expect($e->estadoHttp)->toBe(401)->and($e->codigo)->toBe('sin_sesion'));

        $this->actingAs(Personas::interno(Rol::OFICIAL, empleado: ['atribucion_monto' => 30_000_000]));
        expect($sesion->exigir('oficial', 'analista')->atribucionMonto)->toBe(30_000_000)
            ->and($sesion->usuario()->esInterno)->toBeTrue();
        expect(fn () => $sesion->exigir('cliente'))->toThrow(fn (ErrorNegocio $e) => expect($e->estadoHttp)->toBe(403));
        expect(fn () => $sesion->exigirClienteId())->toThrow(fn (ErrorNegocio $e) => expect($e->codigo)->toBe('sin_permiso'));
    });
});

describe('PerfilCliente: datos del cliente para otros módulos', function () {
    it('dice si la identidad está verificada y bloquea la radicación si no (RN-07)', function () {
        $pendiente = Personas::cliente()->cliente;
        $verificado = Personas::cliente(['estado_kyc' => Cliente::KYC_VERIFICADO])->cliente;
        $perfil = app(PerfilCliente::class);

        expect($perfil->identidadVerificada($verificado->id))->toBeTrue()
            ->and($perfil->identidadVerificada($pendiente->id))->toBeFalse()
            ->and($perfil->identidadVerificada(999_999))->toBeFalse();

        $perfil->exigirIdentidadVerificada($verificado->id);
        expect(fn () => $perfil->exigirIdentidadVerificada($pendiente->id))
            ->toThrow(fn (ErrorNegocio $e) => expect($e->codigo)->toBe('identidad_no_verificada')->and($e->estadoHttp)->toBe(409));
    });

    it('entrega los datos conocidos ya enmascarados (RN-32, RNF-06)', function () {
        $usuario = Personas::cliente(['nombres' => 'Laura', 'apellidos' => 'Mejía Restrepo', 'num_documento' => '1020456782', 'telefono' => '3104567821']);
        $datos = app(PerfilCliente::class)->datosConocidos($usuario->cliente->id);

        expect($datos)->toMatchArray([
            'nombre_completo' => 'Laura Mejía Restrepo',
            'documento_enmascarado' => '•••• 6782',
            'telefono_enmascarado' => '•••• 7821',
            'email' => $usuario->email,
            'estado_kyc' => 'pendiente',
        ])
            ->and(json_encode($datos))->not->toContain('1020456782')->not->toContain('3104567821')
            ->and(app(PerfilCliente::class)->datosConocidos(999_999))->toBeNull()
            ->and(app(PerfilCliente::class)->usuarioId($usuario->cliente->id))->toBe($usuario->id);
    });

    it('lee el consentimiento vigente según el último movimiento (RN-19, RN-21)', function () {
        $cliente = Personas::cliente()->cliente;
        $perfil = app(PerfilCliente::class);
        $mover = fn (string $accion) => Consentimiento::create([
            'cliente_id' => $cliente->id, 'finalidad_codigo' => 'consulta_centrales', 'accion' => $accion,
            'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => now(),
        ]);

        expect($perfil->tieneConsentimiento($cliente->id, 'consulta_centrales'))->toBeFalse();
        $mover(Consentimiento::OTORGA);
        expect($perfil->tieneConsentimiento($cliente->id, 'consulta_centrales'))->toBeTrue();
        $mover(Consentimiento::REVOCA);
        expect($perfil->tieneConsentimiento($cliente->id, 'consulta_centrales'))->toBeFalse();
    });
});

describe('SegundoFactor para otros propósitos (RN-61)', function () {
    it('un código emitido para una oferta no sirve para otra ni para otro usuario', function () {
        $usuario = Personas::cliente();
        $mfa = app(SegundoFactor::class);

        $desafio = $mfa->emitirDesafio($usuario->id, 'aceptar_oferta', 'of-1');
        $codigo = Mail::sent(\App\Modules\Identidad\Mail\CodigoSegundoFactorMail::class)->last()->codigo;

        expect(fn () => $mfa->verificar($desafio['desafio_id'], $codigo, 'aceptar_oferta', $usuario->id, 'of-2'))
            ->toThrow(fn (ErrorNegocio $e) => expect($e->codigo)->toBe('codigo_vencido'));
        expect(fn () => $mfa->verificar($desafio['desafio_id'], $codigo, 'sesion'))
            ->toThrow(fn (ErrorNegocio $e) => expect($e->codigo)->toBe('codigo_vencido'));
        expect(fn () => $mfa->verificar($desafio['desafio_id'], $codigo, 'aceptar_oferta', $usuario->id + 1, 'of-1'))
            ->toThrow(ErrorNegocio::class);

        expect($mfa->verificar($desafio['desafio_id'], $codigo, 'aceptar_oferta', $usuario->id, 'of-1'))->toBe($usuario->id);
    });
});

it('la verificación del registro abre la sesión del cliente nuevo (RF-01 → RF-02)', function () {
    Http::fake();
    $sms = new SmsFalso;
    $this->app->instance(EnviadorSms::class, $sms);

    $inicio = $this->postJson('/api/v1/clientes/registro', [
        'tipo_documento' => 'CC', 'num_documento' => '1067123456', 'nombres' => 'María José', 'apellidos' => 'Pérez Díaz',
        'fecha_nacimiento' => now()->subYears(30)->toDateString(), 'email' => 'maria.perez@example.com',
        'telefono' => '3001234567', 'password' => 'Clave-Segura-2026', 'password_confirmation' => 'Clave-Segura-2026',
        'acepta_politica' => true, 'finalidades_opcionales' => [],
    ])->assertCreated();

    $verificado = $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
        'codigo_email' => Mail::sent(CodigoVerificacionMail::class)->last()->codigo,
        'codigo_telefono' => $sms->ultimoCodigo(),
    ])->assertCreated()
        ->assertJson(['estado_kyc' => 'pendiente', 'usuario' => ['rol' => 'cliente', 'documento_enmascarado' => '•••• 3456']]);

    $cookies = Personas::cookiesDeRespuesta($verificado);
    expect($cookies)->toHaveKeys(['ft_acceso', 'ft_renovacion']);

    Auth::forgetGuards();
    $this->call('GET', '/api/v1/identidad/sesion', [], $cookies, [], Personas::cabeceras())
        ->assertOk()
        ->assertJsonPath('usuario.email', 'maria.perez@example.com')
        ->assertJsonPath('usuario.nombre_corto', 'María');
});

it('siembra las cuentas de demostración de los seis roles con datos sintéticos', function () {
    $this->seed(CuentasDemoSeeder::class);
    $this->seed(CuentasDemoSeeder::class); // es idempotente

    expect(Usuario::where('email', 'like', '%@demo.finantech.co')->count())->toBe(8)
        ->and(Usuario::with('rol')->get()->pluck('rol.codigo')->unique()->sort()->values()->all())
        ->toBe(['administrador', 'analista', 'cliente', 'contabilidad', 'directivo', 'oficial']);

    $laura = Usuario::where('email', 'laura.mejia@demo.finantech.co')->sole();
    expect($laura->cliente->estado_kyc)->toBe('verificado')
        ->and(Hash::check(CuentasDemoSeeder::CONTRASENA, $laura->password))->toBeTrue()
        ->and(Consentimiento::where('cliente_id', $laura->cliente->id)->count())->toBe(3);
});
