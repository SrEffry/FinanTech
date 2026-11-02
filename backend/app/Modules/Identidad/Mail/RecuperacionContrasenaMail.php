<?php

namespace App\Modules\Identidad\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class RecuperacionContrasenaMail extends Mailable
{
    public function __construct(public readonly string $enlace, public readonly int $minutosVigencia) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Crea una contraseña nueva para FinanTech');
    }

    public function content(): Content
    {
        $enlace = e($this->enlace);

        return new Content(htmlString: <<<HTML
            <p>Recibimos una solicitud para crear una contraseña nueva en FinanTech.</p>
            <p><a href="{$enlace}">Crear contraseña nueva</a></p>
            <p>El enlace vence en {$this->minutosVigencia} minutos y solo sirve una vez.
            Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.</p>
            HTML);
    }
}
