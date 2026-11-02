import type { AccionPendiente, SolicitudResumen } from '../../lib/api/tipos'

/** Pantalla donde el cliente resuelve la acción pendiente de una solicitud. */
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
