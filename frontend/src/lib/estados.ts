import type { EstadoSolicitud, HitoEstado } from './api/tipos'

/**
 * Máquina de estados de la solicitud (correcciones ERS v1.1, C:182-200).
 * El cliente nunca ve el nombre técnico del estado (RN-36): solo estas etiquetas.
 */
export const ETIQUETA_CLIENTE: Record<EstadoSolicitud, string> = {
  BORRADOR: 'Borrador',
  RADICADA: 'Radicada',
  PENDIENTE_CLIENTE: 'Necesitamos un documento',
  EN_EVALUACION: 'En evaluación',
  EN_ESTUDIO: 'En estudio',
  EN_DECISION: 'En decisión',
  EN_COMITE: 'En decisión',
  APROBADA: 'Aprobada',
  APROBADA_CONDICIONADA: 'Aprobada',
  NEGADA: 'No aprobada',
  OFERTA_ACEPTADA: 'Aprobada',
  FORMALIZADA: 'Pagaré firmado',
  DESEMBOLSADA: 'Desembolsada',
  DESISTIDA: 'Cerrada',
  OFERTA_RECHAZADA: 'Cerrada',
  OFERTA_VENCIDA: 'Cerrada',
}

/** Etiquetas para la consola interna, donde sí se distinguen todos los estados. */
export const ETIQUETA_INTERNA: Record<EstadoSolicitud, string> = {
  BORRADOR: 'Borrador',
  RADICADA: 'Radicada',
  PENDIENTE_CLIENTE: 'Pendiente del cliente',
  EN_EVALUACION: 'En evaluación',
  EN_ESTUDIO: 'En estudio',
  EN_DECISION: 'En decisión',
  EN_COMITE: 'En comité',
  APROBADA: 'Aprobada',
  APROBADA_CONDICIONADA: 'Aprobada con condiciones',
  NEGADA: 'Negada',
  OFERTA_ACEPTADA: 'Oferta aceptada',
  FORMALIZADA: 'Formalizada',
  DESEMBOLSADA: 'Desembolsada',
  DESISTIDA: 'Desistida',
  OFERTA_RECHAZADA: 'Oferta rechazada',
  OFERTA_VENCIDA: 'Oferta vencida',
}

export type Tono = 'neutro' | 'progreso' | 'accion' | 'exito' | 'negado'

export function tonoEstado(estado: EstadoSolicitud): Tono {
  switch (estado) {
    case 'PENDIENTE_CLIENTE':
      return 'accion'
    case 'APROBADA':
    case 'APROBADA_CONDICIONADA':
    case 'OFERTA_ACEPTADA':
    case 'FORMALIZADA':
    case 'DESEMBOLSADA':
      return 'exito'
    case 'NEGADA':
      return 'negado'
    case 'BORRADOR':
    case 'DESISTIDA':
    case 'OFERTA_RECHAZADA':
    case 'OFERTA_VENCIDA':
      return 'neutro'
    default:
      return 'progreso'
  }
}

/** Estados en los que la solicitud sigue viva (RN-28: una sola activa por producto). */
export const ESTADOS_ACTIVOS: readonly EstadoSolicitud[] = [
  'BORRADOR',
  'RADICADA',
  'PENDIENTE_CLIENTE',
  'EN_EVALUACION',
  'EN_ESTUDIO',
  'EN_DECISION',
  'EN_COMITE',
  'APROBADA',
  'APROBADA_CONDICIONADA',
  'OFERTA_ACEPTADA',
]

export function estaActiva(estado: EstadoSolicitud): boolean {
  return ESTADOS_ACTIVOS.includes(estado)
}

type ClaveEtapa = 'radicada' | 'evaluacion' | 'estudio' | 'decision' | 'aprobada' | 'formalizada'

const ETAPAS: { clave: ClaveEtapa; etiqueta: string }[] = [
  { clave: 'radicada', etiqueta: 'Radicada' },
  { clave: 'evaluacion', etiqueta: 'En evaluación' },
  { clave: 'estudio', etiqueta: 'En estudio' },
  { clave: 'decision', etiqueta: 'En decisión' },
  { clave: 'aprobada', etiqueta: 'Aprobada' },
  { clave: 'formalizada', etiqueta: 'Pagaré firmado' },
]

const ETAPA_DE_ESTADO: Partial<Record<EstadoSolicitud, ClaveEtapa>> = {
  RADICADA: 'radicada',
  EN_EVALUACION: 'evaluacion',
  EN_ESTUDIO: 'estudio',
  EN_DECISION: 'decision',
  EN_COMITE: 'decision',
  APROBADA: 'aprobada',
  APROBADA_CONDICIONADA: 'aprobada',
  OFERTA_ACEPTADA: 'aprobada',
  FORMALIZADA: 'formalizada',
  DESEMBOLSADA: 'formalizada',
}

export type EstadoEtapa = 'completada' | 'actual' | 'pendiente'

export interface Etapa {
  clave: string
  etiqueta: string
  estado: EstadoEtapa
  fecha?: string
  tono?: Tono
}

/**
 * Arma la línea de etapas del seguimiento (8.2.4) a partir del historial.
 * Las etapas por las que la solicitud no pasó (por ejemplo, estudio cuando la evaluación
 * aprobó directamente) no se muestran. Un cierre (negada, desistida, oferta vencida o
 * rechazada) reemplaza las etapas que faltaban.
 */
export function construirEtapas(historial: HitoEstado[], estadoActual: EstadoSolicitud): Etapa[] {
  const fechas = new Map<ClaveEtapa, string>()
  for (const hito of historial) {
    const clave = ETAPA_DE_ESTADO[hito.estado]
    if (clave && !fechas.has(clave)) fechas.set(clave, hito.fecha)
  }

  const cierre = !estaActiva(estadoActual) && !ETAPA_DE_ESTADO[estadoActual]
  // PENDIENTE_CLIENTE no es una etapa: la solicitud sigue en la última que alcanzó.
  const ultimaAlcanzada = ETAPAS.reduce(
    (indice, etapa, i) => (fechas.has(etapa.clave) ? i : indice),
    -1,
  )
  const claveActual = ETAPA_DE_ESTADO[estadoActual]
  const indiceActual = claveActual ? ETAPAS.findIndex((e) => e.clave === claveActual) : ultimaAlcanzada

  const etapas: Etapa[] = []
  ETAPAS.forEach((etapa, i) => {
    const fecha = fechas.get(etapa.clave)
    if (i < indiceActual) {
      if (fecha) etapas.push({ ...etapa, estado: 'completada', fecha })
      return
    }
    if (i === indiceActual && !cierre) {
      etapas.push({ ...etapa, estado: 'actual', fecha, tono: tonoEstado(estadoActual) })
      return
    }
    if (i === indiceActual && cierre && fecha) {
      etapas.push({ ...etapa, estado: 'completada', fecha })
      return
    }
    if (cierre) return
    // Las etapas opcionales futuras (estudio y decisión) solo aparecen si la solicitud
    // ya está en ellas; mientras tanto se muestra el camino corto.
    if (etapa.clave === 'estudio' || etapa.clave === 'decision') {
      if (indiceActual < 2) return
    }
    etapas.push({ ...etapa, estado: 'pendiente' })
  })

  if (cierre) {
    const ultimo = historial[historial.length - 1]
    etapas.push({
      clave: 'cierre',
      etiqueta: ETIQUETA_CLIENTE[estadoActual],
      estado: 'actual',
      fecha: ultimo?.estado === estadoActual ? ultimo.fecha : undefined,
      tono: tonoEstado(estadoActual),
    })
  }
  return etapas
}
