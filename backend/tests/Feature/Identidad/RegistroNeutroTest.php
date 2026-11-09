<?php

/*
 * P3 (decisión de las personas, 01/11) — RN-17 manda sobre RF-01 FA-01 (CP0005):
 * si el documento o el correo ya tienen cuenta, POST clientes/registro responde igual que
 * un registro nuevo, sin confirmar que la cuenta existe, y el titular recibe un aviso por
 * correo. El registro "señuelo" nunca se puede verificar.
 */

use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Mail\AvisoIntentoRegistroMail;
use App\Modules\Identidad\Mail\CodigoVerificacionMail;
use App\Modules\Identidad\Mail\RegistroNoDisponibleMail;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\RegistroPendiente;
use App\Modules\Identidad\Models\Usuario;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\Support\DatosPrueba;
use Tests\Support\SmsFalso;

beforeEach(function () {
    Mail::fake();
    Http::fake(); // contraste de contraseñas filtradas (RNF-05) sin salir a internet
    $this->sms = new SmsFalso;
    $this->app->instance(EnviadorSms::class, $this->sms);
    config(['finantech.registro.tiempo_minimo_respuesta_ms' => 0]);
});

/** Crea por la API la cuenta de María (documento 1067123456, maria.perez@example.com). */
function neutroCuentaExistente(\Tests\TestCase $prueba): Usuario
{
    $inicio = $prueba->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertCreated();
    $prueba->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
        'codigo_email' => DatosPrueba::codigoCorreo(),
        'codigo_telefono' => $prueba->sms->ultimoCodigo(),
    ])->assertCreated();

    return Usuario::sole();
}

describe('P3 / RN-17 / CP0005 — el registro no confirma que la cuenta existe', function () {
    it('responde con el mismo código y la misma forma para un registro nuevo, un documento repetido y un correo repetido', function () {
        neutroCuentaExistente($this);

        $nuevo = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'num_documento' => '1055555555', 'email' => 'nueva@example.com',
        ]));
        $porDocumento = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']));
        $porCorreo = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']));

        foreach ([$porDocumento, $porCorreo] as $respuesta) {
            expect($respuesta->status())->toBe($nuevo->status())->toBe(201)
                ->and(array_keys($respuesta->json()))->toBe(array_keys($nuevo->json()))
                ->and($respuesta->headers->get('Content-Type'))->toBe($nuevo->headers->get('Content-Type'));
            // Los tiempos que devuelve son los mismos que los de un registro nuevo.
            expect(now()->diffInMinutes($respuesta['codigos_expiran_en'], true))
                ->toEqualWithDelta(now()->diffInMinutes($nuevo['codigos_expiran_en'], true), 0.1);
        }

        expect(Usuario::count())->toBe(1);
    });

    it('el correo repetido no recibe un código: su titular recibe el aviso del intento', function () {
        $titular = neutroCuentaExistente($this);
        Mail::fake(); // solo interesa lo que envía el segundo intento

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']))->assertCreated();

        Mail::assertNotSent(CodigoVerificacionMail::class);
        Mail::assertNotSent(RegistroNoDisponibleMail::class);
        Mail::assertSent(AvisoIntentoRegistroMail::class, 1);
        Mail::assertSent(AvisoIntentoRegistroMail::class, fn ($mail) => $mail->hasTo($titular->email));
    });

    it('con un documento repetido y un correo nuevo, avisa al titular y al correo nuevo no le confirma la cuenta', function () {
        $titular = neutroCuentaExistente($this);
        Mail::fake();

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']))->assertCreated();

        Mail::assertNotSent(CodigoVerificacionMail::class);
        Mail::assertSent(AvisoIntentoRegistroMail::class, fn ($mail) => $mail->hasTo($titular->email));
        Mail::assertSent(RegistroNoDisponibleMail::class, fn ($mail) => $mail->hasTo('otra@example.com'));

        $texto = (new RegistroNoDisponibleMail('http://portal'))->render();
        expect($texto)->not->toContain('maria')->not->toContain('1067123456')->not->toContain('ya existe');
    });

    it('el aviso al titular no lleva los datos de quien lo intentó', function () {
        neutroCuentaExistente($this);
        Mail::fake();

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'email' => 'intruso@example.com', 'nombres' => 'Intruso', 'telefono' => '3119998877',
        ]))->assertCreated();

        Mail::assertSent(AvisoIntentoRegistroMail::class, function (AvisoIntentoRegistroMail $mail) {
            $html = $mail->render();
            expect($html)->not->toContain('intruso')->not->toContain('Intruso')->not->toContain('8877')
                ->toContain('/recuperar');

            return true;
        });
    });

    it('el celular escrito recibe su SMS como en un registro nuevo', function () {
        neutroCuentaExistente($this);
        $enviados = count($this->sms->enviados);

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'email' => 'otra@example.com', 'telefono' => '3119998877',
        ]))->assertCreated();

        expect($this->sms->enviados)->toHaveCount($enviados + 1)
            ->and(end($this->sms->enviados)['telefono'])->toBe('3119998877')
            ->and($this->sms->ultimoCodigo())->toMatch('/^\d{6}$/');
    });

    it('el registro señuelo nunca se verifica: responde como un código equivocado hasta agotar los intentos', function () {
        neutroCuentaExistente($this);
        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']));
        $url = "/api/v1/clientes/registro/{$inicio['registro_id']}/verificar";
        $codigoSms = $this->sms->ultimoCodigo();

        // Aunque alguien adivinara el código del correo, el señuelo no se puede verificar.
        $senuelo = RegistroPendiente::findOrFail($inicio['registro_id']);
        $senuelo->update(['codigo_email_hash' => bcrypt('111111')]);

        foreach (range(4, 1) as $restantes) {
            $this->postJson($url, ['codigo_email' => '111111', 'codigo_telefono' => $codigoSms])
                ->assertUnprocessable()
                ->assertJson(['codigo' => 'codigo_incorrecto', 'datos' => ['intentos_restantes' => $restantes]]);
        }
        $this->postJson($url, ['codigo_email' => '111111', 'codigo_telefono' => $codigoSms])
            ->assertUnprocessable()->assertJson(['codigo' => 'intentos_agotados']);

        expect(Usuario::count())->toBe(1)->and(Cliente::count())->toBe(1)
            ->and(RegistroPendiente::count())->toBe(0);
    });

    it('el reenvío del señuelo responde igual que el de un registro nuevo y solo manda el SMS', function () {
        neutroCuentaExistente($this);
        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']));
        Mail::fake();
        $enviados = count($this->sms->enviados);

        $this->travel(61)->seconds();
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/reenviar")
            ->assertOk()
            ->assertJsonStructure(['registro_id', 'codigos_expiran_en', 'reenvio_disponible_en']);

        Mail::assertNothingSent();
        expect($this->sms->enviados)->toHaveCount($enviados + 1);

        // Y respeta los mismos límites (RF-01 FA-02).
        $this->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/reenviar")
            ->assertStatus(429)->assertJson(['codigo' => 'reenvio_muy_pronto']);
    });

    it('el titular recibe como mucho 3 avisos por hora, aunque se intente más veces', function () {
        $titular = neutroCuentaExistente($this);
        Mail::fake();

        foreach (range(1, 5) as $i) {
            $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => "10999999{$i}0"]))
                ->assertCreated();
        }

        Mail::assertSent(AvisoIntentoRegistroMail::class, 3);
        expect(RegistroAuditoria::where('accion', 'cliente.registro_aviso_titular')->count())->toBe(5)
            ->and(RegistroAuditoria::where('accion', 'cliente.registro_aviso_titular')->pluck('id_entidad')->unique()->all())
            ->toBe([(string) $titular->id]);
    });

    it('la auditoría registra el intento sin datos personales (RNF-06)', function () {
        neutroCuentaExistente($this);

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']));

        $rechazo = RegistroAuditoria::where('accion', 'cliente.registro')->where('resultado', 'rechazo')->sole();
        expect(json_encode($rechazo->detalle))->not->toContain('1067123456')->not->toContain('otra@example.com')
            ->and($rechazo->detalle)->toBe(['motivo' => 'cuenta_existente']);
    });

    it('el señuelo no guarda los datos personales ni la contraseña de quien lo intentó', function () {
        neutroCuentaExistente($this);

        $inicio = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']));

        $datos = RegistroPendiente::findOrFail($inicio['registro_id'])->datos;
        expect($datos)->toHaveKey('senuelo', true)
            ->not->toHaveKey('password_hash')->not->toHaveKey('num_documento')->not->toHaveKey('nombres');
    });

    it('un registro nuevo y uno repetido tardan al menos el tiempo mínimo (RN-17)', function () {
        config(['finantech.registro.tiempo_minimo_respuesta_ms' => 300]);
        neutroCuentaExistente($this);

        $medir = function (array $cambios) {
            $inicio = microtime(true);
            $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro($cambios))->assertCreated();

            return microtime(true) - $inicio;
        };

        expect($medir(['num_documento' => '1055555555', 'email' => 'nueva@example.com']))->toBeGreaterThanOrEqual(0.3)
            ->and($medir(['email' => 'otra@example.com']))->toBeGreaterThanOrEqual(0.3)
            ->and($medir(['num_documento' => '1099999999']))->toBeGreaterThanOrEqual(0.3);
    });
});
