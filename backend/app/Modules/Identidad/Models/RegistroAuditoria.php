<?php

namespace App\Modules\Identidad\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;

class RegistroAuditoria extends Model
{
    use SoloAdicion;

    public $timestamps = false;

    protected $table = 'identidad_auditoria';

    protected $fillable = [
        'usuario_id', 'accion', 'entidad', 'id_entidad', 'resultado',
        'origen_ip', 'detalle', 'modo_simulado', 'registrado_en',
    ];

    protected function casts(): array
    {
        return [
            'detalle' => 'array',
            'modo_simulado' => 'boolean',
            'registrado_en' => 'datetime',
        ];
    }
}
