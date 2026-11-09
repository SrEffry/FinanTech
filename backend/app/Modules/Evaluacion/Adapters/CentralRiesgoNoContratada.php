<?php

namespace App\Modules\Evaluacion\Adapters;

use App\Modules\Evaluacion\Contracts\CentralNoDisponible;
use App\Modules\Evaluacion\Contracts\CentralRiesgoService;

/**
 * Modo real sin convenio con una central (MR-003): no hay a quién consultar, así que toda
 * solicitud pasa a evaluación manual. Nunca se niega por esto (RF-08 FA-02).
 */
class CentralRiesgoNoContratada implements CentralRiesgoService
{
    public function consultar(string $tipoDocumento, #[\SensitiveParameter] string $numeroDocumento, int $ingresoMensual): array
    {
        throw new CentralNoDisponible('No hay una central de riesgo contratada.');
    }

    public function esSimulado(): bool
    {
        return false;
    }
}
