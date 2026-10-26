<?php

namespace App\Modules\Identidad\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PoliticaTratamiento extends Model
{
    protected $table = 'identidad_politicas_tratamiento';

    protected $fillable = ['version', 'vigente_desde', 'resumen'];

    protected function casts(): array
    {
        return ['vigente_desde' => 'date'];
    }

    public static function vigente(): self
    {
        return static::query()
            ->where('vigente_desde', '<=', now()->toDateString())
            ->orderByDesc('vigente_desde')
            ->firstOrFail();
    }

    public function finalidades(): HasMany
    {
        return $this->hasMany(Finalidad::class, 'politica_id')->orderBy('orden');
    }
}
