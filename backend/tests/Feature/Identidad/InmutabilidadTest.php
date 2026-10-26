<?php

use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Identidad\Services\Auditoria;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

describe('CP0010 — la bitácora de auditoría es inmutable (RNF-08)', function () {
    beforeEach(function () {
        app(Auditoria::class)->registrar('prueba.accion', 'entidad', 1, detalle: ['x' => 1]);
        $this->registro = RegistroAuditoria::sole();
    });

    it('guarda actor, momento, origen, entidad y resultado', function () {
        expect($this->registro->only(['accion', 'entidad', 'id_entidad', 'resultado']))
            ->toBe(['accion' => 'prueba.accion', 'entidad' => 'entidad', 'id_entidad' => '1', 'resultado' => 'exito'])
            ->and($this->registro->origen_ip)->not->toBeNull()
            ->and($this->registro->registrado_en)->not->toBeNull();
    });

    it('rechaza modificar un registro desde el modelo', function () {
        $this->registro->resultado = 'alterado';
        $this->registro->save();
    })->throws(LogicException::class);

    it('rechaza borrar un registro desde el modelo', function () {
        $this->registro->delete();
    })->throws(LogicException::class);

    it('rechaza modificar o borrar directamente en la base de datos', function () {
        expect(fn () => DB::table('identidad_auditoria')->update(['resultado' => 'alterado']))->toThrow(QueryException::class)
            ->and(fn () => DB::table('identidad_auditoria')->delete())->toThrow(QueryException::class)
            ->and(RegistroAuditoria::sole()->resultado)->toBe('exito');
    });
});

describe('CP0006 paso 7 — el histórico de consentimientos es inmutable (RN-21)', function () {
    beforeEach(function () {
        $usuario = Usuario::create([
            'rol_id' => Rol::where('codigo', Rol::CLIENTE)->value('id'),
            'nombre_completo' => 'Ana Gómez', 'email' => 'ana@example.com', 'password' => 'Clave-Segura-2026',
        ]);
        $cliente = Cliente::create([
            'usuario_id' => $usuario->id, 'tipo_documento' => 'CC', 'num_documento' => '1000000001',
            'nombres' => 'Ana', 'apellidos' => 'Gómez', 'fecha_nacimiento' => '1990-01-01', 'telefono' => '3000000001',
        ]);
        $this->consentimiento = Consentimiento::create([
            'cliente_id' => $cliente->id, 'finalidad_codigo' => 'ofertas_comerciales', 'accion' => 'otorga',
            'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => now(),
        ]);
    });

    it('rechaza modificar un consentimiento desde el modelo', function () {
        $this->consentimiento->accion = 'revoca';
        $this->consentimiento->save();
    })->throws(LogicException::class);

    it('rechaza modificar o borrar directamente en la base de datos', function () {
        expect(fn () => DB::table('identidad_consentimientos')->update(['accion' => 'revoca']))->toThrow(QueryException::class)
            ->and(fn () => DB::table('identidad_consentimientos')->delete())->toThrow(QueryException::class);
    });
});
