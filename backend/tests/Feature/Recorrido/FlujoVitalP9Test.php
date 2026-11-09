<?php

/*
 * P9 · Prueba de aceptación del flujo vital por la API real (qa-senior).
 * Un solo recorrido, con las cookies de sesión reales y sin actingAs para el cliente:
 * registro → verificación de identidad → ingreso con segundo factor → simulación →
 * radicación con documentos → evaluación automática → (V3) bandeja y decisión del oficial →
 * (V4) oferta y aceptación con segundo factor y firma simulada.
 * Los pasos que dependen de endpoints que aún no existen quedan en todo() con su tarea.
 * Solo datos sintéticos. El recorrido en el navegador (V6) está en docs/qa/e2e/.
 */

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Database\Seeders\ReglasMotorSeeder;
use App\Modules\Identidad\Contracts\EnviadorSms;
use App\Modules\Identidad\Mail\CodigoSegundoFactorMail;
use App\Modules\Identidad\Models\Rol;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\DatosPrueba;
use Tests\Support\Personas;
use Tests\Support\SmsFalso;

/** Petición como la hace el portal: cookies de sesión, Accept JSON y X-Requested-With. */
function p9(string $metodo, string $uri, array $cookies = [], array $cuerpo = [], array $archivos = []): TestResponse
{
    Auth::forgetGuards(); // los guards no se reinician entre peticiones de una misma prueba
    $servidor = Personas::cabeceras();
    if ($archivos !== []) {
        return test()->call($metodo, $uri, $cuerpo, $cookies, $archivos, $servidor);
    }
    $servidor['CONTENT_TYPE'] = 'application/json';

    return test()->call($metodo, $uri, [], $cookies, [], $servidor, $cuerpo ? json_encode($cuerpo) : null);
}

function p9Png(string $nombre): UploadedFile
{
    return UploadedFile::fake()->createWithContent($nombre, base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    ));
}

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    $this->seed(ReglasMotorSeeder::class);
    Mail::fake();
    Storage::fake('local');
    Http::preventStrayRequests();
    Http::fake(['api.pwnedpasswords.com/*' => Http::response('')]);
    config(['finantech.registro.tiempo_minimo_respuesta_ms' => 0, 'finantech.sesion.tiempo_minimo_respuesta_ms' => 0]);
    $this->sms = new SmsFalso;
    $this->app->instance(EnviadorSms::class, $this->sms);
});

describe('P9 — flujo vital de punta a punta por la API', function () {
    it('registro → identidad → ingreso con segundo factor → simulación → radicación → evaluación automática', function () {
        // 1. Registro (RF-01, CP0004): política vigente, inicio y verificación de los dos códigos.
        p9('GET', '/api/v1/identidad/politica-vigente')->assertOk()->assertJsonStructure(['version', 'finalidades']);
        // Documento sintético de perfil medio en la central simulada (suma de dígitos 5 → 0,5).
        $datos = DatosPrueba::registro(['num_documento' => '1000000004', 'email' => 'laura.p9@example.com']);
        $inicio = p9('POST', '/api/v1/clientes/registro', [], $datos)->assertCreated();
        $verificado = p9('POST', "/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [], [
            'codigo_email' => DatosPrueba::codigoCorreo(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ])->assertCreated();
        $cookies = Personas::cookiesDeRespuesta($verificado);
        expect($cookies)->toHaveKey('ft_acceso');                                    // el registro abre sesión
        p9('GET', '/api/v1/identidad/sesion', $cookies)->assertOk()->assertJsonPath('usuario.rol', Rol::CLIENTE);

        // 2. Sin identidad verificada no se puede crear la solicitud (RN-07).
        p9('POST', '/api/v1/originacion/solicitudes', $cookies, ['producto' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertStatus(409)->assertJsonPath('codigo', 'identidad_no_verificada');

        // 3. Verificación de identidad con el adaptador simulado, marcada como simulada (RF-02, MR-003, CP0007).
        p9('POST', '/api/v1/clientes/verificacion-identidad', $cookies, ['escenario' => 'exito'], [
            'documento_frente' => p9Png('frente.png'), 'documento_reverso' => p9Png('reverso.png'), 'rostro' => p9Png('rostro.png'),
        ])->assertOk()->assertJson(['estado_kyc' => 'verificado', 'simulado' => true]);

        // 4. Cierra la sesión e ingresa de nuevo con contraseña y segundo factor (RF-03, CP0008).
        p9('DELETE', '/api/v1/identidad/sesion', $cookies)->assertSuccessful();
        p9('GET', '/api/v1/identidad/sesion', $cookies)->assertUnauthorized();
        $desafio = p9('POST', '/api/v1/identidad/sesiones', [], ['email' => $datos['email'], 'password' => $datos['password']])->assertOk();
        $codigoMfa = Mail::sent(CodigoSegundoFactorMail::class)->last()->codigo;
        $ingreso = p9('POST', "/api/v1/identidad/sesiones/{$desafio['desafio_id']}/verificar", [], ['codigo' => $codigoMfa])->assertOk();
        $cookies = Personas::cookiesDeRespuesta($ingreso);

        // 5. Simulación transparente (RF-05, CP0011): TEA y tasa máxima legal, desglose que suma el costo total.
        $simulacion = p9('POST', '/api/v1/cliente/simulaciones', $cookies, ['producto' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertSuccessful();
        expect($simulacion['tasa_ea'])->toBeLessThanOrEqual($simulacion['tasa_maxima_legal_ea'])
            ->and($simulacion['cuota'])->toBeGreaterThan(0);

        // 6. Radicación (RF-06, CP0012): borrador, datos, documentos requeridos y radicado único.
        $solicitud = p9('POST', '/api/v1/originacion/solicitudes', $cookies, ['producto' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertCreated();
        $id = $solicitud['id'];
        $detalle = p9('PATCH', "/api/v1/originacion/solicitudes/{$id}", $cookies, [
            'laboral' => ['ocupacion' => 'empleado', 'empleador' => 'Empresa Sintética S.A.S.', 'antiguedad_laboral_meses' => 36],
            'financiero' => ['ingreso_mensual' => 4_500_000, 'egreso_mensual' => 1_500_000],
            'referencia' => ['nombre' => 'Pedro Referencia Sintética', 'celular' => '3109876543'],
            'acepta_consulta_centrales' => true,
        ])->assertOk();
        $requeridos = collect($detalle['documentos'])->where('requerido', true)->pluck('tipo');
        expect($requeridos)->not->toBeEmpty();
        foreach ($requeridos as $tipo) {
            p9('POST', "/api/v1/originacion/solicitudes/{$id}/documentos", $cookies, ['tipo' => $tipo], [
                'archivo' => UploadedFile::fake()->create("{$tipo}.pdf", 120, 'application/pdf'),
            ])->assertOk();
        }
        $radicada = p9('POST', "/api/v1/originacion/solicitudes/{$id}/radicar", $cookies)->assertOk();
        expect($radicada['radicado'])->toMatch('/^FT-'.now()->year.'-\d{6}$/');

        // 7. Evaluación automática (RF-08, CP0013): el motor consume SolicitudRadicada y mueve la solicitud.
        $seguimiento = p9('GET', "/api/v1/originacion/solicitudes/{$id}", $cookies)->assertOk();
        expect($seguimiento['estado'])->not->toBeIn(['BORRADOR', 'RADICADA', 'EN_EVALUACION']);

        // El cliente no puede ver la evaluación interna (RNF-05); el oficial sí, con su versión de reglas (RN-44).
        p9('GET', "/api/v1/evaluacion/solicitudes/{$id}/evaluacion", $cookies)->assertForbidden();
        $oficial = Personas::cookiesDe(Personas::interno(Rol::OFICIAL));
        $evaluacion = p9('GET', "/api/v1/evaluacion/solicitudes/{$id}/evaluacion", $oficial)->assertOk();
        expect($evaluacion['version_reglas'])->not->toBeEmpty()
            ->and($evaluacion['fuente_central'])->toBe('simulada');

        // La decisión sugerida y el estado coinciden con los umbrales de RN-40 (y RN-41).
        $esperado = match ($evaluacion['decision_sugerida']) {
            'aprobar' => ['APROBADA'],
            'negar' => ['NEGADA'],
            default => ['EN_ESTUDIO', 'EN_DECISION'], // D20: el escalado pasa a EN_DECISION sin concepto
        };
        expect($seguimiento['estado'])->toBeIn($esperado);
        if ($evaluacion['puntaje'] >= $evaluacion['umbrales']['aprobar'] && ! $evaluacion['capacidad_pago']['supera_limite']) {
            expect($evaluacion['decision_sugerida'])->toBe('aprobar');
        }
        if ($evaluacion['puntaje'] < $evaluacion['umbrales']['negar']) {
            expect($evaluacion['decision_sugerida'])->toBe('negar');
        }
    });

    /*
     * Los caminos de error de este tramo (RN-53 a RN-58, 401/403, código equivocado, oferta vencida)
     * están en Evaluacion/DecisionOficialTest y Desembolso/OfertasTest. Aquí se prueba que las piezas
     * encajan de punta a punta: el evento real entre módulos y las sesiones reales de cada actor.
     */
    it('D21 → V3 → V4: Laura pasa por el oficial, recibe la oferta y firma el pagaré con segundo factor', function () {
        // Cliente sintético de perfil medio en la central simulada, con identidad verificada.
        $datos = DatosPrueba::registro(['num_documento' => '1000000004', 'email' => 'laura.d21@example.com']);
        $inicio = p9('POST', '/api/v1/clientes/registro', [], $datos)->assertCreated();
        $cookies = Personas::cookiesDeRespuesta(p9('POST', "/api/v1/clientes/registro/{$inicio['registro_id']}/verificar", [], [
            'codigo_email' => DatosPrueba::codigoCorreo(),
            'codigo_telefono' => $this->sms->ultimoCodigo(),
        ])->assertCreated());
        p9('POST', '/api/v1/clientes/verificacion-identidad', $cookies, ['escenario' => 'exito'], [
            'documento_frente' => p9Png('frente.png'), 'documento_reverso' => p9Png('reverso.png'), 'rostro' => p9Png('rostro.png'),
        ])->assertOk();

        // D21 (contrato, "Escenario de la demo"): 6 meses de antigüedad y cuota del 25 % → puntaje 660.
        $id = p9('POST', '/api/v1/originacion/solicitudes', $cookies, ['producto' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertCreated()['id'];
        $detalle = p9('PATCH', "/api/v1/originacion/solicitudes/{$id}", $cookies, [
            'laboral' => ['ocupacion' => 'empleado', 'empleador' => 'Empresa Sintética S.A.S.', 'antiguedad_laboral_meses' => 6],
            'financiero' => ['ingreso_mensual' => 1_100_000, 'egreso_mensual' => 0],
            'referencia' => ['nombre' => 'Pedro Referencia Sintética', 'celular' => '3109876543'],
            'acepta_consulta_centrales' => true,
        ])->assertOk();
        foreach (collect($detalle['documentos'])->where('requerido', true)->pluck('tipo') as $tipo) {
            p9('POST', "/api/v1/originacion/solicitudes/{$id}/documentos", $cookies, ['tipo' => $tipo], [
                'archivo' => UploadedFile::fake()->create("{$tipo}.pdf", 120, 'application/pdf'),
            ])->assertOk();
        }
        $radicado = p9('POST', "/api/v1/originacion/solicitudes/{$id}/radicar", $cookies)->assertOk()['radicado'];

        // D20: el escalado pasa a EN_DECISION sin concepto. CP0013: el analista consulta la evaluación con su versión.
        p9('GET', "/api/v1/originacion/solicitudes/{$id}", $cookies)->assertOk()->assertJsonPath('estado', 'EN_DECISION');
        $analista = Personas::cookiesDe(Personas::interno(Rol::ANALISTA));
        $evaluacion = p9('GET', "/api/v1/evaluacion/solicitudes/{$id}/evaluacion", $analista)->assertOk();
        expect($evaluacion['puntaje'])->toBe(660)
            ->and($evaluacion['version_reglas'])->not->toBeEmpty()
            ->and($evaluacion['fuente_central'])->toBe('simulada');

        // V3: bandeja y expediente del oficial, con el documento enmascarado (RNF-08).
        $oficial = Personas::cookiesDe(Personas::interno(Rol::OFICIAL, [], ['atribucion_monto' => 30_000_000]));
        $bandeja = p9('GET', '/api/v1/originacion/bandeja', $oficial)->assertOk();
        expect(collect($bandeja['solicitudes'])->firstWhere('id', $id))->not->toBeNull()
            ->radicado->toBe($radicado)
            ->and($bandeja->getContent())->not->toContain($datos['num_documento']);
        expect(p9('GET', "/api/v1/originacion/expedientes/{$id}", $oficial)->assertOk()->getContent())
            ->not->toContain($datos['num_documento']);
        p9('GET', "/api/v1/evaluacion/decisiones/contexto/{$id}", $oficial)->assertOk();

        // RF-10: el cliente no decide; el oficial aprueba con motivo y el estado cambia.
        $decision = ['solicitud_id' => $id, 'resultado' => 'aprobada', 'motivo' => 'Capacidad de pago suficiente (recorrido P9).'];
        p9('POST', '/api/v1/evaluacion/decisiones', $cookies, $decision)->assertForbidden();
        p9('POST', '/api/v1/evaluacion/decisiones', $oficial, $decision)->assertCreated()->assertJsonPath('solicitud.estado', 'APROBADA');

        // V4: DecisionRegistrada crea la oferta y el seguimiento la enlaza (RF-07, RF-11, RN-59).
        $seguimiento = p9('GET', "/api/v1/originacion/solicitudes/{$id}", $cookies)->assertOk()
            ->assertJsonPath('accion_pendiente.tipo', 'oferta');
        $ofertaId = $seguimiento['oferta_id'];
        $oferta = p9('GET', "/api/v1/desembolso/ofertas/{$ofertaId}", $cookies)->assertOk()->assertJsonPath('estado', 'vigente');
        expect($oferta['tasa_ea'])->toBeGreaterThan(0)
            ->and(array_sum(array_column($oferta['desglose'], 'valor')))->toBe($oferta['costo_total'])
            ->and(round((strtotime($oferta['vence_en']) - strtotime($oferta['emitida_en'])) / 86400))->toEqual(15.0);

        // RN-61, RN-62, MR-004: aceptar exige segundo factor y la firma queda marcada como simulada.
        $desafio = p9('POST', "/api/v1/desembolso/ofertas/{$ofertaId}/desafio-mfa", $cookies)->assertOk();
        expect($desafio->json('codigo_demo'))->toBeNull(); // el código solo viaja por el canal, nunca en la respuesta
        $firmada = p9('POST', "/api/v1/desembolso/ofertas/{$ofertaId}/aceptar", $cookies, [
            'declaracion' => true,
            'desafio_id' => $desafio['desafio_id'],
            'codigo' => Mail::sent(CodigoSegundoFactorMail::class)->last()->codigo,
        ])->assertOk()->assertJsonPath('estado', 'firmada');
        expect($firmada['firma']['simulada'])->toBeTrue();

        p9('GET', "/api/v1/originacion/solicitudes/{$id}", $cookies)->assertOk()->assertJsonPath('estado', 'FORMALIZADA');
        expect(collect(p9('GET', '/api/v1/originacion/bandeja', $oficial)->assertOk()['solicitudes'])->firstWhere('id', $id))->toBeNull();
    });
});
