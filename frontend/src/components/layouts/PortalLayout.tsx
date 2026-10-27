import { NavLink, Outlet } from 'react-router'
import { Calculator, FileText, House, LogOut, ShieldCheck } from 'lucide-react'
import { useCerrarSesion, useUsuario } from '../../features/acceso/sesion'
import { Logo } from '../dominio/Marca'
import { BarraNavegacion, SaltarAlContenido } from './Comunes'

const SECCIONES = [
  { a: '/portal', etiqueta: 'Inicio', icono: House, fin: true },
  { a: '/portal/simular', etiqueta: 'Simular', icono: Calculator, fin: false },
  { a: '/portal/solicitudes', etiqueta: 'Solicitudes', icono: FileText, fin: false },
  { a: '/portal/privacidad', etiqueta: 'Privacidad', icono: ShieldCheck, fin: false },
]

/**
 * Portal del cliente (RI-03): menú superior en escritorio y barra inferior en el celular,
 * donde está el 80 % de los clientes.
 */
export function PortalLayout() {
  const usuario = useUsuario()
  const cerrar = useCerrarSesion()

  return (
    <div className="min-h-dvh bg-fondo">
      <SaltarAlContenido />
      <BarraNavegacion />
      <header className="no-imprimir sticky top-0 z-30 border-b border-linea bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/portal" aria-label="FinanTech, ir al inicio">
            <Logo />
          </NavLink>
          <nav aria-label="Secciones del portal" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {SECCIONES.map(({ a, etiqueta, fin }) => (
                <li key={a}>
                  <NavLink
                    to={a}
                    end={fin}
                    className={({ isActive }) =>
                      `inline-flex min-h-11 items-center rounded-campo px-3 text-sm font-medium transition-colors ${
                        isActive ? 'bg-primario-50 text-primario-700' : 'text-tinta-suave hover:bg-fondo hover:text-tinta'
                      }`
                    }
                  >
                    {etiqueta}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-tinta-suave lg:inline">Hola, {usuario.nombre_corto}</span>
            <button
              type="button"
              onClick={() => cerrar.mutate()}
              disabled={cerrar.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-campo px-3 text-sm font-medium text-tinta-suave hover:bg-fondo hover:text-tinta"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-6 pb-28 outline-none sm:px-6 md:pb-12">
        <Outlet />
      </main>

      <nav
        aria-label="Secciones del portal"
        className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {SECCIONES.map(({ a, etiqueta, icono: Icono, fin }) => (
            <li key={a}>
              <NavLink
                to={a}
                end={fin}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                    isActive ? 'text-primario-700' : 'text-tinta-tenue'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icono aria-hidden="true" className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                    {etiqueta}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
