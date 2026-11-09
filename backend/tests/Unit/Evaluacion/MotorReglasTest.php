<?php

/*
 * T10 — Motor de reglas como función pura (RF-08, RN-40, RN-41, RN-43, RN-44; CP0013, CP0014).
 * Sin base de datos: la definición de reglas y la política se pasan como arreglos.
 */

use App\Modules\Evaluacion\Adapters\CentralRiesgoNoContratada;
use App\Modules\Evaluacion\Adapters\CentralRiesgoSimulada;
use App\Modules\Evaluacion\Contracts\CentralNoDisponible;
use App\Modules\Evaluacion\Database\Seeders\ReglasMotorSeeder;
use App\Modules\Evaluacion\Motor\CatalogoVariables;
use App\Modules\Evaluacion\Motor\EntradaEvaluacion;
use App\Modules\Evaluacion\Motor\MotorReglas;

const T10_POLITICA = ['umbral_aprobar' => 700, 'umbral_negar' => 500, 'limite_cuota_ingreso' => 40.0];

/** Entrada sintética: por omisión, un perfil excelente (mora 0, cuota 10 %, 3 años de trabajo). */
function t10Entrada(array $cambios = []): EntradaEvaluacion
{
    return EntradaEvaluacion::desdeArray(array_merge([
        'cuota_mensual' => 300_000,
        'ingreso_mensual' => 3_000_000,
        'egreso_mensual' => 0,
        'antiguedad_laboral_meses' => 36,
        'meses_como_cliente' => 12,
        'mora_maxima_dias' => 0,
        'saldo_total' => 3_000_000,
        'obligaciones_vigentes' => 1,
        'consultas_ultimos_6_meses' => 1,
    ], $cambios));
}

/** Definición con una sola variable que no suma ni resta: el puntaje es la base. */
function t10DefinicionFija(int $base): array
{
    return [
        'base' => $base,
        'escala' => ['min' => 0, 'max' => 1000],
        'variables' => [['codigo' => 'antiguedad_cliente', 'tramos' => [['puntos' => 0]]]],
    ];
}

function t10Evaluar(EntradaEvaluacion $entrada, ?array $definicion = null, array $politica = T10_POLITICA): array
{
    return (new MotorReglas)->evaluar($entrada, $definicion ?? ReglasMotorSeeder::DEFINICION_INICIAL, $politica);
}

describe('RN-40 — clasificación por puntaje con los umbrales de la política', function () {
    it('clasifica en los límites exactos: 700 aprueba, 699 y 500 escalan, 499 niega', function (int $puntaje, string $decision, string $riesgo) {
        $resultado = t10Evaluar(t10Entrada(), t10DefinicionFija($puntaje));

        expect($resultado['puntaje'])->toBe($puntaje)
            ->and($resultado['decision_sugerida'])->toBe($decision)
            ->and($resultado['nivel_riesgo'])->toBe($riesgo);
    })->with([
        [1000, 'aprobar', 'bajo'], [700, 'aprobar', 'bajo'], [699, 'escalar', 'medio'],
        [500, 'escalar', 'medio'], [499, 'negar', 'alto'], [0, 'negar', 'alto'],
    ]);

    it('los umbrales salen de la política, no del código', function () {
        $politica = ['umbral_aprobar' => 800, 'umbral_negar' => 600, 'limite_cuota_ingreso' => 40.0];

        expect(t10Evaluar(t10Entrada(), t10DefinicionFija(750), $politica)['decision_sugerida'])->toBe('escalar')
            ->and(t10Evaluar(t10Entrada(), t10DefinicionFija(599), $politica)['decision_sugerida'])->toBe('negar')
            ->and(t10Evaluar(t10Entrada(), t10DefinicionFija(750), $politica)['umbrales'])->toBe(['aprobar' => 800, 'negar' => 600]);
    });

    it('un perfil excelente con las reglas R-2026.10-1 suma lo mismo que el portal simulado', function () {
        $r = t10Evaluar(t10Entrada());

        // 600 + 140 (al día) + 110 (cuota 10 %) + 50 (deuda 1x) + 60 (36 meses) + 20 (1 consulta) + 20 (12 meses)
        expect($r['puntaje'])->toBe(1000)->and($r['decision_sugerida'])->toBe('aprobar')->and($r['causal'])->toBeNull();
    });

    it('niega con la causal de la variable que más restó (RF-08 FA-04)', function () {
        $r = t10Evaluar(t10Entrada([
            'mora_maxima_dias' => 90, 'consultas_ultimos_6_meses' => 6, 'antiguedad_laboral_meses' => 3, 'meses_como_cliente' => 0,
        ]));

        // 600 − 160 + 110 + 50 − 30 − 40 + 0 = 530 → escalar; con cuota alta baja a negar.
        expect($r['puntaje'])->toBe(530)->and($r['decision_sugerida'])->toBe('escalar');

        $negada = t10Evaluar(t10Entrada([
            'mora_maxima_dias' => 90, 'consultas_ultimos_6_meses' => 6, 'antiguedad_laboral_meses' => 3,
            'meses_como_cliente' => 0, 'cuota_mensual' => 1_350_000,
        ]));
        // 600 − 160 − 170 + 50 − 30 − 40 + 0 = 250
        expect($negada['decision_sugerida'])->toBe('negar')
            ->and($negada['causal'])->toBe('cuota_ingreso') // −170 pesa más que −160
            ->and($negada['nivel_riesgo'])->toBe('alto');
    });

    it('acota el puntaje a la escala', function () {
        expect(t10Evaluar(t10Entrada(), t10DefinicionFija(1500))['puntaje'])->toBe(1000)
            ->and(t10Evaluar(t10Entrada(), t10DefinicionFija(-20))['puntaje'])->toBe(0);
    });
});

describe('RN-41 — la cuota no supera el 40 % del ingreso disponible', function () {
    it('con puntaje de aprobación y la cuota por encima del límite, no aprueba: escala con su causal', function () {
        $r = t10Evaluar(t10Entrada(['cuota_mensual' => 1_350_000, 'meses_como_cliente' => 0])); // 45 %

        // 600 + 140 − 170 + 50 + 60 + 20 + 0 = 700: aprobaría por puntaje.
        expect($r['puntaje'])->toBe(700)
            ->and($r['capacidad_pago']['supera_limite'])->toBeTrue()
            ->and($r['decision_sugerida'])->toBe('escalar')
            ->and($r['causal'])->toBe(MotorReglas::CAUSAL_CUOTA_SUPERA_LIMITE);
    });

    it('calcula la capacidad de pago sobre el ingreso menos los egresos', function () {
        $capacidad = (new MotorReglas)->capacidadPago(400_000, 2_000_000, 1_000_000, 40.0);

        expect($capacidad)->toBe([
            'cuota_estimada' => 400_000, 'ingreso_disponible' => 1_000_000, 'porcentaje' => 40.0,
            'limite' => 40.0, 'supera_limite' => false, // exactamente el 40 % sí se admite
        ]);
        expect((new MotorReglas)->capacidadPago(400_100, 2_000_000, 1_000_000, 40.0)['supera_limite'])->toBeTrue();
    });

    it('sin ingreso disponible la cuota ocupa el 100 % y supera el límite', function () {
        $capacidad = (new MotorReglas)->capacidadPago(100_000, 1_000_000, 1_500_000, 40.0);

        expect($capacidad['ingreso_disponible'])->toBe(0)->and($capacidad['porcentaje'])->toBe(100.0)
            ->and($capacidad['supera_limite'])->toBeTrue();
    });
});

describe('RN-44 y CP0013 paso 8 — reproducible y explicable', function () {
    it('la misma entrada con las mismas reglas da exactamente el mismo resultado', function () {
        expect(t10Evaluar(t10Entrada()))->toBe(t10Evaluar(t10Entrada()));
    });

    it('la entrada se guarda y se reconstruye sin perder nada', function () {
        $entrada = t10Entrada(['saldo_total' => 1_234_567]);

        expect(EntradaEvaluacion::desdeArray($entrada->toArray()))->toEqual($entrada)
            ->and(EntradaEvaluacion::desdeArray([])->cuotaMensual)->toBe(0);
    });

    it('ordena las variables determinantes por su peso y las explica en español', function () {
        $r = t10Evaluar(t10Entrada([
            'cuota_mensual' => 1_058_000, 'meses_como_cliente' => 1, 'antiguedad_laboral_meses' => 1,
            'mora_maxima_dias' => 15, 'obligaciones_vigentes' => 1, 'saldo_total' => 9_500_000,
        ]));
        $porCodigo = collect($r['variables'])->keyBy('codigo');
        $pesos = array_map(fn ($v) => abs($v['contribucion']), $r['variables']);

        expect($pesos)->toBe(collect($pesos)->sortDesc()->values()->all())
            ->and($porCodigo['cuota_ingreso']['valor'])->toBe('35,3 %')
            ->and($porCodigo['comportamiento_pago']['valor'])->toBe('Mora máxima de 15 días')
            ->and($porCodigo['endeudamiento']['valor'])->toBe('$ 9.500.000 en 1 obligación')
            ->and($porCodigo['antiguedad_laboral']['valor'])->toBe('1 mes')
            ->and($porCodigo['antiguedad_cliente']['valor'])->toBe('1 mes')
            ->and($porCodigo['consultas_recientes']['valor'])->toBe('1 en 6 meses');

        $otro = collect(t10Evaluar(t10Entrada(['cuota_mensual' => 600_000, 'obligaciones_vigentes' => 3]))['variables'])->keyBy('codigo');
        expect($otro['cuota_ingreso']['valor'])->toBe('20 %')
            ->and($otro['comportamiento_pago']['valor'])->toBe('Al día en los últimos 24 meses')
            ->and($otro['endeudamiento']['valor'])->toBe('$ 3.000.000 en 3 obligaciones')
            ->and($otro['antiguedad_laboral']['valor'])->toBe('36 meses');
    });

    it('cada tramo de R-2026.10-1 da los puntos del portal simulado', function (array $cambios, string $codigo, int $puntos) {
        $r = collect(t10Evaluar(t10Entrada($cambios))['variables'])->keyBy('codigo');

        expect($r[$codigo]['contribucion'])->toBe($puntos);
    })->with([
        'mora 0' => [['mora_maxima_dias' => 0], 'comportamiento_pago', 140],
        'mora 30' => [['mora_maxima_dias' => 30], 'comportamiento_pago', 30],
        'mora 31' => [['mora_maxima_dias' => 31], 'comportamiento_pago', -160],
        'cuota 20 %' => [['cuota_mensual' => 600_000], 'cuota_ingreso', 110],
        'cuota 30 %' => [['cuota_mensual' => 900_000], 'cuota_ingreso', 60],
        'cuota 40 %' => [['cuota_mensual' => 1_200_000], 'cuota_ingreso', 10],
        'cuota 40,1 %' => [['cuota_mensual' => 1_203_000], 'cuota_ingreso', -170],
        'deuda 2,9x' => [['saldo_total' => 8_700_000], 'endeudamiento', 50],
        'deuda 3x' => [['saldo_total' => 9_000_000], 'endeudamiento', 0],
        'deuda 6x' => [['saldo_total' => 18_000_000], 'endeudamiento', -60],
        'sin ingreso' => [['ingreso_mensual' => 0], 'endeudamiento', -60],
        '24 meses' => [['antiguedad_laboral_meses' => 24], 'antiguedad_laboral', 60],
        '12 meses' => [['antiguedad_laboral_meses' => 12], 'antiguedad_laboral', 30],
        '11 meses' => [['antiguedad_laboral_meses' => 11], 'antiguedad_laboral', -30],
        '2 consultas' => [['consultas_ultimos_6_meses' => 2], 'consultas_recientes', 20],
        '4 consultas' => [['consultas_ultimos_6_meses' => 4], 'consultas_recientes', 0],
        '5 consultas' => [['consultas_ultimos_6_meses' => 5], 'consultas_recientes', -40],
        'cliente 6 meses' => [['meses_como_cliente' => 6], 'antiguedad_cliente', 20],
        'cliente 5 meses' => [['meses_como_cliente' => 5], 'antiguedad_cliente', 0],
    ]);

    it('si ningún tramo aplica, la variable no suma ni resta', function () {
        $definicion = t10DefinicionFija(600);
        $definicion['variables'][0]['tramos'] = [['max' => -1, 'puntos' => 99]];

        expect(t10Evaluar(t10Entrada(), $definicion)['variables'][0]['contribucion'])->toBe(0);
    });
});

describe('RN-43 / CP0014 pasos 1 a 3 — catálogo de variables sin atributos sensibles', function () {
    it('ninguna variable del catálogo es un atributo prohibido o una aproximación', function () {
        expect(array_intersect(CatalogoVariables::codigos(), CatalogoVariables::PROHIBIDAS))->toBe([])
            ->and(CatalogoVariables::PROHIBIDAS)->toContain('sexo', 'genero', 'estado_civil', 'origen_etnico', 'religion',
                'afiliacion_politica', 'estado_salud', 'nombres', 'parentesco', 'barrio', 'edad');
    });

    it('cada variable del catálogo tiene nombre, fuente y justificación de negocio', function () {
        foreach (CatalogoVariables::VARIABLES as $codigo => $variable) {
            expect($variable['nombre'])->not->toBeEmpty()
                ->and($variable['fuente'])->not->toBeEmpty()
                ->and(mb_strlen($variable['justificacion']))->toBeGreaterThan(30, "{$codigo} sin justificación");
        }
    });

    it('la versión de reglas inicial solo usa variables del catálogo', function () {
        foreach (ReglasMotorSeeder::DEFINICION_INICIAL['variables'] as $regla) {
            expect(CatalogoVariables::admitida($regla['codigo']))->toBeTrue();
        }
    });

    it('la entrada del motor no tiene dónde recibir un atributo prohibido', function () {
        $campos = array_keys(t10Entrada()->toArray());

        expect(array_intersect($campos, CatalogoVariables::PROHIBIDAS))->toBe([])
            ->and($campos)->toHaveCount(count((new ReflectionClass(EntradaEvaluacion::class))->getProperties()));
    });

    it('rechaza una definición de reglas con una variable fuera del catálogo o prohibida', function (string $codigo) {
        $definicion = t10DefinicionFija(600);
        $definicion['variables'][] = ['codigo' => $codigo, 'tramos' => [['puntos' => 10]]];

        expect(fn () => t10Evaluar(t10Entrada(), $definicion))->toThrow(InvalidArgumentException::class, 'RN-43');
    })->with(['sexo', 'estado_civil', 'edad', 'inventada', '']);

    it('rechaza una definición incompleta o con una variable sin tramos', function () {
        expect(fn () => t10Evaluar(t10Entrada(), ['base' => 600]))->toThrow(InvalidArgumentException::class, 'incompleta');

        $sinTramos = t10DefinicionFija(600);
        $sinTramos['variables'][0]['tramos'] = [];
        expect(fn () => t10Evaluar(t10Entrada(), $sinTramos))->toThrow(InvalidArgumentException::class, 'tramos');
    });
});

describe('MR-003 — central de riesgo simulada y no contratada', function () {
    it('da un perfil estable según el documento y lo marca como simulado', function () {
        $central = new CentralRiesgoSimulada;

        expect($central->esSimulado())->toBeTrue()
            ->and($central->consultar('CC', '1000000008', 5_000_000))->toBe([ // suma 9 → perfil 0,9
                'obligaciones_vigentes' => 1, 'saldo_total' => 5_000_000, 'mora_maxima_dias' => 0,
                'consultas_ultimos_6_meses' => 1, 'calificacion' => 'A',
            ])
            ->and($central->consultar('CC', '1000000004', 5_000_000)['mora_maxima_dias'])->toBe(30) // perfil 0,5
            ->and($central->consultar('CC', '1100000009', 5_000_000)['calificacion'])->toBe('C')   // perfil 0,1
            ->and($central->consultar('PA', 'AB12345', 1_000_000)['calificacion'])->toBe('B')      // solo suman los dígitos: 15 → perfil 0,5
            ->and($central->consultar('CC', '1000000008', 5_000_000))->toBe($central->consultar('CC', '1000000008', 5_000_000));
    });

    it('no responde con documentos que terminan en 0 (escenario de caída, RF-08 FA-02)', function () {
        expect(fn () => (new CentralRiesgoSimulada)->consultar('CC', '1000000010', 1))->toThrow(CentralNoDisponible::class);
    });

    it('sin central contratada nunca responde y no se presenta como simulada', function () {
        $central = new CentralRiesgoNoContratada;

        expect($central->esSimulado())->toBeFalse()
            ->and(fn () => $central->consultar('CC', '1000000008', 1))->toThrow(CentralNoDisponible::class);
    });
});
