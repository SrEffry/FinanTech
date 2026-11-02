<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sesión abierta tras el segundo factor (RF-03). Su id viaja como `sid` en el token
 * de acceso, de modo que cerrarla invalida el acceso al instante en todos los canales.
 */
class Sesion extends Model
{
    use HasUuids;

    protected $table = 'identidad_sesiones';

    protected $fillable = [
        'usuario_id', 'renovacion_hash', 'renovacion_anterior_hash', 'rotada_en', 'renovacion_expira_en',
        'ultima_actividad_en', 'canal', 'origen_ip', 'agente', 'cerrada_en', 'motivo_cierre',
    ];

    protected $hidden = ['renovacion_hash', 'renovacion_anterior_hash'];

    protected function casts(): array
    {
        return [
            'rotada_en' => 'datetime',
            'renovacion_expira_en' => 'datetime',
            'ultima_actividad_en' => 'datetime',
            'cerrada_en' => 'datetime',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }

    public function estaAbierta(): bool
    {
        return $this->cerrada_en === null && $this->renovacion_expira_en->isFuture();
    }
}
