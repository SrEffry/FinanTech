<?php

namespace App\Modules\Identidad\Models;

use App\Shared\Eloquent\SoloAdicion;
use Illuminate\Database\Eloquent\Model;

/**
 * Cada otorgamiento o revocación de una finalidad (RN-04, RN-21).
 */
class Consentimiento extends Model
{
    use SoloAdicion;

    public const OTORGA = 'otorga';
    public const REVOCA = 'revoca';

    public $timestamps = false;

    protected $table = 'identidad_consentimientos';

    protected $fillable = ['cliente_id', 'finalidad_codigo', 'accion', 'version_politica', 'canal', 'registrado_en'];

    protected function casts(): array
    {
        return ['registrado_en' => 'datetime'];
    }
}
