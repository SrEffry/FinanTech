<?php

use App\Modules\Identidad\Mail\CodigoSegundoFactorMail;
use App\Modules\Identidad\Models\IntentoAcceso;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Sesion;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\TokenAcceso;
use App\Modules\Identidad\Mail\RecuperacionContrasenaMail;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\Personas;

beforeEach(function () {
    Mail::fake();
    // RN-17: en las pruebas el tiempo mínimo es corto; la prueba de latencia lo sube.
    config(['finantech.sesion.tiempo_minimo_respuesta_ms' => 0]);

    // Rutas protegidas de prueba, para ver el RBAC sin depender de otros módulos.
    Route::middleware(['api', 'sesion'])->get('/api/v1/prueba/protegida', fn () => ['ok' => true]);
    Route::middleware(['api', 'rol:cliente'])->post('/api/v1/prueba/solo-cliente', fn () => ['ok' => true]);
    Route::middleware(['api', 'rol:analista,oficial'])->get('/api/v1/prueba/consola', fn () => ['ok' => true]);
});

/** Petición como la hace el portal, con las cookies indicadas y nada más. */
function idtPeticion(string $metodo, string $uri, array $cookies = [], array $cuerpo = [], bool $ajax = true): TestResponse
{
    // Los guards no se reinician entre peticiones de una misma prueba: se limpia a mano.
    Auth::forgetGuards();
    $servidor = $ajax ? Personas::cabeceras() : ['HTTP_ACCEPT' => 'application/json'];
    $servidor['CONTENT_TYPE'] = 'application/json';

    return test()->call($metodo, $uri, [], $cookies, [], $servidor, $cuerpo ? json_encode($cuerpo) : null);
}

function idtCodigoMfa(): string
{
    return Mail::sent(CodigoSegundoFactorMail::class)->last()->codigo;
}

/** Inicio de sesión completo (credenciales + segundo factor). Devuelve la respuesta del verificar. */
function idtIngresar(string $email, string $password = Personas::CLAVE): TestResponse
{
    $desafio = idtPeticion('POST', '/api/v1/identidad/sesiones', [], compact('email', 'password'))->assertOk();

    return idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio['desafio_id']}/verificar", [], ['codigo' => idtCodigoMfa()]);
}

function idtIntentar(string $email, string $password): TestResponse
{
    return idtPeticion('POST', '/api/v1/identidad/sesiones', [], compact('email', 'password'));
}

describe('CP0008 — inicio de sesión único con segundo factor (RF-03, RN-13, RN-14, RN-15)', function () {
    it('autentica con credenciales válidas y segundo factor, y emite las cookies httpOnly', function () {
        $this->freezeSecond();
        $cliente = Personas::cliente(['nombres' => 'Laura', 'apellidos' => 'Mejía', 'num_documento' => '1020456782']);

        $desafio = idtIntentar($cliente->email, Personas::CLAVE)
            ->assertOk()
            ->assertJsonStructure(['desafio_id', 'enviado_a', 'expira_en', 'reenvio_disponible_en'])
            ->assertJsonMissingPath('codigo_demo');
        expect($desafio['enviado_a'])->toBe(mb_substr($cliente->email, 0, 1).'•••@prueba.finantech.co');
        // Sin el segundo factor todavía no hay sesión.
        expect($desafio->headers->getCookies())->toBeEmpty();

        $respuesta = idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio['desafio_id']}/verificar", [], ['codigo' => idtCodigoMfa()])
            ->assertOk()
            ->assertJson(['usuario' => [
                'id' => $cliente->id,
                'rol' => 'cliente',
                'nombre_corto' => 'Laura',
                'estado_kyc' => 'pendiente',
                'documento_enmascarado' => '•••• 6782',
            ]]);

        $cookies = collect($respuesta->headers->getCookies())->keyBy(fn ($c) => $c->getName());
        $acceso = $cookies['ft_acceso'];
        $renovacion = $cookies['ft_renovacion'];

        // RN-13 y RN-14: vigencias; RI-08: httpOnly y rutas acotadas.
        expect($acceso->isHttpOnly())->toBeTrue()
            ->and($acceso->getPath())->toBe('/api')
            ->and($acceso->getSameSite())->toBe('lax')
            ->and($acceso->getExpiresTime())->toBe(now()->addMinutes(15)->getTimestamp())
            ->and($renovacion->isHttpOnly())->toBeTrue()
            ->and($renovacion->getPath())->toBe('/api/v1/identidad/sesion')
            ->and($renovacion->getSameSite())->toBe('strict')
            ->and($renovacion->getExpiresTime())->toBe(now()->addDays(7)->getTimestamp());

        // El token de acceso es un JWT firmado con vigencia de 15 minutos.
        $carga = app(TokenAcceso::class)->validar($acceso->getValue());
        expect($carga['exp'] - $carga['iat'])->toBe(15 * 60)->and($carga['sub'])->toBe((string) $cliente->id);

        // Ningún token viaja en el cuerpo.
        expect($respuesta->getContent())->not->toContain($acceso->getValue())->not->toContain($renovacion->getValue());

        // Solo se guarda la huella del token de renovación.
        expect(Sesion::sole()->renovacion_hash)->toBe(hash('sha256', $renovacion->getValue()));
        expect(RegistroAuditoria::where('accion', 'sesion.inicio')->where('resultado', 'exito')->count())->toBe(1);
    });

    it('exige el segundo factor a cada rol interno y lo lleva a su rol (RN-15)', function (string $rol) {
        $interno = Personas::interno($rol, empleado: ['cargo' => 'Cargo X', 'area' => 'Área Y', 'atribucion_monto' => 30_000_000]);

        $desafio = idtIntentar($interno->email, Personas::CLAVE)->assertOk();
        expect($desafio->headers->getCookies())->toBeEmpty()
            ->and($desafio->json())->toHaveKey('desafio_id');

        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio['desafio_id']}/verificar", [], ['codigo' => idtCodigoMfa()])
            ->assertOk()
            ->assertJson(['usuario' => ['rol' => $rol, 'cargo' => 'Cargo X', 'area' => 'Área Y', 'atribucion_monto' => 30_000_000]])
            ->assertJsonMissingPath('usuario.estado_kyc');
    })->with([Rol::ANALISTA, Rol::OFICIAL, Rol::CONTABILIDAD, Rol::DIRECTIVO, Rol::ADMINISTRADOR]);

    it('expone la sesión actual: usuario con acceso válido, null sin cookies', function () {
        $cliente = Personas::cliente();
        $cookies = Personas::cookiesDeRespuesta(idtIngresar($cliente->email)->assertOk());

        idtPeticion('GET', '/api/v1/identidad/sesion', $cookies)->assertOk()->assertJsonPath('usuario.id', $cliente->id);
        idtPeticion('GET', '/api/v1/identidad/sesion')->assertOk()->assertExactJson(['usuario' => null]);
    });

    it('el acceso vence a los 15 minutos y entonces pide renovar (RN-13)', function () {
        $cookies = Personas::cookiesDeRespuesta(idtIngresar(Personas::cliente()->email));

        $this->travel(14)->minutes();
        idtPeticion('GET', '/api/v1/prueba/protegida', $cookies)->assertOk();

        $this->travel(2)->minutes();
        idtPeticion('GET', '/api/v1/prueba/protegida', $cookies)->assertUnauthorized()->assertJson(['codigo' => 'sin_sesion']);
        // Con la cookie de renovación, GET identidad/sesion responde 401 para que el portal renueve.
        idtPeticion('GET', '/api/v1/identidad/sesion', $cookies)->assertUnauthorized()->assertJson(['codigo' => 'sin_sesion']);
        // Sin ella, no hay sesión.
        idtPeticion('GET', '/api/v1/identidad/sesion', ['ft_acceso' => $cookies['ft_acceso']])->assertExactJson(['usuario' => null]);
    });

    it('rota el token de renovación en cada uso e invalida el anterior (RN-14)', function () {
        $cliente = Personas::cliente();
        $primeras = Personas::cookiesDeRespuesta(idtIngresar($cliente->email));
        $this->travel(20)->minutes();

        $renovada = idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $primeras)
            ->assertOk()
            ->assertJsonPath('usuario.id', $cliente->id);
        $segundas = Personas::cookiesDeRespuesta($renovada);

        expect($segundas['ft_renovacion'])->not->toBe($primeras['ft_renovacion'])
            ->and($segundas['ft_acceso'])->not->toBe($primeras['ft_acceso']);
        idtPeticion('GET', '/api/v1/prueba/protegida', $segundas)->assertOk();

        // Pasada la ventana de gracia, reutilizar el token viejo se toma como robo y cierra la sesión.
        $this->travel(1)->minutes();
        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $primeras)->assertUnauthorized()->assertJson(['codigo' => 'sin_sesion']);

        idtPeticion('GET', '/api/v1/prueba/protegida', $segundas)->assertUnauthorized();
        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $segundas)->assertUnauthorized();
        expect(Sesion::sole()->motivo_cierre)->toBe('reuso_renovacion')
            ->and(RegistroAuditoria::where('accion', 'sesion.reuso_renovacion')->exists())->toBeTrue();
    });

    it('si dos pestañas renuevan a la vez, la segunda recibe un acceso nuevo sin cerrar la sesión', function () {
        $cookies = Personas::cookiesDeRespuesta(idtIngresar(Personas::cliente()->email));
        $this->travel(16)->minutes();

        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $cookies)->assertOk();
        $segunda = idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $cookies)->assertOk();

        $nuevas = Personas::cookiesDeRespuesta($segunda);
        expect($nuevas)->toHaveKey('ft_acceso')->not->toHaveKey('ft_renovacion');
        idtPeticion('GET', '/api/v1/prueba/protegida', $nuevas)->assertOk();
        expect(Sesion::sole()->cerrada_en)->toBeNull();
    });

    it('la renovación vence a los 7 días (RN-14)', function () {
        $cookies = Personas::cookiesDeRespuesta(idtIngresar(Personas::cliente()->email));

        $this->travel(7)->days();
        $this->travel(1)->minutes();
        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $cookies)->assertUnauthorized();
    });

    it('renovar sin cookie responde 401 y borra las cookies', function () {
        $respuesta = idtPeticion('POST', '/api/v1/identidad/sesion/renovar')->assertUnauthorized()->assertJson(['codigo' => 'sin_sesion']);

        expect(collect($respuesta->headers->getCookies())->every(fn ($c) => $c->isCleared()))->toBeTrue();
    });

    it('la consola interna vence tras 15 minutos de inactividad; el cliente no (RN-16)', function () {
        $analista = Personas::cookiesDeRespuesta(idtIngresar(Personas::interno(Rol::ANALISTA)->email));
        $cliente = Personas::cookiesDeRespuesta(idtIngresar(Personas::cliente()->email));

        $this->travel(16)->minutes();

        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $analista)->assertUnauthorized();
        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $cliente)->assertOk();
    });

    it('cierra la sesión en todos los canales y borra las cookies', function () {
        $cliente = Personas::cliente();
        $web = Personas::cookiesDeRespuesta(idtIngresar($cliente->email));
        $movil = Personas::cookiesDe($cliente);

        $cierre = idtPeticion('DELETE', '/api/v1/identidad/sesion', $web)->assertNoContent();
        expect(collect($cierre->headers->getCookies())->map->getName()->sort()->values()->all())->toBe(['ft_acceso', 'ft_renovacion'])
            ->and(collect($cierre->headers->getCookies())->every(fn ($c) => $c->isCleared()))->toBeTrue();

        // El acceso de 15 minutos ya emitido deja de servir al instante en el otro canal.
        idtPeticion('GET', '/api/v1/prueba/protegida', $movil)->assertUnauthorized();
        idtPeticion('POST', '/api/v1/identidad/sesion/renovar', $movil)->assertUnauthorized();
        expect(Sesion::whereNull('cerrada_en')->count())->toBe(0);
    });

    it('cerrar sesión sin sesión también responde 204', function () {
        idtPeticion('DELETE', '/api/v1/identidad/sesion')->assertNoContent();
    });

    it('rechaza un token de acceso alterado o firmado con otra clave', function () {
        $cliente = Personas::cliente();
        $cookies = Personas::cookiesDe($cliente);
        [$cabecera, $carga, $firma] = explode('.', $cookies['ft_acceso']);

        $datos = json_decode(base64_decode(strtr($carga, '-_', '+/')), true);
        $datos['rol'] = 'administrador';
        $alterada = rtrim(strtr(base64_encode(json_encode($datos)), '+/', '-_'), '=');

        idtPeticion('GET', '/api/v1/prueba/protegida', ['ft_acceso' => "{$cabecera}.{$alterada}.{$firma}"])->assertUnauthorized();
        idtPeticion('GET', '/api/v1/prueba/protegida', ['ft_acceso' => "{$cabecera}.{$carga}."])->assertUnauthorized();
        $sinFirma = rtrim(strtr(base64_encode('{"alg":"none","typ":"JWT"}'), '+/', '-_'), '=');
        idtPeticion('GET', '/api/v1/prueba/protegida', ['ft_acceso' => "{$sinFirma}.{$carga}."])->assertUnauthorized();

        config(['finantech.sesion.clave_firma' => 'otra-clave']);
        idtPeticion('GET', '/api/v1/prueba/protegida', $cookies)->assertUnauthorized();
    });

    it('un usuario desactivado pierde la sesión', function () {
        $cliente = Personas::cliente();
        $cookies = Personas::cookiesDe($cliente);
        $cliente->update(['estado' => Usuario::INACTIVO]);

        idtPeticion('GET', '/api/v1/prueba/protegida', $cookies)->assertUnauthorized();
    });
});

describe('CP0009 — bloqueo por intentos y mensaje que no revela la cuenta (RN-12, RN-17)', function () {
    it('responde lo mismo para un correo existente y uno inexistente', function () {
        $cliente = Personas::cliente();

        $existente = idtIntentar($cliente->email, 'Equivocada-123')->assertUnauthorized();
        $inexistente = idtIntentar('nadie@prueba.finantech.co', 'Equivocada-123')->assertUnauthorized();

        expect($existente->getContent())->toBe($inexistente->getContent())
            ->and($existente->json())->toBe([
                'codigo' => 'credenciales_invalidas',
                'mensaje' => 'El correo o la contraseña no son correctos.',
            ]);
    });

    it('tarda lo mismo exista o no el correo (sin canal lateral por latencia)', function () {
        config(['finantech.sesion.tiempo_minimo_respuesta_ms' => 150]);
        $cliente = Personas::cliente();

        $medir = function (string $email) {
            $inicio = hrtime(true);
            idtIntentar($email, 'Equivocada-123');

            return (hrtime(true) - $inicio) / 1e6;
        };

        $existente = collect(range(1, 3))->map(fn () => $medir($cliente->email))->avg();
        IntentoAcceso::query()->delete();
        $inexistente = collect(range(1, 3))->map(fn () => $medir('nadie@prueba.finantech.co'))->avg();

        expect($existente)->toBeGreaterThanOrEqual(150)
            ->and($inexistente)->toBeGreaterThanOrEqual(150)
            ->and(abs($existente - $inexistente))->toBeLessThan(60);
    });

    it('bloquea 30 minutos al quinto intento fallido, aun con la contraseña correcta', function () {
        $cliente = Personas::cliente();

        foreach (range(1, 4) as $intento) {
            idtIntentar($cliente->email, 'Equivocada-123')->assertUnauthorized();
        }
        idtIntentar($cliente->email, 'Equivocada-123')
            ->assertStatus(423)
            ->assertJson(['codigo' => 'cuenta_bloqueada'])
            ->assertJsonPath('mensaje', fn ($m) => str_contains($m, '30 minutos') && str_contains($m, 'recuperar'));

        idtIntentar($cliente->email, Personas::CLAVE)->assertStatus(423);

        $this->travel(29)->minutes();
        idtIntentar($cliente->email, Personas::CLAVE)->assertStatus(423);

        $this->travel(2)->minutes();
        idtIntentar($cliente->email, Personas::CLAVE)->assertOk()->assertJsonStructure(['desafio_id']);
    });

    it('el contador también corre para correos que no existen, con la misma respuesta', function () {
        $cliente = Personas::cliente();

        foreach (range(1, 5) as $intento) {
            $existente = idtIntentar($cliente->email, 'Equivocada-123');
            $inexistente = idtIntentar('nadie@prueba.finantech.co', 'Equivocada-123');
            expect($existente->status())->toBe($inexistente->status())
                ->and($existente->getContent())->toBe($inexistente->getContent());
        }

        expect($inexistente->status())->toBe(423);
        // No se guarda el correo en claro.
        expect(IntentoAcceso::pluck('identificador_hash')->implode(''))->not->toContain('nadie');
    });

    it('deja en la auditoría cada intento fallido y el bloqueo, con su origen', function () {
        $cliente = Personas::cliente();
        foreach (range(1, 5) as $intento) {
            idtIntentar($cliente->email, 'Equivocada-123');
        }

        $fallidos = RegistroAuditoria::where('accion', 'sesion.inicio')->where('resultado', 'rechazo')->get();
        expect($fallidos)->toHaveCount(5)
            ->and($fallidos->last()->detalle)->toBe(['motivo' => 'bloqueo_por_intentos'])
            ->and($fallidos->every(fn ($r) => $r->usuario_id === $cliente->id && $r->origen_ip !== null))->toBeTrue()
            // Nada sensible en la bitácora: ni el correo ni la contraseña probada.
            ->and($fallidos->pluck('detalle')->toJson())->not->toContain('Equivocada')->not->toContain($cliente->email);
    });

    it('un ingreso exitoso reinicia el contador', function () {
        $cliente = Personas::cliente();
        foreach (range(1, 4) as $intento) {
            idtIntentar($cliente->email, 'Equivocada-123');
        }
        idtIntentar($cliente->email, Personas::CLAVE)->assertOk();

        idtIntentar($cliente->email, 'Equivocada-123')->assertUnauthorized();
    });

    it('una cuenta inactiva recibe el mismo mensaje genérico', function () {
        $cliente = Personas::cliente(usuario: ['estado' => Usuario::BLOQUEADO]);

        idtIntentar($cliente->email, Personas::CLAVE)->assertUnauthorized()->assertJson(['codigo' => 'credenciales_invalidas']);
    });
});

describe('segundo factor del inicio de sesión (RN-15)', function () {
    it('informa los intentos restantes y anula el desafío al quinto error', function () {
        $cliente = Personas::cliente();
        $desafio = idtIntentar($cliente->email, Personas::CLAVE)['desafio_id'];
        $codigo = idtCodigoMfa();
        $incorrecto = $codigo === '000000' ? '111111' : '000000';

        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $incorrecto])
            ->assertUnprocessable()
            ->assertJson(['codigo' => 'codigo_incorrecto', 'datos' => ['intentos_restantes' => 4]]);
        foreach (range(1, 3) as $intento) {
            idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $incorrecto]);
        }
        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $incorrecto])
            ->assertUnprocessable()->assertJson(['codigo' => 'intentos_agotados']);

        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $codigo])
            ->assertUnprocessable()->assertJson(['codigo' => 'codigo_vencido']);
        expect(Sesion::count())->toBe(0);
    });

    it('el código vence a los 5 minutos y es de un solo uso', function () {
        $cliente = Personas::cliente();
        $desafio = idtIntentar($cliente->email, Personas::CLAVE)['desafio_id'];
        $codigo = idtCodigoMfa();

        $this->travel(6)->minutes();
        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $codigo])
            ->assertUnprocessable()->assertJson(['codigo' => 'codigo_vencido']);

        $desafio = idtIntentar($cliente->email, Personas::CLAVE)['desafio_id'];
        $codigo = idtCodigoMfa();
        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $codigo])->assertOk();
        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $codigo])
            ->assertUnprocessable()->assertJson(['codigo' => 'codigo_vencido']);
    });

    it('reenvía el código después de 60 segundos e invalida el anterior', function () {
        $cliente = Personas::cliente();
        $desafio = idtIntentar($cliente->email, Personas::CLAVE)['desafio_id'];
        $anterior = idtCodigoMfa();

        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/reenviar")
            ->assertStatus(429)->assertJson(['codigo' => 'reenvio_muy_pronto']);

        $this->travel(61)->seconds();
        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/reenviar")
            ->assertOk()->assertJsonPath('desafio_id', $desafio);
        $nuevo = idtCodigoMfa();

        if ($nuevo !== $anterior) {
            idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $anterior])
                ->assertJson(['codigo' => 'codigo_incorrecto']);
        }
        idtPeticion('POST', "/api/v1/identidad/sesiones/{$desafio}/verificar", [], ['codigo' => $nuevo])->assertOk();
    });

    it('un desafío inexistente o mal formado se trata como vencido', function () {
        idtPeticion('POST', '/api/v1/identidad/sesiones/no-es-un-uuid/verificar', [], ['codigo' => '123456'])
            ->assertUnprocessable()->assertJson(['codigo' => 'codigo_vencido']);
        idtPeticion('POST', '/api/v1/identidad/sesiones/'.Str::uuid().'/reenviar')
            ->assertStatus(410)->assertJson(['codigo' => 'codigo_vencido']);
    });
});

describe('RBAC en el servidor (RNF-05)', function () {
    it('responde 401 sin sesión en rutas con `sesion` y con `rol`', function () {
        idtPeticion('GET', '/api/v1/prueba/protegida')
            ->assertUnauthorized()
            ->assertExactJson(['codigo' => 'sin_sesion', 'mensaje' => 'Tu sesión terminó. Vuelve a ingresar para continuar.']);
        idtPeticion('POST', '/api/v1/prueba/solo-cliente')->assertUnauthorized();
        idtPeticion('GET', '/api/v1/prueba/consola')->assertUnauthorized();
    });

    it('responde 403 con otro rol y deja pasar al rol correcto', function () {
        $cliente = Personas::cookiesDe(Personas::cliente());
        $oficial = Personas::cookiesDe(Personas::interno(Rol::OFICIAL));
        $admin = Personas::cookiesDe(Personas::interno(Rol::ADMINISTRADOR));

        idtPeticion('POST', '/api/v1/prueba/solo-cliente', $cliente)->assertOk();
        idtPeticion('POST', '/api/v1/prueba/solo-cliente', $oficial)->assertForbidden()->assertJson(['codigo' => 'sin_permiso']);
        idtPeticion('GET', '/api/v1/prueba/consola', $oficial)->assertOk();
        idtPeticion('GET', '/api/v1/prueba/consola', $cliente)->assertForbidden();
        idtPeticion('GET', '/api/v1/prueba/consola', $admin)->assertForbidden();
    });

    it('no autentica peticiones que modifican datos sin la cabecera del portal (CSRF)', function () {
        $cliente = Personas::cookiesDe(Personas::cliente());

        idtPeticion('POST', '/api/v1/prueba/solo-cliente', $cliente, ajax: false)->assertUnauthorized();
        idtPeticion('GET', '/api/v1/prueba/protegida', $cliente, ajax: false)->assertOk();
    });
});

describe('recuperación de contraseña (RF-03 FA-04, RN-17)', function () {
    it('responde siempre 202 con el mismo mensaje y solo envía correo si la cuenta existe', function () {
        $cliente = Personas::cliente();

        $existente = idtPeticion('POST', '/api/v1/identidad/recuperacion', [], ['email' => $cliente->email])->assertStatus(202);
        $inexistente = idtPeticion('POST', '/api/v1/identidad/recuperacion', [], ['email' => 'nadie@prueba.finantech.co'])->assertStatus(202);

        expect($existente->getContent())->toBe($inexistente->getContent());
        Mail::assertSent(\App\Modules\Identidad\Mail\RecuperacionContrasenaMail::class, 1);
        Mail::assertSent(\App\Modules\Identidad\Mail\RecuperacionContrasenaMail::class, fn ($m) => $m->hasTo($cliente->email));
    });

    it('cambia la contraseña con el enlace, cierra las sesiones y levanta el bloqueo', function () {
        $cliente = Personas::cliente();
        $cookies = Personas::cookiesDe($cliente);
        foreach (range(1, 5) as $intento) {
            idtIntentar($cliente->email, 'Equivocada-123');
        }

        idtPeticion('POST', '/api/v1/identidad/recuperacion', [], ['email' => $cliente->email]);
        $enlace = Mail::sent(\App\Modules\Identidad\Mail\RecuperacionContrasenaMail::class)->last()->enlace;
        parse_str(parse_url($enlace, PHP_URL_QUERY), $parametros);

        idtPeticion('POST', '/api/v1/identidad/recuperacion/confirmar', [], [
            'email' => $cliente->email,
            'token' => 'token-falso',
            'password' => 'Nueva-Clave-2026',
            'password_confirmation' => 'Nueva-Clave-2026',
        ])->assertUnprocessable()->assertJson(['codigo' => 'enlace_invalido']);

        Http::fake(); // contraste de contraseñas filtradas sin salir a internet
        idtPeticion('POST', '/api/v1/identidad/recuperacion/confirmar', [], [
            'email' => $parametros['email'],
            'token' => $parametros['token'],
            'password' => 'Nueva-Clave-2026',
            'password_confirmation' => 'Nueva-Clave-2026',
        ])->assertOk();

        idtPeticion('GET', '/api/v1/prueba/protegida', $cookies)->assertUnauthorized();
        idtIntentar($cliente->email, 'Nueva-Clave-2026')->assertOk();

        // El enlace es de un solo uso.
        idtPeticion('POST', '/api/v1/identidad/recuperacion/confirmar', [], [
            'email' => $parametros['email'],
            'token' => $parametros['token'],
            'password' => 'Otra-Clave-2026!',
            'password_confirmation' => 'Otra-Clave-2026!',
        ])->assertUnprocessable();
    });

    it('el enlace vence a los 60 minutos', function () {
        $cliente = Personas::cliente();
        idtPeticion('POST', '/api/v1/identidad/recuperacion', [], ['email' => $cliente->email]);
        parse_str(parse_url(Mail::sent(\App\Modules\Identidad\Mail\RecuperacionContrasenaMail::class)->last()->enlace, PHP_URL_QUERY), $parametros);

        $this->travel(61)->minutes();
        Http::fake();
        idtPeticion('POST', '/api/v1/identidad/recuperacion/confirmar', [], [
            ...$parametros,
            'password' => 'Nueva-Clave-2026',
            'password_confirmation' => 'Nueva-Clave-2026',
        ])->assertUnprocessable()->assertJson(['codigo' => 'enlace_invalido']);
    });
});

it('informa el modo de los servicios externos (MR-003)', function () {
    idtPeticion('GET', '/api/v1/sistema/estado')->assertOk()->assertExactJson(['servicios_externos' => 'simulado']);

    config(['finantech.servicios_externos' => 'real']);
    idtPeticion('GET', '/api/v1/sistema/estado')->assertExactJson(['servicios_externos' => 'real']);
});
