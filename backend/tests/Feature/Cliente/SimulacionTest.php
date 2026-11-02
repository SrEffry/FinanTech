<?php

use App\Modules\Cliente\Models\Simulacion;
use App\Modules\Cliente\Services\CalculadoraCredito;
use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Models\VersionParametros;
use Illuminate\Support\Carbon;

beforeEach(fn () => $this->seed(ParametrosCreditoSeeder::class));

function simular(array $cambios = []): Illuminate\Testing\TestResponse
{
    return test()->postJson('/api/v1/cliente/simulaciones', array_merge([
        'producto' => 'libre_inversion',
        'monto' => 5_000_000,
        'plazo_meses' => 24,
    ], $cambios));
}

describe('catálogo de productos (RF-05)', function () {
    it('es público y devuelve los productos de la versión vigente con la forma del contrato', function () {
        $respuesta = $this->getJson('/api/v1/cliente/productos')->assertOk();

        expect($respuesta->json())->toHaveCount(count(ParametrosCreditoSeeder::PRODUCTOS))
            ->and($respuesta->json('0'))->toBe([
                'tasa_ea' => 18.9,
                'codigo' => 'libre_inversion',
                'nombre' => 'Libre inversión',
                'descripcion' => 'Para lo que necesites, sin justificar el uso del dinero.',
                'monto_min' => 1_000_000,
                'monto_max' => 50_000_000,
                'plazo_min' => 12,
                'plazo_max' => 60,
                'paso_monto' => 100_000,
            ]);
    });

    it('nunca anuncia una tasa por encima de la máxima legal (RN-23)', function () {
        VersionParametros::create([
            'version' => 'P-2026.11-1', 'vigente_desde' => now()->subMinute(), 'publicado_por' => 'Prueba',
            'tasa_maxima_legal_ea' => 20, 'umbral_aprobar' => 700, 'umbral_negar' => 500, 'limite_cuota_ingreso' => 40,
            'productos' => ParametrosCreditoSeeder::PRODUCTOS, 'registrado_en' => now(),
        ]);

        $tasas = collect($this->getJson('/api/v1/cliente/productos')->json())->pluck('tasa_ea', 'codigo');

        expect($tasas->max())->toBeLessThanOrEqual(20.0)
            ->and($tasas['viajes'])->toEqual(20.0)  // 22,6 % queda en el tope
            ->and($tasas['libranza'])->toBe(14.9);  // las que ya estaban por debajo no cambian
    });

    it('responde con un mensaje claro si todavía no hay parámetros publicados', function () {
        Carbon::setTestNow('2026-08-01 12:00:00'); // antes de la primera versión sembrada

        $this->getJson('/api/v1/cliente/productos')
            ->assertStatus(503)
            ->assertJsonPath('codigo', 'parametros_no_disponibles');
    });
});

describe('CP0011 — simulación transparente (RF-05, RN-23, RN-24, RN-26)', function () {
    it('es pública y devuelve la simulación completa con la forma del contrato', function () {
        simular()->assertOk()->assertJsonStructure([
            'id', 'producto' => ['codigo', 'nombre'], 'monto', 'plazo_meses', 'tasa_ea', 'tasa_mensual',
            'cuota', 'costo_total', 'total_a_pagar', 'valor_a_recibir', 'desglose' => [['concepto', 'descripcion', 'valor']],
            'plan' => [['numero', 'fecha', 'cuota', 'capital', 'interes', 'seguro', 'saldo']],
            'tasa_maxima_legal_ea', 'vigente_hasta',
        ])->assertJsonPath('producto.nombre', 'Libre inversión');
    });

    it('la suma del desglose es igual al costo total y el plan amortiza todo el monto', function (string $producto, int $monto, int $plazo) {
        $s = simular(['producto' => $producto, 'monto' => $monto, 'plazo_meses' => $plazo])->assertOk()->json();

        expect(array_sum(array_column($s['desglose'], 'valor')))->toBe($s['costo_total'])
            ->and($s['total_a_pagar'])->toBe($s['monto'] + $s['costo_total'])
            ->and(array_sum(array_column($s['plan'], 'capital')))->toBe($monto)
            ->and(end($s['plan'])['saldo'])->toBe(0)
            ->and($s['plan'])->toHaveCount($plazo)
            // Pagado en cuotas + estudio de crédito = monto + costo total: no hay costos ocultos (RN-24).
            ->and(array_sum(array_column($s['plan'], 'cuota')) + $s['desglose'][2]['valor'])->toBe($s['total_a_pagar']);
    })->with([
        'libre inversión mínimo' => ['libre_inversion', 1_000_000, 12],
        'libre inversión típico' => ['libre_inversion', 5_000_000, 24],
        'libranza máximo' => ['libranza', 80_000_000, 72],
        'tecnología corto' => ['tecnologia_hogar', 500_000, 6],
        'viajes' => ['viajes', 7_300_000, 31],
    ]);

    it('desglosa intereses, seguro y estudio de crédito (RN-24)', function () {
        $conceptos = array_column(simular()->json('desglose'), 'concepto');

        expect($conceptos)->toBe(['Intereses', 'Seguro de vida deudor', 'Estudio de crédito']);
    });

    it('dice cuánto recibe el cliente después de descontar el estudio de crédito (UX-15, RNF-20)', function () {
        $s = simular(['monto' => 5_000_000])->json();

        expect($s['valor_a_recibir'])->toBe(4_925_000)
            ->and($s['valor_a_recibir'])->toBe($s['monto'] - $s['desglose'][2]['valor']);
    });

    it('calcula lo mismo que la referencia del portal (frontend/src/mocks/calculos.ts)', function () {
        Carbon::setTestNow('2026-11-01 12:00:00');

        $s = simular()->assertOk()->json();

        // Valores obtenidos de calcularCredito(18.9, 5_000_000, 24, 25.8) en el portal.
        expect($s['cuota'])->toBe(252_762)
            ->and($s['costo_total'])->toBe(1_141_283)
            ->and($s['tasa_ea'])->toBe(18.9)
            ->and($s['tasa_mensual'])->toBe(1.4531)
            ->and(array_column($s['desglose'], 'valor'))->toBe([958_283, 108_000, 75_000])
            ->and($s['plan'][0])->toMatchArray(['capital' => 175_609, 'interes' => 72_653, 'seguro' => 4_500, 'saldo' => 4_824_391])
            ->and($s['plan'][23])->toMatchArray(['cuota' => 252_757, 'capital' => 244_701, 'interes' => 3_556, 'saldo' => 0])
            ->and(Carbon::parse($s['plan'][0]['fecha'])->toDateString())->toBe('2026-12-01');
    });

    it('nunca aplica una tasa mayor a la máxima legal (RN-23)', function () {
        $credito = app(CalculadoraCredito::class)->calcular(30.0, 1_000_000, 12, 25.8, now());

        expect($credito['tasa_ea'])->toBe(25.8)
            ->and($credito['cuota'])->toBe(95_060)           // referencia del portal con el tope aplicado
            ->and($credito['costo_total'])->toBe(200_720);

        $s = simular(['producto' => 'viajes', 'monto' => 2_000_000, 'plazo_meses' => 12])->json();
        expect($s['tasa_ea'])->toBeLessThanOrEqual($s['tasa_maxima_legal_ea']);
    });

    it('cobra el estudio de crédito dentro de su mínimo y su máximo', function () {
        $calculadora = app(CalculadoraCredito::class);

        expect($calculadora->valorEstudio(1_000_000))->toBe(60_000)
            ->and($calculadora->valorEstudio(10_000_000))->toBe(150_000)
            ->and($calculadora->valorEstudio(80_000_000))->toBe(450_000);
    });

    it('conserva la simulación 30 días con la versión de parámetros que usó (RN-26)', function () {
        Carbon::setTestNow('2026-11-01 12:00:00');

        $s = simular()->json();
        $guardada = Simulacion::findOrFail($s['id']);

        expect($guardada->version_parametros)->toBe(ParametrosCreditoSeeder::VERSION_INICIAL)
            ->and($guardada->cuota)->toBe($s['cuota'])
            ->and($guardada->costo_total)->toBe($s['costo_total'])
            ->and($guardada->usuario_id)->toBeNull()
            ->and($guardada->vigente_hasta->toDateString())->toBe('2026-12-01')
            ->and(Carbon::parse($s['vigente_hasta'])->toDateString())->toBe('2026-12-01');

        Carbon::setTestNow('2026-12-02 12:00:00');
        $this->artisan('model:prune', ['--model' => [Simulacion::class]])->assertSuccessful();

        expect(Simulacion::find($s['id']))->toBeNull();
    });
});

describe('rangos y errores (RF-05 FA-01)', function () {
    it('informa el rango del monto cuando está por fuera', function (int $monto) {
        simular(['monto' => $monto])
            ->assertStatus(422)
            ->assertJsonPath('codigo', 'fuera_de_rango')
            ->assertJsonPath('mensaje', 'El monto debe estar entre $1.000.000 y $50.000.000.')
            ->assertJsonPath('datos', ['campo' => 'monto', 'minimo' => 1_000_000, 'maximo' => 50_000_000]);
    })->with([999_999, 50_000_001]);

    it('informa el rango del plazo cuando está por fuera', function (int $plazo) {
        simular(['plazo_meses' => $plazo])
            ->assertStatus(422)
            ->assertJsonPath('codigo', 'fuera_de_rango')
            ->assertJsonPath('mensaje', 'El plazo debe estar entre 12 y 60 meses.')
            ->assertJsonPath('datos', ['campo' => 'plazo_meses', 'minimo' => 12, 'maximo' => 60]);
    })->with([11, 61]);

    it('acepta los extremos del rango', function () {
        simular(['monto' => 1_000_000, 'plazo_meses' => 12])->assertOk();
        simular(['monto' => 50_000_000, 'plazo_meses' => 60])->assertOk();
    });

    it('rechaza un producto que no existe', function () {
        simular(['producto' => 'hipotecario'])
            ->assertStatus(422)
            ->assertJsonPath('codigo', 'producto_invalido')
            ->assertJsonPath('mensaje', 'Elige uno de los productos disponibles.');

        expect(Simulacion::count())->toBe(0);
    });

    it('valida la forma de la petición con mensajes en español', function () {
        $this->postJson('/api/v1/cliente/simulaciones', ['producto' => 'libre_inversion', 'monto' => 'mucho'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['monto', 'plazo_meses'])
            ->assertJsonPath('errors.monto.0', 'El monto debe ser un número entero.')
            ->assertJsonPath('errors.plazo_meses.0', 'El plazo es obligatorio.');
    });

    it('tiene su propio límite de peticiones, independiente del registro', function () {
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/v1/cliente/productos')->assertOk();
        }
        $this->getJson('/api/v1/cliente/productos')->assertStatus(429);

        // El contador del simulador no consume el del registro (throttle con prefijo propio).
        $this->postJson('/api/v1/clientes/registro', [])->assertStatus(422);
    });
});
