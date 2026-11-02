<?php

namespace App\Modules\Originacion\Models;

use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;

/** Cambio de estado de una solicitud (RF-07: hitos con fecha). Solo adición. */
class HistorialEstado extends Model
{
    use SoloAdicion;

    public $timestamps = false;

    protected $table = 'originacion_historial_estados';

    protected $fillable = [
        'solicitud_id', 'estado_anterior', 'estado_nuevo', 'actor_usuario_id', 'motivo', 'registrado_en',
    ];

    protected function casts(): array
    {
        return [
            'estado_anterior' => EstadoSolicitud::class,
            'estado_nuevo' => EstadoSolicitud::class,
            'actor_usuario_id' => 'integer',
            'registrado_en' => 'datetime',
        ];
    }
}
