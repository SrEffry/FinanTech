<?php

/*
 * T32 (qa-senior) — P3 / RN-17 / CP0005: el registro duplicado responde neutro (T30).
 * Complementa RegistroNeutroTest (backend-senior) sin repetirlo: aquí se verifica que ningún
 * canal secundario delate la cuenta existente: el log, las cabeceras y el cuerpo exacto de la
 * verificación del señuelo frente a un código equivocado de un registro real.
 */

use App\Modules\Identidad\Contracts\EnviadorSms;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\Support\DatosPrueba;
use Tests\Support\SmsFalso;

beforeEach(function () {
    Mail::fake();
    Http::preventStrayRequests();
    Http::fake(['api.pwnedpasswords.com/*' => Http::response('')]);
    config(['finantech.registro.tiempo_minimo_respuesta_ms' => 0]);

    $this->sms = new SmsFalso;
    $this->app->instance(EnviadorSms::class, $this->sms);

    $this->logs = [];
    $this->app['events']->listen(MessageLogged::class, function (MessageLogged $e) {
        $this->logs[] = $e;
    });
});

/** Crea por la API la cuenta de María (documento 1067123456, maria.perez@example.com). */
function t32CuentaExistente(\Tests\TestCase $prueba): void
{
    $inicio = $prueba->postJson('/api/v1/clientes/registro', DatosPrueba::registro())->assertCreated();
    $prueba->postJson("/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [
        'codigo_email' => DatosPrueba::codigoCorreo(),
        'codigo_telefono' => $prueba->sms->ultimoCodigo(),
    ])->assertCreated();
}

/** Nombres de las cabeceras de una respuesta, sin las que cambian en cada petición. */
function t32Cabeceras(\Illuminate\Testing\TestResponse $respuesta): array
{
    $nombres = array_diff(array_keys($respuesta->headers->all()), ['date']);
    sort($nombres);

    return $nombres;
}

describe('T32 — P3 / RN-17 / CP0005: ningún canal secundario delata la cuenta', function () {
    it('un registro repetido no deja en el log nada que delate la cuenta ni los datos del titular (RNF-06)', function () {
        t32CuentaExistente($this);
        $this->logs = [];

        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']))->assertCreated();
        $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']))->assertCreated();

        $texto = collect($this->logs)
            ->map(fn (MessageLogged $e) => $e->level.' '.$e->message.' '.json_encode($e->context))
            ->implode("\n");

        expect($texto)->not->toContain('1067123456')
            ->not->toContain('maria.perez')
            ->not->toContain('cuenta_existente')
            ->not->toContain('senuelo')
            ->not->toContain('señuelo');
        expect(collect($this->logs)->whereIn('level', ['error', 'critical', 'alert', 'emergency']))->toBeEmpty();
    });

    it('un registro nuevo y uno repetido devuelven las mismas cabeceras', function () {
        t32CuentaExistente($this);

        $nuevo = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'num_documento' => '1055555555', 'email' => 'nueva@example.com',
        ]))->assertCreated();
        $porDocumento = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['email' => 'otra@example.com']))->assertCreated();
        $porCorreo = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']))->assertCreated();

        expect(t32Cabeceras($porDocumento))->toBe(t32Cabeceras($nuevo))
            ->and(t32Cabeceras($porCorreo))->toBe(t32Cabeceras($nuevo))
            ->and($porDocumento->headers->getCookies())->toBe([])
            ->and($nuevo->headers->getCookies())->toBe([]);
    });

    it('verificar un señuelo con un código equivocado responde exactamente igual que un registro real', function () {
        t32CuentaExistente($this);

        $real = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro([
            'num_documento' => '1055555555', 'email' => 'nueva@example.com',
        ]))->assertCreated();
        $senuelo = $this->postJson('/api/v1/clientes/registro', DatosPrueba::registro(['num_documento' => '1099999999']))->assertCreated();

        $equivocado = ['codigo_email' => '000000', 'codigo_telefono' => '000000'];
        $respuestaReal = $this->postJson("/api/v1/clientes/registro/{$real['registro_id']}/verificar", $equivocado);
        $respuestaSenuelo = $this->postJson("/api/v1/clientes/registro/{$senuelo['registro_id']}/verificar", $equivocado);

        expect($respuestaSenuelo->status())->toBe($respuestaReal->status())->toBe(422)
            ->and($respuestaSenuelo->json())->toBe($respuestaReal->json())
            ->and(t32Cabeceras($respuestaSenuelo))->toBe(t32Cabeceras($respuestaReal));
    });
});
