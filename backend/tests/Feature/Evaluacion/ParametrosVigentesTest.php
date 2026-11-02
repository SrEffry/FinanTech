<?php

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Evaluacion\Models\VersionParametros;
use App\Modules\Evaluacion\Services\ParametrosVigentes;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => $this->seed(ParametrosCreditoSeeder::class));

describe('parámetros de crédito versionados (F-ADM-02, RN-44)', function () {
    it('entrega la última versión cuya vigencia ya empezó', function () {
        $parametros = app(ParametrosVigentes::class);

        expect($parametros->version(Carbon::parse('2026-09-15')))->toBe('P-2026.09-1')
            ->and($parametros->vigente(Carbon::parse('2026-09-15'))['umbral_aprobar'])->toBe(720)
            ->and($parametros->version(Carbon::parse('2026-10-20')))->toBe('P-2026.10-1')
            ->and($parametros->vigente(Carbon::parse('2026-10-20'))['umbral_aprobar'])->toBe(700)
            ->and($parametros->tasaMaximaLegalEa())->toBe(25.8);
    });

    it('una versión programada a futuro no aplica antes de su fecha', function () {
        VersionParametros::create([
            'version' => 'P-2027.01-1', 'vigente_desde' => '2027-01-01 05:00:00', 'publicado_por' => 'Prueba',
            'tasa_maxima_legal_ea' => 24, 'umbral_aprobar' => 700, 'umbral_negar' => 500, 'limite_cuota_ingreso' => 40,
            'productos' => [], 'registrado_en' => now(),
        ]);

        expect(app(ParametrosVigentes::class)->version(Carbon::parse('2026-12-31')))->toBe('P-2026.10-1')
            ->and(app(ParametrosVigentes::class)->version(Carbon::parse('2027-01-02')))->toBe('P-2027.01-1');
    });

    it('busca un producto por código con tipos numéricos', function () {
        $producto = app(ParametrosVigentes::class)->producto('libranza', Carbon::parse('2026-10-20'));

        expect($producto)->toMatchArray(['nombre' => 'Libranza', 'tasa_ea' => 14.9, 'monto_min' => 2_000_000, 'plazo_max' => 72])
            ->and(app(ParametrosVigentes::class)->producto('no_existe'))->toBeNull();
    });

    it('falla con un error de negocio si no hay ninguna versión vigente', function () {
        app(ParametrosVigentes::class)->vigente(Carbon::parse('2020-01-01'));
    })->throws(ErrorNegocio::class, 'Por ahora no podemos mostrar los productos.');

    it('el seeder no duplica versiones al correr dos veces', function () {
        $this->seed(ParametrosCreditoSeeder::class);

        expect(VersionParametros::count())->toBe(2);
    });

    it('una versión publicada no se modifica ni se borra en el modelo (solo adición)', function () {
        $version = VersionParametros::firstOrFail();

        expect(fn () => $version->update(['tasa_maxima_legal_ea' => 40]))->toThrow(LogicException::class)
            ->and(fn () => $version->delete())->toThrow(LogicException::class);
    });

    it('la base de datos también rechaza UPDATE y DELETE (RN-44)', function () {
        expect(fn () => DB::table('evaluacion_parametros')->update(['tasa_maxima_legal_ea' => 40]))
            ->toThrow(Illuminate\Database\QueryException::class, 'solo adicion')
            ->and(fn () => DB::table('evaluacion_parametros')->delete())
            ->toThrow(Illuminate\Database\QueryException::class, 'solo adicion');
    });
});
