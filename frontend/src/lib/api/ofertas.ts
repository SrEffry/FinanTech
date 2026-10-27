import { solicitar } from './cliente'
import type { DesafioMfa, Oferta } from './tipos'

export function obtenerOferta(id: string) {
  return solicitar<Oferta>(`/desembolso/ofertas/${id}`)
}

/** Aceptar la oferta exige segundo factor (RN-61): primero se pide el código. */
export function pedirCodigoAceptacion(id: string) {
  return solicitar<DesafioMfa>(`/desembolso/ofertas/${id}/desafio-mfa`, { metodo: 'POST' })
}

export function aceptarOferta(id: string, desafioId: string, codigo: string) {
  return solicitar<Oferta>(`/desembolso/ofertas/${id}/aceptar`, {
    metodo: 'POST',
    cuerpo: { declaracion: true, desafio_id: desafioId, codigo },
  })
}

export function rechazarOferta(id: string, motivo: string) {
  return solicitar<Oferta>(`/desembolso/ofertas/${id}/rechazar`, { metodo: 'POST', cuerpo: { motivo } })
}
