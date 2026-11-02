<?php

namespace App\Modules\Identidad\Http\Controllers;

use Illuminate\Http\JsonResponse;

class SistemaController
{
    /** MR-003 / MR-004: el portal muestra el distintivo cuando los terceros son simulados. */
    public function estado(): JsonResponse
    {
        return response()->json([
            'servicios_externos' => config('finantech.servicios_externos') === 'real' ? 'real' : 'simulado',
        ]);
    }
}
