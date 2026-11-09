<?php

namespace App\Modules\Evaluacion\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * RF-10: forma del cuerpo `NuevaDecision` de tipos.ts. Las reglas de negocio (motivo, resultado,
 * atribución, conflicto, tasa) las verifica DecisionesCredito, con sus códigos del contrato.
 */
class RegistrarDecisionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'solicitud_id' => ['required', 'uuid'],
            'resultado' => ['nullable', 'string', 'max:30'],
            'motivo' => ['nullable', 'string', 'max:1000'],
            'ajustes' => ['nullable', 'array'],
            'ajustes.monto' => ['required_with:ajustes', 'integer', 'min:1'],
            'ajustes.plazo_meses' => ['required_with:ajustes', 'integer', 'min:1', 'max:600'],
            'ajustes.tasa_ea' => ['required_with:ajustes', 'numeric', 'min:0', 'max:999'],
        ];
    }

    public function messages(): array
    {
        return [
            'solicitud_id.*' => 'Indica la solicitud que vas a decidir.',
            'motivo.max' => 'El motivo puede tener hasta 1.000 caracteres.',
            'ajustes.*.*' => 'Revisa el monto, el plazo y la tasa ajustados.',
        ];
    }
}
