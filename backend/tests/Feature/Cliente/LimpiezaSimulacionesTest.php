<?php

use App\Modules\Cliente\Models\Simulacion;
use Illuminate\Console\Scheduling\Event as Tarea;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Str;

/*
 * RN-26: la simulación se conserva 30 días. La limpieza diaria está en routes/console.php.
 */

function simulacionSintetica(string $vigenteHasta): Simulacion
{
    return Simulacion::create([
        'usuario_id' => null, 'producto_codigo' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24,
        'version_parametros' => 'P-2026.10-1', 'tasa_ea' => 18.9, 'cuota' => 252_762, 'costo_total' => 1_000_000,
        'creada_en' => now(), 'vigente_hasta' => $vigenteHasta,
    ]);
}

it('programa cada día la limpieza de las simulaciones vencidas, a las 2 a. m. de Colombia', function () {
    $tarea = collect(app(Schedule::class)->events())
        ->first(fn (Tarea $t) => Str::contains($t->command, 'model:prune') && Str::contains($t->command, 'Simulacion'));

    expect($tarea)->not->toBeNull()
        ->and($tarea->expression)->toBe('0 2 * * *')
        ->and($tarea->timezone)->toBe('America/Bogota');
});

it('borra solo las simulaciones vencidas', function () {
    $vencida = simulacionSintetica(now()->subDay()->toDateTimeString());
    $vigente = simulacionSintetica(now()->addDays(29)->toDateTimeString());

    $this->artisan('model:prune', ['--model' => [Simulacion::class]])->assertSuccessful();

    expect(Simulacion::find($vencida->id))->toBeNull()
        ->and(Simulacion::find($vigente->id))->not->toBeNull();
});
