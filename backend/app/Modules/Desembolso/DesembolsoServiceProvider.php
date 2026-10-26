<?php

namespace App\Modules\Desembolso;

use App\Modules\ModuleServiceProvider;

class DesembolsoServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
