<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Model;

class Finalidad extends Model
{
    public const GESTION_CLIENTE = 'gestion_cliente';
    public const VERIFICACION_IDENTIDAD = 'verificacion_identidad';
    public const CONSULTA_CENTRALES = 'consulta_centrales';
    public const OFERTAS_COMERCIALES = 'ofertas_comerciales';
    public const ENCUESTAS = 'encuestas_satisfaccion';

    public $timestamps = false;

    protected $table = 'identidad_finalidades';

    protected $fillable = ['politica_id', 'codigo', 'nombre', 'descripcion', 'necesaria', 'orden'];

    protected function casts(): array
    {
        return ['necesaria' => 'boolean'];
    }
}
