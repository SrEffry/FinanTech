<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Model;

/** Contador de intentos fallidos por identificador, exista o no la cuenta (RN-12, RN-17). */
class IntentoAcceso extends Model
{
    protected $table = 'identidad_intentos_acceso';

    protected $fillable = ['identificador_hash', 'fallidos', 'ultimo_fallo_en', 'bloqueado_hasta'];

    protected function casts(): array
    {
        return [
            'ultimo_fallo_en' => 'datetime',
            'bloqueado_hasta' => 'datetime',
        ];
    }
}
