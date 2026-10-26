<?php

namespace App\Modules\Identidad\Models;

use App\Modules\Identidad\Services\IndiceCiego;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Maestro único de clientes: sustituye los cinco registros dispersos (RF-01).
 */
class Cliente extends Model
{
    public const KYC_PENDIENTE = 'pendiente';
    public const KYC_VERIFICADO = 'verificado';
    public const KYC_REVISION_MANUAL = 'revision_manual';
    public const KYC_BLOQUEADO = 'bloqueado';

    protected $table = 'identidad_clientes';

    protected $fillable = [
        'usuario_id', 'tipo_documento', 'num_documento', 'nombres', 'apellidos',
        'fecha_nacimiento', 'telefono', 'telefono_verificado_en', 'estado_kyc',
    ];

    protected $hidden = ['num_documento', 'num_documento_hash'];

    protected function casts(): array
    {
        return [
            'num_documento' => 'encrypted',
            'fecha_nacimiento' => 'date',
            'telefono_verificado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Cliente $cliente) {
            if ($cliente->isDirty('num_documento')) {
                $cliente->num_documento_hash = IndiceCiego::documento($cliente->num_documento);
            }
        });
    }

    /** RNF-06: en pantalla solo se muestran los últimos 4 dígitos. */
    protected function documentoEnmascarado(): Attribute
    {
        return Attribute::get(fn () => str_repeat('•', max(0, strlen($this->num_documento) - 4)).substr($this->num_documento, -4));
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }

    public function consentimientos(): HasMany
    {
        return $this->hasMany(Consentimiento::class);
    }
}
