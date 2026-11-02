<?php

namespace App\Modules\Identidad\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Código del segundo factor (RN-15, RN-61). */
class CodigoSegundoFactorMail extends Mailable
{
    public function __construct(
        public readonly string $codigo,
        public readonly int $minutosVigencia,
        public readonly string $motivo,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Tu código de seguridad de FinanTech');
    }

    public function content(): Content
    {
        $codigo = e($this->codigo);
        $motivo = e($this->motivo);

        return new Content(htmlString: <<<HTML
            <p>Tu código para {$motivo} en FinanTech es:</p>
            <p style="font-size:24px;font-weight:bold;letter-spacing:4px">{$codigo}</p>
            <p>Vence en {$this->minutosVigencia} minutos. No lo compartas con nadie: FinanTech nunca te lo pedirá por teléfono.</p>
            <p>Si no fuiste tú, cambia tu contraseña.</p>
            HTML);
    }
}
