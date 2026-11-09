<?php

use App\Modules\Desembolso\Listeners\EmitirOfertaAlAprobar;
use App\Modules\Desembolso\Models\Oferta;
use App\Modules\Desembolso\Services\Ofertas;
use App\Modules\Evaluacion\Database\Seeders\ParametrosCreditoSeeder;
use App\Modules\Identidad\Mail\CodigoSegundoFactorMail;
use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\RegistroAuditoria;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Originacion\Enums\EstadoSolicitud as E;
use App\Modules\Originacion\Events\SolicitudRadicada;
use App\Modules\Originacion\Models\Solicitud;
use App\Modules\Originacion\Services\Solicitudes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Personas;

/*
 * T18 · Oferta y pagaré (RF-11, RN-59, RN-61, RN-62, MR-004, E3), lo vital de P9.
 * Contrato: docs/contrato-api-v1-frontend.md → "Oferta y pagaré".
 */

const T18_URL = '/api/v1/desembolso/ofertas';

/** Solicitud del cliente llevada hasta APROBADA por la máquina E3 (sin el motor). */
function t18SolicitudAprobada(int $clienteId): Solicitud
{
    $servicio = app(Solicitudes::class);
    $s = $servicio->crearBorrador($clienteId, 'libre_inversion', 5_000_000, 24);
    $s->update(['acepta_consulta_centrales' => true]);
    $servicio->radicar($s);
    $servicio->transicionar($s, E::EN_EVALUACION);
    $servicio->transicionar($s, E::APROBADA);

    return $s;
}

function t18CodigoEnviado(): string
{
    return Mail::sent(CodigoSegundoFactorMail::class)->last()->codigo;
}

beforeEach(function () {
    $this->seed(ParametrosCreditoSeeder::class);
    Event::fake([SolicitudRadicada::class]); // el motor no interviene en estas pruebas
    Mail::fake();
    $this->withHeaders(['Accept' => 'application/json', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->usuario = Personas::cliente(['estado_kyc' => Cliente::KYC_VERIFICADO]);
    $this->actingAs($this->usuario);
    $this->solicitud = t18SolicitudAprobada($this->usuario->cliente->id);
    $this->oferta = app(Ofertas::class)->emitir($this->solicitud->id, 'dec-1', 5_000_000, 24, 18.9);
});

describe('emisión (RF-11 paso 1, RN-59, CP0011)', function () {
    it('emite la oferta vigente 15 días con desglose completo y pagaré cifrado', function () {
        $r = $this->getJson(T18_URL."/{$this->oferta->id}")->assertOk();

        expect($r->json('estado'))->toBe('vigente')
            ->and($r->json('solicitud_id'))->toBe($this->solicitud->id)
            ->and($r->json('radicado'))->toBe($this->solicitud->fresh()->radicado)
            ->and($r->json('producto'))->toBe('Libre inversión')
            ->and($r->json('cuota'))->toBe(252_762)              // la misma del simulador
            ->and($r->json('tasa_ea'))->toEqual(18.9)
            ->and($r->json('condiciones_originales'))->toBeNull()
            ->and($r->json('firma'))->toBeNull()
            ->and(array_sum(array_column($r->json('desglose'), 'valor')))->toBe($r->json('costo_total'))
            ->and($r->json('plan'))->toHaveCount(24)
            ->and($r->json('valor_a_recibir'))->toBeLessThan(5_000_000);
        expect(round((strtotime($r->json('vence_en')) - strtotime($r->json('emitida_en'))) / 86400))->toEqual(15.0);

        // RNF-06: el pagaré solo muestra los últimos 4 dígitos y está cifrado en reposo.
        $cliente = $this->usuario->cliente;
        expect($r->json('pagare.texto'))->toContain(substr($cliente->num_documento, -4))
            ->and($r->json('pagare.texto'))->not->toContain($cliente->num_documento)
            ->and($r->json('pagare.texto'))->toContain('no es un título valor');
        expect(DB::table('desembolso_ofertas')->value('pagare_texto'))->not->toContain('Pagaré');
    });

    it('no emite dos ofertas para la misma decisión', function () {
        $otra = app(Ofertas::class)->emitir($this->solicitud->id, 'dec-1', 5_000_000, 24, 18.9);

        expect($otra->id)->toBe($this->oferta->id)->and(Oferta::count())->toBe(1);
    });

    it('en una aprobación condicionada guarda lo que pidió el cliente y nunca supera la tasa máxima (RN-23)', function () {
        $oferta = app(Ofertas::class)->emitir($this->solicitud->id, 'dec-2', 4_000_000, 36, 99.0, 'Ajustamos el monto a tu capacidad de pago.');
        $r = $this->getJson(T18_URL."/{$oferta->id}")->assertOk();

        expect($r->json('monto'))->toBe(4_000_000)
            ->and($r->json('tasa_ea'))->toBeLessThanOrEqual(app(\App\Modules\Evaluacion\Services\ParametrosVigentes::class)->tasaMaximaLegalEa())
            ->and($r->json('condiciones_originales'))->toMatchArray(['monto' => 5_000_000, 'plazo_meses' => 24, 'cuota' => 252_762])
            ->and($r->json('motivo_condicion'))->toBe('Ajustamos el monto a tu capacidad de pago.');
    });

    it('el oyente de la decisión emite solo en aprobaciones', function () {
        $oyente = app(EmitirOfertaAlAprobar::class);
        $evento = fn (string $resultado, string $id) => (object) [
            'solicitudId' => $this->solicitud->id, 'decisionId' => $id, 'clienteId' => $this->usuario->cliente->id,
            'resultado' => $resultado, 'monto' => 5_000_000, 'plazoMeses' => 24, 'tasaEa' => 18.9,
            'automatizada' => true, 'motivoCondicion' => null, 'decididaEn' => now()->toIso8601String(),
        ];

        $oyente->handle($evento('negada', 'dec-n'));
        $oyente->handle($evento('aprobada_condicionada', 'dec-c'));

        expect(Oferta::where('decision_id', 'dec-n')->exists())->toBeFalse()
            ->and(Oferta::where('decision_id', 'dec-c')->exists())->toBeTrue();
    });

    it('al publicarse DecisionRegistrada de una aprobación se emite la oferta (V3 → V4)', function () {
        \App\Modules\Evaluacion\Events\DecisionRegistrada::dispatch(
            $this->solicitud->id, 'dec-evento', $this->usuario->cliente->id, 'aprobada',
            5_000_000, 24, 18.9, false, null, now()->toIso8601String(),
        );

        expect(Oferta::where('decision_id', 'dec-evento')->where('estado', 'vigente')->exists())->toBeTrue();
    });

    it('el seguimiento de la solicitud enlaza la oferta vigente (RF-07)', function () {
        $r = $this->getJson("/api/v1/originacion/solicitudes/{$this->solicitud->id}")->assertOk();

        expect($r->json('oferta_id'))->toBe($this->oferta->id)
            ->and($r->json('accion_pendiente'))->toBe([
                'tipo' => 'oferta', 'texto' => 'Tienes una oferta lista para revisar y firmar.', 'oferta_id' => $this->oferta->id,
            ]);
    });
});

describe('autorización (RNF-05)', function () {
    it('responde 401 sin sesión, 403 a un interno y 404 con la oferta de otro cliente', function () {
        $rutas = [['GET', ''], ['POST', '/desafio-mfa'], ['POST', '/aceptar'], ['POST', '/rechazar']];

        auth()->logout();
        foreach ($rutas as [$m, $sufijo]) {
            $this->json($m, T18_URL."/{$this->oferta->id}{$sufijo}")->assertUnauthorized();
        }
        $this->actingAs(Personas::interno(Rol::OFICIAL));
        foreach ($rutas as [$m, $sufijo]) {
            $this->json($m, T18_URL."/{$this->oferta->id}{$sufijo}")->assertForbidden();
        }
        $this->actingAs(Personas::cliente(['estado_kyc' => Cliente::KYC_VERIFICADO]));
        foreach ($rutas as [$m, $sufijo]) {
            $this->json($m, T18_URL."/{$this->oferta->id}{$sufijo}")->assertNotFound()->assertJsonPath('codigo', 'no_encontrada');
        }
    });
});

describe('aceptación con segundo factor y firma (RN-61, RN-62, MR-004)', function () {
    it('acepta con declaración y código, firma simulada y formaliza la solicitud', function () {
        $desafio = $this->postJson(T18_URL."/{$this->oferta->id}/desafio-mfa")->assertOk()->json('desafio_id');
        $codigo = t18CodigoEnviado();

        $this->postJson(T18_URL."/{$this->oferta->id}/aceptar", ['declaracion' => false, 'desafio_id' => $desafio, 'codigo' => $codigo])
            ->assertStatus(422)->assertJsonPath('codigo', 'declaracion_requerida');
        $this->postJson(T18_URL."/{$this->oferta->id}/aceptar", ['declaracion' => true, 'desafio_id' => $desafio, 'codigo' => '000000'])
            ->assertStatus(422)->assertJsonPath('codigo', 'codigo_incorrecto');

        $r = $this->postJson(T18_URL."/{$this->oferta->id}/aceptar", ['declaracion' => true, 'desafio_id' => $desafio, 'codigo' => $codigo])
            ->assertOk();

        expect($r->json('estado'))->toBe('firmada')
            ->and($r->json('firma.simulada'))->toBeTrue()
            ->and($r->json('firma.huella_sha256'))->toMatch('/^[0-9a-f]{64}$/')
            ->and($r->json('firma.sellado_en'))->not->toBeNull();

        $s = $this->solicitud->fresh();
        expect($s->estado)->toBe(E::FORMALIZADA)
            ->and($s->historial()->pluck('estado_nuevo')->map->value->take(-2)->values()->all())->toBe(['OFERTA_ACEPTADA', 'FORMALIZADA']);

        $firma = RegistroAuditoria::where('accion', 'desembolso.pagare_firmado')->where('id_entidad', $this->oferta->id)->sole();
        expect($firma->modo_simulado)->toBeTrue();

        // Ya firmada: no se acepta dos veces ni se rechaza.
        $this->postJson(T18_URL."/{$this->oferta->id}/desafio-mfa")->assertStatus(409)->assertJsonPath('codigo', 'oferta_no_vigente');
        $this->postJson(T18_URL."/{$this->oferta->id}/rechazar")->assertStatus(409);
    });

    it('un código del inicio de sesión no sirve para firmar la oferta (RN-61)', function () {
        $desafio = app(\App\Modules\Identidad\Services\SegundoFactor::class)->emitirDesafio($this->usuario->id, 'sesion')['desafio_id'];

        $this->postJson(T18_URL."/{$this->oferta->id}/aceptar", ['declaracion' => true, 'desafio_id' => $desafio, 'codigo' => t18CodigoEnviado()])
            ->assertStatus(422)->assertJsonPath('codigo', 'codigo_vencido');
        expect($this->oferta->fresh()->estado)->toBe('vigente');
    });

    it('si el proveedor de firma no está disponible, la oferta sigue vigente (RF-11 FA-03)', function () {
        config(['finantech.servicios_externos' => 'real']);
        $desafio = $this->postJson(T18_URL."/{$this->oferta->id}/desafio-mfa")->assertOk()->json('desafio_id');

        $this->postJson(T18_URL."/{$this->oferta->id}/aceptar", ['declaracion' => true, 'desafio_id' => $desafio, 'codigo' => t18CodigoEnviado()])
            ->assertStatus(503)->assertJsonPath('codigo', 'firma_no_disponible');

        expect($this->oferta->fresh()->estado)->toBe('vigente')
            ->and($this->solicitud->fresh()->estado)->toBe(E::APROBADA);
    });
});

describe('vencimiento y rechazo (RN-59, RF-11 FA-01)', function () {
    it('a los 15 días la oferta vence y la solicitud pasa a OFERTA_VENCIDA', function () {
        $this->travel(15)->days();
        $this->travel(1)->minutes();

        $this->getJson(T18_URL."/{$this->oferta->id}")->assertOk()->assertJsonPath('estado', 'vencida');
        $this->postJson(T18_URL."/{$this->oferta->id}/desafio-mfa")->assertStatus(409)->assertJsonPath('codigo', 'oferta_vencida');

        expect($this->solicitud->fresh()->estado)->toBe(E::OFERTA_VENCIDA);
        $this->getJson("/api/v1/originacion/solicitudes/{$this->solicitud->id}")->assertJsonPath('accion_pendiente', null);
    });

    it('el cliente puede rechazarla y la solicitud se cierra', function () {
        $this->postJson(T18_URL."/{$this->oferta->id}/rechazar", ['motivo' => 'Encontré otra opción.'])
            ->assertOk()->assertJsonPath('estado', 'rechazada');

        expect($this->solicitud->fresh()->estado)->toBe(E::OFERTA_RECHAZADA)
            ->and(RegistroAuditoria::where('accion', 'desembolso.oferta_rechazada')->exists())->toBeTrue();
    });
});
