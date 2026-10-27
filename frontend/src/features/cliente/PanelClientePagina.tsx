import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Calculator, CircleAlert, FilePlus2, FileSignature, ShieldCheck, UserCheck } from 'lucide-react'
import { listarSolicitudes } from '../../lib/api/solicitudes'
import type { AccionPendiente, SolicitudResumen } from '../../lib/api/tipos'
import { estaActiva } from '../../lib/estados'
import { mensajeDe } from '../../lib/errores'
import { formatoFechaCorta } from '../../lib/formato'
import { ButtonLink } from '../../components/ui/Button'
import { Alert, EmptyState, Panel } from '../../components/ui/Feedback'
import { Skeleton } from '../../components/ui/Spinner'
import { Dinero } from '../../components/dominio/Marca'
import { EstadoBadge } from '../../components/dominio/Estado'
import { useUsuario } from '../acceso/sesion'
import { leerSimulacion, rutaSolicitar } from '../simulacion/simulacionGuardada'

export function rutaAccion(solicitud: SolicitudResumen, accion: AccionPendiente): string {
  switch (accion.tipo) {
    case 'oferta':
      return `/portal/ofertas/${accion.oferta_id}`
    case 'decision':
      return `/portal/solicitudes/${solicitud.id}/decision`
    case 'borrador':
      return `/portal/solicitar/${solicitud.id}`
    default:
      return `/portal/solicitudes/${solicitud.id}`
  }
}

const BOTON_ACCION: Record<AccionPendiente['tipo'], string> = {
  oferta: 'Revisar oferta',
  decision: 'Ver explicación',
  borrador: 'Continuar solicitud',
  documentos: 'Cargar documento',
}

export function TarjetaSolicitud({ solicitud }: { solicitud: SolicitudResumen }) {
  return (
    <li className="flex flex-col gap-3 rounded-panel border border-linea bg-superficie p-4">
      {/* Si no cabe al lado del título, el estado baja a su propia línea. */}
      <div className="flex flex-wrap-reverse items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 grow basis-52 flex-col">
          <Link to={`/portal/solicitudes/${solicitud.id}`} className="font-semibold text-tinta hover:text-primario-700 hover:underline">
            {solicitud.producto.nombre}
          </Link>
          <span className="text-sm text-tinta-tenue">
            {solicitud.radicado ? `Radicado ${solicitud.radicado}` : 'Sin radicar'}, actualizada el {formatoFechaCorta(solicitud.actualizada_en)}
          </span>
        </div>
        <EstadoBadge estado={solicitud.estado} />
      </div>
      <p className="text-sm text-tinta-suave">
        <Dinero valor={solicitud.monto} className="font-semibold text-tinta" /> a {solicitud.plazo_meses} meses
      </p>
      {solicitud.accion_pendiente ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-campo bg-advertencia-50 px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-medium text-advertencia-800">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {solicitud.accion_pendiente.texto}
          </p>
          <ButtonLink to={rutaAccion(solicitud, solicitud.accion_pendiente)} tamano="sm" variante="secundario">
            {BOTON_ACCION[solicitud.accion_pendiente.tipo]}
          </ButtonLink>
        </div>
      ) : null}
    </li>
  )
}

/** Panel principal del cliente (8.2.1). */
export default function PanelClientePagina() {
  const usuario = useUsuario()
  const solicitudes = useQuery({ queryKey: ['solicitudes'], queryFn: listarSolicitudes, refetchInterval: 30_000 })
  const verificado = usuario.estado_kyc === 'verificado'
  const simulacion = leerSimulacion()

  const lista = solicitudes.data ?? []
  const enCurso = lista.filter((s) => estaActiva(s.estado))
  const firmados = lista.filter((s) => s.estado === 'FORMALIZADA')
  const pendientes = lista.filter((s) => s.accion_pendiente && s.accion_pendiente.tipo !== 'decision')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {usuario.nombre_corto}</h1>
        <p className="text-tinta-suave">
          {pendientes.length > 0
            ? `Tienes ${pendientes.length === 1 ? 'una acción pendiente' : `${pendientes.length} acciones pendientes`}.`
            : 'Aquí ves tus solicitudes y lo que sigue en cada una.'}
        </p>
      </header>

      {!verificado ? (
        <Alert
          tono={usuario.estado_kyc === 'bloqueado' ? 'error' : 'advertencia'}
          titulo={
            usuario.estado_kyc === 'revision_manual'
              ? 'Estamos revisando tu identidad'
              : usuario.estado_kyc === 'bloqueado'
                ? 'No podemos continuar con tu vinculación'
                : 'Verifica tu identidad para poder solicitar créditos'
          }
          accion={
            usuario.estado_kyc === 'pendiente' ? (
              <ButtonLink to="/portal/identidad" tamano="sm" icono={<UserCheck aria-hidden="true" className="size-4" />}>
                Verificar mi identidad
              </ButtonLink>
            ) : undefined
          }
        >
          {usuario.estado_kyc === 'revision_manual'
            ? 'Una persona de nuestro equipo revisa tus datos. Te avisaremos por correo en máximo un día hábil.'
            : usuario.estado_kyc === 'bloqueado'
              ? 'Si necesitas más información, comunícate con nuestros canales de atención.'
              : 'Solo te toma unos minutos: una foto de tu documento por ambas caras y una de tu rostro.'}
        </Alert>
      ) : null}

      {verificado && simulacion ? (
        <Alert
          tono="info"
          titulo="Tienes una simulación guardada"
          accion={
            <ButtonLink to={rutaSolicitar(simulacion)} tamano="sm">
              Continuar con la solicitud
            </ButtonLink>
          }
        >
          Retoma la solicitud con el monto y el plazo que elegiste.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Panel titulo="Solicitudes en curso" acciones={lista.length > 0 ? <Link to="/portal/solicitudes" className="text-sm font-semibold text-primario-700 hover:underline">Ver todas</Link> : undefined}>
          {solicitudes.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : solicitudes.isError ? (
            <Alert tono="error">{mensajeDe(solicitudes.error)}</Alert>
          ) : enCurso.length === 0 ? (
            <EmptyState
              titulo="No tienes solicitudes en curso"
              accion={<ButtonLink to="/portal/simular">Simular un crédito</ButtonLink>}
            >
              Simula primero para ver la cuota, la tasa y todos los costos antes de solicitar.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {enCurso.map((s) => (
                <TarjetaSolicitud key={s.id} solicitud={s} />
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel titulo="Accesos directos">
            <ul className="flex flex-col gap-1">
              <li>
                <Link to="/portal/simular" className="flex min-h-11 items-center gap-3 rounded-campo px-2 hover:bg-fondo">
                  <Calculator aria-hidden="true" className="size-5 text-primario-600" />
                  <span className="font-medium">Simular un crédito</span>
                </Link>
              </li>
              <li>
                {verificado ? (
                  <Link to="/portal/solicitar" className="flex min-h-11 items-center gap-3 rounded-campo px-2 hover:bg-fondo">
                    <FilePlus2 aria-hidden="true" className="size-5 text-primario-600" />
                    <span className="font-medium">Solicitar crédito</span>
                  </Link>
                ) : (
                  // RN-07: sin identidad verificada no se puede solicitar.
                  <span className="flex min-h-11 items-center gap-3 px-2 text-tinta-tenue" aria-disabled="true">
                    <FilePlus2 aria-hidden="true" className="size-5" />
                    <span className="flex flex-col">
                      <span className="font-medium">Solicitar crédito</span>
                      <span className="text-xs">Disponible cuando verifiques tu identidad</span>
                    </span>
                  </span>
                )}
              </li>
              <li>
                <Link to="/portal/privacidad" className="flex min-h-11 items-center gap-3 rounded-campo px-2 hover:bg-fondo">
                  <ShieldCheck aria-hidden="true" className="size-5 text-primario-600" />
                  <span className="font-medium">Mis datos y privacidad</span>
                </Link>
              </li>
            </ul>
          </Panel>

          {firmados.length > 0 ? (
            <Panel titulo="Créditos con pagaré firmado">
              <ul className="flex flex-col gap-3">
                {firmados.map((s) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <FileSignature aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-secundario-700" />
                    <div className="flex flex-col text-sm">
                      <Link to={`/portal/solicitudes/${s.id}`} className="font-semibold hover:underline">
                        {s.producto.nombre}
                      </Link>
                      <span className="text-tinta-suave">
                        <Dinero valor={s.monto} />. El desembolso llega en la segunda entrega del sistema.
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}
