import { useId, useState, type DragEvent } from 'react'
import { FileText, Upload } from 'lucide-react'
import { TIPOS_PERMITIDOS, formatoTamano, validarArchivo } from '../../lib/archivos'

interface Props {
  etiqueta: string
  descripcion?: string
  onSeleccionar: (archivo: File) => void
  archivoActual?: { nombre: string; tamano: number } | null
  error?: string | null
  deshabilitado?: boolean
  cargando?: boolean
  /** Abre la cámara del celular: trasera para documentos, frontal para el rostro. */
  captura?: 'user' | 'environment'
  /** Formatos aceptados; por defecto JPG, PNG o PDF (RN-30). */
  tipos?: readonly string[]
}

export function FileDrop({ etiqueta, descripcion, onSeleccionar, archivoActual, error, deshabilitado, cargando, captura, tipos = TIPOS_PERMITIDOS }: Props) {
  const id = useId()
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [encima, setEncima] = useState(false)
  const mensajeError = errorLocal ?? error ?? null

  function recibir(archivo: File | undefined) {
    if (!archivo) return
    const problema = validarArchivo(archivo, tipos)
    setErrorLocal(problema)
    if (!problema) onSeleccionar(archivo)
  }

  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setEncima(false)
    if (!deshabilitado) recibir(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-campo border border-dashed px-4 py-3 transition-colors focus-within:outline-3 focus-within:outline-primario-400 ${
          mensajeError
            ? 'border-alerta-600 bg-alerta-50'
            : encima
              ? 'border-primario-500 bg-primario-50'
              : 'border-linea bg-superficie hover:border-primario-300'
        } ${deshabilitado ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {archivoActual ? (
          <FileText aria-hidden="true" className="size-6 shrink-0 text-primario-600" />
        ) : (
          <Upload aria-hidden="true" className="size-6 shrink-0 text-tinta-tenue" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-tinta">{etiqueta}</span>
          <span className="truncate text-sm text-tinta-suave">
            {cargando
              ? 'Cargando…'
              : archivoActual
                ? `${archivoActual.nombre} (${formatoTamano(archivoActual.tamano)}). Toca para cambiarlo.`
                : (descripcion ?? 'JPG, PNG o PDF de hasta 10 MB. Toca para elegirlo o arrástralo aquí.')}
          </span>
        </span>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={tipos.join(',')}
          capture={captura}
          disabled={deshabilitado || cargando}
          aria-describedby={mensajeError ? `${id}-error` : undefined}
          aria-invalid={mensajeError ? true : undefined}
          onChange={(e) => {
            recibir(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {captura ? (
        // RI-06: con `capture` muchos celulares abren solo la cámara. Esta es la alternativa
        // para quien no puede o no quiere tomar la foto en el momento.
        <label
          htmlFor={`${id}-archivo`}
          className={`inline-flex min-h-11 cursor-pointer items-center self-start rounded-campo text-sm font-semibold text-primario-700 underline-offset-4 focus-within:outline-3 focus-within:outline-primario-400 hover:underline ${
            deshabilitado || cargando ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          O elige un archivo guardado
          <span className="sr-only">: {etiqueta}</span>
          <input
            id={`${id}-archivo`}
            type="file"
            className="sr-only"
            accept={tipos.join(',')}
            disabled={deshabilitado || cargando}
            aria-describedby={mensajeError ? `${id}-error` : undefined}
            onChange={(e) => {
              recibir(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      ) : null}
      {mensajeError ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-alerta-700">
          {mensajeError}
        </p>
      ) : null}
    </div>
  )
}
