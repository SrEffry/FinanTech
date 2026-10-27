import { useId, useState, type DragEvent } from 'react'
import { FileText, Upload } from 'lucide-react'

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf']
export const TAMANO_MAXIMO = 10 * 1024 * 1024

/** RN-30: JPG, PNG o PDF de máximo 10 MB, revisado en el momento de la captura. */
export function validarArchivo(archivo: File): string | null {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) return 'Sube el documento en JPG, PNG o PDF.'
  if (archivo.size > TAMANO_MAXIMO) return 'El archivo pesa más de 10 MB. Comprímelo o tómale una foto.'
  if (archivo.size === 0) return 'El archivo está vacío. Elige otro.'
  return null
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
}

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
}

export function FileDrop({ etiqueta, descripcion, onSeleccionar, archivoActual, error, deshabilitado, cargando, captura }: Props) {
  const id = useId()
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const [encima, setEncima] = useState(false)
  const mensajeError = errorLocal ?? error ?? null

  function recibir(archivo: File | undefined) {
    if (!archivo) return
    const problema = validarArchivo(archivo)
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
          accept={TIPOS_PERMITIDOS.join(',')}
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
      {mensajeError ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-alerta-700">
          {mensajeError}
        </p>
      ) : null}
    </div>
  )
}
