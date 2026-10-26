<?php

return [

    // MR-003 / MR-004: 'simulado' en desarrollo, pruebas y demostración; 'real' con proveedores contratados.
    'servicios_externos' => env('SERVICIOS_EXTERNOS', 'simulado'),

    // Clave del índice ciego para buscar documentos cifrados sin descifrarlos (RN-01, RNF-06).
    // Es independiente de APP_KEY para que rotar la clave de cifrado no invalide los índices.
    'indice_ciego_clave' => env('INDICE_CIEGO_CLAVE', env('APP_KEY')),

    'registro' => [
        'edad_minima' => 18,                    // RN-03
        'vigencia_registro_minutos' => 30,
        'vigencia_codigos_minutos' => 10,
        'max_intentos_codigo' => 5,
        'espera_reenvio_segundos' => 60,        // RF-01 FA-02
        'max_reenvios_por_hora' => 3,           // RF-01 FA-02
    ],

];
