<?php

/*
 * Casos críticos del motor de evaluación (qa-senior, T20; preparados en la ronda 2 junto a T10).
 *
 * - RN-43 / RNF-25: guardas activas desde ya, que pasan hoy y quedan como regresión: ninguna tabla
 *   de los módulos que alimentan al motor guarda un atributo sensible, y el código de Evaluacion no
 *   tiene variables, propiedades ni métodos con esos nombres.
 * - CP0013 y CP0014: un todo() por paso del plan de pruebas (ERS 14.13 y 14.14). Se convierten en
 *   pruebas reales cuando backend-senior publique T10 (motor, `evaluacion_evaluaciones`, catálogo de
 *   variables) y T15 (reversión humana). El panel de equidad (pasos 7 y 8 de CP0014) está fuera (F2).
 *
 * Este archivo es de qa-senior; las pruebas unitarias del motor las escribe backend-senior en sus
 * propios archivos.
 */

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

describe('CP0013 — evaluación trazable (RF-08, RN-40, RN-41, RN-44, RN-46)', function () {
    it('paso 1-2: una solicitud de puntaje alto (>= 700) se aprueba automáticamente al consumir SolicitudRadicada')
        ->todo('T10: escucha de SolicitudRadicada y central de riesgo simulada con escenario de puntaje alto');
    it('paso 3: una solicitud de puntaje intermedio (500-699) se escala a la bandeja del analista (EN_ESTUDIO)')
        ->todo('T10');
    it('paso 4: una solicitud de puntaje bajo (< 500) se niega automáticamente con su causal')
        ->todo('T10');
    it('límites exactos de RN-40: 700 aprueba, 699 y 500 escalan, 499 niega')
        ->todo('T10: umbrales leídos de la versión de parámetros, no fijos en el código');
    it('paso 5: con puntaje alto, una cuota mayor al 40 % del ingreso disponible no se aprueba (RN-41)')
        ->todo('T10');
    it('paso 6: cada evaluación guarda puntaje, nivel de riesgo, decisión, variables determinantes y version_reglas (RN-44)')
        ->todo('T10: tabla evaluacion_evaluaciones');
    it('la tabla de evaluaciones es de solo adición: trait SoloAdicion y triggers BEFORE UPDATE/DELETE (RN-45, RNF-08)')
        ->todo('T10: EsquemaTest ya exige triggers en toda tabla con SoloAdicion; aquí, update y delete rechazados');
    it('paso 7: la evaluación concluye en menos de 10 minutos desde la radicación (RN-46)')
        ->todo('T10: comparar radicada_en con la fecha de la evaluación');
    it('paso 8: reejecutar con la misma versión de reglas da el mismo puntaje y la misma decisión, y ambas quedan registradas (RN-45)')
        ->todo('T10');
    it('una versión de parámetros nueva no cambia la evaluación ya registrada: se evalúa con la vigente al radicar')
        ->todo('T10');
    it('si la central de riesgo no responde, la solicitud pasa a evaluación manual y nunca se niega (RF-08 FA-02, RNF-09)')
        ->todo('T10: escenario de caída del adaptador simulado');
    it('la llamada a la central queda en la auditoría marcada como simulada (MR-003)')
        ->todo('T10');
    it('sin autorización de consulta a centrales no se consulta la central (RN-19)')
        ->todo('T10');
    it('GET evaluacion/solicitudes/{id}/evaluacion: 401 sin sesión, 403 para el cliente, 200 con version_reglas para analista y oficial')
        ->todo('T10');
});

describe('CP0014 — equidad del modelo (RN-43, RNF-25), caso crítico', function () {
    it('paso 1: el catálogo de variables del motor no incluye ningún atributo sensible')
        ->todo('T10: catálogo de variables publicado por el motor; usar rn43Sensibles()');
    it('paso 2: el catálogo no incluye aproximaciones (nombre, foto o rostro, dirección o barrio, edad de los hijos, EPS, número de personas a cargo por estado civil)')
        ->todo('T10: revisar con backend-senior la lista de aproximaciones antes de cerrar el catálogo');
    it('paso 3: cada variable del catálogo tiene justificación de negocio documentada')
        ->todo('T10');
    it('las variables determinantes de toda evaluación pertenecen al catálogo')
        ->todo('T10');
    it('pasos 4-6: tres pares de solicitudes sintéticas idénticas en riesgo que difieren solo en un atributo sensible obtienen el mismo puntaje y la misma decisión')
        ->todo('T10: pares por sexo, estado civil y edad o nombre; el atributo se cambia en Identidad, no en la solicitud');
    it('paso 9: un oficial revierte una decisión automatizada con motivo y ambas decisiones quedan en el historial')
        ->todo('T15: decisiones de solo adición (RN-58)');
    it('pasos 7-8: panel de equidad por segmento agregado')
        ->todo('Fuera de la primera versión (F2, RF-14)');
});
