<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Model;

class Rol extends Model
{
    public const CLIENTE = 'cliente';
    public const ANALISTA = 'analista';
    public const OFICIAL = 'oficial';
    public const CONTABILIDAD = 'contabilidad';
    public const DIRECTIVO = 'directivo';
    public const ADMINISTRADOR = 'administrador';

    protected $table = 'identidad_roles';

    protected $fillable = ['codigo', 'nombre', 'descripcion', 'interno'];

    protected function casts(): array
    {
        return ['interno' => 'boolean'];
    }
}
