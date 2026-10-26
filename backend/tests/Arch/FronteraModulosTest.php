<?php

/*
 * CP0002 / MR-002: ningún módulo accede a los modelos de otro módulo.
 * Los módulos se comunican por sus servicios públicos o por eventos de dominio.
 */

$modulos = ['Identidad', 'Cliente', 'Originacion', 'Evaluacion', 'Desembolso', 'Contabilidad', 'Analitica'];

foreach ($modulos as $modulo) {
    $modelosAjenos = array_map(
        fn (string $otro) => "App\\Modules\\{$otro}\\Models",
        array_values(array_diff($modulos, [$modulo])),
    );

    arch("el módulo {$modulo} no usa modelos de otros módulos")
        ->expect("App\\Modules\\{$modulo}")
        ->not->toUse($modelosAjenos)
        ->group('arch');
}

arch('el núcleo compartido no depende de ningún módulo')
    ->expect('App\Shared')
    ->not->toUse('App\Modules')
    ->group('arch');

arch('no quedan funciones de depuración')
    ->expect(['dd', 'dump', 'ray', 'var_dump'])
    ->not->toBeUsed()
    ->group('arch');
