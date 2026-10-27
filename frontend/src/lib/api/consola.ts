import { consulta, solicitar } from './cliente'
import type {
  Bandeja,
  Concepto,
  ContextoDecision,
  Evaluacion,
  Expediente,
  FiltrosBandeja,
  NuevaDecision,
  Observacion,
} from './tipos'

/** El servidor arma la bandeja según el rol de la sesión (analista u oficial). */
export function obtenerBandeja(filtros: FiltrosBandeja) {
  return solicitar<Bandeja>(`/originacion/bandeja${consulta(filtros)}`)
}

export function obtenerExpediente(id: string) {
  return solicitar<Expediente>(`/originacion/expedientes/${id}`)
}

export function agregarObservacion(id: string, texto: string) {
  return solicitar<Observacion>(`/originacion/expedientes/${id}/observaciones`, {
    metodo: 'POST',
    cuerpo: { texto },
  })
}

export function pedirDocumentos(id: string, documentos: { tipo: string; motivo: string }[]) {
  return solicitar<Expediente>(`/originacion/expedientes/${id}/documentos-requeridos`, {
    metodo: 'POST',
    cuerpo: { documentos },
  })
}

export function obtenerEvaluacion(id: string) {
  return solicitar<Evaluacion>(`/evaluacion/solicitudes/${id}/evaluacion`)
}

export function emitirConcepto(id: string, recomendacion: Concepto['recomendacion'], texto: string) {
  return solicitar<Expediente>(`/evaluacion/solicitudes/${id}/concepto`, {
    metodo: 'POST',
    cuerpo: { recomendacion, texto },
  })
}

export function obtenerContextoDecision(id: string) {
  return solicitar<ContextoDecision>(`/evaluacion/decisiones/contexto/${id}`)
}

/** La atribución, el conflicto de interés y la tasa máxima se verifican en el servidor (RN-53 a RN-57). */
export function registrarDecision(decision: NuevaDecision) {
  return solicitar<Expediente>('/evaluacion/decisiones', { metodo: 'POST', cuerpo: decision })
}
