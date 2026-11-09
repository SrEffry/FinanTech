<?php

/*
 * T10 — Evaluación automática de punta a punta (RF-08, UC9, SEC-02): el motor consume
 * SolicitudRadicada, consulta la central simulada, guarda la evaluación de solo adición con
 * su versión de reglas y mueve la solicitud (CP0013). Pares de equidad (CP0014). Nunca niega
 * por la caída de un tercero (RF-08 FA-02).
 *
 * Documentos sintéticos para la central simulada (suma de dígitos módulo 10 = perfil):
 * 1000000008 → 0,9 (bueno), 1000000004 → 0,5 (medio), 1100000009 → 0,1 (malo); termina en 0 → caída.
 */

use App\Modules\Evaluacion\Contracts\CentralRiesgoService;
use App\Modules\Evaluacion\Contracts\SolicitudesEvaluables;
use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Database\Seeders\ReglasMotorSeeder;
use App\Modules\Evaluacion\Events\EvaluacionCompletada;
use App\Modules\Evaluacion\Models\Evaluacion;
use App\Modules\Evaluacion\Models\VersionParametros;
use App\Modules\Evaluacion\Motor\CatalogoVariables;
use App\Modules\Evaluacion\Services\Evaluaciones;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Originacion\Services\Solicitudes;
use App\Modules\Originacion\Services\SolicitudesPorId;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Support\Personas;

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    $this->seed(ReglasMotorSeeder::class);
    $this->evaluaciones = fn (): Evaluaciones => app(Evaluaciones::class);
});

/**
 * Cliente verificado con autorización de centrales y una solicitud de libre inversión radicada
 * (5 millones a 24 meses). El ingreso se fija para que la cuota ocupe `$porcentaje` del ingreso
 * disponible. Devuelve el id de la solicitud.
 */
function t10Radicar(string $documento, float $porcentaje, int $antiguedad = 36, array $cliente = [], bool $autoriza = true): string
{
    $usuario = Personas::cliente(array_merge(['estado_kyc' => 'verificado', 'num_documento' => $documento], $cliente));
    $clienteId = $usuario->cliente->id;
    if ($autoriza) {
        t10Consentimiento($clienteId, Consentimiento::OTORGA);
    }

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

    return $solicitud->id;
}

function t10Consentimiento(int $clienteId, string $accion): void
{
    Consentimiento::create([
        'cliente_id' => $clienteId, 'finalidad_codigo' => 'consulta_centrales', 'accion' => $accion,
        'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => now()->addSecond(),
    ]);
}

function t10Estado(string $solicitudId): string
{
    return app(SolicitudesPorId::class)->datosParaEvaluacion($solicitudId)['estado'];
}

describe('CP0013 — evaluación trazable (RF-08, RN-40, RN-41, RN-44, RN-46)', function () {
    it('pasos 1-2: el motor consume SolicitudRadicada y aprueba un puntaje alto', function () {
        Event::fake([EvaluacionCompletada::class]);
        $this->withoutDefer();

        $id = t10Radicar('1000000008', 0.10);

        $evaluacion = Evaluacion::where('solicitud_id', $id)->sole();
        expect(t10Estado($id))->toBe('APROBADA')
            ->and($evaluacion->puntaje)->toBeGreaterThanOrEqual(700)
            ->and($evaluacion->decision_sugerida)->toBe('aprobar')
            ->and($evaluacion->nivel_riesgo)->toBe('bajo');
        Event::assertDispatched(EvaluacionCompletada::class, fn (EvaluacionCompletada $e) => $e->solicitudId === $id
            && $e->decision === 'aprobar' && $e->versionReglas === 'R-2026.10-1' && $e->simulada);
    });

    it('paso 3: un puntaje intermedio se escala a la bandeja del analista', function () {
        $id = t10Radicar('1000000004', 0.35, 6);

        $r = ($this->evaluaciones)()->evaluarRadicada($id);

        expect($r['puntaje'])->toBe(610) // 600 + 30 (mora 30) + 10 (cuota 35 %) + 0 (deuda 5x) − 30 (6 meses) + 0 + 0
            ->and($r['decision_sugerida'])->toBe('escalar')
            ->and(t10Estado($id))->toBe('EN_DECISION');
    });

    it('D20 (P9): la escalada pasa por EN_ESTUDIO y sigue enseguida a EN_DECISION, con el motivo y el actor sistema', function () {
        $id = t10Radicar('1000000004', 0.35, 6);

        ($this->evaluaciones)()->evaluarRadicada($id);

        $historial = DB::table('originacion_historial_estados')->where('solicitud_id', $id)
            ->orderBy('id')->get(['estado_anterior', 'estado_nuevo', 'actor_usuario_id', 'motivo']);
        $ultimos = $historial->slice(-2)->values();

        expect($ultimos[0]->estado_nuevo)->toBe('EN_ESTUDIO')
            ->and($ultimos[1]->estado_anterior)->toBe('EN_ESTUDIO')
            ->and($ultimos[1]->estado_nuevo)->toBe('EN_DECISION')
            ->and($ultimos[1]->motivo)->toBe('Concepto del analista postergado en la primera versión (P9)')
            ->and($ultimos[1]->actor_usuario_id)->toBeNull();
    });

    it('paso 4: un puntaje bajo se niega automáticamente con su causal (FA-04)', function () {
        $id = t10Radicar('1100000009', 0.35, 6);

        $r = ($this->evaluaciones)()->evaluarRadicada($id);

        expect($r['puntaje'])->toBe(320) // 600 − 160 (mora 60) + 10 − 60 (deuda 9x) − 30 − 40 (5 consultas) + 0
            ->and($r['decision_sugerida'])->toBe('negar')
            ->and($r['causal'])->toBe('comportamiento_pago')
            ->and(t10Estado($id))->toBe('NEGADA');
    });

    it('paso 5: con puntaje de aprobación, una cuota mayor al 40 % no se aprueba (RN-41)', function () {
        $id = t10Radicar('1000000008', 0.45);

        $r = ($this->evaluaciones)()->evaluarRadicada($id);

        expect($r['puntaje'])->toBe(700)
            ->and($r['capacidad_pago']['supera_limite'])->toBeTrue()
            ->and($r['decision_sugerida'])->toBe('escalar')
            ->and(t10Estado($id))->toBe('EN_DECISION');
    });

    it('paso 6: guarda puntaje, nivel, decisión, variables determinantes y las versiones aplicadas (RN-44)', function () {
        $id = t10Radicar('1000000008', 0.10);
        ($this->evaluaciones)()->evaluarRadicada($id);

        $fila = DB::table('evaluacion_evaluaciones')->where('solicitud_id', $id)->sole();
        $variables = json_decode($fila->variables_determinantes, true);

        expect($fila->version_reglas)->toBe('R-2026.10-1')
            ->and($fila->version_parametros)->toBe(ParametrosCreditoSeeder::VERSION_INICIAL)
            ->and($fila->fuente_central)->toBe('simulada')
            ->and($fila->radicado)->toStartWith('FT-')
            ->and(json_decode($fila->entradas, true))->toHaveKeys(['cuota_mensual', 'ingreso_mensual', 'mora_maxima_dias'])
            ->and($variables)->toHaveCount(count(CatalogoVariables::VARIABLES))
            ->and(array_diff(array_column($variables, 'codigo'), CatalogoVariables::codigos()))->toBe([]); // CP0014
    });

    it('la tabla de evaluaciones es de solo adición en el modelo y en la base (RN-45, RNF-08)', function () {
        $id = t10Radicar('1000000008', 0.10);
        ($this->evaluaciones)()->evaluarRadicada($id);
        $evaluacion = Evaluacion::sole();

        expect(fn () => $evaluacion->update(['puntaje' => 999]))->toThrow(LogicException::class)
            ->and(fn () => $evaluacion->delete())->toThrow(LogicException::class)
            ->and(fn () => DB::table('evaluacion_evaluaciones')->update(['puntaje' => 999]))->toThrow(QueryException::class)
            ->and(fn () => DB::table('evaluacion_evaluaciones')->delete())->toThrow(QueryException::class)
            ->and(fn () => DB::table('evaluacion_reglas')->update(['publicada_por' => 'x']))->toThrow(QueryException::class)
            ->and(fn () => DB::table('evaluacion_reglas')->delete())->toThrow(QueryException::class);
    });

    it('paso 7: concluye en menos de 10 minutos desde la radicación (RN-46)', function () {
        $id = t10Radicar('1000000008', 0.10);
        $this->travel(2)->minutes();

        $r = ($this->evaluaciones)()->evaluarRadicada($id);

        expect($r['duracion_segundos'])->toBeGreaterThanOrEqual(120)->toBeLessThan(600);
    });

    it('paso 8: reejecutar con la misma versión da el mismo resultado y las dos quedan registradas (RN-45)', function () {
        $id = t10Radicar('1000000004', 0.35, 6);
        $primera = ($this->evaluaciones)()->evaluarRadicada($id);

        // Aunque después se publique otra versión de reglas, la reejecución usa la guardada.
        DB::table('evaluacion_reglas')->insert([
            'version' => 'R-2026.11-1', 'vigente_desde' => now()->subMinute(), 'publicada_por' => 'Prueba',
            'definicion' => json_encode(['base' => 0, 'escala' => ['min' => 0, 'max' => 1000], 'variables' => [
                ['codigo' => 'antiguedad_cliente', 'tramos' => [['puntos' => 0]]]]]),
            'registrado_en' => now(),
        ]);
        $segunda = ($this->evaluaciones)()->reevaluar($primera['id']);

        expect($segunda['id'])->not->toBe($primera['id'])
            ->and($segunda['secuencia'])->toBe(2)
            ->and($segunda['puntaje'])->toBe($primera['puntaje'])
            ->and($segunda['decision_sugerida'])->toBe($primera['decision_sugerida'])
            ->and($segunda['version_reglas'])->toBe('R-2026.10-1')
            ->and($segunda['variables'])->toBe($primera['variables'])
            ->and(Evaluacion::where('solicitud_id', $id)->count())->toBe(2)
            ->and(($this->evaluaciones)()->ultima($id)['id'])->toBe($segunda['id'])
            ->and(RegistroAuditoria::where('accion', 'evaluacion.reevaluada')->sole()->detalle['mismo_resultado'])->toBeTrue()
            ->and(t10Estado($id))->toBe('EN_DECISION'); // reevaluar no mueve la solicitud
    });

    it('una versión de parámetros publicada después no cambia la evaluación: vale la de la solicitud', function () {
        $id = t10Radicar('1000000008', 0.10);
        VersionParametros::create([
            'version' => 'P-2026.11-9', 'vigente_desde' => now()->subMinute(), 'publicado_por' => 'Prueba',
            'tasa_maxima_legal_ea' => 25.8, 'umbral_aprobar' => 1000, 'umbral_negar' => 999,
            'limite_cuota_ingreso' => 5, 'productos' => ParametrosCreditoSeeder::PRODUCTOS, 'registrado_en' => now(),
        ]);

        $r = ($this->evaluaciones)()->evaluarRadicada($id);

        expect($r['version_parametros'])->toBe(ParametrosCreditoSeeder::VERSION_INICIAL)
            ->and($r['umbrales'])->toBe(['aprobar' => 700, 'negar' => 500])
            ->and($r['decision_sugerida'])->toBe('aprobar');
    });
});

describe('RF-08 FA-02 / RN-19 / MR-003 — tercero caído, sin autorización y auditoría', function () {
    it('si la central no responde tras 3 intentos, pasa a estudio manual y nunca se niega', function () {
        $id = t10Radicar('1000000010', 0.10);

        expect(($this->evaluaciones)()->evaluarRadicada($id))->toBeNull()
            ->and(t10Estado($id))->toBe('EN_DECISION')
            ->and(Evaluacion::count())->toBe(0);

        $consultas = RegistroAuditoria::where('accion', 'evaluacion.consulta_central')->get();
        expect($consultas)->toHaveCount(3)
            ->and($consultas->pluck('resultado')->unique()->all())->toBe(['fallo'])
            ->and($consultas->every(fn ($a) => $a->modo_simulado))->toBeTrue()
            ->and(RegistroAuditoria::where('accion', 'evaluacion.derivada_a_manual')->sole()->detalle)
            ->toBe(['motivo' => 'central_no_disponible']);
    });

    it('cada consulta exitosa a la central queda en la auditoría marcada como simulada', function () {
        $id = t10Radicar('1000000008', 0.10);
        ($this->evaluaciones)()->evaluarRadicada($id);

        $consulta = RegistroAuditoria::where('accion', 'evaluacion.consulta_central')->sole();
        expect($consulta->resultado)->toBe('exito')->and($consulta->modo_simulado)->toBeTrue()
            ->and(json_encode($consulta->detalle))->not->toContain('1000000008'); // RNF-06
    });

    it('sin autorización vigente de consulta a centrales no se consulta: pasa a estudio manual', function () {
        $id = t10Radicar('1000000008', 0.10);
        t10Consentimiento(app(SolicitudesPorId::class)->datosParaEvaluacion($id)['cliente_id'], Consentimiento::REVOCA);

        expect(($this->evaluaciones)()->evaluarRadicada($id))->toBeNull()
            ->and(t10Estado($id))->toBe('EN_DECISION')
            ->and(RegistroAuditoria::where('accion', 'evaluacion.consulta_central')->count())->toBe(0);
    });

    it('con SERVICIOS_EXTERNOS=real y sin central contratada, todo pasa a estudio manual', function () {
        config(['finantech.servicios_externos' => 'real']);
        $id = t10Radicar('1000000008', 0.10);

        expect(($this->evaluaciones)()->evaluarRadicada($id))->toBeNull()
            ->and(t10Estado($id))->toBe('EN_DECISION')
            ->and(RegistroAuditoria::where('accion', 'evaluacion.consulta_central')->pluck('modo_simulado')->unique()->all())
            ->toBe([false]);
    });

    it('un error inesperado del motor no rompe la radicación: la solicitud pasa a estudio manual', function () {
        $id = t10Radicar('1000000008', 0.10);
        $this->app->instance(CentralRiesgoService::class, new class implements CentralRiesgoService
        {
            public function consultar(string $tipoDocumento, string $numeroDocumento, int $ingresoMensual): array
            {
                throw new RuntimeException('falla inesperada');
            }

            public function esSimulado(): bool
            {
                return true;
            }
        });

        app(Evaluaciones::class)->evaluarRadicadaSinFallar($id);

        expect(t10Estado($id))->toBe('EN_DECISION')
            ->and(RegistroAuditoria::where('accion', 'evaluacion.derivada_a_manual')->sole()->detalle)->toBe(['motivo' => 'error_motor']);
    });

    it('si ni siquiera se puede leer la solicitud, el error se informa sin propagarse', function () {
        $this->app->instance(SolicitudesEvaluables::class, new class implements SolicitudesEvaluables
        {
            public function datos(string $solicitudId): ?array
            {
                throw new RuntimeException('sin base');
            }

            public function moverA(string $solicitudId, string $estado, ?string $motivo = null, ?int $actorId = null): void {}

            public function expediente(string $solicitudId): array
            {
                return [];
            }
        });

        app(Evaluaciones::class)->evaluarRadicadaSinFallar('9b1c0d4e-0000-4000-8000-000000000000');

        expect(Evaluacion::count())->toBe(0);
    });

    it('no evalúa una solicitud que ya no está RADICADA ni una que no existe', function () {
        $id = t10Radicar('1000000008', 0.10);
        ($this->evaluaciones)()->evaluarRadicada($id);

        expect(($this->evaluaciones)()->evaluarRadicada($id))->toBeNull()
            ->and(($this->evaluaciones)()->evaluarRadicada('9b1c0d4e-0000-4000-8000-000000000000'))->toBeNull()
            ->and(Evaluacion::count())->toBe(1)
            ->and(RegistroAuditoria::where('accion', 'evaluacion.omitida')->pluck('detalle')->all())
            ->toBe([['estado' => 'APROBADA'], ['estado' => null]]);
    });

    it('sin versión de reglas publicada no evalúa ni toca la solicitud (precondición de RF-08)', function () {
        $id = t10Radicar('1000000008', 0.10);
        DB::unprepared('DROP TRIGGER evaluacion_reglas_no_delete');
        DB::table('evaluacion_reglas')->delete();

        expect(($this->evaluaciones)()->evaluarRadicada($id))->toBeNull()
            ->and(t10Estado($id))->toBe('RADICADA')
            ->and(RegistroAuditoria::where('accion', 'evaluacion.sin_version')->sole()->resultado)->toBe('fallo');
    });

    it('los cambios de estado del motor quedan a nombre del sistema, no de quien radicó (D15)', function () {
        $id = t10Radicar('1000000008', 0.10);
        $cliente = Personas::cliente();
        $this->actingAs($cliente);

        ($this->evaluaciones)()->evaluarRadicada($id);

        $cambios = RegistroAuditoria::where('accion', 'originacion.cambio_estado')->where('id_entidad', $id)
            ->get()->filter(fn ($a) => in_array($a->detalle['hacia'], ['EN_EVALUACION', 'APROBADA'], true));
        expect($cambios)->toHaveCount(2)
            ->and($cambios->pluck('usuario_id')->unique()->all())->toBe([null])
            ->and(auth()->id())->toBe($cliente->id); // la sesión se restaura
    });
});

describe('CP0014 pasos 4-6 — pares que solo difieren en un atributo personal (RN-43, RNF-25)', function () {
    it('obtienen el mismo puntaje, la misma decisión y las mismas variables', function (array $a, array $b) {
        // Mismo perfil en la central (los dos documentos suman 9) y misma solicitud.
        $primera = ($this->evaluaciones)()->evaluarRadicada(t10Radicar('1000000008', 0.25, 18, $a));
        $segunda = ($this->evaluaciones)()->evaluarRadicada(t10Radicar('1000000017', 0.25, 18, $b));

        expect($segunda['puntaje'])->toBe($primera['puntaje'])
            ->and($segunda['decision_sugerida'])->toBe($primera['decision_sugerida'])
            ->and($segunda['variables'])->toBe($primera['variables']);
    })->with([
        'nombre que sugiere el sexo' => [['nombres' => 'María Fernanda'], ['nombres' => 'Mario Fernando']],
        'edad' => [['fecha_nacimiento' => now()->subYears(22)->toDateString()], ['fecha_nacimiento' => now()->subYears(61)->toDateString()]],
        'apellidos de origen distinto' => [['apellidos' => 'Mosquera Palacios'], ['apellidos' => 'Müller Schmidt']],
    ]);
});

describe('GET evaluacion/solicitudes/{id}/evaluacion (UC7, UC10, RNF-05)', function () {
    it('401 sin sesión, 403 al cliente y 200 con version_reglas a analista y oficial', function () {
        $id = t10Radicar('1000000008', 0.10);
        ($this->evaluaciones)()->evaluarRadicada($id);
        $url = "/api/v1/evaluacion/solicitudes/{$id}/evaluacion";

        $this->getJson($url)->assertUnauthorized();
        $this->actingAs(Personas::cliente(['estado_kyc' => 'verificado']))->getJson($url)->assertForbidden();

        foreach ([Rol::ANALISTA, Rol::OFICIAL] as $rol) {
            $this->actingAs(Personas::interno($rol))->getJson($url)
                ->assertOk()
                ->assertJsonPath('version_reglas', 'R-2026.10-1')
                ->assertJsonPath('fuente_central', 'simulada')
                ->assertJsonStructure(['id', 'puntaje', 'escala_min', 'escala_max', 'nivel_riesgo', 'decision_sugerida',
                    'umbrales' => ['aprobar', 'negar'], 'evaluada_en', 'duracion_segundos',
                    'variables' => [['codigo', 'nombre', 'valor', 'contribucion']],
                    'capacidad_pago' => ['cuota_estimada', 'ingreso_disponible', 'porcentaje', 'limite', 'supera_limite']]);
        }
    });

    it('404 sin_evaluacion si la solicitud no tiene evaluación, y 404 genérico con un id inválido', function () {
        $this->actingAs(Personas::interno(Rol::ANALISTA));

        $this->getJson('/api/v1/evaluacion/solicitudes/9b1c0d4e-0000-4000-8000-000000000000/evaluacion')
            ->assertNotFound()->assertJsonPath('codigo', 'sin_evaluacion');
        $this->getJson('/api/v1/evaluacion/solicitudes/no-es-un-id/evaluacion')
            ->assertNotFound()->assertJsonPath('codigo', 'no_encontrado');
    });
});
