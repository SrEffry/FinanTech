const BASE = '/api/v1'

/**
 * Error de la API ya traducido para mostrarlo al usuario.
 *
 * El backend responde tres formas distintas y el código de estado no alcanza para
 * distinguirlas (422 y 429 se usan en dos de ellas):
 * - negocio: `{codigo, mensaje, datos?}` (ErrorNegocio): el mensaje ya está en español claro.
 * - validación: `{message, errors: {campo: [..]}}` (422 de Laravel): un mensaje por campo.
 * - framework: `{message}` u otra cosa: nunca se muestra tal cual (RNF-09).
 */
export class ErrorApi extends Error {
  readonly estado: number
  readonly codigo: string
  readonly datos: Record<string, unknown> | undefined
  /** Mensajes por campo cuando el servidor rechazó la validación. */
  readonly campos: Record<string, string>

  constructor(
    estado: number,
    codigo: string,
    mensaje: string,
    datos?: Record<string, unknown>,
    campos: Record<string, string> = {},
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
    this.codigo = codigo
    this.datos = datos
    this.campos = campos
  }
}

const MENSAJES: Record<string, string> = {
  sin_conexion: 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.',
  sin_sesion: 'Tu sesión terminó. Vuelve a ingresar para continuar.',
  sin_permiso: 'No tienes permiso para hacer esta acción.',
  no_encontrado: 'No encontramos lo que buscas. Puede que ya no exista.',
  demasiados_intentos: 'Hiciste muchos intentos seguidos. Espera un minuto y vuelve a intentarlo.',
  error_servidor: 'Algo falló de nuestro lado. Inténtalo de nuevo en unos minutos.',
  validacion: 'Revisa los datos marcados.',
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function interpretarError(estado: number, cuerpo: unknown): ErrorApi {
  if (esObjeto(cuerpo) && typeof cuerpo.codigo === 'string' && typeof cuerpo.mensaje === 'string') {
    const datos = esObjeto(cuerpo.datos) ? cuerpo.datos : undefined
    return new ErrorApi(estado, cuerpo.codigo, cuerpo.mensaje, datos)
  }

  if (esObjeto(cuerpo) && esObjeto(cuerpo.errors)) {
    const campos: Record<string, string> = {}
    for (const [campo, mensajes] of Object.entries(cuerpo.errors)) {
      if (Array.isArray(mensajes) && typeof mensajes[0] === 'string') campos[campo] = mensajes[0]
    }
    const primero = Object.values(campos)[0]
    return new ErrorApi(estado, 'validacion', primero ?? MENSAJES.validacion, undefined, campos)
  }

  const codigo =
    estado === 0
      ? 'sin_conexion'
      : estado === 401
        ? 'sin_sesion'
        : estado === 403
          ? 'sin_permiso'
          : estado === 404
            ? 'no_encontrado'
            : estado === 429
              ? 'demasiados_intentos'
              : 'error_servidor'
  return new ErrorApi(estado, codigo, MENSAJES[codigo])
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  cuerpo?: unknown
  formulario?: FormData
  senal?: AbortSignal
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text()
  if (!texto) return undefined
  try {
    return JSON.parse(texto)
  } catch {
    return texto
  }
}

/**
 * Llama a /api/v1. La sesión viaja en cookies httpOnly del mismo origen (RI-08):
 * el portal nunca guarda tokens.
 */
export async function solicitar<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, formulario, senal } = opciones
  const cabeceras: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined
  if (formulario) {
    body = formulario
  } else if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json'
    body = JSON.stringify(cuerpo)
  }

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body,
      credentials: 'same-origin',
      signal: senal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw interpretarError(0, undefined)
  }

  const datos = await leerCuerpo(respuesta)
  if (!respuesta.ok) throw interpretarError(respuesta.status, datos)
  return datos as T
}

/** Descarga un archivo de la API (por ejemplo, la exportación de auditoría). */
export async function descargar(ruta: string, nombreArchivo: string): Promise<void> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, { credentials: 'same-origin' })
  } catch {
    throw interpretarError(0, undefined)
  }
  if (!respuesta.ok) throw interpretarError(respuesta.status, await leerCuerpo(respuesta))
  guardarArchivo(await respuesta.blob(), nombreArchivo)
}

export function guardarArchivo(contenido: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}

export function consulta(parametros: object): string {
  const busqueda = new URLSearchParams()
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') busqueda.set(clave, String(valor))
  }
  const texto = busqueda.toString()
  return texto ? `?${texto}` : ''
}
