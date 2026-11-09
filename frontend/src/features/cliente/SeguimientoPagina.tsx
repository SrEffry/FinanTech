import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { enviarDocumentos, obtenerSolicitud } from '../../lib/api/solicitudes'
import { ETIQUETA_CLIENTE } from '../../lib/estados'
import { mensajeDe } from '../../lib/errores'
import { formatoFechaHora } from '../../lib/formato'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Alert, Panel } from '../../components/ui/Feedback'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toastContexto'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { EstadoBadge, LineaEtapas } from '../../components/dominio/Estado'
import { Dinero } from '../../components/dominio/Marca'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { DocumentosSolicitud } from './DocumentosSolicitud'
import { rutaAccion } from './rutaAccion'

/**
 * Seguimiento de la solicitud (8.2.4, RF-07). Mientras el motor evalúa se consulta cada
 * pocos segundos; después, cada 30 s, para reflejar los cambios a tiempo (RN-34).
 */
export default function SeguimientoPagina() {
  const { id = '' } = useParams()
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const solicitud = useQuery({
    queryKey: ['solicitud', id],
    queryFn: () => obtenerSolicitud(id),
    refetchInterval: (consulta) =>
      consulta.state.data && ['RADICADA', 'EN_EVALUACION'].includes(consulta.state.data.estado) ? 3000 : 30_000,
  })

  const envio = useMutation({
    mutationFn: () => enviarDocumentos(id),
    onSuccess: (actualizada) => {
      cliente.setQueryData(['solicitud', id], actualizada)
      cliente.invalidateQueries({ queryKey: ['solicitudes'] })
      avisar('Recibimos tus documentos. Seguimos con el estudio.')
    },
  })

  if (solicitud.isPending) return <CargaPagina />
  if (solicitud.isError) return <Alert tono="error">{mensajeDe(solicitud.error)}</Alert>

  const s = solicitud.data
  if (s.estado === 'BORRADOR') return <Navigate to={`/portal/solicitar/${s.id}`} replace />
  const accion = s.accion_pendiente
  const evaluando = s.estado === 'RADICADA' || s.estado === 'EN_EVALUACION'

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={s.producto.nombre}
        descripcion={s.radicado ? `Radicado ${s.radicado}` : undefined}
        migas={[{ etiqueta: 'Solicitudes', a: '/portal/solicitudes' }, { etiqueta: s.radicado ?? s.producto.nombre }]}
        acciones={<EstadoBadge estado={s.estado} />}
      />

      {/* El estado en grande, con lo que sigue (RN-36: etiqueta para el cliente). */}
      <section
        aria-label="Estado de tu solicitud"
        className="sobre-oscuro trama-trenza -mx-4 flex flex-col gap-5 bg-noche px-5 py-6 text-white sm:mx-0 sm:rounded-lienzo sm:px-8 sm:py-7 sm:shadow-elevada lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <p className="text-sm text-niebla">Estado de tu solicitud</p>
          <p className="titular text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold">{ETIQUETA_CLIENTE[s.estado]}</p>
          {evaluando ? (
            <p className="flex items-center gap-2 text-niebla">
              <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              Estamos evaluando tu solicitud. Suele tardar unos minutos y esta página se actualiza sola.
            </p>
          ) : accion && accion.tipo !== 'documentos' ? (
            <p className="text-niebla">{accion.texto}</p>
          ) : null}
        </div>
        {accion && accion.tipo !== 'documentos' ? (
          <ButtonLink to={rutaAccion(s, accion)} variante="acento" tamano="lg" className="self-start lg:self-auto">
            {accion.tipo === 'oferta' ? 'Revisar oferta' : 'Ver explicación'}
          </ButtonLink>
        ) : null}
      </section>

      {s.estado === 'PENDIENTE_CLIENTE' ? (
        <Panel variante="destacado" titulo="Necesitamos que vuelvas a cargar un documento" descripcion="Cuando lo cargues, envíalo para que sigamos con el estudio.">
          <div className="flex flex-col gap-5">
            <DocumentosSolicitud solicitudId={s.id} documentos={s.documentos} editable />
            {envio.isError ? <Alert tono="error">{mensajeDe(envio.error)}</Alert> : null}
            <Button
              onClick={() => envio.mutate()}
              cargando={envio.isPending}
              disabled={s.documentos.some((d) => d.requerido && (d.estado === 'pendiente' || d.estado === 'rechazado'))}
              className="self-start"
            >
              Enviar documentos
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel titulo="Etapas">
        <LineaEtapas historial={s.historial} estado={s.estado} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel titulo="Lo que pediste">
          <div className="flex flex-col gap-5">
            <p className="flex items-baseline gap-2 text-tinta-suave">
              <Dinero valor={s.monto} className="cifras text-xl font-semibold tracking-tight text-noche" /> a {s.plazo_meses} meses
            </p>
            <CuotaConTea cuota={s.cuota_estimada} tea={s.tasa_ea} tamano="mediano" etiquetaCuota="Cuota estimada" />
            <p className="text-sm text-tinta-tenue">
              Las condiciones definitivas te las mostramos en la oferta, si la solicitud es aprobada.
            </p>
          </div>
        </Panel>
        <Panel titulo="Historial">
          <ol className="flex flex-col gap-3">
            {[...s.historial].reverse().map((h, i) => (
              <li key={`${h.estado}-${h.fecha}-${i}`} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium">{ETIQUETA_CLIENTE[h.estado]}</span>
                <span className="text-tinta-tenue">{formatoFechaHora(h.fecha)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {s.estado !== 'PENDIENTE_CLIENTE' ? (
        <Panel titulo="Documentos">
          <DocumentosSolicitud solicitudId={s.id} documentos={s.documentos} editable={false} />
        </Panel>
      ) : null}
    </div>
  )
}
