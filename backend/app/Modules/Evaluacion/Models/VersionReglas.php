<?php

namespace App\Modules\Evaluacion\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;

/**
 * Versión publicada de las reglas del puntaje (REGLA_VERSION, RN-44). Solo adición:
 * un cambio de pesos o tramos se publica como una versión nueva.
 */
class VersionReglas extends Model
{
    use SoloAdicion;

    public $timestamps = false;

    protected $table = 'evaluacion_reglas';

    protected $fillable = ['version', 'vigente_desde', 'publicada_por', 'definicion', 'registrado_en'];

    protected function casts(): array
    {
        return [
            'vigente_desde' => 'datetime',
            'definicion' => 'array',
            'registrado_en' => 'datetime',
        ];
    }
}
