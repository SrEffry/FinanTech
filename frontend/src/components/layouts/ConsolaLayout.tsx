import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  ClipboardList,
  FileSearch,
  Gauge,
  House,
  LogOut,
  Menu,
  ScrollText,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Rol } from '../../lib/api/tipos'
import { useCerrarSesion, useUsuario } from '../../features/acceso/sesion'
import { formatoCuentaRegresiva } from '../../lib/formato'
import { Logo } from '../dominio/Marca'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { BarraNavegacion, SaltarAlContenido } from './Comunes'

interface Modulo {
  a: string
  etiqueta: string
  icono: LucideIcon
}

const MODULOS: Record<Exclude<Rol, 'cliente'>, Modulo[]> = {
  analista: [{ a: '/consola/analista', etiqueta: 'Bandeja de estudio', icono: ClipboardList }],
  oficial: [
    { a: '/consola/oficial', etiqueta: 'Bandeja de decisiones', icono: Gauge },
    { a: '/consola/auditoria', etiqueta: 'Mi actividad', icono: ScrollText },
  ],
  administrador: [
    { a: '/consola/admin/usuarios', etiqueta: 'Usuarios y roles', icono: Users },
    { a: '/consola/admin/parametros', etiqueta: 'Parámetros', icono: SlidersHorizontal },
    { a: '/consola/admin/auditoria', etiqueta: 'Auditoría', icono: FileSearch },
  ],
  contabilidad: [
    { a: '/consola/contabilidad', etiqueta: 'Inicio', icono: House },
    { a: '/consola/auditoria', etiqueta: 'Mi actividad', icono: ScrollText },
  ],
  directivo: [
    { a: '/consola/directivo', etiqueta: 'Inicio', icono: House },
    { a: '/consola/auditoria', etiqueta: 'Auditoría', icono: FileSearch },
  ],
}

const NOMBRE_ROL: Record<Rol, string> = {
  cliente: 'Cliente',
  analista: 'Analista de crédito',
  oficial: 'Oficial de crédito',
  contabilidad: 'Auxiliar contable',
  directivo: 'Directivo',
  administrador: 'Administrador',
}

/** RN-16: la consola interna se cierra a los 15 minutos sin actividad, con un minuto de aviso. */
const INACTIVIDAD_MS = 15 * 60_000
const AVISO_MS = 60_000

function useInactividad(onExpirar: () => void) {
  const [restante, setRestante] = useState<number | null>(null)
  const ultimaActividad = useRef(Date.now())
  const expirar = useRef(onExpirar)
  expirar.current = onExpirar

  const registrar = useCallback(() => {
    ultimaActividad.current = Date.now()
    setRestante(null)
  }, [])

  useEffect(() => {
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    const alActuar = () => {
      // Con el aviso abierto solo cuenta el botón "Seguir conectado".
      if (Date.now() - ultimaActividad.current < INACTIVIDAD_MS - AVISO_MS) ultimaActividad.current = Date.now()
    }
    eventos.forEach((e) => window.addEventListener(e, alActuar, { passive: true }))
    const intervalo = window.setInterval(() => {
      const quieto = Date.now() - ultimaActividad.current
      if (quieto >= INACTIVIDAD_MS) {
        window.clearInterval(intervalo)
        expirar.current()
      } else if (quieto >= INACTIVIDAD_MS - AVISO_MS) {
        setRestante(Math.ceil((INACTIVIDAD_MS - quieto) / 1000))
      }
    }, 1000)
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, alActuar))
      window.clearInterval(intervalo)
    }
  }, [])

  return { restante, seguir: registrar }
}

/** Consola interna (RI-03): barra lateral persistente con los módulos del rol. */
export function ConsolaLayout() {
  const usuario = useUsuario()
  const cerrar = useCerrarSesion()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { restante, seguir } = useInactividad(() => cerrar.mutate())
  const modulos = MODULOS[usuario.rol as Exclude<Rol, 'cliente'>] ?? []

  const navegacion = (
    <nav aria-label="Módulos de la consola" className="flex flex-1 flex-col gap-1 px-3">
      {modulos.map(({ a, etiqueta, icono: Icono }) => (
        <NavLink
          key={a}
          to={a}
          onClick={() => setMenuAbierto(false)}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-campo px-3 text-sm font-medium transition-colors ${
              isActive ? 'bg-white/12 text-white' : 'text-primario-100 hover:bg-white/8 hover:text-white'
            }`
          }
        >
          <Icono aria-hidden="true" className="size-4.5" />
          {etiqueta}
        </NavLink>
      ))}
    </nav>
  )

  const pie = (
    <div className="flex flex-col gap-3 border-t border-white/12 px-6 py-4">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">{usuario.nombre_completo}</span>
        <span className="text-xs text-primario-200">{NOMBRE_ROL[usuario.rol]}</span>
      </div>
      <button
        type="button"
        onClick={() => cerrar.mutate()}
        className="inline-flex min-h-11 items-center gap-2 rounded-campo text-sm font-medium text-primario-100 hover:text-white"
      >
        <LogOut aria-hidden="true" className="size-4" />
        Cerrar sesión
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh bg-fondo lg:grid lg:grid-cols-[256px_1fr]">
      <SaltarAlContenido />
      <BarraNavegacion />

      <aside className="hidden flex-col bg-primario-800 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="px-6 py-5">
          <Logo claro />
          <p className="mt-1 text-xs text-primario-200">Consola interna</p>
        </div>
        {navegacion}
        {pie}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-primario-800 px-4 lg:hidden">
        <Logo claro />
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          aria-expanded={menuAbierto}
          aria-controls="menu-consola"
          className="inline-flex size-11 items-center justify-center rounded-campo text-white"
          aria-label="Abrir menú"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
      </header>
      {menuAbierto ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-tinta/50" onClick={() => setMenuAbierto(false)} />
          <div id="menu-consola" className="relative flex h-full w-72 flex-col bg-primario-800 pt-4">
            <div className="flex items-center justify-between px-6 pb-4">
              <Logo claro />
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="inline-flex size-11 items-center justify-center rounded-campo text-white"
                aria-label="Cerrar menú"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            {navegacion}
            {pie}
          </div>
        </div>
      ) : null}

      <main id="contenido" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <Modal
        abierto={restante !== null}
        onCerrar={seguir}
        titulo="Tu sesión está por cerrarse"
        descripcion={
          <>
            Por seguridad cerramos la consola después de 15 minutos sin actividad. Se cerrará en{' '}
            <span className="cifras font-semibold text-tinta">{formatoCuentaRegresiva(restante ?? 0)}</span>.
          </>
        }
        acciones={
          <>
            <Button variante="secundario" onClick={() => cerrar.mutate()}>
              Cerrar sesión
            </Button>
            <Button onClick={seguir}>Seguir conectado</Button>
          </>
        }
      />
    </div>
  )
}
