import type { InputHTMLAttributes, ReactNode } from 'react'

interface PropsCasilla extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  etiqueta: ReactNode
  descripcion?: ReactNode
  ref?: React.Ref<HTMLInputElement>
}

/** Casilla con etiqueta clicable completa (área táctil de 44 px). */
export function Checkbox({ etiqueta, descripcion, id, className = '', disabled, ...props }: PropsCasilla) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <span className="flex min-h-11 items-start pt-0.5">
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-describedby={descripcion ? `${id}-descripcion` : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-linea accent-primario-600 disabled:cursor-not-allowed"
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

/** Interruptor accesible: un botón con role="switch" y aria-checked. */
export function Switch({ id, activo, onCambiar, etiqueta, disabled, describedBy }: PropsInterruptor) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        activo ? 'bg-secundario-700' : 'bg-tinta-tenue/40'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
          activo ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
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
        <output htmlFor={id} className="cifras text-xl font-semibold text-tinta">
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
