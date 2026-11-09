<?php

use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use App\Modules\Originacion\Enums\EstadoSolicitud as E;
use App\Modules\Originacion\Events\DocumentosEnviados;
use App\Modules\Originacion\Events\SolicitudRadicada;
use App\Modules\Originacion\Models\DocumentoSolicitud;
use App\Modules\Originacion\Models\Solicitud;
use App\Modules\Originacion\Services\Solicitudes;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\Personas;

/*
 * T11 · Radicación de punta a punta desde el portal del cliente (RF-06, RF-07, CP0012).
 * Contrato: docs/contrato-api-v1-frontend.md → "Originación (cliente)"; la referencia de
 * validaciones y mensajes es frontend/src/mocks/handlers/solicitudes.ts.
 */

const T11_URL = '/api/v1/originacion/solicitudes';

function t11Cliente(string $kyc = Cliente::KYC_VERIFICADO): Usuario
{
    return Personas::cliente(['estado_kyc' => $kyc]);
}

function t11ClienteId(Usuario $usuario): int
{
    return $usuario->cliente->id;
}

/** Datos completos para radicar (sintéticos). */
function t11DatosCompletos(string $ocupacion = 'empleado'): array
{
    return [
        'laboral' => ['ocupacion' => $ocupacion, 'empleador' => 'Empresa Sintética S.A.S.', 'antiguedad_laboral_meses' => 36],
        'financiero' => ['ingreso_mensual' => 4_500_000, 'egreso_mensual' => 1_500_000],
        'referencia' => ['nombre' => 'Pedro Referencia Sintética', 'celular' => '3109876543'],
        'acepta_consulta_centrales' => true,
    ];
}

function t11Pdf(string $nombre = 'soporte.pdf', int $kb = 120): UploadedFile
{
    return UploadedFile::fake()->create($nombre, $kb, 'application/pdf');
}

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    Storage::fake('local');
    $this->withHeaders(['Accept' => 'application/json', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->usuario = t11Cliente();
    $this->actingAs($this->usuario);

    /** Crea el borrador por la API y devuelve su id. */
    $this->crear = function (string $producto = 'libre_inversion', int $monto = 5_000_000, int $plazo = 24): string {
        return $this->postJson(T11_URL, ['producto' => $producto, 'monto' => $monto, 'plazo_meses' => $plazo])
            ->assertCreated()->json('id');
    };

    /** Borrador completo y con todos los documentos requeridos cargados, listo para radicar. */
    $this->listoParaRadicar = function (string $ocupacion = 'empleado'): string {
        $id = ($this->crear)();
        $this->patchJson(T11_URL."/{$id}", t11DatosCompletos($ocupacion))->assertOk();
        foreach (Solicitud::find($id)->documentos()->where('requerido', true)->pluck('tipo') as $tipo) {
            $this->post(T11_URL."/{$id}/documentos", ['tipo' => $tipo, 'archivo' => t11Pdf()])->assertOk();
        }

        return $id;
    };
});

describe('autorización (RNF-05, RN-35)', function () {
    it('responde 401 sin sesión y 403 a un rol interno en todas las rutas', function () {
        $rutas = [
            ['GET', T11_URL], ['POST', T11_URL], ['GET', T11_URL.'/x'], ['PATCH', T11_URL.'/x'],
            ['POST', T11_URL.'/x/documentos'], ['POST', T11_URL.'/x/radicar'], ['POST', T11_URL.'/x/enviar-documentos'],
        ];

        auth()->logout();
        foreach ($rutas as [$metodo, $url]) {
            $this->json($metodo, $url)->assertUnauthorized()->assertJsonPath('codigo', 'sin_sesion');
        }

        $this->actingAs(Personas::interno(Rol::ANALISTA));
        foreach ($rutas as [$metodo, $url]) {
            $this->json($metodo, $url)->assertForbidden()->assertJsonPath('codigo', 'sin_permiso');
        }
    });

    it('el cliente solo ve sus solicitudes; la de otro responde como si no existiera (RN-35)', function () {
        $propia = ($this->crear)();
        $otro = t11Cliente();
        $ajena = app(Solicitudes::class)->crearBorrador(t11ClienteId($otro), 'libre_inversion', 5_000_000, 24)->id;

        $this->getJson(T11_URL)->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $propia);

        $this->getJson(T11_URL."/{$ajena}")->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
        $this->patchJson(T11_URL."/{$ajena}", ['monto' => 3_000_000])->assertNotFound();
        $this->postJson(T11_URL."/{$ajena}/radicar")->assertNotFound();
        $this->post(T11_URL."/{$ajena}/documentos", ['tipo' => 'certificado_laboral', 'archivo' => t11Pdf()])->assertNotFound();
        $this->getJson(T11_URL.'/no-es-un-uuid')->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
    });
});

describe('borrador (RF-06 paso 1, RN-07, RN-28, RN-32)', function () {
    it('crea el borrador con la cuota del simulador, los datos conocidos enmascarados y su historial', function () {
        $r = $this->postJson(T11_URL, ['producto' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertCreated();

        $cliente = $this->usuario->cliente;
        expect($r->json('estado'))->toBe('BORRADOR')
            ->and($r->json('radicado'))->toBeNull()
            ->and($r->json('producto'))->toBe(['codigo' => 'libre_inversion', 'nombre' => 'Libre inversión'])
            ->and($r->json('tasa_ea'))->toEqual(18.9)
            ->and($r->json('cuota_estimada'))->toBe(252_762)
            ->and($r->json('accion_pendiente.tipo'))->toBe('borrador')
            ->and($r->json('historial'))->toHaveCount(1)
            ->and($r->json('historial.0.estado'))->toBe('BORRADOR')
            ->and($r->json('laboral'))->toBe(['ocupacion' => '', 'empleador' => '', 'antiguedad_laboral_meses' => null])
            ->and($r->json('referencia'))->toBe(['nombre' => '', 'celular' => ''])
            ->and($r->json('documentos'))->toBe([])
            ->and($r->json('capacidad_pago'))->toBeNull()
            ->and($r->json('oferta_id'))->toBeNull()
            ->and($r->json('borrador_vence_en'))->not->toBeNull();

        // RNF-06: el documento y el celular salen enmascarados, a 4 dígitos.
        $conocidos = $r->json('datos_conocidos');
        expect($conocidos['documento_enmascarado'])->not->toContain($cliente->num_documento)
            ->and($conocidos['documento_enmascarado'])->toEndWith(substr($cliente->num_documento, -4))
            ->and($conocidos['telefono_enmascarado'])->not->toContain($cliente->telefono)
            ->and($r->getContent())->not->toContain($cliente->num_documento);
    });

    it('no deja crear la solicitud sin identidad verificada (RN-07)', function () {
        $this->actingAs(t11Cliente(Cliente::KYC_PENDIENTE));

        $this->postJson(T11_URL, ['producto' => 'libre_inversion', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertStatus(409)->assertJsonPath('codigo', 'identidad_no_verificada');
    });

    it('rechaza una segunda solicitud activa del mismo producto con el id de la existente (RN-28)', function () {
        $id = ($this->crear)();

        $this->postJson(T11_URL, ['producto' => 'libre_inversion', 'monto' => 3_000_000, 'plazo_meses' => 12])
            ->assertStatus(409)
            ->assertJsonPath('codigo', 'solicitud_activa')
            ->assertJsonPath('datos.solicitud_id', $id);
    });

    it('valida el producto y los tipos de dato', function () {
        $this->postJson(T11_URL, ['producto' => 'no_existe', 'monto' => 5_000_000, 'plazo_meses' => 24])
            ->assertStatus(422)->assertJsonPath('codigo', 'producto_invalido');
        $this->postJson(T11_URL, ['producto' => 'libre_inversion'])
            ->assertStatus(422)->assertJsonValidationErrors(['monto', 'plazo_meses']);
    });

    it('precarga los datos laborales, financieros y la referencia de la última solicitud (RN-32)', function () {
        $primera = ($this->listoParaRadicar)('independiente');
        $this->postJson(T11_URL."/{$primera}/radicar")->assertOk();

        $codigo = collect(app(\App\Modules\Evaluacion\Services\ParametrosVigentes::class)->productos())
            ->pluck('codigo')->first(fn ($c) => $c !== 'libre_inversion');
        $r = $this->postJson(T11_URL, ['producto' => $codigo, 'monto' => 2_000_000, 'plazo_meses' => 12])->assertCreated();

        expect($r->json('laboral.ocupacion'))->toBe('independiente')
            ->and($r->json('laboral.empleador'))->toBe('Empresa Sintética S.A.S.')
            ->and($r->json('financiero'))->toBe(['ingreso_mensual' => 4_500_000, 'egreso_mensual' => 1_500_000])
            ->and($r->json('referencia'))->toBe(['nombre' => 'Pedro Referencia Sintética', 'celular' => '3109876543'])
            // Los documentos de su ocupación quedan pendientes: cada solicitud lleva los suyos.
            ->and(collect($r->json('documentos'))->pluck('estado')->unique()->all())->toBe(['pendiente'])
            ->and(collect($r->json('documentos'))->pluck('tipo')->all())->toBe(['extractos_bancarios', 'declaracion_renta']);
    });
});

describe('edición del borrador (PATCH)', function () {
    it('recalcula la cuota al cambiar monto o plazo y calcula la capacidad de pago (RN-41, RF-06 FA-04)', function () {
        $id = ($this->crear)();

        $r = $this->patchJson(T11_URL."/{$id}", [
            'monto' => 8_000_000, 'plazo_meses' => 36,
            'financiero' => ['ingreso_mensual' => 1_500_000, 'egreso_mensual' => 1_000_000],
        ])->assertOk();

        $cuota = $r->json('cuota_estimada');
        expect($r->json('monto'))->toBe(8_000_000)
            ->and($r->json('plazo_meses'))->toBe(36)
            ->and($cuota)->not->toBe(252_762)
            ->and($r->json('capacidad_pago.ingreso_disponible'))->toBe(500_000)
            ->and($r->json('capacidad_pago.porcentaje'))->toEqual(round($cuota / 500_000 * 100, 1))
            ->and($r->json('capacidad_pago.limite'))->toEqual(40)
            ->and($r->json('capacidad_pago.supera_limite'))->toBeTrue();
        expect(Solicitud::find($id)->cuota_estimada)->toBe($cuota);
    });

    it('rechaza monto y plazo fuera del rango del producto con 422 por campo', function () {
        $id = ($this->crear)();

        $this->patchJson(T11_URL."/{$id}", ['monto' => 1, 'plazo_meses' => 400])
            ->assertStatus(422)
            ->assertJsonPath('errors.monto.0', 'El monto está fuera del rango del producto.')
            ->assertJsonValidationErrors(['plazo_meses']);
    });

    it('recalcula los documentos requeridos cuando cambia la ocupación', function () {
        $id = ($this->crear)();

        $r = $this->patchJson(T11_URL."/{$id}", ['laboral' => ['ocupacion' => 'empleado', 'empleador' => '', 'antiguedad_laboral_meses' => null]])->assertOk();
        expect(collect($r->json('documentos'))->map(fn ($d) => [$d['tipo'], $d['requerido'], $d['estado']])->all())->toBe([
            ['certificado_laboral', true, 'pendiente'],
            ['desprendibles_nomina', true, 'pendiente'],
        ]);
        $this->post(T11_URL."/{$id}/documentos", ['tipo' => 'certificado_laboral', 'archivo' => t11Pdf()])->assertOk();
        $ruta = DocumentoSolicitud::where('solicitud_id', $id)->where('tipo', 'certificado_laboral')->first()->ruta;

        $r = $this->patchJson(T11_URL."/{$id}", ['laboral' => ['ocupacion' => 'pensionado', 'empleador' => 'Colpensiones sintético', 'antiguedad_laboral_meses' => 0]])->assertOk();

        expect(collect($r->json('documentos'))->pluck('tipo')->all())->toBe(['desprendible_pension']);
        // El archivo que ya no se pide no se queda guardado.
        Storage::disk('local')->assertMissing($ruta);
    });

    it('acepta el borrador a medias y no admite campos que aproximen variables prohibidas (RN-43)', function () {
        $id = ($this->crear)();

        $this->patchJson(T11_URL."/{$id}", [
            'laboral' => ['ocupacion' => '', 'empleador' => '', 'antiguedad_laboral_meses' => null],
            'financiero' => ['ingreso_mensual' => null, 'egreso_mensual' => null],
            'referencia' => ['nombre' => '', 'celular' => ''],
        ])->assertOk();

        $this->patchJson(T11_URL."/{$id}", ['referencia' => ['nombre' => 'Ana', 'celular' => '3001112233', 'parentesco' => 'esposa']])
            ->assertStatus(422)->assertJsonValidationErrors(['referencia']);
        $this->patchJson(T11_URL."/{$id}", ['laboral' => ['ocupacion' => 'astronauta']])
            ->assertStatus(422)->assertJsonValidationErrors(['laboral.ocupacion' => 'Elige tu ocupación.']);
    });

    it('guarda la referencia cifrada en reposo (RNF-06)', function () {
        $id = ($this->crear)();
        $this->patchJson(T11_URL."/{$id}", t11DatosCompletos())->assertOk();

        $crudo = DB::table('originacion_solicitudes')->where('id', $id)->first();
        expect($crudo->referencia_celular)->not->toContain('3109876543')
            ->and($crudo->referencia_nombre)->not->toContain('Pedro');
    });
});

describe('documentos (RN-30)', function () {
    beforeEach(function () {
        $this->id = ($this->crear)();
        $this->patchJson(T11_URL."/{$this->id}", t11DatosCompletos('empleado'))->assertOk();
    });

    it('carga un PDF, lo guarda cifrado y con la ruta cifrada en la base', function () {
        $contenido = '%PDF-1.4 contenido sintético';
        $archivo = UploadedFile::fake()->createWithContent('certificado.pdf', $contenido);

        $r = $this->post(T11_URL."/{$this->id}/documentos", ['tipo' => 'certificado_laboral', 'archivo' => $archivo])->assertOk();

        expect($r->json('tipo'))->toBe('certificado_laboral')
            ->and($r->json('nombre'))->toBe('Certificado laboral')
            ->and($r->json('estado'))->toBe('cargado')
            ->and($r->json('archivo.nombre'))->toBe('certificado.pdf')
            ->and($r->json('archivo.tamano'))->toBe(strlen($contenido))
            ->and($r->json())->not->toHaveKey('ruta');

        $crudo = DB::table('originacion_documentos')->where('solicitud_id', $this->id)->where('tipo', 'certificado_laboral')->first();
        expect($crudo->ruta)->not->toContain('originacion/')
            ->and($crudo->archivo_nombre)->not->toContain('certificado');

        $ruta = DocumentoSolicitud::find($crudo->id)->ruta;
        $guardado = Storage::disk('local')->get($ruta);
        expect($guardado)->not->toContain('contenido sintético')
            ->and(Crypt::decryptString($guardado))->toBe($contenido);

        expect(RegistroAuditoria::where('accion', 'originacion.documento_cargado')->where('id_entidad', $this->id)->exists())->toBeTrue();
    });

    it('acepta JPG y PNG y reemplaza el archivo anterior', function () {
        $this->post(T11_URL."/{$this->id}/documentos", ['tipo' => 'desprendibles_nomina', 'archivo' => UploadedFile::fake()->create('a.jpg', 50, 'image/jpeg')])->assertOk();
        $anterior = DocumentoSolicitud::where('solicitud_id', $this->id)->where('tipo', 'desprendibles_nomina')->first()->ruta;

        $this->post(T11_URL."/{$this->id}/documentos", ['tipo' => 'desprendibles_nomina', 'archivo' => UploadedFile::fake()->create('b.png', 50, 'image/png')])
            ->assertOk()->assertJsonPath('archivo.nombre', 'b.png');

        Storage::disk('local')->assertMissing($anterior);
    });

    it('rechaza otros formatos, aunque digan ser PDF, y archivos de más de 10 MB', function () {
        $url = T11_URL."/{$this->id}/documentos";

        $this->post($url, ['tipo' => 'certificado_laboral', 'archivo' => UploadedFile::fake()->create('a.docx', 10, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')])
            ->assertStatus(422)->assertJsonPath('codigo', 'archivo_no_permitido')->assertJsonPath('mensaje', 'Sube el documento en JPG, PNG o PDF.');

        // El tipo se toma del contenido, no de la extensión ni de lo que declara el navegador.
        // (Un archivo real: el falso de Laravel informa el tipo según la extensión.)
        $ruta = tempnam(sys_get_temp_dir(), 't11');
        file_put_contents($ruta, "MZ ejecutable disfrazado de PDF\n");
        $falso = new UploadedFile($ruta, 'falso.pdf', 'application/pdf', null, true);
        $this->post($url, ['tipo' => 'certificado_laboral', 'archivo' => $falso])
            ->assertStatus(422)->assertJsonPath('codigo', 'archivo_no_permitido');

        $this->post($url, ['tipo' => 'certificado_laboral', 'archivo' => t11Pdf('grande.pdf', 10 * 1024 + 1)])
            ->assertStatus(422)->assertJsonPath('mensaje', 'El archivo pesa más de 10 MB. Comprímelo o tómale una foto.');

        $this->post($url, ['tipo' => 'certificado_laboral'])->assertStatus(422)->assertJsonPath('codigo', 'archivo_no_permitido');

        expect(DocumentoSolicitud::where('solicitud_id', $this->id)->where('estado', 'cargado')->count())->toBe(0);
    });

    it('rechaza un tipo de documento que no hace parte de la solicitud', function () {
        $this->post(T11_URL."/{$this->id}/documentos", ['tipo' => 'desprendible_pension', 'archivo' => t11Pdf()])
            ->assertStatus(422)->assertJsonPath('codigo', 'documento_invalido');
    });
});

describe('radicación (RF-06 pasos 6 a 8, RN-29, RN-33, CP0012)', function () {
    it('pide los datos que faltan con las claves del formulario', function () {
        $id = ($this->crear)();

        $this->postJson(T11_URL."/{$id}/radicar")
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'laboral.ocupacion', 'laboral.empleador', 'laboral.antiguedad_laboral_meses',
                'financiero.ingreso_mensual', 'financiero.egreso_mensual', 'referencia.nombre', 'referencia.celular',
            ]);

        $this->patchJson(T11_URL."/{$id}", array_replace_recursive(t11DatosCompletos(), ['referencia' => ['celular' => '6011234567']]))->assertOk();
        $this->postJson(T11_URL."/{$id}/radicar")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['referencia.celular' => 'Escribe un celular de 10 dígitos que empiece por 3.']);
    });

    it('no radica sin los documentos requeridos y dice cuáles faltan', function () {
        $id = ($this->crear)();
        $this->patchJson(T11_URL."/{$id}", t11DatosCompletos('empleado'))->assertOk();
        $this->post(T11_URL."/{$id}/documentos", ['tipo' => 'certificado_laboral', 'archivo' => t11Pdf()])->assertOk();

        $this->postJson(T11_URL."/{$id}/radicar")
            ->assertStatus(422)
            ->assertJsonPath('codigo', 'documentos_incompletos')
            ->assertJsonPath('mensaje', 'Falta cargar: desprendibles de nómina.')
            ->assertJsonPath('datos.documentos', ['desprendibles_nomina']);
    });

    it('el documento opcional no impide radicar', function () {
        $id = ($this->listoParaRadicar)('independiente');

        $this->postJson(T11_URL."/{$id}/radicar")->assertOk()->assertJsonPath('estado', 'RADICADA');
    });

    it('exige la autorización de consulta a centrales (RN-33)', function () {
        $id = ($this->listoParaRadicar)();
        $this->patchJson(T11_URL."/{$id}", ['acepta_consulta_centrales' => false])->assertOk();

        $this->postJson(T11_URL."/{$id}/radicar")
            ->assertStatus(422)->assertJsonPath('codigo', 'consulta_centrales_requerida');
        expect(Solicitud::find($id)->estado)->toBe(E::BORRADOR);
    });

    it('radica con radicado FT-AAAA-NNNNNN, registra la autorización y publica el evento (CP0012)', function () {
        Event::fake([SolicitudRadicada::class]);
        $id = ($this->listoParaRadicar)();
        expect(Consentimiento::where('cliente_id', t11ClienteId($this->usuario))->where('finalidad_codigo', 'consulta_centrales')->exists())->toBeFalse();

        $r = $this->postJson(T11_URL."/{$id}/radicar")->assertOk();

        $anio = now('America/Bogota')->format('Y');
        expect($r->json('estado'))->toBe('RADICADA')
            ->and($r->json('radicado'))->toMatch("/^FT-{$anio}-\\d{6}$/")
            ->and(collect($r->json('historial'))->pluck('estado')->all())->toBe(['BORRADOR', 'RADICADA'])
            ->and($r->json('accion_pendiente'))->toBeNull()
            ->and($r->json('borrador_vence_en'))->toBeNull();

        // RN-33 / RN-21: la casilla al radicar queda como otorgamiento en el histórico.
        $consentimiento = Consentimiento::where('cliente_id', t11ClienteId($this->usuario))->where('finalidad_codigo', 'consulta_centrales')->sole();
        expect($consentimiento->accion)->toBe('otorga')->and($consentimiento->canal)->toBe('web');

        Event::assertDispatched(SolicitudRadicada::class, fn (SolicitudRadicada $e) => $e->solicitudId === $id && $e->radicado === $r->json('radicado'));

        // Ya radicada: no se edita ni se vuelve a radicar.
        $this->patchJson(T11_URL."/{$id}", ['monto' => 3_000_000])->assertStatus(409)->assertJsonPath('codigo', 'no_editable');
        $this->postJson(T11_URL."/{$id}/radicar")->assertStatus(409)->assertJsonPath('codigo', 'no_editable');
        $this->post(T11_URL."/{$id}/documentos", ['tipo' => 'certificado_laboral', 'archivo' => t11Pdf()])
            ->assertStatus(409)->assertJsonPath('codigo', 'no_editable');
    });

    it('no radica si la identidad dejó de estar verificada (RN-07)', function () {
        $id = ($this->listoParaRadicar)();
        $this->usuario->cliente->update(['estado_kyc' => Cliente::KYC_REVISION_MANUAL]);

        $this->postJson(T11_URL."/{$id}/radicar")->assertStatus(409)->assertJsonPath('codigo', 'identidad_no_verificada');
    });
});

describe('seguimiento y documentos pendientes (RF-07, UC8)', function () {
    it('lista con resumen y muestra el historial con fecha; al pedir documentos vuelve a RADICADA con el mismo radicado', function () {
        Event::fake([SolicitudRadicada::class, DocumentosEnviados::class]);
        $id = ($this->listoParaRadicar)();
        $radicado = $this->postJson(T11_URL."/{$id}/radicar")->json('radicado');

        // No está esperando documentos.
        $this->postJson(T11_URL."/{$id}/enviar-documentos")->assertStatus(409)->assertJsonPath('codigo', 'no_editable');

        // La consola (T17) pide de nuevo un documento: aquí se simula con el servicio y la tabla.
        $solicitud = Solicitud::find($id);
        app(Solicitudes::class)->transicionar($solicitud, E::PENDIENTE_CLIENTE, null, 'Certificado ilegible');
        DocumentoSolicitud::where('solicitud_id', $id)->where('tipo', 'certificado_laboral')
            ->update(['estado' => 'rechazado', 'motivo_rechazo' => 'No se lee la fecha de expedición.']);

        $lista = $this->getJson(T11_URL)->assertOk();
        expect($lista->json('0'))->toHaveKeys(['id', 'radicado', 'producto', 'monto', 'plazo_meses', 'estado', 'creada_en', 'actualizada_en', 'accion_pendiente'])
            ->and($lista->json('0.estado'))->toBe('PENDIENTE_CLIENTE')
            ->and($lista->json('0.accion_pendiente.tipo'))->toBe('documentos');

        $detalle = $this->getJson(T11_URL."/{$id}")->assertOk();
        $rechazado = collect($detalle->json('documentos'))->firstWhere('tipo', 'certificado_laboral');
        expect($rechazado['estado'])->toBe('rechazado')
            ->and($rechazado['motivo_rechazo'])->toBe('No se lee la fecha de expedición.');

        $this->postJson(T11_URL."/{$id}/enviar-documentos")
            ->assertStatus(422)->assertJsonPath('codigo', 'documentos_incompletos');

        $this->post(T11_URL."/{$id}/documentos", ['tipo' => 'certificado_laboral', 'archivo' => t11Pdf()])->assertOk();
        $r = $this->postJson(T11_URL."/{$id}/enviar-documentos")->assertOk();

        expect($r->json('estado'))->toBe('RADICADA')
            ->and($r->json('radicado'))->toBe($radicado)
            ->and(collect($r->json('historial'))->pluck('estado')->all())->toBe(['BORRADOR', 'RADICADA', 'PENDIENTE_CLIENTE', 'RADICADA']);
        foreach ($r->json('historial') as $hito) {
            expect(strtotime($hito['fecha']))->not->toBeFalse();
        }
        Event::assertDispatched(DocumentosEnviados::class, fn (DocumentosEnviados $e) => $e->solicitudId === $id && $e->radicado === $radicado);
    });

    it('consultar la solicitud registra el último acceso sin cambiar su fecha de actualización (RN-31)', function () {
        $id = ($this->crear)();
        $antes = Solicitud::find($id)->updated_at;
        $this->travel(5)->minutes();

        $this->getJson(T11_URL."/{$id}")->assertOk();

        $s = Solicitud::find($id);
        expect($s->updated_at->equalTo($antes))->toBeTrue()
            ->and($s->ultimo_acceso_en->greaterThan($antes))->toBeTrue();
    });
});
