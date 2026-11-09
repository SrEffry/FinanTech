<?php

/*
 * T33: el SMS simulado (MR-003) también llega a la bandeja de desarrollo (Mailpit), marcado
 * "[SMS SIMULADO] para •••• 1234", con el celular enmascarado (RNF-06, D-01). Y el registro
 * tiene su propio contador de límite de peticiones (RNF-07, D8).
 */

use App\Modules\Identidad\Adapters\SmsSimulado;
use App\Modules\Identidad\Mail\SmsSimuladoMail;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Tests\Support\DatosPrueba;

beforeEach(function () {
    Mail::fake();
    config(['finantech.sms_simulado.buzon' => 'sms-simulado@finantech.test']);
});

describe('T33 — SMS simulado visible en la bandeja de desarrollo', function () {
    it('deja una copia marcada como simulada, con el celular enmascarado y el código legible', function () {
        (new SmsSimulado)->enviar('3001234567', 'FinanTech: tu código de verificación es 123456.');

        Mail::assertSent(SmsSimuladoMail::class, function (SmsSimuladoMail $mail) {
            $html = $mail->render();
            expect($mail->hasTo('sms-simulado@finantech.test'))->toBeTrue()
                ->and($mail->envelope()->subject)->toBe('[SMS SIMULADO] para •••• 4567')
                ->and($html)->toContain('SMS SIMULADO')->toContain('123456')->toContain('•••• 4567')
                ->not->toContain('3001234567');

            return true;
        });
    });

    it('el log sigue con el celular enmascarado (D-01)', function () {
        $lineas = [];
        $this->app['events']->listen(MessageLogged::class, function (MessageLogged $e) use (&$lineas) {
            $lineas[] = $e->message;
        });

        (new SmsSimulado)->enviar('3001234567', 'código 654321');

        expect(implode("\n", $lineas))->toContain('[SMS SIMULADO] a •••• 4567: código 654321')
            ->not->toContain('3001234567');
    });

    it('no deja copia si no hay buzón configurado', function () {
        config(['finantech.sms_simulado.buzon' => null]);

        (new SmsSimulado)->enviar('3001234567', 'código 654321');

        Mail::assertNothingSent();
    });

    it('nunca deja copia en producción', function () {
        $this->app['env'] = 'production';

        (new SmsSimulado)->enviar('3001234567', 'código 654321');

        Mail::assertNothingSent();
    });

    it('en el registro, el código del celular llega a la bandeja junto con el del correo', function () {
        Http::fake();
        config(['finantech.registro.tiempo_minimo_respuesta_ms' => 0]);

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertCreated();

        Mail::assertSent(SmsSimuladoMail::class, fn (SmsSimuladoMail $mail) => $mail->celularEnmascarado === '•••• 4567'
            && preg_match('/\b\d{6}\b/', $mail->texto) === 1);
    });
});

describe('D8 — límite de peticiones del registro con contador propio (RNF-07)', function () {
    it('las rutas del registro usan su limitador con nombre, no el genérico por IP', function () {
        foreach (['clientes/registro', 'clientes/registro/{registro}/reenviar', 'clientes/registro/{registro}/verificar'] as $uri) {
            $ruta = collect(Route::getRoutes()->getRoutes())->first(fn ($r) => $r->uri() === "api/v1/{$uri}");

            expect($ruta->gatherMiddleware())->toContain('throttle:identidad-registro')
                ->not->toContain('throttle:10,1');
        }
    });

    it('agotar el límite del registro no bloquea el inicio de sesión desde la misma IP', function () {
        foreach (range(1, 11) as $_) {
            $this->postJson('/api/v1/clientes/registro', []);
        }
        $this->postJson('/api/v1/clientes/registro', [])->assertStatus(429);

        $this->postJson('/api/v1/identidad/sesiones', ['email' => 'nadie@example.com', 'password' => 'x'])
            ->assertStatus(401);
    });
});
