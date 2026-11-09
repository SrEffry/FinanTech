<?php

/*
 * D26 (T16 mínimo) — RF-09: el cliente titular conoce la decisión en lenguaje claro, sin
 * códigos, pesos, puntaje ni versión de reglas (RN-52), sin el motivo interno del oficial
 * (D6/UX-03), con el distintivo de simulado (MR-004) y solo si es suya (RN-35). Datos sintéticos.
 */

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Database\Seeders\ReglasMotorSeeder;
use App\Modules\Evaluacion\Services\Evaluaciones;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Originacion\Services\Solicitudes;
use Tests\Support\Personas;

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    $this->seed(ReglasMotorSeeder::class);
});

/** @return array{0: string, 1: Usuario} id de la solicitud evaluada y su titular */
function d26Evaluada(string $documento, float $porcentaje, int $antiguedad): array
{
    $usuario = Personas::cliente(['estado_kyc' => 'verificado', 'num_documento' => $documento]);
    Consentimiento::create([
        'cliente_id' => $usuario->cliente->id, 'finalidad_codigo' => 'consulta_centrales', 'accion' => Consentimiento::OTORGA,
        'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => now()->addSecond(),
    ]);
    $servicio = app(Solicitudes::class);
    $solicitud = $servicio->crearBorrador($usuario->cliente->id, 'libre_inversion', 5_000_000, 24);
    $solicitud->update([
        'ocupacion' => 'empleado',
        'antiguedad_laboral_meses' => $antiguedad,
        'ingreso_mensual' => (int) ceil($solicitud->cuota_estimada / $porcentaje),
        'egreso_mensual' => 0,
        'acepta_consulta_centrales' => true,
    ]);
    $servicio->radicar($solicitud);
    app(Evaluaciones::class)->evaluarRadicada($solicitud->id);

    return [$solicitud->id, $usuario];
}

function d26Decidir(string $id, string $resultado, array $extra = []): void
{
    test()->actingAs(Personas::interno(Rol::OFICIAL, [], ['atribucion_monto' => 30_000_000]))
        ->postJson('/api/v1/evaluacion/decisiones', ['solicitud_id' => $id, 'resultado' => $resultado,
            'motivo' => 'Nota interna ZZ-CONFIDENCIAL del oficial.'] + $extra)
        ->assertCreated();
}

it('RF-09: una negación automática se explica en lenguaje claro, con el distintivo de simulado', function () {
    [$id, $titular] = d26Evaluada('1100000009', 0.35, 6);

    $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")
        ->assertOk()
        ->assertJsonPath('resultado', 'negada')
        ->assertJsonPath('automatizada', true)
        ->assertJsonPath('motivo_principal', 'Registras pagos atrasados recientes con otras entidades.')
        ->assertJsonPath('variables.0.efecto', 'desfavorable')
        ->assertJsonPath('variables.0.nombre', 'Comportamiento de pago en centrales')
        ->assertJsonPath('simulado', true)
        ->assertJsonPath('condicion', null)
        ->assertJsonPath('reconsideracion', null)
        ->assertJsonPath('puede_reconsiderar', false)
        ->assertJsonPath('producto', 'Libre inversión')
        ->assertJsonPath('oferta_id', null)
        ->assertJsonStructure(['decidida_en', 'radicado', 'reconsideracion_vence_en']);
});

it('RN-52: el cuerpo no trae códigos, pesos, puntaje ni versión de reglas', function () {
    [$id, $titular] = d26Evaluada('1100000009', 0.35, 6);

    $cuerpo = $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")->assertOk()->getContent();

    foreach (['puntaje', 'version_reglas', 'R-2026', 'contribucion', 'comportamiento_pago', 'cuota_ingreso',
        'consultas_recientes', 'causal', 'umbral', '"codigo"', '"valor"'] as $interno) {
        expect($cuerpo)->not->toContain($interno);
    }
});

it('D6/UX-03: el motivo interno del oficial no llega al cliente', function () {
    [$id, $titular] = d26Evaluada('1000000004', 0.35, 6);
    d26Decidir($id, 'negada');

    $respuesta = $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")->assertOk();

    $respuesta->assertJsonPath('automatizada', false)
        ->assertJsonPath('motivo_principal', 'Un oficial de crédito revisó tu solicitud y decidió no aprobarla en este momento.');
    expect($respuesta->getContent())->not->toContain('ZZ-CONFIDENCIAL');
});

it('una aprobación condicionada dice las condiciones y no el motivo interno', function () {
    [$id, $titular] = d26Evaluada('1000000004', 0.35, 6);
    d26Decidir($id, 'aprobada_condicionada', ['ajustes' => ['monto' => 4_000_000, 'plazo_meses' => 36, 'tasa_ea' => 19.5]]);

    $respuesta = $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")->assertOk();

    $respuesta->assertJsonPath('resultado', 'aprobada_condicionada')
        ->assertJsonPath('condicion', 'Te aprobamos $ 4.000.000 a 36 meses, con una tasa de 19,50 % E.A.');
    expect($respuesta->getContent())->not->toContain('ZZ-CONFIDENCIAL');
});

it('D6/UX-03: el motivo del oficial no aparece ni en la oferta ni en la explicación', function () {
    [$id, $titular] = d26Evaluada('1000000004', 0.35, 6);
    d26Decidir($id, 'aprobada_condicionada', ['ajustes' => ['monto' => 4_000_000, 'plazo_meses' => 36, 'tasa_ea' => 19.5]]);

    $explicacion = $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")->assertOk();
    $oferta = $this->getJson('/api/v1/desembolso/ofertas/'.$explicacion->json('oferta_id'))->assertOk();

    $oferta->assertJsonPath('motivo_condicion', 'Tu solicitud se aprobó con condiciones distintas a las que pediste.');
    expect($oferta->getContent())->not->toContain('ZZ-CONFIDENCIAL')
        ->and($explicacion->getContent())->not->toContain('ZZ-CONFIDENCIAL');
});

it('UX-31: una aprobación automática trae la oferta y sus factores favorables', function () {
    [$id, $titular] = d26Evaluada('1000000008', 0.10, 36);

    $respuesta = $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")->assertOk();

    $respuesta->assertJsonPath('resultado', 'aprobada')
        ->assertJsonPath('motivo_principal', 'Tu solicitud cumple las condiciones para aprobarla.')
        ->assertJsonPath('variables.0.efecto', 'favorable');
    expect($respuesta->json('oferta_id'))->not->toBeNull()
        ->and($respuesta->json('variables'))->toHaveCount(3);
});

it('MR-004: sin evaluación automática no hay distintivo ni factores', function () {
    [$id, $titular] = d26Evaluada('1000000000', 0.35, 6); // termina en 0: la central simulada no responde
    d26Decidir($id, 'negada');

    $this->actingAs($titular)->getJson("/api/v1/originacion/solicitudes/{$id}/decision")->assertOk()
        ->assertJsonPath('simulado', false)
        ->assertJsonPath('variables', []);
});

it('404 sin_decision mientras no haya decisión; el envío a comité no cuenta', function () {
    [$id, $titular] = d26Evaluada('1000000004', 0.35, 6);
    $url = "/api/v1/originacion/solicitudes/{$id}/decision";

    $this->actingAs($titular)->getJson($url)->assertNotFound()->assertJsonPath('codigo', 'sin_decision');
    d26Decidir($id, 'comite');
    $this->actingAs($titular)->getJson($url)->assertNotFound()->assertJsonPath('codigo', 'sin_decision');
});

it('RN-35: solo el dueño; 401 sin sesión, 403 a roles internos y 404 si es de otro cliente', function () {
    [$id] = d26Evaluada('1100000009', 0.35, 6);
    $url = "/api/v1/originacion/solicitudes/{$id}/decision";

    $this->getJson($url)->assertUnauthorized();
    $this->actingAs(Personas::interno(Rol::OFICIAL))->getJson($url)->assertForbidden();
    $this->actingAs(Personas::cliente(['estado_kyc' => 'verificado']))->getJson($url)
        ->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
});
