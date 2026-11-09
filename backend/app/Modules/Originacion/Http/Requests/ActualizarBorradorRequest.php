<?php

namespace App\Modules\Originacion\Http\Requests;

use App\Modules\Originacion\Services\CatalogoDocumentos;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `CambiosBorrador` del contrato. El borrador se guarda a medias: aquí solo se valida el
 * tipo de cada dato; lo que hace falta para radicar se exige al radicar (RF-06 paso 6).
 * No hay campos de sexo, estado civil, salud ni parentesco (RN-43).
 */
class ActualizarBorradorRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'monto' => ['sometimes', 'integer', 'min:0', 'max:1000000000'],
            'plazo_meses' => ['sometimes', 'integer', 'min:0', 'max:600'],
            'laboral' => ['sometimes', 'array:ocupacion,empleador,antiguedad_laboral_meses'],
            'laboral.ocupacion' => ['nullable', 'string', Rule::in(CatalogoDocumentos::OCUPACIONES)],
            'laboral.empleador' => ['nullable', 'string', 'max:120'],
            'laboral.antiguedad_laboral_meses' => ['nullable', 'integer', 'min:0', 'max:720'],
            'financiero' => ['sometimes', 'array:ingreso_mensual,egreso_mensual'],
            'financiero.ingreso_mensual' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'financiero.egreso_mensual' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'referencia' => ['sometimes', 'array:nombre,celular'],
            'referencia.nombre' => ['nullable', 'string', 'max:120'],
            'referencia.celular' => ['nullable', 'string', 'max:20'],
            'acepta_consulta_centrales' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'laboral.ocupacion.in' => 'Elige tu ocupación.',
            'laboral.antiguedad_laboral_meses.*' => 'Escribe los meses como un número entero.',
            'financiero.ingreso_mensual.*' => 'Escribe tu ingreso mensual en pesos, sin puntos ni decimales.',
            'financiero.egreso_mensual.*' => 'Escribe tus gastos mensuales en pesos, sin puntos ni decimales.',
        ];
    }
}
