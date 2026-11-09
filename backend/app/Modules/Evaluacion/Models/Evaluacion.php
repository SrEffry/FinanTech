<?php

namespace App\Modules\Evaluacion\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Resultado del motor de reglas para una solicitud (RF-08). Solo adición (RN-44, RN-45):
 * una reevaluación es una fila nueva con la secuencia siguiente.
 */
class Evaluacion extends Model
{
    use HasUuids;
    use SoloAdicion;

    public $timestamps = false;

    protected $table = 'evaluacion_evaluaciones';

    protected $fillable = [
        'solicitud_id', 'secuencia', 'cliente_id', 'radicado', 'version_reglas', 'version_parametros',
        'puntaje', 'escala_min', 'escala_max', 'nivel_riesgo', 'decision_sugerida', 'causal',
        'umbral_aprobar', 'umbral_negar', 'variables_determinantes', 'capacidad_pago', 'entradas',
        'fuente_central', 'radicada_en', 'evaluada_en', 'registrado_en',
    ];

    protected function casts(): array
    {
        return [
            'secuencia' => 'integer',
            'cliente_id' => 'integer',
            'puntaje' => 'integer',
            'escala_min' => 'integer',
            'escala_max' => 'integer',
            'umbral_aprobar' => 'integer',
            'umbral_negar' => 'integer',
            'variables_determinantes' => 'array',
            'capacidad_pago' => 'array',
            'entradas' => 'array',
            'radicada_en' => 'datetime',
            'evaluada_en' => 'datetime',
            'registrado_en' => 'datetime',
        ];
    }
}
