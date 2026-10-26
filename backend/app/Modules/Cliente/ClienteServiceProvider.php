<?php

namespace App\Modules\Cliente;

use App\Modules\ModuleServiceProvider;

class ClienteServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
