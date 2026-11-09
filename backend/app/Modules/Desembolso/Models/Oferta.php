<?php

namespace App\Modules\Desembolso\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** Oferta de crédito (RF-11). Privado del módulo: los demás usan Desembolso\Services. */
class Oferta extends Model
{
    use HasUuids;

    public const VIGENTE = 'vigente';
    public const FIRMADA = 'firmada';
    public const RECHAZADA = 'rechazada';
    public const VENCIDA = 'vencida';

    protected $table = 'desembolso_ofertas';

    protected $fillable = [
        'solicitud_id', 'decision_id', 'cliente_id', 'radicado', 'producto_codigo', 'version_parametros',
        'monto', 'plazo_meses', 'tasa_ea', 'cuota', 'costo_total', 'valor_a_recibir', 'desglose', 'plan',
        'condiciones_originales', 'motivo_condicion', 'estado', 'emitida_en', 'vence_en', 'pagare_version',
        'pagare_texto', 'firma_huella_sha256', 'firma_sellada_en', 'firma_simulada', 'firma_proveedor',
        'cerrada_en', 'motivo_rechazo',
    ];

    protected function casts(): array
    {
        return [
            'cliente_id' => 'integer',
            'monto' => 'integer',
            'plazo_meses' => 'integer',
            'tasa_ea' => 'float',
            'cuota' => 'integer',
            'costo_total' => 'integer',
            'valor_a_recibir' => 'integer',
            'desglose' => 'array',
            'plan' => 'array',
            'condiciones_originales' => 'array',
            'emitida_en' => 'datetime',
            'vence_en' => 'datetime',
            'pagare_texto' => 'encrypted',
            'firma_sellada_en' => 'datetime',
            'firma_simulada' => 'boolean',
            'cerrada_en' => 'datetime',
        ];
    }
}
