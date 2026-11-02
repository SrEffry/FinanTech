<?php

namespace App\Modules\Identidad\Database\Seeders;

use App\Modules\Identidad\Models\Cliente;
use App\Modules\Identidad\Models\Consentimiento;
use App\Modules\Identidad\Models\Empleado;
use App\Modules\Identidad\Models\Finalidad;
use App\Modules\Identidad\Models\Rol;
use App\Modules\Identidad\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Cuentas de demostración de los seis roles, con datos sintéticos (CLAUDE.md: solo datos
 * sintéticos fuera de producción). Son las mismas de frontend/README.md, con la contraseña
 * `Demo#2026!`. Nunca se siembran en producción.
 */
class CuentasDemoSeeder extends Seeder
{
    public const CONTRASENA = 'Demo#2026!';

    public function run(): void
    {
        if (app()->isProduction()) {
            return;
        }

        $this->cliente();

        $internos = [
            [Rol::ANALISTA, 'Andrés Felipe Rojas Pineda', 'andres.rojas', 'Analista de crédito', 'Riesgo de crédito', 0],
            [Rol::OFICIAL, 'Camila Ortiz Beltrán', 'camila.ortiz', 'Oficial de crédito', 'Crédito de consumo', 30_000_000],
            [Rol::ADMINISTRADOR, 'Sergio Páez Molina', 'sergio.paez', 'Administrador de plataforma', 'Tecnología', 0],
            [Rol::CONTABILIDAD, 'Diana Vargas Lozano', 'diana.vargas', 'Auxiliar contable', 'Contabilidad', 0],
            [Rol::DIRECTIVO, 'Hernán Cuéllar Ríos', 'hernan.cuellar', 'Gerente de crédito', 'Dirección', 0],
            [Rol::ANALISTA, 'Valentina Suárez Mora', 'valentina.suarez', 'Analista de crédito', 'Riesgo de crédito', 0],
            [Rol::OFICIAL, 'Julián Herrera Castaño', 'julian.herrera', 'Oficial de crédito sénior', 'Crédito de consumo', 80_000_000],
        ];

        foreach ($internos as [$rol, $nombre, $correo, $cargo, $area, $atribucion]) {
            $usuario = $this->usuario($rol, $nombre, "{$correo}@demo.finantech.co");
            Empleado::updateOrCreate(['usuario_id' => $usuario->id], [
                'cargo' => $cargo,
                'area' => $area,
                'atribucion_monto' => $atribucion,
            ]);
        }
    }

    private function cliente(): void
    {
        $usuario = $this->usuario(Rol::CLIENTE, 'Laura Mejía Restrepo', 'laura.mejia@demo.finantech.co');

        $cliente = Cliente::firstOrNew(['usuario_id' => $usuario->id]);
        $nuevo = ! $cliente->exists;
        $cliente->fill([
            'tipo_documento' => 'CC',
            'num_documento' => '1020456782',
            'nombres' => 'Laura',
            'apellidos' => 'Mejía Restrepo',
            'fecha_nacimiento' => '1994-03-12',
            'telefono' => '3104567821',
            'telefono_verificado_en' => now(),
            'estado_kyc' => Cliente::KYC_VERIFICADO,
        ])->save();

        if ($nuevo) {
            foreach ([Finalidad::GESTION_CLIENTE, Finalidad::VERIFICACION_IDENTIDAD, Finalidad::CONSULTA_CENTRALES] as $finalidad) {
                Consentimiento::create([
                    'cliente_id' => $cliente->id,
                    'finalidad_codigo' => $finalidad,
                    'accion' => Consentimiento::OTORGA,
                    'version_politica' => '1.0',
                    'canal' => 'web',
                    'registrado_en' => now(),
                ]);
            }
        }
    }

    private function usuario(string $rol, string $nombre, string $correo): Usuario
    {
        return Usuario::updateOrCreate(['email' => $correo], [
            'rol_id' => Rol::where('codigo', $rol)->value('id'),
            'nombre_completo' => $nombre,
            'email_verificado_en' => now(),
            'password' => Hash::make(self::CONTRASENA),
            'mfa_activo' => true,
            'estado' => Usuario::ACTIVO,
            'password_cambiada_en' => now(),
        ]);
    }
}
