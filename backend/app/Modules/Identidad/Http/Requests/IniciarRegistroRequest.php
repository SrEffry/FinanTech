<?php

namespace App\Modules\Identidad\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class IniciarRegistroRequest extends FormRequest
{
    public const TIPOS_DOCUMENTO = ['CC', 'CE', 'PA', 'PPT'];

    public function rules(): array
    {
        $edadMinima = config('finantech.registro.edad_minima');

        return [
            'tipo_documento' => ['required', Rule::in(self::TIPOS_DOCUMENTO)],
            'num_documento' => ['required', 'string', 'regex:/^[0-9A-Za-z]{5,15}$/'],
            'nombres' => ['required', 'string', 'max:80', "regex:/^[\\pL' -]+$/u"],
            'apellidos' => ['required', 'string', 'max:80', "regex:/^[\\pL' -]+$/u"],
            // RN-03: solo mayores de 18 años, contra la fecha del sistema.
            'fecha_nacimiento' => ['required', 'date', 'before_or_equal:'.now()->subYears($edadMinima)->toDateString(), 'after:1900-01-01'],
            'email' => ['required', 'string', 'email:rfc', 'max:160'],
            'telefono' => ['required', 'regex:/^3\d{9}$/'],
            // RNF-05: mínimo 10 caracteres, mezcla de tipos y contraste con contraseñas filtradas.
            'password' => ['required', 'confirmed', Password::min(10)->mixedCase()->numbers()->symbols()->uncompromised()],
            'acepta_politica' => ['accepted'],
            'finalidades_opcionales' => ['present', 'array'],
            'finalidades_opcionales.*' => ['string', 'distinct'],
            'canal' => ['sometimes', Rule::in(['web', 'movil'])],
        ];
    }

    public function messages(): array
    {
        return [
            'fecha_nacimiento.before_or_equal' => 'Debes ser mayor de 18 años para registrarte.',
            'num_documento.regex' => 'El número de documento debe tener entre 5 y 15 letras o números, sin puntos ni espacios.',
            'telefono.regex' => 'Ingresa un celular colombiano de 10 dígitos que empiece por 3.',
            'nombres.regex' => 'El nombre solo puede tener letras y espacios.',
            'apellidos.regex' => 'Los apellidos solo pueden tener letras y espacios.',
            'acepta_politica.accepted' => 'Debes leer y aceptar la política de tratamiento de datos.',
        ];
    }
}
