<?php

namespace App\Modules\Evaluacion\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;

/**
 * Versión publicada de los parámetros de crédito (RN-44). Solo adición: un cambio
 * de tasas, rangos o umbrales se publica como una versión nueva.
 */
class VersionParametros extends Model
{
    use SoloAdicion;

    public $timestamps = false;

    protected $table = 'evaluacion_parametros';

    protected $fillable = [
        'version', 'vigente_desde', 'publicado_por_id', 'publicado_por', 'tasa_maxima_legal_ea',
        'umbral_aprobar', 'umbral_negar', 'limite_cuota_ingreso', 'productos', 'registrado_en',
    ];

    protected function casts(): array
    {
        return [
            'vigente_desde' => 'datetime',
            'tasa_maxima_legal_ea' => 'float',
            'umbral_aprobar' => 'integer',
            'umbral_negar' => 'integer',
            'limite_cuota_ingreso' => 'float',
            'productos' => 'array',
            'registrado_en' => 'datetime',
        ];
    }
}
