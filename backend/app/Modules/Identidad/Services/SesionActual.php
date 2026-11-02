<?php

namespace App\Modules\Identidad\Services;

use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\Datos\UsuarioAutenticado;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Support\Facades\Auth;

/**
 * Interfaz pública del módulo de Identidad: quién hace la petición (MR-002).
 *
 * Los demás módulos la inyectan en lugar de usar Auth::user(), que devuelve un
 * modelo privado de Identidad. La autorización siempre ocurre en el servidor (RNF-05).
 */
class SesionActual
{
    public const SIN_SESION = 'Tu sesión terminó. Vuelve a ingresar para continuar.';
    public const SIN_PERMISO = 'No tienes permiso para hacer esta acción.';

    public function usuario(): ?UsuarioAutenticado
    {
        $usuario = Auth::user();

        return $usuario instanceof Usuario ? UsuarioAutenticado::desde($usuario) : null;
    }

    public function id(): ?int
    {
        return Auth::id();
    }

    /** Id de identidad_clientes del usuario de la sesión, o null si no es cliente. */
    public function clienteId(): ?int
    {
        return $this->usuario()?->clienteId;
    }

    public function rol(): ?string
    {
        return $this->usuario()?->rol;
    }

    /**
     * Exige sesión y, si se indican, uno de los roles.
     *
     * @throws ErrorNegocio 401 sin_sesion o 403 sin_permiso
     */
    public function exigir(string ...$roles): UsuarioAutenticado
    {
        $usuario = $this->usuario();
        if (! $usuario) {
            throw new ErrorNegocio('sin_sesion', self::SIN_SESION, 401);
        }
        if ($roles !== [] && ! $usuario->tieneRol(...$roles)) {
            throw new ErrorNegocio('sin_permiso', self::SIN_PERMISO, 403);
        }

        return $usuario;
    }

    /**
     * Id de cliente del usuario de la sesión; exige que sea un cliente.
     *
     * @throws ErrorNegocio 401 sin_sesion o 403 sin_permiso
     */
    public function exigirClienteId(): int
    {
        return $this->exigir('cliente')->clienteId
            ?? throw new ErrorNegocio('sin_permiso', self::SIN_PERMISO, 403);
    }
}
