import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Spinner } from './Spinner'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito' | 'claro' | 'contorno-claro' | 'acento'
type Tamano = 'md' | 'sm' | 'lg'

// Píldora: los botones se distinguen de los campos (radio 10 px) por su forma (direccion-visual §5).
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-salida ' +
  'active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 aria-disabled:cursor-not-allowed'

const DESHABILITADO_LLENO = 'disabled:bg-linea disabled:text-tinta-suave disabled:shadow-none'

const VARIANTES: Record<Variante, string> = {
  primario: `bg-primario-600 text-white shadow-boton hover:bg-primario-700 active:bg-primario-800 ${DESHABILITADO_LLENO}`,
  // Borde primario-600 (8,38:1): ya no parece deshabilitado junto al primario (SV-05).
  secundario:
    'border-[1.5px] border-primario-600 bg-superficie text-primario-700 hover:bg-primario-50 active:bg-primario-100 ' +
    'disabled:border-linea disabled:bg-superficie disabled:text-tinta-suave',
  // Deshabilitado: además del color, opacidad (SV-11).
  fantasma: 'text-primario-700 hover:bg-primario-50 active:bg-primario-100 disabled:text-tinta-suave disabled:opacity-60 disabled:hover:bg-transparent',
  peligro: `bg-alerta-600 text-white shadow-boton hover:bg-alerta-700 active:bg-alerta-700 ${DESHABILITADO_LLENO}`,
  exito: `bg-secundario-700 text-white shadow-boton hover:bg-secundario-800 active:bg-secundario-800 ${DESHABILITADO_LLENO}`,
  // Para superficies noche (página de inicio, panel de acceso).
  claro: `bg-white text-noche shadow-boton hover:bg-cielo active:bg-primario-100 ${DESHABILITADO_LLENO}`,
  // Acento menta: la llamada principal sobre noche (texto noche sobre menta-300, 10,18:1).
  acento: `bg-menta-300 text-noche shadow-boton hover:bg-menta-200 active:bg-secundario-100 ${DESHABILITADO_LLENO}`,
  'contorno-claro':
    'border-[1.5px] border-white/50 text-white hover:border-white hover:bg-white/10 active:bg-white/15 disabled:opacity-60',
}

// Áreas táctiles de 44 px como mínimo (RI-01).
const TAMANOS: Record<Tamano, string> = {
  md: 'min-h-11 px-5 text-base',
  sm: 'min-h-11 px-4 text-sm sm:min-h-9',
  lg: 'min-h-13 px-7 text-base',
}

function clasesBoton(variante: Variante = 'primario', tamano: Tamano = 'md', extra = ''): string {
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
