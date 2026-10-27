import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

export type TonoAviso = 'info' | 'exito' | 'advertencia' | 'error'

const ESTILOS: Record<TonoAviso, { caja: string; icono: ReactNode }> = {
  info: {
    caja: 'border-primario-200 bg-primario-50 text-primario-800',
    icono: <Info aria-hidden="true" className="size-5 shrink-0 text-primario-600" />,
  },
  exito: {
    caja: 'border-secundario-100 bg-secundario-50 text-secundario-800',
    icono: <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-secundario-700" />,
  },
  advertencia: {
    caja: 'border-advertencia-100 bg-advertencia-50 text-advertencia-800',
    icono: <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-advertencia-700" />,
  },
  error: {
    caja: 'border-alerta-100 bg-alerta-50 text-alerta-700',
    icono: <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-alerta-600" />,
  },
}

interface PropsAviso {
  tono?: TonoAviso
  titulo?: ReactNode
  children?: ReactNode
  accion?: ReactNode
  className?: string
}

/** Aviso en línea. Los errores se anuncian de inmediato (role="alert"); el resto, con cortesía. */
export function Alert({ tono = 'info', titulo, children, accion, className = '' }: PropsAviso) {
  const estilo = ESTILOS[tono]
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-campo border px-4 py-3 ${estilo.caja} ${className}`}
    >
      {estilo.icono}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children ? <div className="text-sm leading-relaxed">{children}</div> : null}
        {accion ? <div className="mt-1">{accion}</div> : null}
      </div>
    </div>
  )
}

export type TonoInsignia = 'neutro' | 'progreso' | 'accion' | 'exito' | 'negado' | 'info'

const INSIGNIAS: Record<TonoInsignia, string> = {
  neutro: 'bg-linea-suave text-tinta-suave',
  progreso: 'bg-primario-50 text-primario-700',
  info: 'bg-primario-50 text-primario-700',
  accion: 'bg-advertencia-100 text-advertencia-800',
  exito: 'bg-secundario-50 text-secundario-800',
  negado: 'bg-alerta-50 text-alerta-700',
}

export function Badge({ tono = 'neutro', children, icono }: { tono?: TonoInsignia; children: ReactNode; icono?: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${INSIGNIAS[tono]}`}>
      {icono}
      {children}
    </span>
  )
}

interface PropsPanel {
  children: ReactNode
  className?: string
  /** "plano" para bloques secundarios dentro de otro panel. */
  variante?: 'normal' | 'plano' | 'destacado'
  as?: 'section' | 'div' | 'article' | 'aside'
  titulo?: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  id?: string
}

const PANELES = {
  normal: 'rounded-panel border border-linea bg-superficie',
  plano: 'rounded-campo bg-fondo',
  destacado: 'rounded-panel border-2 border-primario-600 bg-superficie',
}

export function Panel({ children, className = '', variante = 'normal', as: Etiqueta = 'section', titulo, descripcion, acciones, id }: PropsPanel) {
  const tituloId = id ? `${id}-titulo` : undefined
  return (
    <Etiqueta id={id} aria-labelledby={titulo && tituloId ? tituloId : undefined} className={`${PANELES[variante]} p-4 sm:p-6 ${className}`}>
      {titulo || acciones ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {titulo ? (
              <h2 id={tituloId} className="text-lg font-semibold text-tinta">
                {titulo}
              </h2>
            ) : null}
            {descripcion ? <p className="text-sm text-tinta-suave">{descripcion}</p> : null}
          </div>
          {acciones}
        </header>
      ) : null}
      {children}
    </Etiqueta>
  )
}

/** Pantalla o lista vacía: siempre con la acción que sigue. */
export function EmptyState({ titulo, children, accion, icono }: { titulo: string; children?: ReactNode; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-linea bg-superficie px-5 py-8 sm:items-center sm:text-center">
      {icono ? <span className="text-primario-400">{icono}</span> : null}
      <p className="text-base font-semibold text-tinta">{titulo}</p>
      {children ? <div className="max-w-prose text-sm text-tinta-suave">{children}</div> : null}
      {accion}
    </div>
  )
}
