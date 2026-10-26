<?php

namespace App\Modules\Identidad\Database\Seeders;

use App\Modules\Identidad\Models\Finalidad;
use App\Modules\Identidad\Models\PoliticaTratamiento;
use App\Modules\Identidad\Models\Rol;
use Illuminate\Database\Seeder;

/**
 * Catálogos que el sistema necesita para funcionar: los seis roles (6.3.6)
 * y la política de tratamiento vigente con sus finalidades (RF-04).
 */
class CatalogosIdentidadSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [Rol::CLIENTE, 'Cliente', 'Titular que simula, radica y sigue sus solicitudes', false],
            [Rol::ANALISTA, 'Analista de crédito', 'Estudia expedientes y emite concepto', true],
            [Rol::OFICIAL, 'Oficial de crédito', 'Decide solicitudes dentro de su atribución por monto', true],
            [Rol::CONTABILIDAD, 'Auxiliar contable', 'Autoriza desembolsos y concilia movimientos', true],
            [Rol::DIRECTIVO, 'Directivo', 'Consulta tableros e informes consolidados', true],
            [Rol::ADMINISTRADOR, 'Administrador', 'Gestiona usuarios, roles y parametrización; no decide créditos', true],
        ];

        foreach ($roles as [$codigo, $nombre, $descripcion, $interno]) {
            Rol::updateOrCreate(['codigo' => $codigo], compact('nombre', 'descripcion', 'interno'));
        }

        $politica = PoliticaTratamiento::updateOrCreate(['version' => '1.0'], [
            'vigente_desde' => '2026-10-01',
            'resumen' => 'FinanTech trata tus datos personales para vincularte como cliente, verificar tu identidad '
                .'y gestionar tus productos de crédito, conforme a la Ley 1581 de 2012 y la Ley 1266 de 2008.',
        ]);

        $finalidades = [
            [Finalidad::GESTION_CLIENTE, 'Gestión de tu relación con FinanTech',
                'Crear y administrar tu cuenta, atender tus solicitudes y prestarte los productos que contrates.', true],
            [Finalidad::VERIFICACION_IDENTIDAD, 'Verificación de identidad y prevención de fraude',
                'Verificar tu identidad y consultar listas restrictivas, como exige la normativa de prevención de lavado de activos.', true],
            [Finalidad::CONSULTA_CENTRALES, 'Consulta y reporte a centrales de información crediticia',
                'Consultar tu historial crediticio para evaluar tus solicitudes y reportar el comportamiento de tus obligaciones. Puedes autorizarla ahora o al radicar una solicitud.', false],
            [Finalidad::OFERTAS_COMERCIALES, 'Ofertas comerciales',
                'Enviarte ofertas de productos de FinanTech por correo electrónico o notificación.', false],
            [Finalidad::ENCUESTAS, 'Encuestas de satisfacción',
                'Contactarte para conocer tu opinión sobre nuestro servicio.', false],
        ];

        foreach ($finalidades as $orden => [$codigo, $nombre, $descripcion, $necesaria]) {
            Finalidad::updateOrCreate(
                ['politica_id' => $politica->id, 'codigo' => $codigo],
                compact('nombre', 'descripcion', 'necesaria', 'orden'),
            );
        }
    }
}
