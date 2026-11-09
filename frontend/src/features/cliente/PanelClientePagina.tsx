import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowRight, Calculator, CircleAlert, FilePlus2, FileSignature, ShieldCheck, UserCheck } from 'lucide-react'
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
import { rutaAccion } from './rutaAccion'

const BOTON_ACCION: Record<AccionPendiente['tipo'], string> = {
  oferta: 'Revisar oferta',
  decision: 'Ver explicación',
  borrador: 'Continuar solicitud',
  documentos: 'Cargar documento',
}

export function TarjetaSolicitud({ solicitud }: { solicitud: SolicitudResumen }) {
  return (
    <li className="flex flex-col gap-3 rounded-panel border border-linea bg-superficie p-4 shadow-reposo transition-shadow duration-150 hover:shadow-elevada sm:p-5">
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
      <p className="flex items-baseline gap-2 text-sm text-tinta-suave">
        <Dinero valor={solicitud.monto} className="cifras text-xl font-semibold tracking-tight text-noche" /> a {solicitud.plazo_meses} meses
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

interface Siguiente {
  titulo: string
  texto: string
  accion?: { a: string; etiqueta: string; icono?: ReactNode }
}

/** Lo más importante que la persona puede hacer ahora, en un solo lugar (8.2.1). */
function siguientePaso(
  estadoKyc: string | undefined,
  pendiente: SolicitudResumen | undefined,
  simulacion: ReturnType<typeof leerSimulacion>,
): Siguiente {
  if (estadoKyc === 'revision_manual') {
    return { titulo: 'Estamos revisando tu identidad', texto: 'Una persona de nuestro equipo revisa tus datos. Te avisaremos por correo en máximo un día hábil.' }
  }
  if (estadoKyc === 'bloqueado') {
    return { titulo: 'No podemos continuar con tu vinculación', texto: 'Si necesitas más información, comunícate con nuestros canales de atención.' }
  }
  if (estadoKyc !== 'verificado') {
    return {
      titulo: 'Verifica tu identidad para poder solicitar créditos',
      texto: 'Solo te toma unos minutos: una foto de tu documento por ambas caras y una de tu rostro.',
      accion: { a: '/portal/identidad', etiqueta: 'Verificar mi identidad', icono: <UserCheck aria-hidden="true" className="size-5" /> },
    }
  }
  if (pendiente?.accion_pendiente) {
    return {
      titulo: pendiente.accion_pendiente.texto,
      texto: pendiente.radicado ? `${pendiente.producto.nombre}, radicado ${pendiente.radicado}.` : `${pendiente.producto.nombre}.`,
      accion: { a: rutaAccion(pendiente, pendiente.accion_pendiente), etiqueta: BOTON_ACCION[pendiente.accion_pendiente.tipo] },
    }
  }
  if (simulacion) {
    return {
      titulo: 'Tienes una simulación guardada',
      texto: 'Retoma la solicitud con el monto y el plazo que elegiste.',
      accion: { a: rutaSolicitar(simulacion), etiqueta: 'Continuar con la solicitud' },
    }
  }
  return {
    titulo: '¿Cuánto pagarías por tu próximo crédito?',
    texto: 'Mueve el monto y el plazo y ve la cuota, la tasa y cada costo antes de solicitar.',
    accion: { a: '/portal/simular', etiqueta: 'Simular un crédito', icono: <Calculator aria-hidden="true" className="size-5" /> },
  }
}

const ACCESOS = [
  { a: '/portal/simular', etiqueta: 'Simular un crédito', texto: 'Cuota, tasa y costos al instante', icono: Calculator, requiereIdentidad: false },
  { a: '/portal/solicitar', etiqueta: 'Solicitar crédito', texto: 'Menos de 8 minutos', icono: FilePlus2, requiereIdentidad: true },
  { a: '/portal/privacidad', etiqueta: 'Mis datos y privacidad', texto: 'Lo que autorizas, a tu manera', icono: ShieldCheck, requiereIdentidad: false },
]

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
  const siguiente = siguientePaso(usuario.estado_kyc, pendientes[0], verificado ? simulacion : null)
  const alerta = usuario.estado_kyc === 'bloqueado' || (verificado && pendientes.length > 0)

  return (
    <div className="flex flex-col gap-8">
      {/* Bienvenida con el siguiente paso, sobre el lienzo de la marca. */}
      <section
        aria-labelledby="saludo"
        className="sobre-oscuro trama-trenza relative -mx-4 overflow-hidden bg-noche px-5 py-7 text-white sm:mx-0 sm:rounded-lienzo sm:px-8 sm:py-9 sm:shadow-elevada"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-primario-600/40 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <title>Inicio · FinanTech</title>
            <h1 id="saludo" tabIndex={-1} className="titular text-[length:clamp(1.75rem,6vw,2.5rem)] leading-tight font-semibold outline-none">
              Hola, {usuario.nombre_corto}
            </h1>
            <div role={alerta ? 'status' : undefined} className="flex flex-col gap-1">
              <p className="flex items-start gap-2 text-lg font-semibold text-white">
                {alerta ? <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0 text-menta-300" /> : null}
                {siguiente.titulo}
              </p>
              <p className="text-niebla">{siguiente.texto}</p>
            </div>
          </div>
          {siguiente.accion ? (
            <ButtonLink
              to={siguiente.accion.a}
              variante="acento"
              tamano="lg"
              icono={siguiente.accion.icono ?? <ArrowRight aria-hidden="true" className="size-5" />}
              className="self-start lg:self-auto"
            >
              {siguiente.accion.etiqueta}
            </ButtonLink>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Panel
          titulo="Solicitudes en curso"
          acciones={
            lista.length > 0 ? (
              <Link to="/portal/solicitudes" className="inline-flex min-h-11 items-center text-sm font-semibold text-primario-700 hover:underline">
                Ver todas
              </Link>
            ) : undefined
          }
        >
          {solicitudes.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : solicitudes.isError ? (
            <Alert tono="error">{mensajeDe(solicitudes.error)}</Alert>
          ) : enCurso.length === 0 ? (
            <EmptyState
              icono={<FilePlus2 aria-hidden="true" className="size-6" />}
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
          <nav aria-label="Accesos directos">
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {ACCESOS.map(({ a, etiqueta, texto, icono: Icono, requiereIdentidad }) => {
                const bloqueado = requiereIdentidad && !verificado
                const contenido = (
                  <>
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${bloqueado ? 'bg-fondo text-tinta-suave' : 'bg-cielo text-primario-600'}`}>
                      <Icono aria-hidden="true" className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{etiqueta}</span>
                      <span className="text-sm text-tinta-suave">{bloqueado ? 'Disponible cuando verifiques tu identidad' : texto}</span>
                    </span>
                  </>
                )
                return (
                  <li key={a}>
                    {bloqueado ? (
                      // RN-07: sin identidad verificada no se puede solicitar.
                      <span aria-disabled="true" className="flex items-center gap-3 rounded-panel border border-dashed border-linea p-3 text-tinta-suave">
                        {contenido}
                      </span>
                    ) : (
                      <Link
                        to={a}
                        className="flex items-center gap-3 rounded-panel border border-linea bg-superficie p-3 text-tinta shadow-reposo transition-[box-shadow,border-color] duration-150 hover:border-primario-200 hover:shadow-elevada"
                      >
                        {contenido}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

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
