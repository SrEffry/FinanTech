<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * Credencial única para todos los canales y roles (RF-03, diagrama de clases).
 */
class Usuario extends Authenticatable
{
    public const ACTIVO = 'activo';
    public const BLOQUEADO = 'bloqueado';
    public const INACTIVO = 'inactivo';

    protected $table = 'identidad_usuarios';

    protected $fillable = [
        'rol_id', 'nombre_completo', 'email', 'email_verificado_en', 'password',
        'mfa_activo', 'estado', 'password_cambiada_en',
    ];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'mfa_activo' => 'boolean',
            'email_verificado_en' => 'datetime',
            'bloqueado_hasta' => 'datetime',
            'password_cambiada_en' => 'datetime',
            'ultimo_acceso_en' => 'datetime',
        ];
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class);
    }

    public function cliente(): HasOne
    {
        return $this->hasOne(Cliente::class);
    }

    public function empleado(): HasOne
    {
        return $this->hasOne(Empleado::class);
    }

    public function tieneRol(string ...$codigos): bool
    {
        return in_array($this->rol->codigo, $codigos, true);
    }
}
