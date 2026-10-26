<?php

namespace App\Modules\Identidad\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class CodigoVerificacionMail extends Mailable
{
    public function __construct(public readonly string $codigo, public readonly int $minutosVigencia) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Tu código de verificación de FinanTech');
    }

    public function content(): Content
    {
        $codigo = e($this->codigo);

        return new Content(htmlString: <<<HTML
            <p>Tu código para verificar el correo en FinanTech es:</p>
            <p style="font-size:24px;font-weight:bold;letter-spacing:4px">{$codigo}</p>
            <p>Vence en {$this->minutosVigencia} minutos. Si no estás creando una cuenta, ignora este mensaje.</p>
            HTML);
    }
}
