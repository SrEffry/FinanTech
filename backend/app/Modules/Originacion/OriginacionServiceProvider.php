<?php

namespace App\Modules\Originacion;

use App\Modules\ModuleServiceProvider;

class OriginacionServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
