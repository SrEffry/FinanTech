<?php

namespace App\Modules\Analitica;

use App\Modules\ModuleServiceProvider;

class AnaliticaServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
