import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

type TipoToast = 'exito' | 'error'

interface Toast {
  id: number
  tipo: TipoToast
  mensaje: string
}

interface ContextoToast {
  avisar: (mensaje: string, tipo?: TipoToast) => void
}

const Contexto = createContext<ContextoToast>({ avisar: () => {} })

let siguiente = 0

/** Confirmaciones breves de éxito o error (RI-04), anunciadas a lectores de pantalla. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const cerrar = useCallback((id: number) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id))
  }, [])

  const avisar = useCallback(
    (mensaje: string, tipo: TipoToast = 'exito') => {
      const id = ++siguiente
      setToasts((actuales) => [...actuales.slice(-2), { id, tipo, mensaje }])
      window.setTimeout(() => cerrar(id), tipo === 'error' ? 8000 : 5000)
    },
    [cerrar],
  )

  const valor = useMemo(() => ({ avisar }), [avisar])

  return (
    <Contexto value={valor}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-panel border border-linea bg-superficie px-4 py-3 text-sm text-tinta shadow-lg shadow-tinta/10"
          >
            {t.tipo === 'exito' ? (
              <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-secundario-700" />
            ) : (
              <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-alerta-600" />
            )}
            <p className="flex-1 leading-relaxed">{t.mensaje}</p>
            <button
              type="button"
              onClick={() => cerrar(t.id)}
              className="-m-1 inline-flex size-8 items-center justify-center rounded-campo text-tinta-tenue hover:bg-fondo"
              aria-label="Cerrar aviso"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Contexto>
  )
}

export function useToast() {
  return use(Contexto)
}
