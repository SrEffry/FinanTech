<?php

namespace App\Modules\Identidad\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * P3 / RN-17: el documento ya pertenece a otra cuenta, pero el correo escrito es nuevo.
 * En lugar del código, ese correo recibe este mensaje, que no confirma de quién es la cuenta.
 */
class RegistroNoDisponibleMail extends Mailable
{
    public function __construct(public readonly string $urlPortal) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'No pudimos continuar con tu registro en FinanTech');
    }

    public function content(): Content
    {
        $recuperar = e(rtrim($this->urlPortal, '/').'/recuperar');

        return new Content(htmlString: <<<HTML
            <p>Recibimos una solicitud para crear una cuenta en FinanTech con este correo, pero no podemos
            continuar con el registro en línea con los datos que se ingresaron.</p>
            <p>Si ya tienes una cuenta con nosotros, <a href="{$recuperar}">recupera el acceso</a>.
            Si no, comunícate con nuestros canales de atención para ayudarte.</p>
            <p>Si no estás creando una cuenta, ignora este mensaje.</p>
            HTML);
    }
}
