<?php

/*
 * Casos críticos del motor de evaluación (qa-senior, T20; preparados en la ronda 2 junto a T10).
 *
 * - RN-43 / RNF-25: guardas activas desde ya, que pasan hoy y quedan como regresión: ninguna tabla
 *   de los módulos que alimentan al motor guarda un atributo sensible, y el código de Evaluacion no
 *   tiene variables, propiedades ni métodos con esos nombres.
 * - CP0014 pasos 1-3: revisión independiente del catálogo de T10 con la lista de palabras de QA
 *   (no con la lista de prohibidas del propio motor).
 * - CP0013 y CP0014: los pasos los cubren las pruebas de backend-senior (ver el comentario de abajo);
 *   aquí quedan en todo() solo los que dependen de T11, T15 o T20. El panel de equidad está fuera (F2).
 *
 * Este archivo es de qa-senior; las pruebas del motor las escribe backend-senior en sus archivos.
 */

use App\Modules\Evaluacion\Motor\CatalogoVariables;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Raíces de los atributos que RN-43 prohíbe (sexo, estado civil, origen étnico, religión,
 * afiliación política, estado de salud), en español y en inglés, ya normalizadas sin tildes.
 */
const RN43_PALABRAS_SENSIBLES = [
    'sexo', 'sex', 'genero', 'gender',
    'civil', 'conyuge', 'casado', 'casada', 'soltero', 'soltera', 'marital',
    'etnia', 'etnico', 'etnica', 'raza', 'racial', 'race', 'ethnicity', 'indigena', 'afro',
    'religion', 'religioso', 'religiosa', 'credo', 'iglesia',
    'partido', 'ideologia', 'afiliacion', 'militancia',
    'salud', 'enfermedad', 'discapacidad', 'embarazo', 'eps', 'diagnostico', 'health',
];

/** Parte un identificador (snake_case, camelCase o PascalCase) en palabras normalizadas. */
function rn43Palabras(string $identificador): array
{
    $plano = Str::ascii(Str::snake(str_replace(['-', ' '], '_', $identificador)));

    return array_values(array_filter(explode('_', strtolower($plano))));
}

function rn43Sensibles(string $identificador): array
{
    return array_values(array_intersect(rn43Palabras($identificador), RN43_PALABRAS_SENSIBLES));
}

describe('RN-43 y RNF-25 — sin atributos sensibles en lo que consume el motor', function () {
    it('la detección reconoce los atributos prohibidos y sus variantes', function () {
        expect(rn43Sensibles('estado_civil'))->toBe(['civil'])
            ->and(rn43Sensibles('estadoCivil'))->toBe(['civil'])
            ->and(rn43Sensibles('GeneroCliente'))->toBe(['genero'])
            ->and(rn43Sensibles('origen_étnico'))->toBe(['etnico'])
            ->and(rn43Sensibles('afiliacionPolitica'))->toBe(['afiliacion'])
            ->and(rn43Sensibles('ingreso_mensual'))->toBe([])
            ->and(rn43Sensibles('antiguedad_laboral_meses'))->toBe([]);
    });

    it('ninguna tabla de Evaluacion, Originacion ni Cliente tiene columnas de atributos sensibles', function () {
        $columnas = collect(DB::select(
            "SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND (TABLE_NAME LIKE 'evaluacion\\_%' OR TABLE_NAME LIKE 'originacion\\_%' OR TABLE_NAME LIKE 'cliente\\_%')"
        ));

        expect($columnas)->not->toBeEmpty();

        $hallazgos = $columnas
            ->filter(fn ($c) => rn43Sensibles($c->columna) !== [])
            ->map(fn ($c) => "{$c->tabla}.{$c->columna}")
            ->values()
            ->all();

        expect($hallazgos)->toBe([], 'RN-43: columnas con atributos sensibles: '.implode(', ', $hallazgos));
    });

    it('el código del módulo Evaluacion no declara ni usa variables, propiedades o métodos sensibles', function () {
        $hallazgos = [];
        $archivos = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/Evaluacion')));

        foreach ($archivos as $archivo) {
            if ($archivo->getExtension() !== 'php') {
                continue;
            }

            // Solo identificadores: los textos entre comillas (por ejemplo, la lista de variables
            // prohibidas que el propio motor rechaza) y los comentarios no cuentan.
            foreach (PhpToken::tokenize(file_get_contents($archivo->getPathname())) as $token) {
                if (! $token->is([T_VARIABLE, T_STRING])) {
                    continue;
                }
                if (rn43Sensibles(ltrim($token->text, '$')) !== []) {
                    $hallazgos[] = Str::after($archivo->getPathname(), app_path()).":{$token->line} {$token->text}";
                }
            }
        }

        expect($hallazgos)->toBe([], 'RN-43: identificadores sensibles en Evaluacion: '.implode(', ', $hallazgos));
    });
});

describe('RN-43 / CP0014 pasos 1-3 — revisión independiente del catálogo del motor (T10)', function () {
    it('ninguna variable del catálogo, ni su nombre ni su fuente, nombra un atributo sensible', function () {
        $hallazgos = [];
        foreach (CatalogoVariables::VARIABLES as $codigo => $variable) {
            foreach ([$codigo, $variable['nombre'], $variable['fuente']] as $texto) {
                foreach (preg_split('/[^\p{L}_]+/u', $texto, -1, PREG_SPLIT_NO_EMPTY) as $palabra) {
                    if (rn43Sensibles($palabra) !== []) {
                        $hallazgos[] = "{$codigo}: {$palabra}";
                    }
                }
            }
        }

        expect(CatalogoVariables::VARIABLES)->not->toBeEmpty()
            ->and($hallazgos)->toBe([], 'RN-43: '.implode(', ', $hallazgos));
    });

    it('la lista de prohibidas del motor incluye los seis atributos de RN-43 y las aproximaciones más comunes', function () {
        $prohibidas = CatalogoVariables::PROHIBIDAS;

        // Los seis de RN-43 (con el nombre que usa el motor).
        expect($prohibidas)->toContain('sexo', 'estado_civil', 'origen_etnico', 'religion', 'afiliacion_politica', 'estado_salud');
        // Aproximaciones que la ERS obliga a excluir (RNF-25) y que el portal o la solicitud podrían traer.
        expect($prohibidas)->toContain('nombres', 'apellidos', 'foto', 'fecha_nacimiento', 'edad', 'direccion', 'personas_a_cargo', 'eps');
    });

    it('ninguna variable admitida por el motor está en la lista de prohibidas', function () {
        foreach (CatalogoVariables::PROHIBIDAS as $prohibida) {
            expect(CatalogoVariables::admitida($prohibida))->toBeFalse("{$prohibida} no debe admitirse");
        }
    });
});

/*
 * Cobertura de CP0013 y CP0014 por las pruebas de backend-senior (T10), validadas por QA en la entrega:
 * - tests/Unit/Evaluacion/MotorReglasTest.php: RN-40 en los límites exactos, RN-41, reproducibilidad,
 *   catálogo con justificación, reglas solo con variables del catálogo, entrada sin atributos prohibidos.
 * - tests/Feature/Evaluacion/EvaluacionAutomaticaTest.php: CP0013 pasos 1 a 8, solo adición, central caída
 *   y sin autorización (RF-08 FA-02, RN-19), modo real, CP0014 pasos 4 a 6 (tres pares) y 401/403/404 de
 *   GET evaluacion/solicitudes/{id}/evaluacion.
 * - tests/Feature/Recorrido/FlujoVitalP9Test.php: CP0013 de punta a punta por HTTP (el cliente radica, el motor
 *   evalúa y el analista consulta la evaluación con version_reglas).
 * Aquí quedan solo los pasos que dependen de otras tareas.
 */
describe('CP0014 — pasos de punta a punta que dependen de otras tareas', function () {
    it('CP0014 pasos 4-6 por HTTP: tres pares radicados desde el portal obtienen el mismo puntaje y la misma decisión')
        ->todo('T11 + T20');
    it('CP0014 paso 9: un oficial revierte una decisión automatizada con motivo y ambas decisiones quedan en el historial')
        ->todo('T15: decisiones de solo adición (RN-58)');
    it('CP0014 pasos 7-8: panel de equidad por segmento agregado')
        ->todo('Fuera de la primera versión (F2, RF-14)');
});
