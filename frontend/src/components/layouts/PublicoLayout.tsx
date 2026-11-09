import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { Eye, ListChecks, ShieldCheck } from 'lucide-react'
import { ButtonLink } from '../ui/Button'
import { CuotaConTea } from '../dominio/CuotaConTea'
import { Dinero, Logo } from '../dominio/Marca'
import { BarraNavegacion, SaltarAlContenido } from './Comunes'
import { useFocoAlNavegar } from './useFocoAlNavegar'

const ENLACES_PUBLICOS = [
  { a: '/simular', etiqueta: 'Simular' },
  { a: '/#como-funciona', etiqueta: 'Cómo funciona' },
  { a: '/#seguridad', etiqueta: 'Seguridad' },
]

/**
 * Cabecera de las páginas públicas. `oscura` es la versión que va sobre la superficie noche
 * de la página de inicio.
 */
export function CabeceraPublica({ oscura = false }: { oscura?: boolean }) {
  return (
    <header
      className={
        oscura
          ? 'sobre-oscuro absolute inset-x-0 top-0 z-20 text-white'
          : 'sticky top-0 z-30 border-b border-linea/80 bg-superficie/90 backdrop-blur-md'
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-18 sm:px-6">
        <Link to="/" aria-label="FinanTech, ir al inicio" className="rounded-campo">
          <Logo claro={oscura} />
        </Link>
        <nav aria-label="Páginas públicas" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {ENLACES_PUBLICOS.map(({ a, etiqueta }) => (
              <li key={a}>
                <Link
                  to={a}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                    oscura ? 'text-niebla hover:bg-white/10 hover:text-white' : 'text-tinta-suave hover:bg-fondo hover:text-tinta'
                  }`}
                >
                  {etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ButtonLink to="/ingresar" variante={oscura ? 'contorno-claro' : 'fantasma'} tamano="sm" className={oscura ? 'border-transparent' : ''}>
            Iniciar sesión
          </ButtonLink>
          <ButtonLink to="/registro" variante={oscura ? 'acento' : 'primario'} tamano="sm" className="max-[399px]:hidden">
            Crear cuenta
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}

/** Páginas públicas (simulador del visitante). */
export function PublicoLayout() {
  useFocoAlNavegar()
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <SaltarAlContenido />
      <BarraNavegacion />
      <CabeceraPublica />
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <PiePublico />
    </div>
  )
}

export function PiePublico() {
  return (
    <footer className="sobre-oscuro trama-trenza bg-noche text-niebla">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex max-w-sm flex-col gap-4">
          <Link to="/" aria-label="FinanTech, ir al inicio" className="self-start rounded-campo">
            <Logo claro />
          </Link>
          <p className="text-sm leading-relaxed">Crédito de consumo en línea, con la cuota y la tasa claras desde el primer número.</p>
        </div>
        <nav aria-label="Pie de página">
          <p className="titular mb-3 text-sm font-semibold text-white">Producto</p>
          <ul className="flex flex-col text-sm">
            <li>
              <Link to="/simular" className="inline-flex min-h-11 items-center hover:text-white hover:underline">
                Simular un crédito
              </Link>
            </li>
            <li>
              <Link to="/registro" className="inline-flex min-h-11 items-center hover:text-white hover:underline">
                Crear cuenta
              </Link>
            </li>
            <li>
              <Link to="/ingresar" className="inline-flex min-h-11 items-center hover:text-white hover:underline">
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex flex-col gap-3 text-sm">
          <p className="titular font-semibold text-white">Sobre este sitio</p>
          <p className="leading-relaxed">
            Proyecto académico de Ingeniería de Sistemas de la Universidad de Córdoba. No ofrece crédito real ni mueve dinero.
          </p>
        </div>
      </div>
    </footer>
  )
}

/**
 * Pieza de marca del panel de acceso: un recibo de ejemplo, rotulado como tal (D12). Los
 * valores son ilustrativos (un cálculo con la tasa de libre inversión de la versión de
 * parámetros sintética) y no se presentan como una oferta; lleva cuota y TEA juntas y el
 * aviso de que no constituye aprobación (CP0011).
 */
function ReciboEjemplo() {
  const renglones: [string, number][] = [
    ['Intereses', 958_283],
    ['Seguro de vida deudor', 108_000],
    ['Estudio de crédito', 75_000],
  ]
  return (
    <figure className="relative w-full max-w-sm -rotate-2 text-tinta [filter:drop-shadow(0_28px_40px_rgb(0_0_0/0.35))]">
      <div className="recibo-borde rounded-t-[1.25rem] bg-superficie px-6 pt-5 pb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <figcaption className="text-sm text-tinta-suave">Libre inversión, $ 5.000.000 a 24 meses</figcaption>
          <span className="rounded-full bg-cielo px-2.5 py-1 text-xs font-semibold text-primario-700 ring-1 ring-primario-200 ring-inset">
            Ejemplo
          </span>
        </div>
        <CuotaConTea cuota={252_762} tea={18.9} tamano="mediano" />
        <dl className="cifras mt-4 flex flex-col border-t border-dashed border-linea pt-3 text-sm">
          {renglones.map(([concepto, valor]) => (
            <div key={concepto} className="flex justify-between gap-4 py-1">
              <dt className="text-tinta-suave">{concepto}</dt>
              <dd className="font-medium">
                <Dinero valor={valor} />
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 py-1 font-semibold">
            <dt>Total a pagar</dt>
            <dd>
              <Dinero valor={6_141_283} />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-tinta-suave">Valores ilustrativos: no constituyen una aprobación.</p>
      </div>
    </figure>
  )
}

const MENSAJES = [
  { icono: Eye, titulo: 'Sin letra pequeña' },
  { icono: ListChecks, titulo: 'Sabes en qué va' },
  { icono: ShieldCheck, titulo: 'Datos protegidos' },
]

/**
 * Pantallas de acceso (8.1.1): a la izquierda la identidad de FinanTech sobre noche, con sus
 * tres mensajes de valor; a la derecha el formulario. En el celular solo se ve el formulario.
 */
export function PantallaAcceso({ children, ancho = 'normal' }: { children: ReactNode; ancho?: 'normal' | 'amplio' }) {
  return (
    <div className="min-h-dvh bg-superficie lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <SaltarAlContenido />
      <BarraNavegacion />
      <aside className="sobre-oscuro trama-trenza relative hidden overflow-hidden bg-noche px-12 py-12 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-primario-600/40 blur-3xl"
        />
        <Link to="/" aria-label="FinanTech, ir al inicio" className="relative self-start rounded-campo">
          <Logo claro />
        </Link>
        <div className="relative flex max-w-md flex-col gap-9">
          <p className="titular text-[1.75rem] leading-[1.15] font-semibold">
            Tu crédito de consumo, con la cuota y la tasa claras desde el primer número.
          </p>
          <ReciboEjemplo />
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-niebla [@media(max-height:820px)]:hidden">
            {MENSAJES.map(({ icono: Icono, titulo }) => (
              <li key={titulo} className="flex items-center gap-2">
                <Icono aria-hidden="true" className="size-4 text-menta-300" />
                {titulo}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-bruma">Proyecto académico de la Universidad de Córdoba: no ofrece crédito real.</p>
      </aside>
      <main id="contenido" tabIndex={-1} className="flex min-h-dvh flex-col outline-none lg:px-8 lg:py-12">
        {/* En el celular la marca va arriba, en noche, y el formulario sube encima como una hoja. */}
        <div className="sobre-oscuro trama-trenza relative overflow-hidden bg-noche px-4 pt-5 pb-12 text-white sm:px-8 lg:hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primario-600/45 blur-3xl" />
          <Link to="/" aria-label="FinanTech, ir al inicio" className="relative inline-flex rounded-campo">
            <Logo claro />
          </Link>
          <p className="titular relative mt-6 max-w-xs text-xl leading-snug font-semibold">
            Tu crédito, con la cuota y la tasa claras desde el primer número.
          </p>
        </div>
        <div className="relative -mt-6 flex flex-1 flex-col rounded-t-[1.5rem] bg-superficie px-4 shadow-[0_-12px_32px_-20px_rgb(14_34_64/0.5)] sm:px-8 lg:mt-0 lg:rounded-none lg:px-0 lg:shadow-none">
          <div className={`mx-auto flex w-full flex-1 flex-col justify-center py-8 ${ancho === 'amplio' ? 'max-w-2xl' : 'max-w-md'}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
