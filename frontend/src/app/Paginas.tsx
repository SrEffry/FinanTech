import { Navigate, Outlet, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router'
import { ButtonLink } from '../components/ui/Button'
import { CargaPagina } from '../components/ui/Spinner'
import { DistintivoDemo } from '../components/dominio/Distintivos'
import { Logo } from '../components/dominio/Marca'
import { inicioDeRol, useSesion } from '../features/acceso/sesion'

/** Raíz: restauración del scroll y la marca de demostración, en todas las páginas. */
export function Raiz() {
  return (
    <>
      <DistintivoDemo />
      <Outlet />
      <ScrollRestoration />
    </>
  )
}

/** "/" lleva al inicio del rol, o al inicio de sesión (punto de entrada único, 8.1.1). */
export function InicioRedireccion() {
  const { data: usuario, isPending } = useSesion()
  if (isPending) return <CargaPagina />
  return <Navigate to={usuario ? inicioDeRol(usuario.rol) : '/ingresar'} replace />
}

function PantallaMensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 px-6 py-12 sm:items-center sm:text-center">
      <Logo />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-tinta-suave">{texto}</p>
      </div>
      <ButtonLink to="/">Ir al inicio</ButtonLink>
    </main>
  )
}

export function NoEncontradaPagina() {
  return <PantallaMensaje titulo="No encontramos esta página" texto="Puede que el enlace esté mal escrito o que la página ya no exista." />
}

/** Error inesperado al cargar una ruta: mensaje claro, sin detalles técnicos (RNF-09). */
export function ErrorPagina() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NoEncontradaPagina />
  return (
    <PantallaMensaje
      titulo="Algo falló al abrir esta página"
      texto="Vuelve a intentarlo en unos minutos. Si el problema sigue, cuéntanos por nuestros canales de atención."
    />
  )
}
