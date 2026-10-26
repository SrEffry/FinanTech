<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Empleado extends Model
{
    protected $table = 'identidad_empleados';

    protected $fillable = ['usuario_id', 'cargo', 'area', 'atribucion_monto'];

    protected function casts(): array
    {
        return ['atribucion_monto' => 'decimal:2'];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }
}
