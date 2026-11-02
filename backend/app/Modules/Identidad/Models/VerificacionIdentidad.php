<?php

namespace App\Modules\Identidad\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;

/** Intento de verificación de identidad (RF-02). Solo adición. */
class VerificacionIdentidad extends Model
{
    use SoloAdicion;

    public const VERIFICADO = 'verificado';
    public const REVISION_MANUAL = 'revision_manual';
    public const ILEGIBLE = 'ilegible';
    public const EN_COLA = 'en_cola';
    public const NO_CONTINUA = 'no_continua';

    public $timestamps = false;

    protected $table = 'identidad_verificaciones';

    protected $fillable = [
        'cliente_id', 'resultado', 'coincidencia', 'listas_restrictivas', 'motivo', 'escenario',
        'modo_simulado', 'rutas_imagenes', 'registrado_en',
    ];

    protected $hidden = ['rutas_imagenes', 'listas_restrictivas'];

    protected function casts(): array
    {
        return [
            'coincidencia' => 'float',
            'modo_simulado' => 'boolean',
            'rutas_imagenes' => 'encrypted:array',
            'registrado_en' => 'datetime',
        ];
    }
}
