<?php

use App\Modules\Cliente\Models\Simulacion;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// RN-26: la simulación se conserva 30 días; las vencidas se borran cada madrugada (hora de
// Colombia). model:prune solo busca en app/Models, así que el modelo del módulo se nombra.
// Para que corra hace falta el programador: `php artisan schedule:work` en desarrollo o el
// cron `* * * * * php artisan schedule:run` en el servidor.
Schedule::command('model:prune', ['--model' => [Simulacion::class]])
    ->dailyAt('02:00')
    ->timezone('America/Bogota')
    ->withoutOverlapping()
    ->onOneServer();
