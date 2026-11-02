<?php

namespace App\Modules\Originacion\Contracts;

/**
 * Lo que Originacion necesita saber del cliente, que es dato del módulo de Identidad.
 * Originacion no lee tablas ni modelos de Identidad (CP0002): el adaptador de este
 * contrato llamará a los servicios públicos que publique Identidad (pedido a
 * backend-senior en docs/equipo/tablero.md). Mientras tanto no hay implementación
 * registrada y las pruebas usan un doble.
 */
interface DirectorioClientes
{
    /** RN-07: no se radica sin identidad verificada. */
    public function identidadVerificada(int $clienteId): bool;

    /** RN-33: consentimiento vigente para consultar centrales de información crediticia. */
    public function consienteConsultaCentrales(int $clienteId): bool;

    /**
     * RN-32: datos que el cliente ya entregó, ya enmascarados (RNF-06).
     *
     * @return array{nombre_completo: string, documento_enmascarado: string, fecha_nacimiento: string,
     *     email: string, telefono_enmascarado: string}
     */
    public function datosConocidos(int $clienteId): array;
}
