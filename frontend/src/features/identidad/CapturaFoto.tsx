import { useEffect, useId, useState, type ReactNode } from 'react'
import { Camera, CircleCheck, Glasses, ImageUp, ScanLine, SunMedium, Sparkles } from 'lucide-react'
import { TIPOS_FOTO, formatoTamano, validarArchivo } from '../../lib/archivos'
import { reducirFoto } from '../../lib/imagenes'
import { Spinner } from '../../components/ui/Spinner'

export type TipoCaptura = 'frente' | 'reverso' | 'rostro'

const GUIAS: Record<TipoCaptura, { titulo: string; accion: string; reglas: { icono: ReactNode; texto: string }[] }> = {
  frente: {
    titulo: 'Frente del documento',
    accion: 'Tomar foto del frente',
    reglas: [
      { icono: <SunMedium aria-hidden="true" className="size-4" />, texto: 'Con buena luz' },
      { icono: <Sparkles aria-hidden="true" className="size-4" />, texto: 'Sin reflejos ni sombras' },
      { icono: <ScanLine aria-hidden="true" className="size-4" />, texto: 'Que se vean las cuatro esquinas' },
    ],
  },
  reverso: {
    titulo: 'Reverso del documento',
    accion: 'Tomar foto del reverso',
    reglas: [
      { icono: <SunMedium aria-hidden="true" className="size-4" />, texto: 'Con buena luz' },
      { icono: <Sparkles aria-hidden="true" className="size-4" />, texto: 'Sin reflejos ni sombras' },
      { icono: <ScanLine aria-hidden="true" className="size-4" />, texto: 'Que se vean las cuatro esquinas' },
    ],
  },
  rostro: {
    titulo: 'Foto de tu rostro',
    accion: 'Tomar mi foto',
    reglas: [
      { icono: <SunMedium aria-hidden="true" className="size-4" />, texto: 'En un lugar iluminado' },
      { icono: <Glasses aria-hidden="true" className="size-4" />, texto: 'Sin gafas ni gorra' },
      { icono: <ScanLine aria-hidden="true" className="size-4" />, texto: 'De frente, la cara dentro del óvalo' },
    ],
  },
}

/** Guía de encuadre (RI-06): marco con esquinas para el documento, óvalo para el rostro. */
function Encuadre({ tipo }: { tipo: TipoCaptura }) {
  if (tipo === 'rostro') {
    return (
      <svg viewBox="0 0 160 112" aria-hidden="true" className="h-28 w-full">
        <rect x="1" y="1" width="158" height="110" rx="14" className="fill-cielo" />
        <ellipse cx="80" cy="56" rx="30" ry="40" fill="none" strokeWidth="2.5" strokeDasharray="6 5" className="stroke-primario-600" />
        <circle cx="80" cy="46" r="12" className="fill-primario-200" />
        <path d="M58 86c4-13 13-19 22-19s18 6 22 19" className="fill-primario-200" />
      </svg>
    )
  }
  const esquina = 'fill-none stroke-primario-600'
  return (
    <svg viewBox="0 0 160 112" aria-hidden="true" className="h-28 w-full">
      <rect x="1" y="1" width="158" height="110" rx="14" className="fill-cielo" />
      <rect x="28" y="22" width="104" height="68" rx="7" className="fill-superficie stroke-linea-control" strokeWidth="1.5" />
      {tipo === 'frente' ? (
        <>
          <rect x="38" y="34" width="26" height="32" rx="4" className="fill-primario-200" />
          <rect x="72" y="36" width="48" height="5" rx="2.5" className="fill-linea" />
          <rect x="72" y="47" width="38" height="5" rx="2.5" className="fill-linea" />
          <rect x="72" y="58" width="44" height="5" rx="2.5" className="fill-linea" />
          <rect x="38" y="74" width="82" height="5" rx="2.5" className="fill-linea" />
        </>
      ) : (
        <>
          <rect x="38" y="34" width="84" height="16" rx="3" className="fill-linea" />
          <rect x="38" y="58" width="40" height="5" rx="2.5" className="fill-linea" />
          <rect x="38" y="69" width="56" height="5" rx="2.5" className="fill-linea" />
          <rect x="98" y="58" width="24" height="24" rx="3" className="fill-primario-200" />
        </>
      )}
      <path d="M20 30V18a4 4 0 0 1 4-4h12" strokeWidth="3" strokeLinecap="round" className={esquina} />
      <path d="M124 14h12a4 4 0 0 1 4 4v12" strokeWidth="3" strokeLinecap="round" className={esquina} />
      <path d="M140 82v12a4 4 0 0 1-4 4h-12" strokeWidth="3" strokeLinecap="round" className={esquina} />
      <path d="M36 98H24a4 4 0 0 1-4-4V82" strokeWidth="3" strokeLinecap="round" className={esquina} />
    </svg>
  )
}

/** Miniatura en memoria: se libera al cambiar la foto o al salir (RI-06). */
function useVistaPrevia(archivo: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!archivo || typeof URL.createObjectURL !== 'function') {
      setUrl(null)
      return
    }
    const nueva = URL.createObjectURL(archivo)
    setUrl(nueva)
    return () => URL.revokeObjectURL(nueva)
  }, [archivo])
  return url
}

const BOTON_ARCHIVO =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors ' +
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco'

interface Props {
  tipo: TipoCaptura
  archivo: File | null
  onCambiar: (archivo: File | null) => void
  error?: string
  deshabilitado?: boolean
}

/**
 * Captura de una foto para la verificación de identidad (UX-13, RI-06): guía de encuadre,
 * tres reglas cortas, botón que abre la cámara y la alternativa de subir un archivo; después,
 * la miniatura con "Tomar otra". La foto se reduce antes de enviarla (D9).
 */
export function CapturaFoto({ tipo, archivo, onCambiar, error, deshabilitado }: Props) {
  const id = useId()
  const guia = GUIAS[tipo]
  const [preparando, setPreparando] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const vista = useVistaPrevia(archivo)
  const mensaje = errorLocal ?? error ?? null

  async function recibir(elegido: File | undefined) {
    if (!elegido) return
    const problema = validarArchivo(elegido, TIPOS_FOTO)
    setErrorLocal(problema)
    if (problema) return
    setPreparando(true)
    try {
      onCambiar(await reducirFoto(elegido))
    } finally {
      setPreparando(false)
    }
  }

  const entrada = (conCamara: boolean) => (
    <input
      type="file"
      className="sr-only"
      accept={TIPOS_FOTO.join(',')}
      capture={conCamara ? (tipo === 'rostro' ? 'user' : 'environment') : undefined}
      disabled={deshabilitado || preparando}
      aria-describedby={mensaje ? `${id}-error` : undefined}
      aria-invalid={mensaje ? true : undefined}
      onChange={(e) => {
        void recibir(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  return (
    <article
      aria-labelledby={`${id}-titulo`}
      className={`flex flex-col gap-4 rounded-panel border bg-superficie p-4 shadow-reposo ${mensaje ? 'border-alerta-600' : archivo ? 'border-secundario-700' : 'border-linea'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-titulo`} className="font-semibold text-tinta">
          {guia.titulo}
        </h3>
        {archivo ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-secundario-700">
            <CircleCheck aria-hidden="true" className="size-4" />
            Lista
          </span>
        ) : null}
      </div>

      {archivo && vista ? (
        <img src={vista} alt={`Vista previa: ${guia.titulo.toLowerCase()}`} className="h-36 w-full rounded-campo bg-fondo object-contain" />
      ) : archivo ? (
        <p className="rounded-campo bg-fondo px-3 py-6 text-center text-sm text-tinta-suave">{archivo.name}</p>
      ) : (
        <>
          <Encuadre tipo={tipo} />
          <ul className="flex flex-col gap-1.5 text-sm text-tinta-suave">
            {guia.reglas.map((r) => (
              <li key={r.texto} className="flex items-center gap-2">
                <span className="text-primario-600">{r.icono}</span>
                {r.texto}
              </li>
            ))}
          </ul>
        </>
      )}

      {archivo ? <p className="text-xs text-tinta-tenue">{`${archivo.name} (${formatoTamano(archivo.size)})`}</p> : null}

      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
        {preparando ? (
          <p className="inline-flex min-h-11 items-center gap-2 text-sm text-tinta-suave" role="status">
            <Spinner tamano="sm" /> Preparando la foto…
          </p>
        ) : (
          <>
            <label className={`${BOTON_ARCHIVO} ${archivo ? 'border border-primario-600 text-primario-700 hover:bg-cielo' : 'bg-primario-600 text-white hover:bg-primario-700'} ${deshabilitado ? 'pointer-events-none opacity-60' : ''}`}>
              <Camera aria-hidden="true" className="size-4" />
              {archivo ? 'Tomar otra' : guia.accion}
              <span className="sr-only">{archivo ? `: ${guia.titulo.toLowerCase()}` : ''}</span>
              {entrada(true)}
            </label>
            {/* RI-06: alternativa para quien no puede o no quiere tomar la foto en el momento. */}
            <label className={`${BOTON_ARCHIVO} text-primario-700 hover:bg-cielo ${deshabilitado ? 'pointer-events-none opacity-60' : ''}`}>
              <ImageUp aria-hidden="true" className="size-4" />
              Subir un archivo
              <span className="sr-only">: {guia.titulo.toLowerCase()}</span>
              {entrada(false)}
            </label>
          </>
        )}
      </div>

      {mensaje ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-alerta-700">
          {mensaje}
        </p>
      ) : null}
    </article>
  )
}
