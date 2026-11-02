import type { InputHTMLAttributes, ReactNode } from 'react'

interface PropsCasilla extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  etiqueta: ReactNode
  descripcion?: ReactNode
  /** Error asociado a la casilla: se anuncia con ella (aria-invalid y aria-describedby). */
  error?: string
  ref?: React.Ref<HTMLInputElement>
}

/** Casilla con etiqueta clicable completa (área táctil de 44 px). */
export function Checkbox({ etiqueta, descripcion, error, id, className = '', disabled, ...props }: PropsCasilla) {
  const describedBy = [descripcion ? `${id}-descripcion` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  return (
    <div className={`flex gap-3 ${className}`}>
      <span className="flex min-h-11 items-start pt-0.5">
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-primario-600 disabled:cursor-not-allowed"
          {...props}
        />
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <label htmlFor={id} className={`text-base ${disabled ? 'text-tinta-suave' : 'cursor-pointer text-tinta'}`}>
          {etiqueta}
        </label>
        {descripcion ? (
          <span id={`${id}-descripcion`} className="text-sm text-tinta-tenue">
            {descripcion}
          </span>
        ) : null}
        {error ? (
          <span id={`${id}-error`} className="text-sm font-medium text-alerta-700">
            {error}
          </span>
        ) : null}
      </span>
    </div>
  )
}

interface PropsInterruptor {
  id: string
  activo: boolean
  onCambiar: (activo: boolean) => void
  etiqueta: string
  disabled?: boolean
  describedBy?: string
}

/**
 * Interruptor accesible: un botón con role="switch" y aria-checked. Apagado se ve con borde
 * de control (3,51:1) y pulgar oscuro; además dice "Sí" o "No" en texto, para que el estado
 * no dependa solo de la posición ni del color (SV-02, UX-10, WCAG 1.4.1 y 1.4.11).
 */
export function Switch({ id, activo, onCambiar, etiqueta, disabled, describedBy }: PropsInterruptor) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => onCambiar(!activo)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
          activo ? 'border-secundario-700 bg-secundario-700' : 'border-linea-control bg-superficie'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-5 rounded-full shadow-sm transition-transform duration-150 ease-salida ${
            activo ? 'translate-x-5.5 bg-white' : 'translate-x-0.5 bg-tinta-tenue'
          }`}
        />
      </button>
      <span aria-hidden="true" className={`w-6 text-sm font-semibold ${activo ? 'text-secundario-700' : 'text-tinta-suave'}`}>
        {activo ? 'Sí' : 'No'}
      </span>
    </span>
  )
}

interface PropsDeslizador {
  id: string
  etiqueta: string
  valor: number
  min: number
  max: number
  paso: number
  onCambiar: (valor: number) => void
  /** Texto del valor actual, por ejemplo "$ 5.000.000". */
  textoValor: string
  textoMin: string
  textoMax: string
}

/** Control deslizante de monto o plazo (8.2.2). El valor también se anuncia con aria-valuetext. */
export function Slider({ id, etiqueta, valor, min, max, paso, onCambiar, textoValor, textoMin, textoMax }: PropsDeslizador) {
  const progreso = max > min ? ((valor - min) / (max - min)) * 100 : 0
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-tinta">
          {etiqueta}
        </label>
        <output htmlFor={id} className="cifras text-xl font-semibold tracking-tight text-tinta">
          {textoValor}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        aria-valuetext={textoValor}
        onChange={(e) => onCambiar(Number(e.target.value))}
        className="deslizador h-11 w-full cursor-pointer"
        style={{ '--progreso': `${progreso}%` } as React.CSSProperties}
      />
      <div className="cifras flex justify-between text-xs text-tinta-tenue" aria-hidden="true">
        <span>{textoMin}</span>
        <span>{textoMax}</span>
      </div>
    </div>
  )
}
