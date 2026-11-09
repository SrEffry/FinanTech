<?php

namespace App\Modules\Identidad\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Copia de un SMS simulado en la bandeja de desarrollo (Mailpit), para registrarse sin
 * abrir laravel.log. MR-003: va marcado como simulado en el asunto y en el cuerpo.
 * RNF-06 (D-01): el celular llega ya enmascarado; el texto sí lleva el código.
 */
class SmsSimuladoMail extends Mailable
{
    public function __construct(public readonly string $celularEnmascarado, public readonly string $texto) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "[SMS SIMULADO] para {$this->celularEnmascarado}");
    }

    public function content(): Content
    {
        $celular = e($this->celularEnmascarado);
        $texto = e($this->texto);

        return new Content(htmlString: <<<HTML
            <p style="display:inline-block;padding:2px 8px;border:2px dashed #9a3412;color:#9a3412;font-weight:bold">
            SMS SIMULADO — no se envió ningún mensaje de texto real</p>
            <p>Para: {$celular}</p>
            <p style="font-size:18px">{$texto}</p>
            HTML);
    }
}
