<?php

use App\Modules\Originacion\Enums\EstadoSolicitud as E;

/*
 * Máquina de estados de la solicitud: tabla E3 de docs/correcciones-ers-v1.1.md.
 * Si la tabla cambia, esta prueba es la que hay que actualizar primero.
 */

const TRANSICIONES_E3 = [
    'BORRADOR' => ['RADICADA', 'DESISTIDA'],
    'RADICADA' => ['EN_EVALUACION', 'PENDIENTE_CLIENTE'],
    'PENDIENTE_CLIENTE' => ['RADICADA', 'DESISTIDA'],
    'EN_EVALUACION' => ['APROBADA', 'NEGADA', 'EN_ESTUDIO'],
    'EN_ESTUDIO' => ['EN_DECISION', 'PENDIENTE_CLIENTE'],
    'EN_DECISION' => ['APROBADA', 'APROBADA_CONDICIONADA', 'NEGADA', 'EN_COMITE'],
    'EN_COMITE' => ['APROBADA', 'APROBADA_CONDICIONADA', 'NEGADA'],
    'APROBADA' => ['OFERTA_ACEPTADA', 'OFERTA_RECHAZADA', 'OFERTA_VENCIDA'],
    'APROBADA_CONDICIONADA' => ['OFERTA_ACEPTADA', 'OFERTA_RECHAZADA', 'OFERTA_VENCIDA'],
    'NEGADA' => ['EN_ESTUDIO'],
    'OFERTA_ACEPTADA' => ['FORMALIZADA'],
    'FORMALIZADA' => ['DESEMBOLSADA'],
    'DESEMBOLSADA' => [],
    'DESISTIDA' => [],
    'OFERTA_RECHAZADA' => [],
    'OFERTA_VENCIDA' => [],
];

describe('máquina de estados de la solicitud (E3, OE-03)', function () {
    it('tiene exactamente los 16 estados técnicos que usa el portal', function () {
        expect(array_map(fn (E $e) => $e->value, E::cases()))->toEqualCanonicalizing(array_keys(TRANSICIONES_E3));
    });

    it('permite exactamente las transiciones de la tabla E3 y ninguna otra', function () {
        foreach (E::cases() as $origen) {
            foreach (E::cases() as $destino) {
                $esperada = in_array($destino->value, TRANSICIONES_E3[$origen->value], true);
                expect($origen->puedePasarA($destino))->toBe($esperada, "{$origen->value} → {$destino->value}");
            }
        }
    });

    it('no permite saltarse la evaluación ni volver a borrador', function () {
        expect(E::BORRADOR->puedePasarA(E::APROBADA))->toBeFalse()
            ->and(E::RADICADA->puedePasarA(E::APROBADA))->toBeFalse()
            ->and(E::RADICADA->puedePasarA(E::BORRADOR))->toBeFalse()
            ->and(E::NEGADA->puedePasarA(E::APROBADA))->toBeFalse(); // solo por reconsideración (RN-49)
    });

    it('los estados de cierre son terminales', function () {
        foreach ([E::DESEMBOLSADA, E::DESISTIDA, E::OFERTA_RECHAZADA, E::OFERTA_VENCIDA] as $estado) {
            expect($estado->esTerminal())->toBeTrue();
        }
        expect(E::NEGADA->esTerminal())->toBeFalse();
    });

    it('marca como activos los mismos estados que el portal (RN-28, frontend/src/lib/estados.ts)', function () {
        expect(E::activos())->toBe([
            'BORRADOR', 'RADICADA', 'PENDIENTE_CLIENTE', 'EN_EVALUACION', 'EN_ESTUDIO', 'EN_DECISION',
            'EN_COMITE', 'APROBADA', 'APROBADA_CONDICIONADA', 'OFERTA_ACEPTADA',
        ]);
    });
});
