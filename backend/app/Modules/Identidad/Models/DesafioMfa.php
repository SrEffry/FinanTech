<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Código de un solo uso del segundo factor (RN-15, RN-61). */
class DesafioMfa extends Model
{
    use HasUuids;

    public const SESION = 'sesion';

    protected $table = 'identidad_desafios_mfa';

    protected $fillable = [
        'usuario_id', 'proposito', 'referencia', 'codigo_hash', 'intentos', 'reenvios',
        'expira_en', 'reenvio_disponible_en',
    ];

    protected $hidden = ['codigo_hash'];

    protected function casts(): array
    {
        return [
            'expira_en' => 'datetime',
            'reenvio_disponible_en' => 'datetime',
        ];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
