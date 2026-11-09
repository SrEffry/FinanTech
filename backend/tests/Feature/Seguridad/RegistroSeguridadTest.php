<?php

/*
 * Pruebas de seguridad y regresión del registro de clientes (RF-01), a cargo de QA.
 * Complementan RegistroClienteTest sin repetirlo: enumeración (CP0005, RN-17),
 * cifrado en reposo y nada sensible en los logs (RNF-06), limitación de tasa y
 * entradas maliciosas (RNF-07), contraseñas filtradas (RNF-05) y flujos de RF-01
 * que no tenían prueba (códigos y registros vencidos, carrera por el documento).
 */

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\RegistroPendiente;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Support\DatosPrueba;
use Tests\Support\SmsFalso;

beforeEach(function () {
    Mail::fake();
    // Contraste de contraseñas filtradas (RNF-05) sin salir a internet. Cada prueba
    // puede fijar $this->respuestaPwned para simular una contraseña comprometida.
    $this->respuestaPwned = '';
    Http::preventStrayRequests();
    Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response($this->respuestaPwned)]);

    $this->logs = [];
    $this->app['events']->listen(MessageLogged::class, function (MessageLogged $e) {
        $this->logs[] = $e;
    });
});

/** Registro completo con el SMS falso; devuelve el cliente creado. */
function qaRegistrarCliente(\Tests\TestCase $prueba, array $cambios = []): Cliente
{
    $sms = new SmsFalso;
    app()->instance(EnviadorSms::class, $sms);

    $inicio = $prueba->postJson('/api/v1/clientes/registro', DatosPrueba::registro($cambios))->assertCreated();
    $prueba->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
        'codigo_email' => DatosPrueba::codigoCorreo(),
        'codigo_telefono' => $sms->ultimoCodigo(),
    ])->assertCreated();

    return Cliente::latest('id')->first();
}

/** Registro con el adaptador SMS simulado real (escribe en el log), un intento fallido y la verificación. */
function qaFlujoConLog(\Tests\TestCase $prueba): string
{
    $inicio = $prueba->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertCreated();
    $url = "/api/v1/clientes/registro/{$inicio['registro_id']}/verificar";

    $prueba->postJson($url, ['codigo_email' => '000000', 'codigo_telefono' => '000000'])->assertUnprocessable();

    preg_match('/es (\d{6})\./', DatosPrueba::textoDelLog($prueba->logs), $m);
    $prueba->postJson($url, ['codigo_email' => DatosPrueba::codigoCorreo(), 'codigo_telefono' => $m[1] ?? ''])
        ->assertCreated();

    return DatosPrueba::textoDelLog($prueba->logs);
}

describe('CP0005 / RN-17 — el registro no permite distinguir qué dato ya existe', function () {
    it('responde exactamente lo mismo si el duplicado es el documento o el correo', function () {
        qaRegistrarCliente($this);

        $porDocumento = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']));
        $porCorreo = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']));

        // P3 (01/11): la respuesta es la de un registro nuevo (201); solo cambian el id y las horas.
        expect($porDocumento->status())->toBe(201)
            ->and($porCorreo->status())->toBe($porDocumento->status())
            ->and(array_keys($porCorreo->json()))->toBe(array_keys($porDocumento->json()));
    });

    it('compara el correo sin distinguir mayúsculas (RN-02)', function () {
        qaRegistrarCliente($this);

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'num_documento' => '1099999999', 'email' => 'MARIA.Perez@Example.COM',
        ]))->assertCreated(); // P3: neutro

        expect(Usuario::count())->toBe(1);
        Mail::assertSent(\App\Modules\Identidad\Mail\AvisoIntentoRegistroMail::class, fn ($m) => $m->hasTo('maria.perez@example.com'));
    });

    it('normaliza el documento antes de comparar (RN-01)', function () {
        qaRegistrarCliente($this, ['tipo_documento' => 'PA', 'num_documento' => 'AB12345']);

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'tipo_documento' => 'PA', 'num_documento' => 'ab12345', 'email' => 'otra@example.com',
        ]))->assertCreated(); // P3: neutro; el titular recibe el aviso

        Mail::assertSent(\App\Modules\Identidad\Mail\AvisoIntentoRegistroMail::class);

        expect(Cliente::count())->toBe(1);
    });

    it('el rechazo no expone datos personales ni en la respuesta ni en la auditoría', function () {
        qaRegistrarCliente($this);

        $respuesta = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']))
            ->assertCreated(); // P3: neutro

        $rechazo = RegistroAuditoria::where('resultado', 'rechazo')->sole();
        $texto = $respuesta->getContent().json_encode($rechazo->detalle);

        expect($texto)->not->toContain('1067123456')->not->toContain('maria.perez')->not->toContain('otra@example.com')
            ->not->toContain('María')->not->toContain('3001234567')
            ->and($rechazo->origen_ip)->not->toBeNull();
    });
});

describe('RNF-06 — datos sensibles cifrados en reposo', function () {
    it('el registro pendiente guarda cifrados los datos personales y solo la huella de los códigos', function () {
        $sms = new SmsFalso;
        $this->app->instance(EnviadorSms::class, $sms);
        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertCreated();

        $fila = DB::table('identidad_registros_pendientes')->sole();
        foreach (['1067123456', 'María', 'Pérez', '3001234567', DatosPrueba::PASSWORD, now()->subYears(30)->toDateString()] as $dato) {
            expect($fila->datos)->not->toContain($dato);
        }

        expect($fila->codigo_email_hash)->not->toBe(DatosPrueba::codigoCorreo())
            ->and(Hash::check(DatosPrueba::codigoCorreo(), $fila->codigo_email_hash))->toBeTrue()
            ->and($fila->codigo_telefono_hash)->not->toContain($sms->ultimoCodigo());
    });

    it('el índice ciego del documento no es un hash sin clave que se pueda recorrer por diccionario', function () {
        qaRegistrarCliente($this);

        $huella = DB::table('identidad_clientes')->value('num_documento_hash');

        expect($huella)->not->toBe(hash('sha256', '1067123456'))
            ->and($huella)->not->toBe(hash('sha256', 'documento:1067123456'))
            ->and($huella)->not->toContain('1067123456');
    });

    it('ninguna respuesta del registro devuelve el documento, el celular ni la contraseña', function () {
        $sms = new SmsFalso;
        $this->app->instance(EnviadorSms::class, $sms);

        $respuestas = [];
        $respuestas[] = $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro());
        $this->travel(61)->seconds();
        $respuestas[] = $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/reenviar");
        $respuestas[] = $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => DatosPrueba::codigoCorreo(), 'codigo_telefono' => $sms->ultimoCodigo(),
        ]);

        foreach ($respuestas as $respuesta) {
            expect($respuesta->getContent())->not->toContain('1067123456')->not->toContain('3001234567')
                ->not->toContain(DatosPrueba::PASSWORD)->not->toContain('password');
        }
    });
});

describe('RNF-06 — nada sensible en los registros de la aplicación', function () {
    it('el flujo completo no escribe documento, contraseña ni fecha de nacimiento en el log', function () {
        $log = qaFlujoConLog($this);

        expect($log)->not->toContain('1067123456')
            ->not->toContain(DatosPrueba::PASSWORD)
            ->not->toContain(now()->subYears(30)->toDateString());
    });

    it('el SMS simulado no deja el celular completo en el log', function () {
        $log = qaFlujoConLog($this);

        expect($log)->toContain('[SMS SIMULADO]') // el código sí debe quedar: así se lee en desarrollo
            ->not->toContain('3001234567');
    })->group('defectos'); // regresión de D-01 (corregido el 01/11; ver docs/qa/trazabilidad.md)

    it('un error de negocio no se registra como error de la aplicación con su traza', function () {
        qaFlujoConLog($this); // incluye un código incorrecto: ErrorNegocio 'codigo_incorrecto'

        $reportados = collect($this->logs)->filter(fn (MessageLogged $e) => ($e->context['exception'] ?? null) instanceof ErrorNegocio);

        expect($reportados)->toBeEmpty();
    })->group('defectos'); // regresión de D-02 (corregido el 01/11; ver docs/qa/trazabilidad.md)

    it('las trazas de excepción no incluyen los argumentos de las funciones (contraseñas, códigos)', function () {
        // Con zend.exception_ignore_args=Off, cualquier excepción que pase por un método que
        // reciba la contraseña (por ejemplo, el inicio de sesión) la deja escrita en el log.
        expect(ini_get('zend.exception_ignore_args'))->toBe('1');
    })->group('defectos'); // regresión de D-02 (corregido el 01/11; ver docs/qa/trazabilidad.md)
});

describe('RNF-07 — limitación de tasa contra fuerza bruta', function () {
    it('admite 10 peticiones por minuto al registro y rechaza la siguiente con 429', function () {
        foreach (range(1, 10) as $_) {
            $this->postJson('/api/v1/clientes/registro', [])->assertUnprocessable();
        }

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertStatus(429);
        expect(RegistroPendiente::count())->toBe(0);

        $this->travel(61)->seconds();
        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertCreated();
    });

    it('el límite cubre también la verificación de códigos', function () {
        $url = '/api/v1/clientes/registro/'.Str::uuid().'/verificar';
        foreach (range(1, 10) as $_) {
            $this->postJson($url, ['codigo_email' => '000000', 'codigo_telefono' => '000000']);
        }

        $this->postJson($url, ['codigo_email' => '000000', 'codigo_telefono' => '000000'])->assertStatus(429);
    });
});

describe('RNF-05 y RNF-07 — validación de entradas en el servidor', function () {
    it('rechaza una contraseña que aparece en filtraciones conocidas', function () {
        $hash = strtoupper(sha1(DatosPrueba::PASSWORD));
        $this->respuestaPwned = substr($hash, 5).':1532';

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro())
            ->assertUnprocessable()->assertJsonValidationErrors(['password']);

        expect(RegistroPendiente::count())->toBe(0);
    });

    it('rechaza entradas con inyección o marcado sin error de servidor', function (string $campo, string $valor) {
        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([$campo => $valor]))
            ->assertUnprocessable()->assertJsonValidationErrors([$campo]);

        expect(RegistroPendiente::count())->toBe(0);
    })->with([
        'SQL en el documento' => ['num_documento', "1' OR '1'='1"],
        'SQL en el correo' => ['email', "a@b.co' --"],
        'script en el nombre' => ['nombres', '<script>alert(1)</script>'],
        'script en los apellidos' => ['apellidos', '"><img src=x onerror=alert(1)>'],
        'teléfono con texto' => ['telefono', '300123456; DROP'],
        'tipo de documento inventado' => ['tipo_documento', 'XX'],
    ]);

    it('ignora campos que el cliente no debe controlar (asignación masiva)', function () {
        $sms = new SmsFalso;
        $this->app->instance(EnviadorSms::class, $sms);

        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'estado_kyc' => 'verificado', 'rol_id' => 99, 'rol' => 'administrador', 'mfa_activo' => false,
            'estado' => 'activo', 'usuario_id' => 1,
        ]))->assertCreated();
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => DatosPrueba::codigoCorreo(), 'codigo_telefono' => $sms->ultimoCodigo(),
            'estado_kyc' => 'verificado',
        ])->assertCreated()->assertJson(['estado_kyc' => 'pendiente']);

        $cliente = Cliente::sole();
        expect($cliente->estado_kyc)->toBe(Cliente::KYC_PENDIENTE) // RN-07: nadie se salta la verificación
            ->and($cliente->usuario->rol->codigo)->toBe(Rol::CLIENTE)
            ->and($cliente->usuario->mfa_activo)->toBeTrue();
    });
});

describe('RF-01 — flujos sin prueba hasta ahora', function () {
    beforeEach(function () {
        $this->sms = new SmsFalso;
        $this->app->instance(EnviadorSms::class, $this->sms);
    });

    it('rechaza códigos vencidos a los 10 minutos sin crear el cliente', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro());

        $this->travel(11)->minutes();
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => DatosPrueba::codigoCorreo(), 'codigo_telefono' => $this->sms->ultimoCodigo(),
        ])->assertUnprocessable()->assertJson(['codigo' => 'codigos_vencidos']);

        expect(Cliente::count())->toBe(0);
    });

    it('anula el registro pendiente a los 30 minutos', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro());

        $this->travel(31)->minutes();
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/reenviar")
            ->assertStatus(410)->assertJson(['codigo' => 'registro_vencido']);

        expect(RegistroPendiente::count())->toBe(0);
    });

    it('un registro inexistente responde 404 sin nombres internos de la aplicación', function () {
        config(['app.debug' => false]);

        $respuesta = $this->postJson('/api/v1/clientes/registro/'.Str::uuid().'/verificar', [
            'codigo_email' => '123456', 'codigo_telefono' => '123456',
        ])->assertNotFound();

        expect($respuesta->getContent())->not->toContain('App\\\\')->not->toContain('RegistroPendiente');
    })->group('defectos'); // regresión de D-03 (corregido el 01/11; ver docs/qa/trazabilidad.md)

    it('si otra cuenta tomó el documento mientras se verificaba, no crea un duplicado', function () {
        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro());
        $codigoCorreo = DatosPrueba::codigoCorreo();
        $codigoSms = $this->sms->ultimoCodigo();

        // Otra vía (por ejemplo, un cliente migrado, RF-01 FA-03) crea el mismo documento.
        $otro = DatosPrueba::usuario(Rol::CLIENTE);
        $otro->cliente->update(['num_documento' => '1067123456']);

        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
            'codigo_email' => $codigoCorreo, 'codigo_telefono' => $codigoSms,
        ])->assertStatus(409)->assertJson(['codigo' => 'cuenta_existente']);

        expect(Cliente::count())->toBe(1)->and(RegistroPendiente::count())->toBe(0);
    })->group('defectos'); // regresión de D-04 (corregido el 01/11; ver docs/qa/trazabilidad.md)

    it('un nuevo inicio con el mismo correo reemplaza al registro pendiente anterior', function () {
        $primero = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro());
        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']))->assertCreated();

        expect(RegistroPendiente::count())->toBe(1);
        $this->postJson("/api/v1/clientes/registro/{$primero['registro_id']}/reenviar")->assertNotFound();
    });
});
