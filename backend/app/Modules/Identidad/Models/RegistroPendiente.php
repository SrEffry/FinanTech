<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RegistroPendiente extends Model
{
    use HasUuids;

    protected $table = 'identidad_registros_pendientes';

    protected $fillable = [
        'datos', 'num_documento_hash', 'email', 'codigo_email_hash', 'codigo_telefono_hash',
        'intentos', 'reenvios', 'codigos_expiran_en', 'expira_en',
    ];

    protected $hidden = ['datos', 'codigo_email_hash', 'codigo_telefono_hash'];

    protected function casts(): array
    {
        return [
            'datos' => 'encrypted:array',
            'reenvios' => 'array',
            'codigos_expiran_en' => 'datetime',
            'expira_en' => 'datetime',
        ];
    }
}
