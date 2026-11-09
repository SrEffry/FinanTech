<?php

namespace App\Modules\Evaluacion\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Decisión sobre una solicitud (RF-10). Solo adición (RN-58): una corrección es una fila nueva.
 */
class Decision extends Model
{
    use HasUuids;
    use SoloAdicion;

    public $timestamps = false;

    protected $table = 'evaluacion_decisiones';

    protected $fillable = [
        'solicitud_id', 'cliente_id', 'radicado', 'evaluacion_id', 'resultado', 'motivo', 'automatizada',
        'autor_usuario_id', 'autor_nombre', 'atribucion_monto', 'monto', 'plazo_meses', 'tasa_ea',
        'condicionada', 'estado_resultante', 'registrado_en',
    ];

    protected function casts(): array
    {
        return [
            'cliente_id' => 'integer',
            'automatizada' => 'boolean',
            'autor_usuario_id' => 'integer',
            'atribucion_monto' => 'integer',
            'monto' => 'integer',
            'plazo_meses' => 'integer',
            'tasa_ea' => 'float',
            'condicionada' => 'boolean',
            'registrado_en' => 'datetime',
        ];
    }
}
