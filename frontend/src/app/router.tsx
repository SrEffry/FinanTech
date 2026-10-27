import { createBrowserRouter, type RouteObject } from 'react-router'
import { CargaPagina } from '../components/ui/Spinner'
import { RutaProtegida } from '../components/layouts/Comunes'
import { ConsolaLayout } from '../components/layouts/ConsolaLayout'
import { PortalLayout } from '../components/layouts/PortalLayout'
import { PublicoLayout } from '../components/layouts/PublicoLayout'
import { ErrorPagina, InicioRedireccion, NoEncontradaPagina, Raiz } from './Paginas'

/** Cada pantalla se carga aparte (división por rutas, RNF-01). */
function pagina(cargar: () => Promise<{ default: React.ComponentType }>): Pick<RouteObject, 'lazy'> {
  return { lazy: async () => ({ Component: (await cargar()).default }) }
}

const INTERNOS = ['analista', 'oficial', 'administrador', 'contabilidad', 'directivo'] as const

export const router = createBrowserRouter([
  {
    element: <Raiz />,
    errorElement: <ErrorPagina />,
    hydrateFallbackElement: <CargaPagina />,
    children: [
      { path: '/', element: <InicioRedireccion /> },

      // Acceso (8.1)
      { path: '/ingresar', ...pagina(() => import('../features/acceso/IngresarPagina')) },
      { path: '/ingresar/verificacion', ...pagina(() => import('../features/acceso/SegundoFactorPagina')) },
      { path: '/recuperar', ...pagina(() => import('../features/acceso/RecuperarPagina')) },
      { path: '/registro', ...pagina(() => import('../features/registro/RegistroPagina')) },

      // Simulador para visitantes (RF-05 FA-02)
      {
        element: <PublicoLayout />,
        children: [{ path: '/simular', ...pagina(() => import('../features/simulacion/SimuladorPagina')) }],
      },

      // Portal del cliente (8.2)
      {
        element: <RutaProtegida roles={['cliente']} />,
        children: [
          {
            path: '/portal',
            element: <PortalLayout />,
            children: [
              { index: true, ...pagina(() => import('../features/cliente/PanelClientePagina')) },
              { path: 'simular', ...pagina(() => import('../features/simulacion/SimuladorPagina')) },
              { path: 'identidad', ...pagina(() => import('../features/identidad/VerificarIdentidadPagina')) },
              { path: 'solicitar', ...pagina(() => import('../features/cliente/RadicacionPagina')) },
              { path: 'solicitar/:id', ...pagina(() => import('../features/cliente/RadicacionPagina')) },
              { path: 'solicitudes', ...pagina(() => import('../features/cliente/MisSolicitudesPagina')) },
              { path: 'solicitudes/:id', ...pagina(() => import('../features/cliente/SeguimientoPagina')) },
              { path: 'solicitudes/:id/decision', ...pagina(() => import('../features/cliente/ExplicacionPagina')) },
              { path: 'ofertas/:id', ...pagina(() => import('../features/cliente/OfertaPagina')) },
              { path: 'privacidad', ...pagina(() => import('../features/cliente/PrivacidadPagina')) },
            ],
          },
        ],
      },

      // Consola interna (8.3 y 8.6)
      {
        element: <RutaProtegida roles={[...INTERNOS]} />,
        children: [
          {
            path: '/consola',
            element: <ConsolaLayout />,
            children: [
              {
                element: <RutaProtegida roles={['analista']} />,
                children: [{ path: 'analista', ...pagina(() => import('../features/consola/BandejaPagina')) }],
              },
              {
                element: <RutaProtegida roles={['oficial']} />,
                children: [
                  { path: 'oficial', ...pagina(() => import('../features/consola/BandejaPagina')) },
                  { path: 'decisiones/:id', ...pagina(() => import('../features/consola/DecisionPagina')) },
                ],
              },
              {
                element: <RutaProtegida roles={['analista', 'oficial']} />,
                children: [{ path: 'expedientes/:id', ...pagina(() => import('../features/consola/ExpedientePagina')) }],
              },
              {
                element: <RutaProtegida roles={['administrador']} />,
                children: [
                  { path: 'admin/usuarios', ...pagina(() => import('../features/administracion/UsuariosPagina')) },
                  { path: 'admin/parametros', ...pagina(() => import('../features/administracion/ParametrosPagina')) },
                  { path: 'admin/auditoria', ...pagina(() => import('../features/administracion/AuditoriaPagina')) },
                ],
              },
              {
                element: <RutaProtegida roles={['oficial', 'contabilidad', 'directivo']} />,
                children: [{ path: 'auditoria', ...pagina(() => import('../features/administracion/AuditoriaPagina')) }],
              },
              {
                element: <RutaProtegida roles={['contabilidad', 'directivo']} />,
                children: [
                  { path: 'contabilidad', ...pagina(() => import('../features/consola/PanelPendientePagina')) },
                  { path: 'directivo', ...pagina(() => import('../features/consola/PanelPendientePagina')) },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NoEncontradaPagina /> },
    ],
  },
])
