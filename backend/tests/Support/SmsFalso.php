<?php

namespace Tests\Support;

use App\Modules\Identidad\Contracts\EnviadorSms;

class SmsFalso implements EnviadorSms
{
    /** @var list<array{telefono: string, mensaje: string}> */
    public array $enviados = [];

    public function enviar(string $telefono, string $mensaje): void
    {
        $this->enviados[] = compact('telefono', 'mensaje');
    }

    public function esSimulado(): bool
    {
        return true;
    }

    public function ultimoCodigo(): ?string
    {
        $ultimo = end($this->enviados);

        return $ultimo && preg_match('/\b(\d{6})\b/', $ultimo['mensaje'], $m) ? $m[1] : null;
    }
}
