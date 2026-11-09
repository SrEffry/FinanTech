<?php

namespace App\Modules\Originacion\Services;

/**
 * Documentos de soporte que se piden según la ocupación (RF-06 paso 5). Es la misma lista
 * de la API simulada del portal (frontend/src/mocks/motor.ts → documentosRequeridos).
 * Los textos son para el cliente: lenguaje claro, sin jerga (RN-36).
 */
class CatalogoDocumentos
{
    public const OCUPACIONES = ['empleado', 'independiente', 'pensionado'];

    /** @var array<string, array{nombre: string, descripcion: string}> */
    private const CATALOGO = [
        'certificado_laboral' => [
            'nombre' => 'Certificado laboral',
            'descripcion' => 'Con cargo, salario y fecha de ingreso, de máximo 30 días.',
        ],
        'desprendibles_nomina' => [
            'nombre' => 'Desprendibles de nómina',
            'descripcion' => 'Los dos últimos.',
        ],
        'extractos_bancarios' => [
            'nombre' => 'Extractos bancarios',
            'descripcion' => 'De los últimos tres meses, de la cuenta donde recibes tus ingresos.',
        ],
        'declaracion_renta' => [
            'nombre' => 'Declaración de renta',
            'descripcion' => 'La del último año gravable, si declaras.',
        ],
        'desprendible_pension' => [
            'nombre' => 'Desprendible de pensión',
            'descripcion' => 'El último que recibiste.',
        ],
    ];

    /** @var array<string, array<string, bool>> ocupación => [tipo => requerido] */
    private const POR_OCUPACION = [
        'empleado' => ['certificado_laboral' => true, 'desprendibles_nomina' => true],
        'independiente' => ['extractos_bancarios' => true, 'declaracion_renta' => false],
        'pensionado' => ['desprendible_pension' => true],
    ];

    /** @return array<string, bool> tipo => requerido; vacío si aún no hay ocupación */
    public function paraOcupacion(?string $ocupacion): array
    {
        return self::POR_OCUPACION[$ocupacion ?? ''] ?? [];
    }

    /** @return array{nombre: string, descripcion: string} */
    public function describir(string $tipo): array
    {
        return self::CATALOGO[$tipo] ?? ['nombre' => ucfirst(str_replace('_', ' ', $tipo)), 'descripcion' => ''];
    }
}
