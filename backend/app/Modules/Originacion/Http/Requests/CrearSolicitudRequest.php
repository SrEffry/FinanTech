<?php

namespace App\Modules\Originacion\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** RF-06 paso 1: la solicitud nace de la simulación (producto, monto y plazo). */
class CrearSolicitudRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'producto' => ['required', 'string', 'max:40'],
            // El rango del producto lo aplica el servicio (RF-05 FA-01: se lleva al rango).
            'monto' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'plazo_meses' => ['required', 'integer', 'min:0', 'max:600'],
        ];
    }
}
