<?php

namespace App\Modules\Evaluacion;

use App\Modules\ModuleServiceProvider;

class EvaluacionServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
