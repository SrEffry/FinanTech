<?php

namespace App\Modules\Identidad\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * P3 / RN-17: alguien intentó registrarse con el documento o el correo de una cuenta que
 * ya existe. La respuesta del registro no lo revela; el aviso real llega solo al titular.
 * No lleva ningún dato de quien lo intentó (podría ser un tercero).
 */
class AvisoIntentoRegistroMail extends Mailable
{
    public function __construct(public readonly string $urlPortal, public readonly string $momento) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Alguien intentó crear una cuenta con tus datos en FinanTech');
    }

    public function content(): Content
    {
        $ingresar = e(rtrim($this->urlPortal, '/').'/ingresar');
        $recuperar = e(rtrim($this->urlPortal, '/').'/recuperar');
        $momento = e($this->momento);

        return new Content(htmlString: <<<HTML
            <p>El {$momento} alguien intentó crear una cuenta nueva en FinanTech con datos que ya están
            registrados a tu nombre. No creamos ninguna cuenta nueva.</p>
            <p><strong>Si fuiste tú,</strong> ya tienes una cuenta: <a href="{$ingresar}">ingresa</a> o, si no recuerdas
            tu contraseña, <a href="{$recuperar}">crea una nueva</a>.</p>
            <p><strong>Si no fuiste tú,</strong> no tienes que hacer nada: tu cuenta sigue protegida. Si te preocupa,
            comunícate con nuestros canales de atención.</p>
            HTML);
    }
}
