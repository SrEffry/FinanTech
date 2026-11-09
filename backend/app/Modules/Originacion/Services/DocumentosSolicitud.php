<?php

namespace App\Modules\Originacion\Services;

use App\Modules\Identidad\Services\Auditoria;
use App\Modules\Originacion\Enums\EstadoSolicitud;
use App\Modules\Originacion\Models\DocumentoSolicitud;
use App\Modules\Originacion\Models\Solicitud;
use App\Shared\Exceptions\ErrorNegocio;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Documentos de soporte de la solicitud (RF-06 paso 5).
 *
 * - RN-30: solo JPG, PNG o PDF de hasta 10 MB, verificado en el servidor por el contenido
 *   del archivo y no por la extensión que declara el navegador.
 * - RNF-06: el archivo se guarda cifrado en el disco privado y su ruta va cifrada en la base.
 */
class DocumentosSolicitud
{
    public const DISCO = 'local';
    public const TAMANO_MAXIMO = 10 * 1024 * 1024;
    public const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf'];

    public function __construct(
        private readonly CatalogoDocumentos $catalogo,
        private readonly Auditoria $auditoria,
    ) {}

    /**
     * Deja los documentos requeridos por la ocupación actual: conserva los que siguen
     * pidiéndose (con lo ya cargado) y quita los que ya no aplican, con su archivo.
     */
    public function sincronizar(Solicitud $solicitud): void
    {
        $requeridos = $this->catalogo->paraOcupacion($solicitud->ocupacion);
        $actuales = $solicitud->documentos()->get()->keyBy('tipo');

        foreach ($actuales as $tipo => $documento) {
            if (! array_key_exists($tipo, $requeridos)) {
                $this->borrarArchivo($documento);
                $documento->delete();
            }
        }

        foreach ($requeridos as $tipo => $requerido) {
            $documento = $actuales->get($tipo);
            if ($documento) {
                $documento->update(['requerido' => $requerido]);
            } else {
                DocumentoSolicitud::create([
                    'solicitud_id' => $solicitud->id,
                    'tipo' => $tipo,
                    'requerido' => $requerido,
                    'estado' => DocumentoSolicitud::PENDIENTE,
                ]);
            }
        }

        $solicitud->unsetRelation('documentos');
    }

    /**
     * @throws ErrorNegocio 409 no_editable, 422 documento_invalido, 422 archivo_no_permitido (RN-30)
     */
    public function cargar(Solicitud $solicitud, string $tipo, mixed $archivo, ?int $actorId): DocumentoSolicitud
    {
        if (! in_array($solicitud->estado, [EstadoSolicitud::BORRADOR, EstadoSolicitud::PENDIENTE_CLIENTE], true)) {
            throw new ErrorNegocio('no_editable', 'En este momento no puedes cambiar los documentos de esta solicitud.', 409);
        }

        $documento = $solicitud->documentos()->where('tipo', $tipo)->first()
            ?? throw new ErrorNegocio('documento_invalido', 'Ese documento no hace parte de tu solicitud.');

        $this->validarArchivo($archivo);

        $contenido = $archivo->get();
        $ruta = "originacion/{$solicitud->id}/".Str::uuid().'.cifrado';
        Storage::disk(self::DISCO)->put($ruta, Crypt::encryptString($contenido));

        $anterior = $documento->ruta;
        DB::transaction(function () use ($documento, $solicitud, $archivo, $contenido, $ruta) {
            $documento->update([
                'estado' => DocumentoSolicitud::CARGADO,
                'motivo_rechazo' => null,
                'archivo_nombre' => mb_substr($archivo->getClientOriginalName(), 0, 150),
                'archivo_tamano' => $archivo->getSize(),
                'archivo_mime' => $archivo->getMimeType(),
                'ruta' => $ruta,
                'huella_sha256' => hash('sha256', $contenido),
                'cargado_en' => now(),
            ]);
            $solicitud->touch();
        });

        // El archivo reemplazado ya no se necesita: no se guardan copias sueltas de datos personales.
        if ($anterior) {
            Storage::disk(self::DISCO)->delete($anterior);
        }

        // Sin el nombre del archivo: puede llevar datos personales (RNF-06).
        $this->auditoria->registrar('originacion.documento_cargado', 'solicitud', $solicitud->id, usuarioId: $actorId, detalle: [
            'tipo' => $tipo,
            'tamano' => $documento->archivo_tamano,
        ]);

        return $documento;
    }

    /** @return Collection<int, DocumentoSolicitud> requeridos que faltan por cargar o fueron rechazados */
    public function faltantes(Solicitud $solicitud): Collection
    {
        return $solicitud->documentos()->get()->filter->faltante()->values();
    }

    /** @throws ErrorNegocio 422 documentos_incompletos */
    public function exigirCompletos(Solicitud $solicitud): void
    {
        $faltan = $this->faltantes($solicitud);
        if ($faltan->isEmpty()) {
            return;
        }

        $nombres = $faltan->map(fn (DocumentoSolicitud $d) => mb_strtolower($this->catalogo->describir($d->tipo)['nombre']));
        throw new ErrorNegocio(
            'documentos_incompletos',
            'Falta cargar: '.$nombres->implode(', ').'.',
            422,
            ['documentos' => $faltan->pluck('tipo')->all()],
        );
    }

    /** @return array{tipo: string, nombre: string, descripcion: string, requerido: bool, estado: string, motivo_rechazo: ?string, archivo: ?array} */
    public function vista(DocumentoSolicitud $documento): array
    {
        return [
            'tipo' => $documento->tipo,
            ...$this->catalogo->describir($documento->tipo),
            'requerido' => $documento->requerido,
            'estado' => $documento->estado,
            'motivo_rechazo' => $documento->motivo_rechazo,
            'archivo' => $documento->cargado_en ? [
                'nombre' => (string) $documento->archivo_nombre,
                'tamano' => (int) $documento->archivo_tamano,
                'cargado_en' => $documento->cargado_en->toIso8601String(),
            ] : null,
        ];
    }

    /** RN-30, con los mensajes del handler de referencia del portal. */
    private function validarArchivo(mixed $archivo): void
    {
        // El archivo que supera upload_max_filesize (10M) llega como subida fallida.
        if ($archivo instanceof UploadedFile && in_array($archivo->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new ErrorNegocio('archivo_no_permitido', 'El archivo pesa más de 10 MB. Comprímelo o tómale una foto.');
        }
        if (! $archivo instanceof UploadedFile || ! $archivo->isValid()
            || ! in_array($archivo->getMimeType(), self::TIPOS_PERMITIDOS, true)) {
            throw new ErrorNegocio('archivo_no_permitido', 'Sube el documento en JPG, PNG o PDF.');
        }
        if ($archivo->getSize() > self::TAMANO_MAXIMO) {
            throw new ErrorNegocio('archivo_no_permitido', 'El archivo pesa más de 10 MB. Comprímelo o tómale una foto.');
        }
    }

    private function borrarArchivo(DocumentoSolicitud $documento): void
    {
        if ($documento->ruta) {
            Storage::disk(self::DISCO)->delete($documento->ruta);
        }
    }
}
