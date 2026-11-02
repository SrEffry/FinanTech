<?php

use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\VerificacionIdentidad;
use App\Modules\Identidad\Services\PerfilCliente;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\Personas;

function idtOtorgar($cliente, array $finalidades): void
{
    foreach ($finalidades as $finalidad) {
        Consentimiento::create([
            'cliente_id' => $cliente->id, 'finalidad_codigo' => $finalidad, 'accion' => 'otorga',
            'version_politica' => '1.0', 'canal' => 'web', 'registrado_en' => now()->subDay(),
        ]);
    }
}

/** Imagen PNG de 1×1 sintética (la imagen PHP no trae GD). */
function idtImagen(string $nombre): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

    return UploadedFile::fake()->createWithContent($nombre, $png);
}

function idtCapturas(?string $escenario = null): array
{
    return array_filter([
        'documento_frente' => idtImagen('frente.png'),
        'documento_reverso' => idtImagen('reverso.png'),
        'rostro' => idtImagen('rostro.png'),
        'escenario' => $escenario,
    ]);
}

describe('CP0006 — consentimiento por finalidad (RF-04, RN-04, RN-18, RN-21)', function () {
    beforeEach(function () {
        $this->usuario = Personas::cliente();
        idtOtorgar($this->usuario->cliente, ['gestion_cliente', 'verificacion_identidad']);
        $this->actingAs($this->usuario);
    });

    it('muestra cada finalidad con su estado; las opcionales sin otorgar por defecto', function () {
        $estado = $this->getJson('/api/v1/identidad/consentimientos')->assertOk()
            ->assertJsonPath('politica.version', '1.0')
            ->json();

        $finalidades = collect($estado['finalidades'])->keyBy('codigo');
        expect($finalidades['gestion_cliente'])->toMatchArray(['necesaria' => true, 'otorgada' => true])
            ->and($finalidades['ofertas_comerciales'])->toMatchArray(['necesaria' => false, 'otorgada' => false, 'actualizada_en' => null])
            ->and($estado['historial'])->toHaveCount(2);
    });

    it('otorga y revoca una opcional; cada cambio es un registro nuevo con canal y versión (RN-04, RN-21)', function () {
        $this->postJson('/api/v1/identidad/consentimientos', ['finalidad' => 'ofertas_comerciales', 'accion' => 'otorga', 'canal' => 'web'])
            ->assertOk();
        $estado = $this->postJson('/api/v1/identidad/consentimientos', ['finalidad' => 'ofertas_comerciales', 'accion' => 'revoca', 'canal' => 'movil'])
            ->assertOk()->json();

        expect(collect($estado['finalidades'])->firstWhere('codigo', 'ofertas_comerciales')['otorgada'])->toBeFalse()
            ->and($estado['historial'][0])->toMatchArray([
                'finalidad' => 'ofertas_comerciales', 'accion' => 'revoca', 'canal' => 'movil', 'version_politica' => '1.0',
                'nombre_finalidad' => 'Ofertas comerciales',
            ]);

        $movimientos = Consentimiento::where('finalidad_codigo', 'ofertas_comerciales')->orderBy('id')->pluck('accion')->all();
        expect($movimientos)->toBe(['otorga', 'revoca'])
            ->and(RegistroAuditoria::where('accion', 'consentimiento.revocado')->count())->toBe(1);

        // RN-19: el resto de módulos ve el cambio de inmediato.
        expect(app(PerfilCliente::class)->tieneConsentimiento($this->usuario->cliente->id, 'ofertas_comerciales'))->toBeFalse();
    });

    it('no duplica el registro si la finalidad ya estaba en ese estado', function () {
        $this->postJson('/api/v1/identidad/consentimientos', ['finalidad' => 'gestion_cliente', 'accion' => 'otorga'])->assertOk();

        expect(Consentimiento::count())->toBe(2);
    });

    it('no deja revocar una finalidad necesaria (RN-18)', function () {
        $this->postJson('/api/v1/identidad/consentimientos', ['finalidad' => 'gestion_cliente', 'accion' => 'revoca'])
            ->assertUnprocessable()->assertJson(['codigo' => 'finalidad_necesaria']);
    });

    it('rechaza finalidades o acciones que no existen', function () {
        $this->postJson('/api/v1/identidad/consentimientos', ['finalidad' => 'inventada', 'accion' => 'otorga'])
            ->assertUnprocessable()->assertJson(['codigo' => 'finalidad_invalida']);
        $this->postJson('/api/v1/identidad/consentimientos', ['finalidad' => 'encuestas_satisfaccion', 'accion' => 'borrar'])
            ->assertUnprocessable()->assertJson(['codigo' => 'finalidad_invalida']);
    });

    it('la política vigente trae el texto completo para leer antes de aceptar (D6, UX-04)', function () {
        $this->getJson('/api/v1/identidad/politica-vigente')->assertOk()
            ->assertJsonPath('texto', fn ($texto) => str_contains($texto, 'Ley 1581 de 2012') && str_contains($texto, 'Tus derechos'));
    });

    it('el histórico no se puede modificar ni borrar en la base (RN-21)', function () {
        expect(fn () => DB::table('identidad_consentimientos')->update(['accion' => 'revoca']))->toThrow(Exception::class);
    });

    it('solo el cliente titular accede (RNF-05)', function () {
        $this->actingAs(Personas::interno(Rol::ADMINISTRADOR));
        $this->getJson('/api/v1/identidad/consentimientos')->assertForbidden();
    });
});

describe('CP0003 y CP0007 — verificación de identidad con adaptador simulado (RF-02, RN-07, RN-08, RN-10, RN-11, MR-003)', function () {
    beforeEach(function () {
        Storage::fake('local');
        $this->usuario = Personas::cliente(['num_documento' => '1020456782']);
        $this->clienteId = $this->usuario->cliente->id;
        $this->actingAs($this->usuario);
    });

    it('con coincidencia de 0,85 o más y sin listas, verifica y habilita la radicación (RN-07, RN-08)', function () {
        $perfil = app(PerfilCliente::class);
        expect($perfil->identidadVerificada($this->clienteId))->toBeFalse();

        $this->getJson('/api/v1/clientes/verificacion-identidad')->assertOk()
            ->assertExactJson(['estado_kyc' => 'pendiente', 'resultado' => null, 'coincidencia' => null, 'mensaje' => null, 'intentos_restantes' => 5, 'simulado' => true]);

        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('exito'), ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJson(['estado_kyc' => 'verificado', 'resultado' => 'verificado', 'coincidencia' => 0.93, 'simulado' => true]);

        expect($perfil->identidadVerificada($this->clienteId))->toBeTrue();
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('exito'), ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJson(['codigo' => 'identidad_ya_verificada']);
    });

    it('guarda las imágenes cifradas y sus rutas cifradas (RN-09)', function () {
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('exito'), ['Accept' => 'application/json'])->assertOk();

        $verificacion = VerificacionIdentidad::sole();
        $rutas = $verificacion->rutas_imagenes;
        expect($rutas)->toHaveKeys(['documento_frente', 'documento_reverso', 'rostro'])
            ->and(DB::table('identidad_verificaciones')->value('rutas_imagenes'))->not->toContain('identidad/');

        $guardado = Storage::disk('local')->get($rutas['rostro']);
        expect($guardado)->not->toContain('PNG');
    });

    it('con coincidencia menor a 0,85 pasa a revisión manual (RN-08, FA-02)', function () {
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('coincidencia_baja'), ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['estado_kyc' => 'revision_manual', 'resultado' => 'revision_manual', 'coincidencia' => 0.71]);

        expect(Cliente::find($this->clienteId)->estado_kyc)->toBe('revision_manual');
    });

    it('rechaza la captura ilegible con el motivo y al quinto intento pasa a revisión manual (RN-11, FA-01)', function () {
        foreach (range(1, 4) as $intento) {
            $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('documento_ilegible'), ['Accept' => 'application/json'])
                ->assertOk()
                ->assertJson(['estado_kyc' => 'pendiente', 'resultado' => 'ilegible', 'intentos_restantes' => 5 - $intento])
                ->assertJsonPath('mensaje', fn ($m) => str_contains($m, 'borrosa'));
        }

        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('documento_ilegible'), ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['estado_kyc' => 'revision_manual', 'resultado' => 'revision_manual', 'intentos_restantes' => 0]);
    });

    it('si el proveedor no responde, queda en cola sin negar (FA-03)', function () {
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('servicio_caido'), ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['estado_kyc' => 'pendiente', 'resultado' => 'en_cola']);
    });

    it('con coincidencia en listas restrictivas no continúa y no revela el motivo (RN-10, FA-04)', function () {
        $respuesta = $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('lista_restrictiva'), ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['estado_kyc' => 'bloqueado', 'resultado' => 'no_continua', 'coincidencia' => null]);

        expect(mb_strtolower($respuesta->getContent()))->not->toContain('lista')->not->toContain('restrictiva')->not->toContain('lavado');
        expect(RegistroAuditoria::where('accion', 'cumplimiento.alerta_listas')->exists())->toBeTrue();

        // Bloqueado: reintentar no cambia nada.
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('exito'), ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['estado_kyc' => 'bloqueado', 'resultado' => null]);
    });

    it('deja cada llamada al proveedor en la auditoría marcada como simulada (MR-003)', function () {
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('exito'), ['Accept' => 'application/json']);

        $llamadas = RegistroAuditoria::whereIn('accion', ['identidad.proveedor_verificacion', 'identidad.listas_restrictivas', 'identidad.verificacion'])->get();
        expect($llamadas)->toHaveCount(3)
            ->and($llamadas->every(fn ($r) => $r->modo_simulado === true))->toBeTrue();
    });

    it('con proveedores reales sin contratar nunca marca como verificada (MR-003)', function () {
        config(['finantech.servicios_externos' => 'real']);

        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('exito'), ['Accept' => 'application/json'])
            ->assertOk()->assertJson(['estado_kyc' => 'pendiente', 'resultado' => 'en_cola', 'simulado' => false]);
        expect(VerificacionIdentidad::sole()->escenario)->toBeNull();
    });

    it('exige las tres capturas en JPG o PNG', function () {
        $this->post('/api/v1/clientes/verificacion-identidad', [
            'documento_frente' => UploadedFile::fake()->createWithContent('frente.txt', 'hola'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['documento_frente', 'documento_reverso', 'rostro'])
            ->assertJsonPath('errors.rostro.0', 'Falta la foto de tu rostro.');
    });

    it('el histórico de verificaciones es de solo adición', function () {
        $this->post('/api/v1/clientes/verificacion-identidad', idtCapturas('documento_ilegible'), ['Accept' => 'application/json']);

        expect(fn () => DB::table('identidad_verificaciones')->delete())->toThrow(Exception::class)
            ->and(fn () => VerificacionIdentidad::first()->delete())->toThrow(LogicException::class);
    });

    it('solo el cliente verifica su identidad', function () {
        $this->actingAs(Personas::interno(Rol::ANALISTA));
        $this->getJson('/api/v1/clientes/verificacion-identidad')->assertForbidden();
    });
});
