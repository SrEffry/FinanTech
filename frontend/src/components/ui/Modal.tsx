import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: ReactNode
  children?: ReactNode
  acciones?: ReactNode
  /** Para acciones irreversibles no se cierra al hacer clic fuera (RI-04). */
  cierreFuera?: boolean
}

/**
 * Ventana modal sobre <dialog>: el navegador atrapa el foco, cierra con Escape y devuelve
 * el foco al elemento que la abrió.
 */
export function Modal({ abierto, onCerrar, titulo, descripcion, children, acciones, cierreFuera = false }: Props) {
  const referencia = useRef<HTMLDialogElement>(null)
  const tituloId = useId()
  const descripcionId = useId()

  useEffect(() => {
    const dialogo = referencia.current
    if (!dialogo) return
    if (abierto && !dialogo.open) {
      if (typeof dialogo.showModal === 'function') dialogo.showModal()
      else dialogo.setAttribute('open', '')
    }
    if (!abierto && dialogo.open) {
      if (typeof dialogo.close === 'function') dialogo.close()
      else dialogo.removeAttribute('open')
    }
  }, [abierto])

  // Cerrar al hacer clic en el fondo es un atajo de ratón; con teclado se cierra con Escape (onCancel).
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={referencia}
      aria-labelledby={tituloId}
      aria-describedby={descripcion ? descripcionId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      onClick={(e) => {
        if (cierreFuera && e.target === referencia.current) onCerrar()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[1.25rem] border border-linea bg-superficie p-0 text-tinta shadow-flotante backdrop:bg-noche/60 backdrop:backdrop-blur-sm"
    >
      {abierto ? (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={tituloId} className="titular text-xl font-semibold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-tinta-suave transition-colors hover:bg-fondo hover:text-tinta"
              aria-label="Cerrar"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          {descripcion ? (
            <div id={descripcionId} className="text-base leading-relaxed text-tinta-suave">
              {descripcion}
            </div>
          ) : null}
          {children}
          {acciones ? <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{acciones}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}
