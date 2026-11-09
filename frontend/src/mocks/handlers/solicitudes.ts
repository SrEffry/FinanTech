import { http, HttpResponse } from 'msw'
import { obtenerDb, type SolicitudDb, type UsuarioDb } from '../db'
import { avanzarSolicitud, enviarAEstudio, revisarVencimiento } from '../flujo'
import { API, auditar, errorNegocio, errorValidacion, exigirSesion, manejar } from '../utilidades'
import { explicacion } from '../vistas'

/*
 * Originación del cliente (RF-06, RF-07): desde T11 (02/11/2026) son reales en Laravel
 * `GET/POST originacion/solicitudes`, `GET/PATCH .../{id}`, `.../documentos`, `.../radicar`
 * y `.../enviar-documentos`. Aquí solo quedan la explicación de la decisión (T16) y la
 * reconsideración (T23), que solo responden para solicitudes de la base simulada.
 */

/** RN-35: el cliente solo ve sus propias solicitudes; las demás no existen para él. */
function solicitudPropia(cliente: UsuarioDb, id: string): SolicitudDb {
  const solicitud = obtenerDb().solicitudes.find((s) => s.id === id && s.cliente_id === cliente.id)
  if (!solicitud) throw errorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404)
  avanzarSolicitud(solicitud)
  const oferta = obtenerDb().ofertas.find((o) => o.id === solicitud.oferta_id)
  if (oferta) revisarVencimiento(oferta)
  return solicitud
}

export const handlersSolicitudes = [
  http.get(
    `${API}/originacion/solicitudes/:id/decision`,
    manejar(({ params }) => {
      const cliente = exigirSesion(['cliente'])
      const vista = explicacion(solicitudPropia(cliente, String(params.id)))
      if (!vista) return errorNegocio('sin_decision', 'Esta solicitud todavía no tiene una decisión.', 404)
      return HttpResponse.json(vista)
    }),
  ),

  http.post(
    `${API}/originacion/solicitudes/:id/reconsideraciones`,
    manejar(async ({ request, params }) => {
      const cliente = exigirSesion(['cliente'])
      const solicitud = solicitudPropia(cliente, String(params.id))
      const vista = explicacion(solicitud)
      // RF-09 FA-03: no se permite una segunda reconsideración.
      if (solicitud.reconsideracion) {
        return errorNegocio('reconsideracion_existente', 'Ya pediste la reconsideración de esta solicitud.', 409)
      }
      if (!vista?.puede_reconsiderar) {
        return errorNegocio('reconsideracion_no_disponible', 'El plazo para pedir la reconsideración ya venció.', 409)
      }
      const formulario = await request.formData()
      const argumentos = String(formulario.get('argumentos') ?? '').trim()
      if (argumentos.length < 20) {
        return errorValidacion({ argumentos: 'Cuéntanos en al menos 20 caracteres por qué debemos revisar la decisión.' })
      }
      const ahora = new Date()
      solicitud.reconsideracion = { estado: 'en_revision', radicada_en: ahora.toISOString(), argumentos, respuesta: null }
      // RN-49: la reconsideración devuelve la solicitud a estudio.
      enviarAEstudio(solicitud, ahora)
      auditar(cliente, 'Reconsideración pedida', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(explicacion(solicitud))
    }),
  ),
]
