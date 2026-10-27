import { solicitar } from './cliente'
import type {
  CambiosBorrador,
  DocumentoSolicitud,
  ExplicacionDecision,
  SolicitudDetalle,
  SolicitudResumen,
} from './tipos'

export function listarSolicitudes() {
  return solicitar<SolicitudResumen[]>('/originacion/solicitudes')
}

export function obtenerSolicitud(id: string) {
  return solicitar<SolicitudDetalle>(`/originacion/solicitudes/${id}`)
}

/** Crea el borrador. Responde 409 `solicitud_activa` si ya hay una del mismo producto (RN-28). */
export function crearSolicitud(producto: string, monto: number, plazoMeses: number) {
  return solicitar<SolicitudDetalle>('/originacion/solicitudes', {
    metodo: 'POST',
    cuerpo: { producto, monto, plazo_meses: plazoMeses },
  })
}

export function guardarBorrador(id: string, cambios: CambiosBorrador) {
  return solicitar<SolicitudDetalle>(`/originacion/solicitudes/${id}`, { metodo: 'PATCH', cuerpo: cambios })
}

export function cargarDocumento(id: string, tipo: string, archivo: File) {
  const formulario = new FormData()
  formulario.append('tipo', tipo)
  formulario.append('archivo', archivo)
  return solicitar<DocumentoSolicitud>(`/originacion/solicitudes/${id}/documentos`, {
    metodo: 'POST',
    formulario,
  })
}

export function radicar(id: string) {
  return solicitar<SolicitudDetalle>(`/originacion/solicitudes/${id}/radicar`, { metodo: 'POST' })
}

/** Devuelve la solicitud a estudio cuando el cliente ya cargó lo que faltaba. */
export function enviarDocumentos(id: string) {
  return solicitar<SolicitudDetalle>(`/originacion/solicitudes/${id}/enviar-documentos`, { metodo: 'POST' })
}

export function obtenerExplicacion(id: string) {
  return solicitar<ExplicacionDecision>(`/originacion/solicitudes/${id}/decision`)
}

export function pedirReconsideracion(id: string, argumentos: string, adjuntos: File[]) {
  const formulario = new FormData()
  formulario.append('argumentos', argumentos)
  for (const adjunto of adjuntos) formulario.append('adjuntos[]', adjunto)
  return solicitar<ExplicacionDecision>(`/originacion/solicitudes/${id}/reconsideraciones`, {
    metodo: 'POST',
    formulario,
  })
}
