<?php

/*
 * CP0001 (MR-001) y reglas de esquema del monolito modular (MR-002), a cargo de QA.
 * Se verifican sobre la base real de pruebas: MySQL, nunca SQLite.
 */

use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const QA_PREFIJOS_MODULO = ['identidad_', 'cliente_', 'originacion_', 'evaluacion_', 'desembolso_', 'contabilidad_', 'analitica_'];

// Tablas propias de Laravel, que no pertenecen a ningún módulo.
const QA_TABLAS_FRAMEWORK = ['migrations', 'password_reset_tokens', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs'];

function qaTablas(): array
{
    return collect(DB::select('SELECT TABLE_NAME AS nombre, ENGINE AS motor, TABLE_COLLATION AS cotejamiento
        FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = ?', ['BASE TABLE']))->all();
}

function qaPrefijo(string $tabla): ?string
{
    return collect(QA_PREFIJOS_MODULO)->first(fn ($p) => str_starts_with($tabla, $p));
}

describe('CP0001 — conexión a MySQL 8 y migraciones (MR-001)', function () {
    it('las pruebas corren sobre MySQL 8, nunca sobre SQLite', function () {
        expect(DB::connection()->getDriverName())->toBe('mysql')
            ->and(DB::scalar('SELECT VERSION()'))->toStartWith('8.');
    });

    it('todas las tablas usan InnoDB y utf8mb4', function () {
        $tablas = qaTablas();

        expect($tablas)->not->toBeEmpty();
        foreach ($tablas as $t) {
            expect($t->motor)->toBe('InnoDB', "{$t->nombre} no es InnoDB")
                ->and($t->cotejamiento)->toStartWith('utf8mb4');
        }
    });

    it('los seeders crean los seis roles, cinco de ellos internos', function () {
        expect(Rol::pluck('codigo')->sort()->values()->all())
            ->toBe(['administrador', 'analista', 'cliente', 'contabilidad', 'directivo', 'oficial'])
            ->and(Rol::where('interno', true)->count())->toBe(5);
    });

    it('los seeders crean usuarios de prueba sintéticos para los seis roles (paso 6, precondición de CP0008)', function () {
        $this->seed(\Database\Seeders\DatabaseSeeder::class);

        $usuarios = Usuario::with('rol')->get();
        expect($usuarios->pluck('rol.codigo')->unique()->sort()->values()->all())
            ->toBe(['administrador', 'analista', 'cliente', 'contabilidad', 'directivo', 'oficial'])
            // RNF-06: solo datos sintéticos fuera de producción (dominios reservados para pruebas).
            ->and($usuarios->reject(fn ($u) => str_ends_with($u->email, '.finantech.co') || str_ends_with($u->email, '@example.com'))->pluck('email')->all())
            ->toBe([]);
    });
});

describe('MR-002 — esquema del monolito modular', function () {
    it('cada tabla de dominio lleva el prefijo de su módulo', function () {
        $sinModulo = collect(qaTablas())->pluck('nombre')
            ->reject(fn ($t) => in_array($t, QA_TABLAS_FRAMEWORK, true) || qaPrefijo($t) !== null)
            ->values()->all();

        expect($sinModulo)->toBe([]);
    });

    it('no hay llaves foráneas físicas entre tablas de módulos distintos', function () {
        $cruzadas = collect(DB::select('SELECT TABLE_NAME AS tabla, REFERENCED_TABLE_NAME AS referida
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL'))
            ->filter(fn ($fk) => qaPrefijo($fk->tabla) !== qaPrefijo($fk->referida))
            ->map(fn ($fk) => "{$fk->tabla} → {$fk->referida}")
            ->values()->all();

        expect($cruzadas)->toBe([]);
    });

    it('toda tabla de solo adición tiene triggers que bloquean UPDATE y DELETE (RNF-08, RN-21, RN-58, RN-74)', function () {
        $modelos = collect(glob(app_path('Modules/*/Models/*.php')))
            ->map(fn ($archivo) => 'App\\'.str_replace(['/', '.php'], ['\\', ''], Str::after($archivo, app_path().'/')))
            ->filter(fn ($clase) => class_exists($clase) && is_subclass_of($clase, Model::class)
                && in_array(SoloAdicion::class, class_uses_recursive($clase), true));

        expect($modelos)->not->toBeEmpty();

        foreach ($modelos as $clase) {
            $tabla = (new $clase)->getTable();
            $eventos = collect(DB::select('SELECT EVENT_MANIPULATION AS evento FROM information_schema.TRIGGERS
                WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ? AND ACTION_TIMING = ?', [$tabla, 'BEFORE']))
                ->pluck('evento')->sort()->values()->all();

            expect($eventos)->toBe(['DELETE', 'UPDATE'], "{$tabla} ({$clase}) no tiene los dos triggers de solo adición");
        }
    });
});
