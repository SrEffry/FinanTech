<?php

/*
 * V3 / T15 — Consola mínima del oficial y decisión de crédito (RF-07, RF-10, UC10, P9):
 * bandeja (EN_DECISION), expediente con la central, contexto y POST evaluacion/decisiones con
 * motivo obligatorio (RN-54), atribución por monto (RN-53), conflicto de interés (RN-55),
 * segregación (RN-56), tasa ≤ máxima legal (RN-57) y solo adición (RN-58). Al aprobar se
 * publica DecisionRegistrada para la oferta (T18). Datos sintéticos.
 *
 * Documentos de la central simulada: 1000000004 → perfil medio (610, se escala y por D20 llega
 * a EN_DECISION); 1000000008 → perfil bueno (aprobación automática).
 */

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Database\Seeders\ReglasMotorSeeder;
use App\Modules\Evaluacion\Events\DecisionRegistrada;
use App\Modules\Evaluacion\Models\Decision;
use App\Modules\Evaluacion\Models\VersionParametros;
use App\Modules\Evaluacion\Services\Evaluaciones;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Models\VinculoCliente;
use App\Modules\Originacion\Services\Solicitudes;
use App\Modules\Originacion\Services\SolicitudesPorId;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Support\Personas;

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    $this->seed(ReglasMotorSeeder::class);
});

/** Solicitud radicada y evaluada por el motor. Devuelve [id de la solicitud, usuario cliente]. */
function t15Evaluada(string $documento = '1000000004', float $porcentaje = 0.35, int $antiguedad = 6): array
{
    $usuario = Personas::cliente(['estado_kyc' => 'verificado', 'num_documento' => $documento]);
    $clienteId = $usuario->cliente->id;
    Consentimiento::create([
        'cliente_id' => $clienteId, 'finalidad_codigo' => 'consulta_centrales', 'accion' => Consentimiento::OTORGA,
        'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => now()->addSecond(),
    ]);

    $servicio = app(Solicitudes::class);
    $solicitud = $servicio->crearBorrador($clienteId, 'libre_inversion', 5_000_000, 24);
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

function t15Estado(string $id): string
{
    return app(SolicitudesPorId::class)->datosParaEvaluacion($id)['estado'];
}

function t15Oficial(int $atribucion = 30_000_000): Usuario
{
    return Personas::interno(Rol::OFICIAL, ['nombre_completo' => 'Oficial Sintético Uno'], ['atribucion_monto' => $atribucion]);
}

function t15Decidir(array $cuerpo): \Illuminate\Testing\TestResponse
{
    return test()->postJson('/api/v1/evaluacion/decisiones', $cuerpo);
}

describe('GET originacion/bandeja y expedientes/{id} (RF-07, V3)', function () {
    it('el oficial ve en su bandeja la solicitud EN_DECISION, con el cliente enmascarado', function () {
        [$id] = t15Evaluada();

        $respuesta = $this->actingAs(t15Oficial())->getJson('/api/v1/originacion/bandeja')->assertOk();

        $respuesta->assertJsonPath('indicadores.asignadas', 1)
            ->assertJsonPath('indicadores.pendientes', 1)
            ->assertJsonPath('indicadores.atendidas_hoy', 0)
            ->assertJsonPath('solicitudes.0.id', $id)
            ->assertJsonPath('solicitudes.0.estado', 'EN_DECISION')
            ->assertJsonPath('solicitudes.0.producto', 'Libre inversión')
            ->assertJsonPath('solicitudes.0.documento_enmascarado', '•••• 0004')
            ->assertJsonPath('solicitudes.0.semaforo', 'a_tiempo')
            ->assertJsonPath('solicitudes.0.reconsideracion', false)
            ->assertJsonStructure(['solicitudes' => [['radicado', 'cliente', 'monto', 'en_cola_desde', 'sla_vence_en']]]);
        expect($respuesta->getContent())->not->toContain('1000000004');
    });

    it('filtra por estado, producto y monto; la cola del analista no incluye EN_DECISION', function () {
        t15Evaluada();
        $this->actingAs(t15Oficial());

        expect($this->getJson('/api/v1/originacion/bandeja?monto_max=1000000')->json('solicitudes'))->toBe([])
            ->and($this->getJson('/api/v1/originacion/bandeja?monto_min=1000000&producto=libre_inversion')->json('solicitudes'))->toHaveCount(1)
            ->and($this->getJson('/api/v1/originacion/bandeja?estado=EN_COMITE')->json('solicitudes'))->toBe([]);

        $this->actingAs(Personas::interno(Rol::ANALISTA))->getJson('/api/v1/originacion/bandeja')
            ->assertOk()->assertJsonPath('indicadores.asignadas', 0);
    });

    it('marca por vencer y vencida según el tiempo en cola', function () {
        t15Evaluada();
        $this->actingAs(t15Oficial());

        $this->travel(19)->hours();
        $this->getJson('/api/v1/originacion/bandeja')->assertJsonPath('solicitudes.0.semaforo', 'por_vencer')
            ->assertJsonPath('indicadores.proximas_a_vencer', 1);
        $this->travel(6)->hours();
        $this->getJson('/api/v1/originacion/bandeja')->assertJsonPath('solicitudes.0.semaforo', 'vencida');
    });

    it('401 sin sesión y 403 al cliente', function () {
        [$id, $cliente] = t15Evaluada();

        $this->getJson('/api/v1/originacion/bandeja')->assertUnauthorized();
        $this->getJson("/api/v1/originacion/expedientes/{$id}")->assertUnauthorized();
        $this->actingAs($cliente)->getJson('/api/v1/originacion/bandeja')->assertForbidden();
        $this->actingAs($cliente)->getJson("/api/v1/originacion/expedientes/{$id}")->assertForbidden();
    });

    it('el expediente trae la solicitud, el solicitante enmascarado y la central simulada', function () {
        [$id] = t15Evaluada();
        t15Evaluada('1000000008', 0.10); // otra solicitud de otro cliente: no aparece en el historial

        $respuesta = $this->actingAs(t15Oficial())->getJson("/api/v1/originacion/expedientes/{$id}")->assertOk();

        $respuesta->assertJsonPath('solicitud.id', $id)
            ->assertJsonPath('solicitud.estado', 'EN_DECISION')
            ->assertJsonPath('solicitante.documento_enmascarado', '•••• 0004')
            ->assertJsonPath('solicitante.edad', 30)
            ->assertJsonPath('solicitante.estado_kyc', 'verificado')
            ->assertJsonPath('central.fuente', 'simulada')
            ->assertJsonPath('central.mora_maxima_dias', 30)
            ->assertJsonPath('historial_finantech', [])
            ->assertJsonPath('concepto', null)
            ->assertJsonPath('semaforo', 'a_tiempo');
        expect($respuesta->getContent())->not->toContain('1000000004')
            ->and($respuesta->json('solicitante.email'))->toContain('•');
    });

    it('404 si la solicitud no existe o no está radicada', function () {
        $this->actingAs(t15Oficial());
        $usuario = Personas::cliente(['estado_kyc' => 'verificado']);
        $borrador = app(Solicitudes::class)->crearBorrador($usuario->cliente->id, 'libre_inversion', 5_000_000, 24);

        $this->getJson('/api/v1/originacion/expedientes/9b1c0d4e-0000-4000-8000-000000000000')
            ->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
        $this->getJson("/api/v1/originacion/expedientes/{$borrador->id}")
            ->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
    });
});

describe('GET evaluacion/decisiones/contexto/{id} (RF-10)', function () {
    it('da la atribución, la tasa máxima legal y ningún bloqueo', function () {
        [$id] = t15Evaluada();

        $this->actingAs(t15Oficial())->getJson("/api/v1/evaluacion/decisiones/contexto/{$id}")
            ->assertOk()
            ->assertExactJson([
                'atribucion_monto' => 30_000_000,
                'tasa_maxima_legal_ea' => 25.8,
                'bloqueo' => null,
                'decisiones_previas' => [],
            ]);
    });

    it('solo el oficial: 401, 403 al analista y al cliente, 404 sin solicitud', function () {
        [$id, $cliente] = t15Evaluada();
        $url = "/api/v1/evaluacion/decisiones/contexto/{$id}";

        $this->getJson($url)->assertUnauthorized();
        $this->actingAs($cliente)->getJson($url)->assertForbidden();
        $this->actingAs(Personas::interno(Rol::ANALISTA))->getJson($url)->assertForbidden();
        $this->actingAs(t15Oficial())->getJson('/api/v1/evaluacion/decisiones/contexto/9b1c0d4e-0000-4000-8000-000000000000')
            ->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
    });

    it('RN-55 y RN-56: avisa el bloqueo por vínculo con el cliente o por haber parametrizado', function () {
        [$id, $cliente] = t15Evaluada();
        $vinculado = t15Oficial();
        VinculoCliente::create(['usuario_id' => $vinculado->id, 'cliente_id' => $cliente->cliente->id, 'registrado_en' => now()]);
        $parametrizo = t15Oficial();
        VersionParametros::create(VersionParametros::where('version', 'P-2026.10-1')->first()->only([
            'tasa_maxima_legal_ea', 'umbral_aprobar', 'umbral_negar', 'limite_cuota_ingreso', 'productos',
        ]) + ['version' => 'P-2026.10-9', 'vigente_desde' => now()->addYear(), 'publicado_por_id' => $parametrizo->id,
            'publicado_por' => 'Oficial Sintético', 'registrado_en' => now()]);

        $this->actingAs($vinculado)->getJson("/api/v1/evaluacion/decisiones/contexto/{$id}")
            ->assertJsonPath('bloqueo.codigo', 'conflicto_interes');
        $this->actingAs($parametrizo)->getJson("/api/v1/evaluacion/decisiones/contexto/{$id}")
            ->assertJsonPath('bloqueo.codigo', 'segregacion');
    });
});

describe('POST evaluacion/decisiones (RF-10, UC10, CP0015)', function () {
    it('aprueba dentro de la atribución: APROBADA, decisión de solo adición, oferta por evento y auditoría', function () {
        Event::fake([DecisionRegistrada::class]);
        [$id] = t15Evaluada();
        $oficial = t15Oficial();
        $this->actingAs($oficial);

        t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada', 'motivo' => 'Capacidad de pago suficiente y buen historial.'])
            ->assertCreated()
            ->assertJsonPath('solicitud.id', $id)
            ->assertJsonPath('solicitud.estado', 'APROBADA');

        $decision = Decision::sole();
        expect(t15Estado($id))->toBe('APROBADA')
            ->and($decision->resultado)->toBe('aprobada')
            ->and($decision->automatizada)->toBeFalse()
            ->and($decision->autor_usuario_id)->toBe($oficial->id)
            ->and($decision->atribucion_monto)->toBe(30_000_000)
            ->and([$decision->monto, $decision->plazo_meses, $decision->tasa_ea])->toBe([5_000_000, 24, 18.9])
            ->and(DB::table('originacion_historial_estados')->where('solicitud_id', $id)->orderByDesc('id')->value('actor_usuario_id'))
            ->toBe($oficial->id)
            ->and(RegistroAuditoria::where('accion', 'decision.registrada')->sole()->usuario_id)->toBe($oficial->id);
        Event::assertDispatched(DecisionRegistrada::class, fn (DecisionRegistrada $e) => $e->solicitudId === $id
            && $e->decisionId === $decision->id && $e->resultado === 'aprobada' && ! $e->automatizada
            && $e->clienteId === $decision->cliente_id && $e->motivoCondicion === null
            && [$e->monto, $e->plazoMeses, $e->tasaEa] === [5_000_000, 24, 18.9]);

        $this->getJson("/api/v1/evaluacion/decisiones/contexto/{$id}")
            ->assertJsonPath('decisiones_previas.0.autor', 'Oficial Sintético Uno')
            ->assertJsonPath('decisiones_previas.0.automatizada', false);
        $this->getJson('/api/v1/originacion/bandeja')->assertJsonPath('indicadores.atendidas_hoy', 1)
            ->assertJsonPath('indicadores.asignadas', 0);
    });

    it('aprueba con condiciones: las condiciones ajustadas viajan en el evento', function () {
        Event::fake([DecisionRegistrada::class]);
        [$id] = t15Evaluada();
        $this->actingAs(t15Oficial());

        t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada_condicionada', 'motivo' => 'Se reduce el monto por capacidad.',
            'ajustes' => ['monto' => 4_000_000, 'plazo_meses' => 36, 'tasa_ea' => 19.5]])
            ->assertCreated()->assertJsonPath('solicitud.estado', 'APROBADA_CONDICIONADA');

        expect(Decision::sole()->condicionada)->toBeTrue();
        Event::assertDispatched(DecisionRegistrada::class, fn (DecisionRegistrada $e) => $e->resultado === 'aprobada_condicionada'
            && [$e->monto, $e->plazoMeses, $e->tasaEa] === [4_000_000, 36, 19.5]
            && $e->motivoCondicion === 'Tu solicitud se aprobó con condiciones distintas a las que pediste.');
    });

    it('niega y envía a comité sin condiciones; luego ya no se puede decidir', function () {
        Event::fake([DecisionRegistrada::class]);
        [$negada] = t15Evaluada();
        [$comite] = t15Evaluada('1000000013');
        $this->actingAs(t15Oficial());

        t15Decidir(['solicitud_id' => $negada, 'resultado' => 'negada', 'motivo' => 'Endeudamiento alto para el ingreso.'])
            ->assertCreated()->assertJsonPath('solicitud.estado', 'NEGADA');
        t15Decidir(['solicitud_id' => $comite, 'resultado' => 'comite', 'motivo' => 'Caso límite: lo revisa el comité.'])
            ->assertCreated()->assertJsonPath('solicitud.estado', 'EN_COMITE');

        Event::assertDispatched(DecisionRegistrada::class, fn (DecisionRegistrada $e) => $e->resultado === 'negada');
        Event::assertDispatchedTimes(DecisionRegistrada::class, 1); // el envío a comité no la publica

        t15Decidir(['solicitud_id' => $comite, 'resultado' => 'aprobada', 'motivo' => 'Intento de decidir de nuevo.'])
            ->assertStatus(409)->assertJsonPath('codigo', 'en_comite');
        t15Decidir(['solicitud_id' => $negada, 'resultado' => 'aprobada', 'motivo' => 'Intento de decidir de nuevo.'])
            ->assertStatus(409)->assertJsonPath('codigo', 'estado_invalido');
        expect(Decision::count())->toBe(2);
    });

    it('RN-54: el motivo es obligatorio y el resultado debe ser válido', function () {
        [$id] = t15Evaluada();
        $this->actingAs(t15Oficial());

        t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada', 'motivo' => '  corto   '])
            ->assertStatus(422)->assertJsonPath('codigo', 'motivo_requerido');
        t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada'])
            ->assertStatus(422)->assertJsonPath('codigo', 'motivo_requerido');
        t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada_automatica', 'motivo' => 'Motivo suficientemente largo.'])
            ->assertStatus(422)->assertJsonPath('codigo', 'resultado_invalido');
        t15Decidir(['resultado' => 'aprobada', 'motivo' => 'Motivo suficientemente largo.'])->assertStatus(422);

        expect(Decision::count())->toBe(0)->and(t15Estado($id))->toBe('EN_DECISION');
    });

    it('RN-53: fuera de la atribución responde 403 y lo audita; negar no exige atribución', function () {
        [$id] = t15Evaluada();
        $oficial = t15Oficial(1_000_000);
        $this->actingAs($oficial);

        t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada', 'motivo' => 'Capacidad de pago suficiente.'])
            ->assertForbidden()->assertJsonPath('codigo', 'fuera_de_atribucion')
            ->assertJsonPath('mensaje', 'El monto supera tu atribución de $ 1.000.000. Envía la solicitud al comité.');

        expect(t15Estado($id))->toBe('EN_DECISION')->and(Decision::count())->toBe(0)
            ->and(RegistroAuditoria::where('accion', 'decision.rechazada')->sole()->detalle)->toBe(['codigo' => 'fuera_de_atribucion']);

        t15Decidir(['solicitud_id' => $id, 'resultado' => 'negada', 'motivo' => 'Endeudamiento alto para el ingreso.'])->assertCreated();
    });

    it('RN-55 y RN-56: con vínculo o habiendo parametrizado responde 403', function () {
        [$id, $cliente] = t15Evaluada();
        $vinculado = t15Oficial();
        VinculoCliente::create(['usuario_id' => $vinculado->id, 'cliente_id' => $cliente->cliente->id, 'registrado_en' => now()]);
        $parametrizo = t15Oficial();
        VersionParametros::create(VersionParametros::where('version', 'P-2026.10-1')->first()->only([
            'tasa_maxima_legal_ea', 'umbral_aprobar', 'umbral_negar', 'limite_cuota_ingreso', 'productos',
        ]) + ['version' => 'P-2026.10-9', 'vigente_desde' => now()->addYear(), 'publicado_por_id' => $parametrizo->id,
            'publicado_por' => 'Oficial Sintético', 'registrado_en' => now()]);
        $cuerpo = ['solicitud_id' => $id, 'resultado' => 'negada', 'motivo' => 'Endeudamiento alto para el ingreso.'];

        $this->actingAs($vinculado);
        t15Decidir($cuerpo)->assertForbidden()->assertJsonPath('codigo', 'conflicto_interes');
        $this->actingAs($parametrizo);
        t15Decidir($cuerpo)->assertForbidden()->assertJsonPath('codigo', 'segregacion');

        expect(Decision::count())->toBe(0)->and(t15Estado($id))->toBe('EN_DECISION')
            ->and(RegistroAuditoria::where('accion', 'decision.rechazada')->pluck('detalle')->all())
            ->toBe([['codigo' => 'conflicto_interes'], ['codigo' => 'segregacion']]);
    });

    it('RN-57: la tasa no pasa de la máxima legal y los ajustes respetan el rango del producto', function () {
        [$id] = t15Evaluada();
        $this->actingAs(t15Oficial(80_000_000));
        $condicionada = fn (array $ajustes) => t15Decidir(['solicitud_id' => $id, 'resultado' => 'aprobada_condicionada',
            'motivo' => 'Se ajustan las condiciones.', 'ajustes' => $ajustes]);

        $condicionada(['monto' => 4_000_000, 'plazo_meses' => 24, 'tasa_ea' => 26.0])
            ->assertStatus(422)->assertJsonPath('codigo', 'tasa_supera_maxima')
            ->assertJsonPath('mensaje', 'La tasa no puede pasar de la máxima legal (25,80 % E.A.).');
        $condicionada(['monto' => 60_000_000, 'plazo_meses' => 24, 'tasa_ea' => 19.0])
            ->assertStatus(422)->assertJsonPath('codigo', 'ajuste_fuera_de_rango');
        $condicionada(['monto' => 4_000_000, 'plazo_meses' => 6, 'tasa_ea' => 19.0])
            ->assertStatus(422)->assertJsonPath('codigo', 'ajuste_fuera_de_rango');
        $condicionada(['monto' => 4_000_000])->assertStatus(422);

        expect(Decision::count())->toBe(0);
    });

    it('401 sin sesión, 403 al analista y 404 con una solicitud que no existe', function () {
        [$id] = t15Evaluada();
        $cuerpo = ['solicitud_id' => $id, 'resultado' => 'negada', 'motivo' => 'Endeudamiento alto para el ingreso.'];

        t15Decidir($cuerpo)->assertUnauthorized();
        $this->actingAs(Personas::interno(Rol::ANALISTA));
        t15Decidir($cuerpo)->assertForbidden();
        $this->actingAs(t15Oficial());
        t15Decidir(['solicitud_id' => '9b1c0d4e-0000-4000-8000-000000000000'] + $cuerpo)
            ->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
    });

    it('RN-58: la decisión no se modifica ni se borra, ni por el modelo ni por SQL', function () {
        [$id] = t15Evaluada();
        $this->actingAs(t15Oficial());
        t15Decidir(['solicitud_id' => $id, 'resultado' => 'negada', 'motivo' => 'Endeudamiento alto para el ingreso.']);
        $decision = Decision::sole();

        expect(fn () => $decision->update(['motivo' => 'otro']))->toThrow(LogicException::class)
            ->and(fn () => $decision->delete())->toThrow(LogicException::class)
            ->and(fn () => DB::table('evaluacion_decisiones')->update(['motivo' => 'otro']))->toThrow(QueryException::class)
            ->and(fn () => DB::table('evaluacion_decisiones')->delete())->toThrow(QueryException::class);
    });
});

describe('D21: escenario de la demo', function () {
    it('Laura (perfil medio en la central simulada) con 6 meses de antigüedad y cuota del 25 % llega al oficial', function () {
        [$id] = t15Evaluada('1020456782', 0.25, 6);

        $evaluacion = app(Evaluaciones::class)->ultima($id);
        expect($evaluacion['puntaje'])->toBe(660) // 600 + 30 (mora 30) + 60 (cuota 25 %) + 0 (deuda 5x) − 30 (6 meses) + 0 + 0
            ->and($evaluacion['fuente_central'])->toBe('simulada')
            ->and(t15Estado($id))->toBe('EN_DECISION')
            ->and(RegistroAuditoria::where('accion', 'evaluacion.consulta_central')->sole()->modo_simulado)->toBeTrue();
    });
});

describe('RN-46: la decisión automática del motor también queda registrada', function () {
    it('una aprobación automática registra la decisión del motor y publica DecisionRegistrada para la oferta', function () {
        Event::fake([DecisionRegistrada::class]);
        [$id] = t15Evaluada('1000000008', 0.10, 36);

        $decision = Decision::sole();
        expect(t15Estado($id))->toBe('APROBADA')
            ->and($decision->automatizada)->toBeTrue()
            ->and($decision->autor_nombre)->toBe('Motor de reglas')
            ->and($decision->evaluacion_id)->not->toBeNull();
        Event::assertDispatched(DecisionRegistrada::class, fn (DecisionRegistrada $e) => $e->solicitudId === $id
            && $e->resultado === 'aprobada' && $e->automatizada
            && [$e->monto, $e->plazoMeses, $e->tasaEa] === [5_000_000, 24, 18.9]);
    });

    it('una negación automática también queda, sin condiciones', function () {
        Event::fake([DecisionRegistrada::class]);
        [$id] = t15Evaluada('1100000009', 0.35, 6);

        expect(t15Estado($id))->toBe('NEGADA')->and(Decision::sole()->resultado)->toBe('negada');
        Event::assertDispatched(DecisionRegistrada::class, fn (DecisionRegistrada $e) => $e->resultado === 'negada' && $e->automatizada);
    });
});
