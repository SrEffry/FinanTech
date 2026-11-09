<?php

namespace App\Modules\Originacion\Models;

use Illuminate\Database\Eloquent\Model;

/** Documento de soporte de una solicitud (RF-06, RN-30). Ruta y nombre cifrados en reposo. */
class DocumentoSolicitud extends Model
{
    public const PENDIENTE = 'pendiente';
    public const CARGADO = 'cargado';
    public const RECHAZADO = 'rechazado';
    public const APROBADO = 'aprobado';

    protected $table = 'originacion_documentos';

    protected $fillable = [
        'solicitud_id', 'tipo', 'requerido', 'estado', 'motivo_rechazo', 'archivo_nombre',
        'archivo_tamano', 'archivo_mime', 'ruta', 'huella_sha256', 'cargado_en',
    ];

    protected $hidden = ['ruta', 'huella_sha256'];

    protected function casts(): array
    {
        return [
            'requerido' => 'boolean',
            'archivo_nombre' => 'encrypted',
            'archivo_tamano' => 'integer',
            'ruta' => 'encrypted',
            'cargado_en' => 'datetime',
        ];
    }

    /** Falta para radicar o para devolver la solicitud a estudio. */
    public function faltante(): bool
    {
        return $this->requerido && in_array($this->estado, [self::PENDIENTE, self::RECHAZADO], true);
    }
}
