<?php

namespace App\Modules\Originacion\Contracts;

/**
 * Lo que Originacion necesita saber del cliente, que es dato del módulo de Identidad.
 * Originacion no lee tablas ni modelos de Identidad (CP0002): el adaptador
 * DirectorioClientesIdentidad llama a los servicios públicos de Identidad (D3).
 */
interface DirectorioClientes
{
    /** RN-07: no se radica sin identidad verificada. */
    public function identidadVerificada(int $clienteId): bool;

    /** RN-33: consentimiento vigente para consultar centrales de información crediticia. */
    public function consienteConsultaCentrales(int $clienteId): bool;

    /**
     * RN-33: registra la autorización expresa que el cliente dio al radicar (RF-04, canal web).
     * Si ya estaba vigente no registra nada (RN-21).
     */
    public function registrarConsentimientoCentrales(int $clienteId): void;

    /**
     * RN-32: datos que el cliente ya entregó, ya enmascarados (RNF-06).
     *
     * @return array{nombre_completo: string, documento_enmascarado: string, fecha_nacimiento: string,
     *     email: string, telefono_enmascarado: string}
     */
    public function datosConocidos(int $clienteId): array;
}
