import { handlersAdministracion } from './administracion'
import { handlersConsola } from './consola'
import { handlersIdentidad } from './identidad'
import { handlersOfertas } from './ofertas'
import { handlersRegistro } from './registro'
import { handlersSesion } from './sesion'
import { handlersSimulacion } from './simulacion'
import { handlersSolicitudes } from './solicitudes'

/**
 * Endpoints simulados. Cuando Laravel implemente uno, se borra su handler: la petición
 * pasa sola al backend real (onUnhandledRequest: 'bypass').
 */
export const handlers = [
  ...handlersSesion,
  ...handlersRegistro,
  ...handlersIdentidad,
  ...handlersSimulacion,
  ...handlersSolicitudes,
  ...handlersOfertas,
  ...handlersConsola,
  ...handlersAdministracion,
]
