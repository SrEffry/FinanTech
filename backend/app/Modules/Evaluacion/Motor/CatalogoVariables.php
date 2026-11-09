<?php

namespace App\Modules\Evaluacion\Motor;

/**
 * Catálogo de variables del motor (F-EVA-02, CP0014 pasos 1 a 3).
 *
 * Solo capacidad de pago, endeudamiento y comportamiento. Cada variable tiene su fuente y su
 * justificación de negocio. Una versión de reglas solo puede usar variables de este catálogo:
 * el motor rechaza cualquier otra (RN-43, RNF-25).
 */
final class CatalogoVariables
{
    /** @var array<string, array{nombre: string, fuente: string, justificacion: string}> */
    public const VARIABLES = [
        'comportamiento_pago' => [
            'nombre' => 'Comportamiento de pago en centrales',
            'fuente' => 'Central de información crediticia',
            'justificacion' => 'La mora reciente con otras entidades es el indicador más directo del riesgo de incumplir (F-EVA-02, comportamiento).',
        ],
        'cuota_ingreso' => [
            'nombre' => 'Cuota frente al ingreso disponible',
            'fuente' => 'Solicitud (ingresos y egresos declarados) y condiciones del crédito',
            'justificacion' => 'Mide si la cuota cabe en lo que le queda al solicitante cada mes; es la capacidad de pago de RN-41.',
        ],
        'endeudamiento' => [
            'nombre' => 'Endeudamiento con otras entidades',
            'fuente' => 'Central de información crediticia e ingreso declarado',
            'justificacion' => 'Un saldo de deuda alto frente al ingreso reduce la capacidad de asumir una obligación nueva (F-EVA-02, endeudamiento).',
        ],
        'antiguedad_laboral' => [
            'nombre' => 'Antigüedad en la actividad actual',
            'fuente' => 'Solicitud (datos laborales)',
            'justificacion' => 'La estabilidad del ingreso durante el plazo del crédito depende del tiempo en la actividad actual.',
        ],
        'consultas_recientes' => [
            'nombre' => 'Consultas recientes a centrales',
            'fuente' => 'Central de información crediticia',
            'justificacion' => 'Muchas solicitudes de crédito en poco tiempo anticipan un sobreendeudamiento.',
        ],
        'antiguedad_cliente' => [
            'nombre' => 'Antigüedad como cliente',
            'fuente' => 'FinanTech',
            'justificacion' => 'Comportamiento previo con FinanTech (RF-08 paso 3): una relación más larga da más información verificable.',
        ],
    ];

    /**
     * RN-43: atributos prohibidos y sus aproximaciones conocidas. Ninguno llega al motor
     * (EntradaEvaluacion no tiene dónde ponerlos) y ninguna versión de reglas puede usarlos.
     *
     * @var list<string>
     */
    public const PROHIBIDAS = [
        // Prohibidas por RN-43.
        'sexo', 'genero', 'estado_civil', 'origen_etnico', 'raza', 'religion', 'afiliacion_politica', 'estado_salud',
        // Aproximaciones: identifican o sugieren las anteriores.
        'nombres', 'apellidos', 'foto', 'rostro', 'parentesco', 'conyuge', 'numero_hijos', 'personas_a_cargo',
        'direccion', 'barrio', 'municipio', 'codigo_postal', 'lugar_nacimiento', 'nacionalidad', 'idioma',
        'eps', 'discapacidad', 'embarazo', 'edad', 'fecha_nacimiento',
    ];

    /** @return list<string> */
    public static function codigos(): array
    {
        return array_keys(self::VARIABLES);
    }

    public static function admitida(string $codigo): bool
    {
        return isset(self::VARIABLES[$codigo]) && ! in_array($codigo, self::PROHIBIDAS, true);
    }
}
