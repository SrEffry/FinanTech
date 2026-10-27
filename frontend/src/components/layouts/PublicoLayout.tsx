import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { BadgeCheck, LineChart, Lock } from 'lucide-react'
import { ButtonLink } from '../ui/Button'
import { Logo } from '../dominio/Marca'
import { BarraNavegacion, SaltarAlContenido } from './Comunes'

/** Páginas públicas (simulador del visitante, recuperación de contraseña). */
export function PublicoLayout() {
  return (
    <div className="min-h-dvh bg-fondo">
      <SaltarAlContenido />
      <BarraNavegacion />
      <header className="border-b border-linea bg-superficie">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="FinanTech, ir al inicio">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ButtonLink to="/ingresar" variante="fantasma" tamano="sm">
              Iniciar sesión
            </ButtonLink>
            <ButtonLink to="/registro" variante="primario" tamano="sm">
              Crear cuenta
            </ButtonLink>
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6">
        <Outlet />
      </main>
      <PiePublico />
    </div>
  )
}

export function PiePublico() {
  return (
    <footer className="border-t border-linea">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-tinta-tenue sm:px-6">
        <p>FinanTech. Crédito de consumo en línea.</p>
        <p>Proyecto académico de la Universidad de Córdoba: no ofrece crédito real.</p>
      </div>
    </footer>
  )
}

const MENSAJES = [
  { icono: LineChart, titulo: 'Decisión en línea', texto: 'Simula, radica y recibe la respuesta sin ir a una oficina.' },
  { icono: BadgeCheck, titulo: 'Seguimiento transparente', texto: 'Ves en qué etapa va tu solicitud y qué falta, con fechas.' },
  { icono: Lock, titulo: 'Tus datos protegidos', texto: 'Cifrados, con segundo factor y solo para lo que autorices.' },
]

/**
 * Pantallas de acceso (8.1.1): a la izquierda la identidad de FinanTech y sus tres
 * mensajes de valor; a la derecha el formulario. En el celular solo se ve el formulario.
 */
export function PantallaAcceso({ children, ancho = 'normal' }: { children: ReactNode; ancho?: 'normal' | 'amplio' }) {
  return (
    <div className="min-h-dvh bg-superficie lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <SaltarAlContenido />
      <BarraNavegacion />
      <aside className="relative hidden overflow-hidden bg-primario-700 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" aria-label="FinanTech, ir al inicio">
          <Logo claro />
        </Link>
        <div className="flex max-w-md flex-col gap-10">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Tu crédito de consumo, con la cuota y la tasa claras desde el primer número.
          </p>
          <ul className="flex flex-col gap-6">
            {MENSAJES.map(({ icono: Icono, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-campo bg-white/10">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{titulo}</span>
                  <span className="text-sm text-primario-100">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primario-200">Proyecto académico de la Universidad de Córdoba: no ofrece crédito real.</p>
      </aside>
      <main id="contenido" tabIndex={-1} className="flex min-h-dvh flex-col px-4 py-6 outline-none sm:px-8 lg:py-12">
        <div className="lg:hidden">
          <Link to="/" aria-label="FinanTech, ir al inicio">
            <Logo />
          </Link>
        </div>
        <div className={`mx-auto flex w-full flex-1 flex-col justify-center py-8 ${ancho === 'amplio' ? 'max-w-2xl' : 'max-w-md'}`}>
          {children}
        </div>
      </main>
    </div>
  )
}
