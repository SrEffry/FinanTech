import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigation } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Rol } from '../../lib/api/tipos'
import { inicioDeRol, useSesion } from '../../features/acceso/sesion'
import { CargaPagina } from '../ui/Spinner'

/** Primer elemento enfocable: salta la navegación (WCAG 2.4.1). */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="sr-only z-50 rounded-campo bg-primario-700 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Saltar al contenido
    </a>
  )
}

/** Barra de progreso arriba cuando una navegación tarda (RI-04). */
export function BarraNavegacion() {
  const navegacion = useNavigation()
  if (navegacion.state === 'idle') return null
  return (
    <div role="progressbar" aria-label="Cargando la página" className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primario-100">
      <div className="h-full w-1/3 animate-[avance_1.2s_ease-in-out_infinite] bg-primario-600" />
    </div>
  )
}

export interface Miga {
  etiqueta: string
  a?: string
}

interface PropsEncabezado {
  titulo: string
  descripcion?: ReactNode
  migas?: Miga[]
  acciones?: ReactNode
  extra?: ReactNode
}

/** Título de página con migas de pan (RI-03) y acciones. */
export function EncabezadoPagina({ titulo, descripcion, migas, acciones, extra }: PropsEncabezado) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {migas && migas.length > 0 ? (
        <nav aria-label="Migas de pan">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-tinta-suave">
            {migas.map((miga, i) => (
              <li key={miga.etiqueta} className="flex items-center gap-1">
                {miga.a ? (
                  <Link to={miga.a} className="rounded-sm hover:text-primario-700 hover:underline">
                    {miga.etiqueta}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-tinta">
                    {miga.etiqueta}
                  </span>
                )}
                {i < migas.length - 1 ? <ChevronRight aria-hidden="true" className="size-3.5" /> : null}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">{titulo}</h1>
          {descripcion ? <div className="text-base text-tinta-suave">{descripcion}</div> : null}
        </div>
        {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
      </div>
      {extra}
    </header>
  )
}

/**
 * Bloquea la navegación por rol. Es solo comodidad del portal: la autorización real la
 * hace el servidor en cada endpoint (RNF-05).
 */
export function RutaProtegida({ roles }: { roles: Rol[] }) {
  const { data: usuario, isPending } = useSesion()
  const ubicacion = useLocation()
  if (isPending) return <CargaPagina etiqueta="Verificando tu sesión…" />
  if (!usuario) {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search)
    return <Navigate to={`/ingresar?volver=${volver}`} replace />
  }
  if (!roles.includes(usuario.rol)) return <Navigate to={inicioDeRol(usuario.rol)} replace />
  return <Outlet />
}
