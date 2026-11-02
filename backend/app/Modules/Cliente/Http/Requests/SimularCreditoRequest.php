<?php

namespace App\Modules\Cliente\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Forma de la petición de simulación. Los rangos de cada producto no se validan aquí:
 * los aplica el simulador con el error `fuera_de_rango`, que trae el rango permitido
 * (RF-05 FA-01).
 */
class SimularCreditoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'producto' => ['required', 'string', 'max:40'],
            'monto' => ['required', 'integer', 'min:0', 'max:9999999999'],
            'plazo_meses' => ['required', 'integer', 'min:0', 'max:600'],
        ];
    }
}
