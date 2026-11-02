import {
  createContext,
  use,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

interface ContextoCampo {
  id: string
  invalido: boolean
  describedBy: string | undefined
}

const Contexto = createContext<ContextoCampo | null>(null)

interface PropsCampo {
  id: string
  etiqueta: ReactNode
  /** Ayuda contextual, por ejemplo qué significa un término financiero (RNF-20). */
  ayuda?: ReactNode
  error?: string
  opcional?: boolean
  children: ReactNode
  className?: string
}

/**
 * Etiqueta, ayuda y error de un control. El control hijo (Input, Select, Textarea) toma de
 * aquí su id, `aria-invalid` y `aria-describedby`, así el lector de pantalla lee el error.
 */
export function Field({ id, etiqueta, ayuda, error, opcional, children, className = '' }: PropsCampo) {
  const ids = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean)
  return (
    <Contexto value={{ id, invalido: Boolean(error), describedBy: ids.length ? ids.join(' ') : undefined }}>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <label htmlFor={id} className="text-sm font-semibold text-tinta">
          {etiqueta}
          {opcional ? <span className="font-normal text-tinta-tenue"> (opcional)</span> : null}
        </label>
        {children}
        {ayuda ? (
          <p id={`${id}-ayuda`} className="text-sm text-tinta-tenue">
            {ayuda}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-alerta-700">
            {error}
          </p>
        ) : null}
      </div>
    </Contexto>
  )
}

function useCampo() {
  return use(Contexto)
}

// UX-10 (SV-01, SV-03): borde de control a 3,51:1 y el mismo contorno de foco del resto del
// portal (2 px, foco 8,38:1); el borde azul refuerza, no reemplaza.
const CONTROL =
  'w-full rounded-campo border bg-superficie px-3.5 text-base text-tinta shadow-reposo placeholder:text-tinta-tenue ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-tinta-suave focus:border-primario-600 ' +
  'disabled:cursor-not-allowed disabled:border-linea disabled:bg-fondo disabled:text-tinta-suave disabled:shadow-none'

function clasesControl(invalido: boolean, extra = '') {
  return `${CONTROL} ${invalido ? 'border-alerta-600 hover:border-alerta-700' : 'border-linea-control'} ${extra}`
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  const campo = useCampo()
  return (
    <input
      id={campo?.id}
      aria-invalid={campo?.invalido || undefined}
      aria-describedby={campo?.describedBy}
      className={clasesControl(Boolean(campo?.invalido), `min-h-12 ${className}`)}
      {...props}
    />
  )
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement> }) {
  const campo = useCampo()
  return (
    <select
      id={campo?.id}
      aria-invalid={campo?.invalido || undefined}
      aria-describedby={campo?.describedBy}
      className={clasesControl(Boolean(campo?.invalido), `min-h-12 pr-8 ${className}`)}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const campo = useCampo()
  return (
    <textarea
      id={campo?.id}
      aria-invalid={campo?.invalido || undefined}
      aria-describedby={campo?.describedBy}
      className={clasesControl(Boolean(campo?.invalido), `min-h-28 py-3 ${className}`)}
      {...props}
    />
  )
}

/** Dato que ya conocemos: visible pero bloqueado y diferenciado (RN-32). */
export function DatoBloqueado({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-campo border border-dashed border-linea-control/60 bg-fondo px-3.5 py-2.5">
      <dt className="text-xs text-tinta-tenue">{etiqueta}</dt>
      <dd className="text-sm font-medium text-tinta-suave">{valor}</dd>
    </div>
  )
}
