<?php

namespace App\Modules\Cliente\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;

/** Simulación guardada 30 días (RN-26). Pasado ese plazo, `model:prune` la elimina. */
class Simulacion extends Model
{
    use HasUuids, MassPrunable;

    public $timestamps = false;

    protected $table = 'cliente_simulaciones';

    protected $fillable = [
        'usuario_id', 'producto_codigo', 'monto', 'plazo_meses', 'version_parametros',
        'tasa_ea', 'cuota', 'costo_total', 'creada_en', 'vigente_hasta',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'integer',
            'plazo_meses' => 'integer',
            'tasa_ea' => 'float',
            'cuota' => 'integer',
            'costo_total' => 'integer',
            'creada_en' => 'datetime',
            'vigente_hasta' => 'datetime',
        ];
    }

    public function prunable(): Builder
    {
        return static::where('vigente_hasta', '<', now());
    }
}
