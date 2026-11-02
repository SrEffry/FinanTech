<?php

/*
 * Pruebas de seguridad del inicio de sesión (RF-03) a cargo de QA. Solo cubren lo
 * que no cubre tests/Feature/Identidad/SesionTest.php (backend-senior), que ya
 * automatiza CP0008 y CP0009: nada sensible en los logs (RNF-06) y límite de
 * peticiones por origen contra fuerza bruta distribuida (RNF-07).
 */

use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\Support\DatosPrueba;
use Tests\Support\Personas;

beforeEach(function () {
    Mail::fake();
    config(['finantech.sesion.tiempo_minimo_respuesta_ms' => 0]);

    $this->logs = [];
    $this->app['events']->listen(MessageLogged::class, function (MessageLogged $e) {
        $this->logs[] = $e;
    });
});

function qaIntentarIngreso(string $email, string $password): TestResponse
{
    return test()->call('POST', '/api/v1/identidad/sesiones', [], [], [],
        Personas::cabeceras() + ['CONTENT_TYPE' => 'application/json'], json_encode(compact('email', 'password')));
}

it('la contraseña probada no queda en el log de la aplicación (RNF-06)', function () {
    $cliente = Personas::cliente();

    qaIntentarIngreso($cliente->email, 'Equivocada-QA-9')->assertUnauthorized();
    qaIntentarIngreso('nadie@prueba.finantech.co', 'Equivocada-QA-9')->assertUnauthorized();

    $log = DatosPrueba::textoDelLog($this->logs);
    expect($log)->not->toContain('Equivocada-QA')
        ->not->toContain($cliente->email)
        ->not->toContain('nadie@prueba.finantech.co');
})->group('defectos'); // regresión de D-02 (corregido el 01/11; ver docs/qa/trazabilidad.md)

it('limita las peticiones de inicio de sesión por origen, aunque cada intento use otro correo (RNF-07)', function () {
    foreach (range(1, 30) as $i) {
        qaIntentarIngreso("persona{$i}@prueba.finantech.co", 'Equivocada-123')->assertUnauthorized();
    }

    qaIntentarIngreso('persona31@prueba.finantech.co', 'Equivocada-123')->assertStatus(429);
});
