<?php

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Modules\Originacion\Enums\EstadoSolicitud as E;
use App\Modules\Originacion\Events\SolicitudRadicada;
use App\Modules\Originacion\Models\HistorialEstado;
use App\Modules\Originacion\Models\Solicitud;
use App\Modules\Originacion\Services\GeneradorRadicado;
use App\Modules\Originacion\Services\Solicitudes;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Process;
use Illuminate\Process\Pool;

/** Doble del directorio de clientes mientras Identidad publica su servicio (T02). */
class DirectorioClientesFalso implements DirectorioClientes
{
    /** @var list<int> */
    public array $sinVerificar = [];

    /** @var list<int> */
    public array $sinConsentimientoCentrales = [];

    public function identidadVerificada(int $clienteId): bool
    {
        return ! in_array($clienteId, $this->sinVerificar, true);
    }

    public function consienteConsultaCentrales(int $clienteId): bool
    {
        return ! in_array($clienteId, $this->sinConsentimientoCentrales, true);
    }

    public function datosConocidos(int $clienteId): array
    {
        return [
            'nombre_completo' => 'Cliente Sintético', 'documento_enmascarado' => '•••• 1234',
            'fecha_nacimiento' => '1990-01-01', 'email' => 'cliente@example.com', 'telefono_enmascarado' => '•••• 5678',
        ];
    }
}

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    $this->directorio = new DirectorioClientesFalso;
    $this->app->instance(DirectorioClientes::class, $this->directorio);
    $this->solicitudes = app(Solicitudes::class);
});

/** Lleva una solicitud por una ruta de estados válida. */
function llevar(Solicitud $solicitud, E ...$estados): Solicitud
{
    foreach ($estados as $estado) {
        $estado === E::RADICADA && $solicitud->estado === E::BORRADOR
            ? app(Solicitudes::class)->radicar($solicitud)
            : app(Solicitudes::class)->transicionar($solicitud, $estado);
    }

    return $solicitud;
}

describe('borrador de solicitud (RF-06)', function () {
    it('crea la solicitud en BORRADOR con la tasa, la cuota y la versión de parámetros vigentes', function () {
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);

        expect($s->estado)->toBe(E::BORRADOR)
            ->and($s->radicado)->toBeNull()
            ->and($s->tasa_ea)->toBe(18.9)
            ->and($s->cuota_estimada)->toBe(252_762)          // la misma cuota que mostró el simulador
            ->and($s->version_parametros)->toBe(ParametrosCreditoSeeder::VERSION_INICIAL)
            ->and($s->acepta_consulta_centrales)->toBeTrue()
            ->and($s->historial()->pluck('estado_nuevo')->all())->toBe([E::BORRADOR]);

        expect(RegistroAuditoria::where('accion', 'originacion.borrador_creado')->where('id_entidad', $s->id)->exists())->toBeTrue();
    });

    it('lleva monto y plazo al rango del producto (RF-05 FA-01)', function () {
        $s = $this->solicitudes->crearBorrador(10, 'tecnologia_hogar', 90_000_000, 2);

        expect($s->monto)->toBe(8_000_000)->and($s->plazo_meses)->toBe(6);
    });

    it('no admite un producto que no existe', function () {
        $this->solicitudes->crearBorrador(10, 'hipotecario', 5_000_000, 24);
    })->throws(ErrorNegocio::class, 'Elige uno de los productos disponibles.');

    it('no se crea sin identidad verificada (RN-07)', function () {
        $this->directorio->sinVerificar = [10];

        try {
            $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);
            $this->fail('Debió rechazarse');
        } catch (ErrorNegocio $e) {
            expect($e->codigo)->toBe('identidad_no_verificada')->and($e->estadoHttp)->toBe(409);
        }
        expect(Solicitud::count())->toBe(0);
    });

    it('reutiliza los datos laborales, financieros y la referencia de la última solicitud (RN-32)', function () {
        $primera = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);
        $primera->update([
            'ocupacion' => 'empleado', 'empleador' => 'Empresa Sintética S.A.S.', 'antiguedad_laboral_meses' => 30,
            'ingreso_mensual' => 4_500_000, 'egreso_mensual' => 1_200_000,
            'referencia_nombre' => 'Persona de Referencia', 'referencia_celular' => '3009998877',
        ]);

        $segunda = $this->solicitudes->crearBorrador(10, 'libranza', 10_000_000, 36);

        expect($segunda->only(['ocupacion', 'empleador', 'antiguedad_laboral_meses', 'ingreso_mensual', 'egreso_mensual', 'referencia_nombre', 'referencia_celular']))
            ->toBe([
                'ocupacion' => 'empleado', 'empleador' => 'Empresa Sintética S.A.S.', 'antiguedad_laboral_meses' => 30,
                'ingreso_mensual' => 4_500_000, 'egreso_mensual' => 1_200_000,
                'referencia_nombre' => 'Persona de Referencia', 'referencia_celular' => '3009998877',
            ]);
    });

    it('guarda la referencia personal cifrada en reposo', function () {
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);
        $s->update(['referencia_nombre' => 'Persona de Referencia', 'referencia_celular' => '3009998877']);

        $crudo = DB::table('originacion_solicitudes')->where('id', $s->id)->first();
        expect($crudo->referencia_celular)->not->toContain('3009998877')
            ->and($crudo->referencia_nombre)->not->toContain('Referencia');
    });

    it('toma el consentimiento de consulta a centrales del directorio de clientes (RN-33)', function () {
        $this->directorio->sinConsentimientoCentrales = [10];

        expect($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24)->acepta_consulta_centrales)->toBeFalse();
    });
});

describe('una sola solicitud activa por producto (RN-28, RF-06 FA-03)', function () {
    it('rechaza una segunda solicitud activa del mismo producto e indica cuál es la activa', function () {
        $activa = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);

        try {
            $this->solicitudes->crearBorrador(10, 'libre_inversion', 3_000_000, 12);
            $this->fail('Debió rechazarse');
        } catch (ErrorNegocio $e) {
            expect($e->codigo)->toBe('solicitud_activa')
                ->and($e->estadoHttp)->toBe(409)
                ->and($e->datos)->toBe(['solicitud_id' => $activa->id, 'estado' => 'BORRADOR'])
                ->and($e->getMessage())->toBe('Ya tienes una solicitud de libre inversión en curso. Puedes seguirla desde tus solicitudes.');
        }
    });

    it('la regla sigue mientras la solicitud avanza por estados activos', function () {
        llevar($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24), E::RADICADA, E::EN_EVALUACION, E::APROBADA);

        $this->solicitudes->crearBorrador(10, 'libre_inversion', 3_000_000, 12);
    })->throws(ErrorNegocio::class, 'en curso');

    it('permite otro producto y permite a otro cliente el mismo producto', function () {
        $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);

        expect($this->solicitudes->crearBorrador(10, 'libranza', 5_000_000, 24)->estado)->toBe(E::BORRADOR)
            ->and($this->solicitudes->crearBorrador(11, 'libre_inversion', 5_000_000, 24)->estado)->toBe(E::BORRADOR);
    });

    it('al cerrarse la solicitud el producto queda libre', function (array $ruta) {
        llevar($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24), ...$ruta);

        expect($this->solicitudes->crearBorrador(10, 'libre_inversion', 3_000_000, 12)->estado)->toBe(E::BORRADOR);
    })->with([
        'desistida' => [[E::DESISTIDA]],
        'negada' => [[E::RADICADA, E::EN_EVALUACION, E::NEGADA]],
        'oferta vencida' => [[E::RADICADA, E::EN_EVALUACION, E::APROBADA, E::OFERTA_VENCIDA]],
        'formalizada' => [[E::RADICADA, E::EN_EVALUACION, E::APROBADA, E::OFERTA_ACEPTADA, E::FORMALIZADA]],
    ]);

    it('no se reabre una negada por reconsideración si ya hay otra activa del mismo producto', function () {
        $negada = llevar($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24), E::RADICADA, E::EN_EVALUACION, E::NEGADA);
        $this->solicitudes->crearBorrador(10, 'libre_inversion', 3_000_000, 12);

        try {
            $this->solicitudes->transicionar($negada, E::EN_ESTUDIO);
            $this->fail('Debió rechazarse');
        } catch (ErrorNegocio $e) {
            expect($e->codigo)->toBe('solicitud_activa');
        }
        expect($negada->fresh()->estado)->toBe(E::NEGADA);
    });

    it('la base de datos impone la regla aunque se salte el servicio', function () {
        $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);

        Solicitud::create([
            'cliente_id' => 10, 'producto_codigo' => 'libre_inversion', 'monto' => 1_000_000, 'plazo_meses' => 12,
            'version_parametros' => 'P-2026.10-1', 'tasa_ea' => 18.9, 'cuota_estimada' => 1, 'estado' => E::BORRADOR,
            'clave_activa' => Solicitud::claveActiva(10, 'libre_inversion'),
        ]);
    })->throws(UniqueConstraintViolationException::class);
});

describe('radicación y radicado (RN-29, RF-06 paso 8)', function () {
    it('asigna radicados FT-AAAA-NNNNNN únicos y consecutivos', function () {
        Carbon::setTestNow('2026-11-01 15:00:00');

        $radicados = collect(range(10, 13))->map(
            fn (int $cliente) => $this->solicitudes->radicar($this->solicitudes->crearBorrador($cliente, 'libre_inversion', 5_000_000, 24))->radicado,
        );

        expect($radicados->all())->toBe(['FT-2026-000001', 'FT-2026-000002', 'FT-2026-000003', 'FT-2026-000004']);
    });

    it('reinicia la secuencia cada año, con el año de Colombia', function () {
        $generador = app(GeneradorRadicado::class);

        // 31/12/2026 a las 11:30 p. m. en Bogotá ya es 01/01/2027 en UTC: sigue siendo 2026.
        expect($generador->siguiente(Carbon::parse('2027-01-01 04:30:00', 'UTC')))->toBe('FT-2026-000001')
            ->and($generador->siguiente(Carbon::parse('2027-01-01 05:30:00', 'UTC')))->toBe('FT-2027-000001')
            ->and($generador->siguiente(Carbon::parse('2026-06-01 12:00:00', 'UTC')))->toBe('FT-2026-000002')
            ->and($generador->siguiente(Carbon::parse('2027-03-01 12:00:00', 'UTC')))->toBe('FT-2027-000002');
    });

    it('no reutiliza un número aunque la solicitud se cierre', function () {
        Carbon::setTestNow('2026-11-01 15:00:00');
        $primera = $this->solicitudes->radicar($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24));
        llevar($primera, E::EN_EVALUACION, E::NEGADA);

        $segunda = $this->solicitudes->radicar($this->solicitudes->crearBorrador(10, 'libre_inversion', 3_000_000, 12));

        expect($primera->fresh()->radicado)->toBe('FT-2026-000001')
            ->and($segunda->radicado)->toBe('FT-2026-000002');
    });

    it('pasa a RADICADA, deja el hito y publica el evento con solo identificadores y valores', function () {
        Event::fake([SolicitudRadicada::class]);

        $s = $this->solicitudes->radicar($this->solicitudes->crearBorrador(10, 'libranza', 12_000_000, 36), actorId: 99);

        expect($s->estado)->toBe(E::RADICADA)
            ->and($s->radicada_en)->not->toBeNull()
            ->and($s->clave_activa)->toBe('10:libranza')
            ->and($s->historial()->pluck('estado_nuevo')->all())->toBe([E::BORRADOR, E::RADICADA])
            ->and($s->historial()->get()->last()->actor_usuario_id)->toBe(99);

        Event::assertDispatched(SolicitudRadicada::class, fn (SolicitudRadicada $e) => $e->solicitudId === $s->id
            && $e->radicado === $s->radicado
            && $e->clienteId === 10
            && $e->producto === 'libranza'
            && $e->monto === 12_000_000
            && $e->plazoMeses === 36
            && $e->versionParametros === ParametrosCreditoSeeder::VERSION_INICIAL);
    });

    it('exige la aceptación de la consulta a centrales (RN-33)', function () {
        $this->directorio->sinConsentimientoCentrales = [10];
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);

        try {
            $this->solicitudes->radicar($s);
            $this->fail('Debió rechazarse');
        } catch (ErrorNegocio $e) {
            expect($e->codigo)->toBe('consulta_centrales_requerida');
        }
        expect($s->fresh()->estado)->toBe(E::BORRADOR)->and($s->fresh()->radicado)->toBeNull();
    });

    it('radicaciones simultáneas en procesos distintos nunca repiten número', function () {
        // Cada proceso es una conexión propia a MySQL que confirma sus transacciones, como
        // dos peticiones reales. Se usa un año ficticio para no tocar las secuencias de la prueba.
        $script = <<<'PHP'
            require 'vendor/autoload.php';
            $app = require 'bootstrap/app.php';
            $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
            $generador = $app->make(App\Modules\Originacion\Services\GeneradorRadicado::class);
            $numeros = [];
            for ($i = 0; $i < 5; $i++) {
                $numeros[] = $generador->siguiente(Carbon\Carbon::create(2999, 6, 1, 12));
            }
            echo implode(',', $numeros);
        PHP;
        $entorno = ['DB_DATABASE' => config('database.connections.mysql.database'), 'APP_ENV' => 'testing'];
        config(['database.connections.auxiliar' => config('database.connections.mysql')]);

        try {
            $resultados = Process::pool(function (Pool $pool) use ($script, $entorno) {
                foreach (range(1, 4) as $_) {
                    $pool->path(base_path())->env($entorno)->timeout(240)->command(['php', '-r', $script]);
                }
            })->start()->wait();

            $radicados = $resultados->collect()
                ->each(fn ($r) => $r->successful() || throw new RuntimeException('Un proceso falló: '.$r->errorOutput().$r->output()))
                ->flatMap(fn ($r) => explode(',', trim($r->output())));

            expect($radicados)->toHaveCount(20)
                ->and($radicados->unique())->toHaveCount(20)
                ->and($radicados->sort()->values()->all())
                ->toBe(array_map(fn (int $n) => sprintf('FT-2999-%06d', $n), range(1, 20)));
        } finally {
            // Lo que escribieron los procesos quedó confirmado: se limpia por fuera de la transacción de la prueba.
            DB::connection('auxiliar')->table('originacion_secuencias_radicado')->where('anio', 2999)->delete();
        }
    });

    it('vuelve a exigir la identidad verificada al radicar (RN-07)', function () {
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);
        $this->directorio->sinVerificar = [10];

        $this->solicitudes->radicar($s);
    })->throws(ErrorNegocio::class, 'verificar tu identidad');

    it('no radica dos veces la misma solicitud ni consume otro número', function () {
        Carbon::setTestNow('2026-11-01 15:00:00');
        $s = $this->solicitudes->radicar($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24));

        expect(fn () => $this->solicitudes->radicar($s))->toThrow(ErrorNegocio::class);
        expect($s->fresh()->radicado)->toBe('FT-2026-000001')
            ->and(DB::table('originacion_secuencias_radicado')->where('anio', 2026)->value('ultimo'))->toEqual(1);
    });

    it('al volver de PENDIENTE_CLIENTE conserva el mismo radicado', function () {
        $s = llevar($this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24), E::RADICADA, E::PENDIENTE_CLIENTE);
        $radicado = $s->radicado;

        $this->solicitudes->transicionar($s, E::RADICADA);

        expect($s->estado)->toBe(E::RADICADA)->and($s->radicado)->toBe($radicado);
    });
});

describe('cambios de estado (E3, RF-07)', function () {
    it('recorre el camino feliz hasta FORMALIZADA dejando un hito por estado', function () {
        $s = llevar(
            $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24),
            E::RADICADA, E::EN_EVALUACION, E::EN_ESTUDIO, E::EN_DECISION, E::EN_COMITE,
            E::APROBADA_CONDICIONADA, E::OFERTA_ACEPTADA, E::FORMALIZADA,
        );

        expect($s->fresh()->estado)->toBe(E::FORMALIZADA)
            ->and($s->fresh()->clave_activa)->toBeNull()
            ->and($s->historial()->count())->toBe(9);
    });

    it('rechaza una transición que no está en la tabla, no cambia nada y la audita', function () {
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);

        try {
            $this->solicitudes->transicionar($s, E::APROBADA, actorId: 7);
            $this->fail('Debió rechazarse');
        } catch (ErrorNegocio $e) {
            expect($e->codigo)->toBe('transicion_invalida')->and($e->estadoHttp)->toBe(409);
        }

        expect($s->fresh()->estado)->toBe(E::BORRADOR)
            ->and($s->historial()->count())->toBe(1)
            ->and(RegistroAuditoria::where('accion', 'originacion.transicion_rechazada')->where('id_entidad', $s->id)->first()?->detalle)
            ->toBe(['desde' => 'BORRADOR', 'hacia' => 'APROBADA']);
    });

    it('decide con el estado de la base y no con una copia vieja en memoria', function () {
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);
        $copiaVieja = Solicitud::findOrFail($s->id);
        $this->solicitudes->transicionar($s, E::DESISTIDA);

        // La copia aún dice BORRADOR, pero en la base ya es DESISTIDA (terminal).
        expect(fn () => $this->solicitudes->transicionar($copiaVieja, E::RADICADA))->toThrow(ErrorNegocio::class);
    });

    it('guarda el motivo y el actor de cada cambio', function () {
        $s = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24);
        $this->solicitudes->transicionar($s, E::DESISTIDA, actorId: 10, motivo: 'El cliente desistió del trámite.');

        $hito = $s->historial()->get()->last();
        expect($hito->estado_anterior)->toBe(E::BORRADOR)
            ->and($hito->estado_nuevo)->toBe(E::DESISTIDA)
            ->and($hito->actor_usuario_id)->toBe(10)
            ->and($hito->motivo)->toBe('El cliente desistió del trámite.');
    });

    it('el historial de estados es de solo adición en el modelo y en la base de datos', function () {
        $hito = $this->solicitudes->crearBorrador(10, 'libre_inversion', 5_000_000, 24)->historial()->first();

        expect(fn () => $hito->update(['motivo' => 'x']))->toThrow(LogicException::class)
            ->and(fn () => $hito->delete())->toThrow(LogicException::class)
            ->and(fn () => DB::table('originacion_historial_estados')->update(['motivo' => 'x']))->toThrow(Illuminate\Database\QueryException::class, 'solo adicion')
            ->and(fn () => DB::table('originacion_historial_estados')->delete())->toThrow(Illuminate\Database\QueryException::class, 'solo adicion');
    });
});
