<?php

namespace App\Modules\Evaluacion\Contracts;

use RuntimeException;

/** La central de información crediticia no respondió (RF-08 FA-02): nunca es motivo para negar. */
class CentralNoDisponible extends RuntimeException {}
