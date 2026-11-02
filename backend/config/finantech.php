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

    // RF-03, RI-08: inicio de sesión con segundo factor y cookies httpOnly.
    'sesion' => [
        'minutos_acceso' => 15,                 // RN-13
        'dias_renovacion' => 7,                 // RN-14 (rota en cada uso)
        'minutos_inactividad_interna' => 15,    // RN-16: consola interna
        'max_intentos' => 5,                    // RN-12
        'minutos_bloqueo' => 30,                // RN-12
        // RN-17 / CP0009: toda respuesta del inicio de sesión tarda al menos esto,
        // para que la latencia no revele si el correo existe.
        'tiempo_minimo_respuesta_ms' => (int) env('SESION_TIEMPO_MINIMO_MS', 500),
        // Si dos pestañas renuevan a la vez, la segunda presenta el token recién rotado:
        // dentro de esta ventana no se toma como robo, solo recibe un acceso nuevo.
        'gracia_rotacion_segundos' => 30,
        'cookie_acceso' => 'ft_acceso',
        'cookie_renovacion' => 'ft_renovacion',
        'ruta_cookie_acceso' => '/api',
        'ruta_cookie_renovacion' => '/api/v1/identidad/sesion',
        'cookie_segura' => (bool) env('SESSION_SECURE_COOKIE', false),
        // Clave de firma de los tokens de acceso (JWT HS256). Por omisión se deriva de APP_KEY.
        'clave_firma' => env('SESION_CLAVE_FIRMA'),
    ],

    // Segundo factor por correo (RN-15 en el inicio de sesión, RN-61 al aceptar la oferta).
    'segundo_factor' => [
        'vigencia_minutos' => 5,
        'espera_reenvio_segundos' => 60,
        'max_intentos' => 5,
        'max_reenvios' => 3,
    ],

    'recuperacion' => [
        'vigencia_minutos' => 60,
        'url_portal' => env('PORTAL_URL', 'http://localhost:5173'),
    ],

];
