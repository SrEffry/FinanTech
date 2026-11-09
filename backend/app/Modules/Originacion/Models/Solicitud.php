<?php

namespace App\Modules\Originacion\Models;

use App\Modules\Originacion\Enums\EstadoSolicitud;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Solicitud de crédito (RF-06). El estado solo cambia a través del servicio
 * Originacion\Services\Solicitudes, que aplica la máquina de estados y deja historial.
 */
class Solicitud extends Model
{
    use HasUuids;

    protected $table = 'originacion_solicitudes';

    protected $fillable = [
        'cliente_id', 'producto_codigo', 'monto', 'plazo_meses', 'version_parametros', 'tasa_ea',
        'cuota_estimada', 'estado', 'clave_activa', 'radicado', 'radicada_en', 'ocupacion', 'empleador',
        'antiguedad_laboral_meses', 'ingreso_mensual', 'egreso_mensual', 'referencia_nombre',
        'referencia_celular', 'acepta_consulta_centrales', 'consentimiento_centrales_id',
        'estado_sla_pausado', 'ultimo_acceso_en',
    ];

    protected function casts(): array
    {
        return [
            'cliente_id' => 'integer',
            'monto' => 'integer',
            'plazo_meses' => 'integer',
            'tasa_ea' => 'float',
            'cuota_estimada' => 'integer',
            'estado' => EstadoSolicitud::class,
            'radicada_en' => 'datetime',
            'antiguedad_laboral_meses' => 'integer',
            'ingreso_mensual' => 'integer',
            'egreso_mensual' => 'integer',
            'referencia_nombre' => 'encrypted',
            'referencia_celular' => 'encrypted',
            'acepta_consulta_centrales' => 'boolean',
            'estado_sla_pausado' => 'boolean',
            'ultimo_acceso_en' => 'datetime',
        ];
    }

    public function historial(): HasMany
    {
        return $this->hasMany(HistorialEstado::class, 'solicitud_id')->orderBy('registrado_en')->orderBy('id');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(DocumentoSolicitud::class, 'solicitud_id')->orderBy('id');
    }

    /** RN-28: valor de la columna única mientras la solicitud está activa. */
    public static function claveActiva(int $clienteId, string $producto): string
    {
        return "{$clienteId}:{$producto}";
    }
}
