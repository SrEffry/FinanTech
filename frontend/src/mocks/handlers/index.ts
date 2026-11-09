import { handlersAdministracion } from './administracion'
import { handlersPuenteSesion } from './puenteSesion'
import { handlersSolicitudes } from './solicitudes'

/**
 * Endpoints simulados. Cuando Laravel implemente uno, se borra su handler: la petición
 * pasa sola al backend real (onUnhandledRequest: 'bypass').
 *
 * Ya son reales (01/11/2026): registro (RF-01), sesión (RF-03), verificación de identidad
 * (RF-02), consentimientos (RF-04), recuperación, `sistema/estado` y simulación (RF-05).
 * Desde el 02/11/2026 también la originación del cliente (RF-06, RF-07): de `solicitudes`
 * solo quedan simuladas la explicación de la decisión y la reconsideración. Desde el
 * 07/11/2026 la oferta y el pagaré (RF-11, `desembolso/ofertas*`) también son reales.
 * Desde el 08/11/2026 también la consola del oficial (V3): bandeja, expediente y decisión.
 * `puenteSesion` no simula nada: deja pasar la sesión real y la enlaza con la base simulada.
 */
export const handlers = [
  ...handlersPuenteSesion,
  ...handlersSolicitudes,
  ...handlersAdministracion,
]
