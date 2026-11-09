<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Model;

/** RN-55: un empleado declaró un vínculo con este cliente. */
class VinculoCliente extends Model
{
    public $timestamps = false;

    protected $table = 'identidad_vinculos_cliente';

    protected $fillable = ['usuario_id', 'cliente_id', 'registrado_en'];

    protected function casts(): array
    {
        return ['usuario_id' => 'integer', 'cliente_id' => 'integer', 'registrado_en' => 'datetime'];
    }
}
