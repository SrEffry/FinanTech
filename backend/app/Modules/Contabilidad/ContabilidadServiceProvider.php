<?php

namespace App\Modules\Contabilidad;

use App\Modules\ModuleServiceProvider;

class ContabilidadServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
