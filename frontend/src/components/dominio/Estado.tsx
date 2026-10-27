import { Check, CircleAlert, CircleX } from 'lucide-react'
import type { EstadoSolicitud, HitoEstado } from '../../lib/api/tipos'
import { construirEtapas, ETIQUETA_CLIENTE, ETIQUETA_INTERNA, tonoEstado, type Tono } from '../../lib/estados'
import { formatoFechaCorta } from '../../lib/formato'
import { Badge, type TonoInsignia } from '../ui/Feedback'

const TONO_INSIGNIA: Record<Tono, TonoInsignia> = {
  neutro: 'neutro',
  progreso: 'progreso',
  accion: 'accion',
  exito: 'exito',
  negado: 'negado',
}

/** Estado con etiqueta para el cliente (RN-36) o para la consola interna. */
export function EstadoBadge({ estado, interno = false }: { estado: EstadoSolicitud; interno?: boolean }) {
  const etiqueta = interno ? ETIQUETA_INTERNA[estado] : ETIQUETA_CLIENTE[estado]
  return <Badge tono={TONO_INSIGNIA[tonoEstado(estado)]}>{etiqueta}</Badge>
}

/**
 * Línea de etapas del seguimiento (8.2.4): completadas marcadas, la actual destacada,
 * las pendientes atenuadas, con la fecha de cada una.
 */
export function LineaEtapas({ historial, estado }: { historial: HitoEstado[]; estado: EstadoSolicitud }) {
  const etapas = construirEtapas(historial, estado)
  return (
    <ol className="flex flex-col gap-0 md:flex-row md:gap-2">
      {etapas.map((etapa, i) => {
        const ultima = i === etapas.length - 1
        const negada = etapa.tono === 'negado'
        const accion = etapa.tono === 'accion'
        const circulo =
          etapa.estado === 'completada'
            ? 'bg-primario-600 text-white'
            : etapa.estado === 'actual'
              ? negada
                ? 'bg-alerta-600 text-white'
                : accion
                  ? 'bg-advertencia-500 text-tinta'
                  : etapa.tono === 'exito'
                    ? 'bg-secundario-700 text-white'
                    : 'border-2 border-primario-600 bg-superficie text-primario-700'
              : 'border border-linea bg-superficie text-tinta-tenue'
        return (
          <li
            key={etapa.clave}
            aria-current={etapa.estado === 'actual' ? 'step' : undefined}
            className="relative flex gap-3 pb-6 last:pb-0 md:flex-1 md:flex-col md:gap-2 md:pb-0"
          >
            {!ultima ? (
              <span
                aria-hidden="true"
                className={`absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 md:top-[15px] md:left-10 md:h-0.5 md:w-[calc(100%-2.5rem)] ${
                  etapa.estado === 'completada' ? 'bg-primario-600' : 'bg-linea'
                }`}
              />
            ) : null}
            <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${circulo}`}>
              {etapa.estado === 'completada' ? (
                <Check aria-hidden="true" className="size-4" />
              ) : negada ? (
                <CircleX aria-hidden="true" className="size-4" />
              ) : accion ? (
                <CircleAlert aria-hidden="true" className="size-4" />
              ) : (
                <span aria-hidden="true">{i + 1}</span>
              )}
            </span>
            <span className="flex flex-col pt-1 md:pt-0">
              <span
                className={`text-sm ${
                  etapa.estado === 'pendiente' ? 'text-tinta-tenue' : etapa.estado === 'actual' ? 'font-semibold text-tinta' : 'text-tinta'
                }`}
              >
                {etapa.etiqueta}
                <span className="sr-only">
                  {etapa.estado === 'completada' ? ', completada' : etapa.estado === 'actual' ? ', etapa actual' : ', pendiente'}
                </span>
              </span>
              {etapa.fecha ? <span className="text-xs text-tinta-tenue">{formatoFechaCorta(etapa.fecha)}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
