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
    public const TEXTO_POLITICA = <<<'TXT'
        Política de tratamiento de datos personales de FinanTech — versión 1.0, vigente desde el 1 de octubre de 2026.

        1. Quién trata tus datos. FinanTech es responsable del tratamiento de los datos personales que nos entregas al registrarte, al simular, al solicitar un crédito y mientras tengas productos con nosotros.

        2. Qué datos tratamos. Tus datos de identificación (tipo y número de documento, nombres, apellidos y fecha de nacimiento), de contacto (correo y celular), las fotos de tu documento y de tu rostro para verificar tu identidad, y la información laboral, financiera y crediticia que nos des o que consultemos con tu autorización.

        3. Para qué los usamos. Cada finalidad aparece por separado en la lista de abajo. Las necesarias son indispensables para prestarte el servicio; las opcionales solo se usan si las autorizas, y puedes retirarlas cuando quieras desde "Mis datos y privacidad" sin que eso afecte tus productos.

        4. Datos sensibles. Las fotos de tu rostro son datos biométricos. No estás obligado a entregarlos, pero sin ellos no podemos verificar tu identidad en línea. Los guardamos cifrados durante el término que exige la ley y después los eliminamos. Nunca usamos tu sexo, estado civil, origen étnico, religión, opinión política ni estado de salud para decidir sobre un crédito.

        5. Tus derechos. Puedes conocer, actualizar y rectificar tus datos; pedir prueba de tu autorización; saber cómo los hemos usado; presentar quejas ante la Superintendencia de Industria y Comercio; revocar una autorización o pedir que suprimamos tus datos cuando no exista una obligación legal o contractual que lo impida.

        6. Cómo ejercerlos. Desde "Mis datos y privacidad" en el portal o escribiendo a nuestros canales de atención. Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.

        7. Con quién los compartimos. Solo con los proveedores que nos ayudan a verificar tu identidad, a consultar listas de prevención de lavado de activos y, si lo autorizas, con las centrales de información crediticia. Todos están obligados a proteger tus datos.

        8. Cambios. Si cambiamos esta política te lo diremos al ingresar y te pediremos aceptar la nueva versión, mostrándote qué cambió.

        Esta política cumple la Ley 1581 de 2012, el Decreto 1377 de 2013 y la Ley 1266 de 2008.
        TXT;

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
            // D6 (UX-04): texto completo que el titular puede leer antes de aceptar.
            'texto' => self::TEXTO_POLITICA,
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
