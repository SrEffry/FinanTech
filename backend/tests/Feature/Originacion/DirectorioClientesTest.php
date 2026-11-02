<?php

use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Originacion\Contracts\DirectorioClientes;
use App\Shared\Exceptions\ErrorNegocio;
use Tests\Support\DatosPrueba;

/*
 * Adaptador de Originacion sobre PerfilCliente (D3). La prueba sí usa modelos de
 * Identidad para preparar datos; el código de Originacion no (CP0002).
 */

function clienteDePrueba(string $kyc = Cliente::KYC_VERIFICADO): Cliente
{
    $usuario = DatosPrueba::usuario(Rol::CLIENTE);
    $cliente = Cliente::where('usuario_id', $usuario->id)->firstOrFail();
    $cliente->update(['estado_kyc' => $kyc]);

    return $cliente;
}

describe('directorio de clientes sobre Identidad (D3)', function () {
    it('dice si la identidad está verificada (RN-07)', function () {
        $directorio = app(DirectorioClientes::class);

        expect($directorio->identidadVerificada(clienteDePrueba()->id))->toBeTrue()
            ->and($directorio->identidadVerificada(clienteDePrueba(Cliente::KYC_PENDIENTE)->id))->toBeFalse()
            ->and($directorio->identidadVerificada(999_999))->toBeFalse();
    });

    it('toma el último movimiento del consentimiento de consulta a centrales (RN-33)', function () {
        $cliente = clienteDePrueba();
        $directorio = app(DirectorioClientes::class);
        $mover = fn (string $accion, string $momento) => Consentimiento::create([
            'cliente_id' => $cliente->id, 'finalidad_codigo' => 'consulta_centrales', 'accion' => $accion,
            'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => $momento,
        ]);

        expect($directorio->consienteConsultaCentrales($cliente->id))->toBeFalse();
        $mover(Consentimiento::OTORGA, '2026-10-01 10:00:00');
        expect($directorio->consienteConsultaCentrales($cliente->id))->toBeTrue();
        $mover(Consentimiento::REVOCA, '2026-10-02 10:00:00');
        expect($directorio->consienteConsultaCentrales($cliente->id))->toBeFalse();
    });

    it('entrega los datos conocidos ya enmascarados (RN-32, RNF-06)', function () {
        $cliente = clienteDePrueba();

        $datos = app(DirectorioClientes::class)->datosConocidos($cliente->id);

        expect(array_keys($datos))->toBe(['nombre_completo', 'documento_enmascarado', 'fecha_nacimiento', 'email', 'telefono_enmascarado'])
            ->and($datos['documento_enmascarado'])->not->toContain($cliente->num_documento)
            ->and($datos['documento_enmascarado'])->toEndWith(substr($cliente->num_documento, -4))
            ->and($datos['telefono_enmascarado'])->not->toContain($cliente->telefono);
    });

    it('responde 404 claro si el cliente no existe', function () {
        app(DirectorioClientes::class)->datosConocidos(999_999);
    })->throws(ErrorNegocio::class, 'No encontramos tus datos de cliente');
});
