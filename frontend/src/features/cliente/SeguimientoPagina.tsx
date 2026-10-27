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
import { useToast } from '../../components/ui/Toast'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { EstadoBadge, LineaEtapas } from '../../components/dominio/Estado'
import { Dinero } from '../../components/dominio/Marca'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { DocumentosSolicitud } from './DocumentosSolicitud'
import { rutaAccion } from './PanelClientePagina'

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

      {accion && accion.tipo !== 'documentos' ? (
        <Alert
          tono={accion.tipo === 'decision' ? 'info' : 'exito'}
          titulo={accion.texto}
          accion={<ButtonLink to={rutaAccion(s, accion)} tamano="sm">{accion.tipo === 'oferta' ? 'Revisar oferta' : 'Ver explicación'}</ButtonLink>}
        />
      ) : null}

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

      {evaluando ? (
        <Alert tono="info" titulo="Estamos evaluando tu solicitud">
          <span className="flex items-center gap-2">
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
            Suele tardar unos minutos. Esta página se actualiza sola.
          </span>
        </Alert>
      ) : null}

      <Panel titulo="Etapas">
        <LineaEtapas historial={s.historial} estado={s.estado} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel titulo="Lo que pediste">
          <div className="flex flex-col gap-5">
            <p className="text-tinta-suave">
              <Dinero valor={s.monto} className="font-semibold text-tinta" /> a {s.plazo_meses} meses
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
