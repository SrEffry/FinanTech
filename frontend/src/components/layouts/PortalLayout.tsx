import { NavLink, Outlet } from 'react-router'
import { Calculator, FileText, House, LogOut, ShieldCheck } from 'lucide-react'
import { useCerrarSesion, useUsuario } from '../../features/acceso/sesion'
import { Logo } from '../dominio/Marca'
import { BarraNavegacion, SaltarAlContenido } from './Comunes'
import { useFocoAlNavegar } from './useFocoAlNavegar'

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
  useFocoAlNavegar()
  const cerrar = useCerrarSesion()

  return (
    <div className="min-h-dvh bg-fondo">
      <SaltarAlContenido />
      <BarraNavegacion />
      <header className="no-imprimir sticky top-0 z-30 border-b border-linea/80 bg-superficie/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/portal" aria-label="FinanTech, ir al inicio" className="rounded-campo">
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
                      `inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors ${
                        isActive ? 'bg-cielo font-semibold text-primario-700' : 'font-medium text-tinta-suave hover:bg-fondo hover:text-tinta'
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
            <span className="hidden items-center gap-2 text-sm text-tinta-suave lg:inline-flex">
              <span aria-hidden="true" className="titular flex size-8 items-center justify-center rounded-full bg-noche text-xs font-bold text-white">
                {usuario.nombre_corto.trim().charAt(0).toUpperCase()}
              </span>
              Hola, {usuario.nombre_corto}
            </span>
            <button
              type="button"
              onClick={() => cerrar.mutate()}
              disabled={cerrar.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-tinta-suave transition-colors hover:bg-fondo hover:text-tinta"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-6 pb-28 outline-none sm:px-6 sm:pt-8 md:pb-16">
        <Outlet />
      </main>

      <nav
        aria-label="Secciones del portal"
        className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(14_34_64/0.25)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-4">
          {SECCIONES.map(({ a, etiqueta, icono: Icono, fin }) => (
            <li key={a}>
              <NavLink
                to={a}
                end={fin}
                className={({ isActive }) =>
                  `relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                    isActive ? 'font-semibold text-primario-700' : 'font-medium text-tinta-suave'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* La sección activa no se marca solo con color: barra arriba y negrita (SV-10). */}
                    {isActive ? <span aria-hidden="true" className="absolute top-0 h-[3px] w-10 rounded-b-full bg-secundario-600" /> : null}
                    <span className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-cielo' : ''}`}>
                      <Icono aria-hidden="true" className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                    </span>
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
