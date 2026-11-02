<?php

namespace App\Modules\Originacion\Enums;

/**
 * Máquina de estados de la solicitud (docs/correcciones-ers-v1.1.md, E3; OE-03, F-ORI-03).
 *
 * El backend solo maneja el nombre técnico; la etiqueta para el cliente (RN-36) la pone
 * el portal. Las reversiones de una decisión automatizada (RF-10 FA-02) no son estados:
 * se registran como una nueva decisión.
 */
enum EstadoSolicitud: string
{
    case BORRADOR = 'BORRADOR';
    case RADICADA = 'RADICADA';
    case PENDIENTE_CLIENTE = 'PENDIENTE_CLIENTE';
    case EN_EVALUACION = 'EN_EVALUACION';
    case EN_ESTUDIO = 'EN_ESTUDIO';
    case EN_DECISION = 'EN_DECISION';
    case EN_COMITE = 'EN_COMITE';
    case APROBADA = 'APROBADA';
    case APROBADA_CONDICIONADA = 'APROBADA_CONDICIONADA';
    case NEGADA = 'NEGADA';
    case OFERTA_ACEPTADA = 'OFERTA_ACEPTADA';
    case FORMALIZADA = 'FORMALIZADA';
    case DESEMBOLSADA = 'DESEMBOLSADA';
    case DESISTIDA = 'DESISTIDA';
    case OFERTA_RECHAZADA = 'OFERTA_RECHAZADA';
    case OFERTA_VENCIDA = 'OFERTA_VENCIDA';

    /**
     * Columna "Sale hacia" de la tabla E3.
     *
     * @return list<self>
     */
    public function siguientes(): array
    {
        return match ($this) {
            self::BORRADOR => [self::RADICADA, self::DESISTIDA],                              // RN-31
            self::RADICADA => [self::EN_EVALUACION, self::PENDIENTE_CLIENTE],
            self::PENDIENTE_CLIENTE => [self::RADICADA, self::DESISTIDA],                     // UC8-A2: 15 días
            self::EN_EVALUACION => [self::APROBADA, self::NEGADA, self::EN_ESTUDIO],          // RN-40
            self::EN_ESTUDIO => [self::EN_DECISION, self::PENDIENTE_CLIENTE],
            self::EN_DECISION => [self::APROBADA, self::APROBADA_CONDICIONADA, self::NEGADA, self::EN_COMITE],
            self::EN_COMITE => [self::APROBADA, self::APROBADA_CONDICIONADA, self::NEGADA],   // RF-10 FA-01
            self::APROBADA, self::APROBADA_CONDICIONADA => [self::OFERTA_ACEPTADA, self::OFERTA_RECHAZADA, self::OFERTA_VENCIDA], // RN-59
            self::NEGADA => [self::EN_ESTUDIO],                                               // reconsideración, RN-49
            self::OFERTA_ACEPTADA => [self::FORMALIZADA],
            self::FORMALIZADA => [self::DESEMBOLSADA],                                        // segunda entrega
            self::DESEMBOLSADA, self::DESISTIDA, self::OFERTA_RECHAZADA, self::OFERTA_VENCIDA => [],
        };
    }

    public function puedePasarA(self $destino): bool
    {
        return in_array($destino, $this->siguientes(), true);
    }

    /**
     * RN-28: estados en los que la solicitud sigue viva y bloquea otra del mismo producto.
     * Coincide con ESTADOS_ACTIVOS del portal (frontend/src/lib/estados.ts). NEGADA,
     * FORMALIZADA y DESEMBOLSADA no bloquean: el trámite de originación ya terminó.
     */
    public function esActiva(): bool
    {
        return in_array($this, [
            self::BORRADOR, self::RADICADA, self::PENDIENTE_CLIENTE, self::EN_EVALUACION,
            self::EN_ESTUDIO, self::EN_DECISION, self::EN_COMITE, self::APROBADA,
            self::APROBADA_CONDICIONADA, self::OFERTA_ACEPTADA,
        ], true);
    }

    public function esTerminal(): bool
    {
        return $this->siguientes() === [];
    }

    /** @return list<string> */
    public static function activos(): array
    {
        return array_values(array_map(
            fn (self $e) => $e->value,
            array_filter(self::cases(), fn (self $e) => $e->esActiva()),
        ));
    }
}
