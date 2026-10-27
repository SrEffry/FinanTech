import { http, HttpResponse } from 'msw'
import type { Oferta } from '../../lib/api/tipos'
import { obtenerDb, type OfertaDb, type UsuarioDb } from '../db'
import { cambiarEstado, consumirDesafio, crearDesafio, revisarVencimiento } from '../flujo'
import { API, auditar, errorNegocio, exigirSesion, leerJson, manejar } from '../utilidades'

function ofertaPropia(cliente: UsuarioDb, id: string): OfertaDb {
  const oferta = obtenerDb().ofertas.find((o) => o.id === id && o.cliente_id === cliente.id)
  if (!oferta) throw errorNegocio('no_encontrada', 'No encontramos esa oferta.', 404)
  revisarVencimiento(oferta)
  return oferta
}

function publica(oferta: OfertaDb): Oferta {
  const { cliente_id, ...resto } = oferta
  return resto
}

function exigirVigente(oferta: OfertaDb) {
  if (oferta.estado === 'vencida') {
    throw errorNegocio('oferta_vencida', 'La oferta venció. Puedes radicar una solicitud nueva cuando quieras.', 409)
  }
  if (oferta.estado !== 'vigente') {
    throw errorNegocio('oferta_no_vigente', 'Esta oferta ya no se puede aceptar.', 409)
  }
}

/** Huella SHA-256 del pagaré: evidencia de firma simulada (MR-004). */
async function huella(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto)
  const resumen = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const handlersOfertas = [
  http.get(
    `${API}/desembolso/ofertas/:id`,
    manejar(({ params }) => HttpResponse.json(publica(ofertaPropia(exigirSesion(['cliente']), String(params.id))))),
  ),

  // RN-61: aceptar la oferta exige segundo factor.
  http.post(
    `${API}/desembolso/ofertas/:id/desafio-mfa`,
    manejar(({ params }) => {
      const cliente = exigirSesion(['cliente'])
      const oferta = ofertaPropia(cliente, String(params.id))
      exigirVigente(oferta)
      return HttpResponse.json(crearDesafio(cliente, 'oferta', oferta.id))
    }),
  ),

  http.post(
    `${API}/desembolso/ofertas/:id/aceptar`,
    manejar(async ({ request, params }) => {
      const cliente = exigirSesion(['cliente'])
      const oferta = ofertaPropia(cliente, String(params.id))
      exigirVigente(oferta)
      const { declaracion, desafio_id = '', codigo = '' } = await leerJson<{
        declaracion: boolean
        desafio_id: string
        codigo: string
      }>(request)
      if (declaracion !== true) {
        return errorNegocio('declaracion_requerida', 'Confirma que leíste y aceptas las condiciones y el pagaré.')
      }
      const desafio = consumirDesafio(desafio_id, codigo.trim(), 'oferta')
      if (desafio.oferta_id !== oferta.id) return errorNegocio('codigo_vencido', 'El código venció. Pide uno nuevo.')

      const ahora = new Date()
      const sello = ahora.toISOString()
      oferta.estado = 'firmada'
      oferta.firma = {
        huella_sha256: await huella(`${oferta.pagare.texto}\n${cliente.id}\n${sello}`),
        sellado_en: sello,
        simulada: true,
      }
      const solicitud = obtenerDb().solicitudes.find((s) => s.id === oferta.solicitud_id)
      if (solicitud) {
        cambiarEstado(solicitud, 'OFERTA_ACEPTADA', ahora)
        cambiarEstado(solicitud, 'FORMALIZADA', ahora)
      }
      auditar(cliente, 'Oferta aceptada', 'oferta', oferta.id)
      auditar('Firma electrónica', 'Pagaré firmado', 'oferta', oferta.id, { simulado: true, origen: 'Servicio externo' })
      return HttpResponse.json(publica(oferta))
    }),
  ),

  http.post(
    `${API}/desembolso/ofertas/:id/rechazar`,
    manejar(async ({ params }) => {
      const cliente = exigirSesion(['cliente'])
      const oferta = ofertaPropia(cliente, String(params.id))
      exigirVigente(oferta)
      oferta.estado = 'rechazada'
      const solicitud = obtenerDb().solicitudes.find((s) => s.id === oferta.solicitud_id)
      if (solicitud) cambiarEstado(solicitud, 'OFERTA_RECHAZADA')
      auditar(cliente, 'Oferta rechazada', 'oferta', oferta.id)
      return HttpResponse.json(publica(oferta))
    }),
  ),
]
