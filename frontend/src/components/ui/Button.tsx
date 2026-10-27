import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Spinner } from './Spinner'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito'
type Tamano = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-campo font-semibold transition-colors select-none ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-primario-600 text-white hover:bg-primario-700 active:bg-primario-800 disabled:bg-linea disabled:text-tinta-tenue',
  secundario:
    'border border-primario-300 bg-superficie text-primario-700 hover:border-primario-500 hover:bg-primario-50 active:bg-primario-100 disabled:border-linea disabled:text-tinta-tenue disabled:bg-superficie',
  fantasma: 'text-primario-700 hover:bg-primario-50 active:bg-primario-100 disabled:text-tinta-tenue',
  peligro: 'bg-alerta-600 text-white hover:bg-alerta-700 active:bg-alerta-700 disabled:bg-linea disabled:text-tinta-tenue',
  exito:
    'bg-secundario-700 text-white hover:bg-secundario-800 active:bg-secundario-800 disabled:bg-linea disabled:text-tinta-tenue',
}

// Áreas táctiles de 44 px como mínimo (RI-01).
const TAMANOS: Record<Tamano, string> = {
  md: 'min-h-11 px-5 text-base',
  sm: 'min-h-11 px-3 text-sm sm:min-h-9',
}

export function clasesBoton(variante: Variante = 'primario', tamano: Tamano = 'md', extra = ''): string {
  return `${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  /** Estado "en proceso" (RI-04): deshabilita el botón y anuncia la espera. */
  cargando?: boolean
  icono?: ReactNode
}

export function Button({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  icono,
  disabled,
  className = '',
  children,
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={clasesBoton(variante, tamano, className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando ? <Spinner tamano="sm" /> : icono}
      {children}
    </button>
  )
}

interface PropsEnlace extends LinkProps {
  variante?: Variante
  tamano?: Tamano
  icono?: ReactNode
}

export function ButtonLink({ variante = 'primario', tamano = 'md', icono, className = '', children, ...resto }: PropsEnlace) {
  return (
    <Link className={clasesBoton(variante, tamano, className)} {...resto}>
      {icono}
      {children}
    </Link>
  )
}
