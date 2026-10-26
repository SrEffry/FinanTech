<?php

use App\Modules\Analitica\AnaliticaServiceProvider;
use App\Modules\Cliente\ClienteServiceProvider;
use App\Modules\Contabilidad\ContabilidadServiceProvider;
use App\Modules\Desembolso\DesembolsoServiceProvider;
use App\Modules\Evaluacion\EvaluacionServiceProvider;
use App\Modules\Identidad\IdentidadServiceProvider;
use App\Modules\Originacion\OriginacionServiceProvider;
use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    IdentidadServiceProvider::class,
    ClienteServiceProvider::class,
    OriginacionServiceProvider::class,
    EvaluacionServiceProvider::class,
    DesembolsoServiceProvider::class,
    ContabilidadServiceProvider::class,
    AnaliticaServiceProvider::class,
];
