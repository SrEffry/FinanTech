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
  pagina_vencida: 'La página estuvo abierta mucho tiempo. Recárgala e inténtalo de nuevo.',
  archivo_muy_pesado: 'Los archivos pesan demasiado para enviarlos juntos. Usa fotos más livianas e inténtalo de nuevo.',
  no_disponible: 'El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
}

/** Errores sin cuerpo de negocio: el portal pone su propio texto (RNF-09). */
const CODIGO_POR_ESTADO: Record<number, string> = {
  0: 'sin_conexion',
  401: 'sin_sesion',
  403: 'sin_permiso',
  404: 'no_encontrado',
  // Laravel responde 419 cuando venció el token CSRF de la página.
  419: 'pagina_vencida',
  // nginx corta el cuerpo antes de llegar a Laravel (client_max_body_size).
  413: 'archivo_muy_pesado',
  429: 'demasiados_intentos',
  503: 'no_disponible',
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

  const codigo = CODIGO_POR_ESTADO[estado] ?? 'error_servidor'
  return new ErrorApi(estado, codigo, MENSAJES[codigo])
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
 * Rutas cuyo 401 no significa "sesión vencida" sino credenciales o códigos rechazados:
 * ahí no se intenta renovar la sesión.
 */
const SIN_RENOVACION = [/^\/identidad\/sesiones(\/|$)/, /^\/identidad\/sesion\/renovar$/, /^\/identidad\/recuperacion/, /^\/clientes\/registro/]

export const RUTA_RENOVAR = '/identidad/sesion/renovar'

/** Valor de una cookie legible. Solo se usa para el token CSRF, que no es un secreto de sesión. */
function leerCookie(nombre: string): string | null {
  if (typeof document === 'undefined') return null
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`))
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null
}

function cabecerasBase(metodo: string): Record<string, string> {
  // Laravel reconoce la petición como AJAX y responde JSON (401 en vez de redirigir).
  const cabeceras: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
  if (metodo !== 'GET') {
    // Protección CSRF de Sanctum (si el backend la usa): la cookie XSRF-TOKEN viaja de vuelta como cabecera.
    const xsrf = leerCookie('XSRF-TOKEN')
    if (xsrf) cabeceras['X-XSRF-TOKEN'] = xsrf
  }
  return cabeceras
}

let renovacionEnCurso: Promise<boolean> | null = null

/**
 * Pide al servidor que rote la cookie de renovación y emita un acceso nuevo (RF-03, tokens
 * de 15 min y 7 días). Si varias peticiones reciben 401 a la vez, comparten una sola
 * renovación: la rotación invalida la cookie anterior y un segundo intento cerraría la sesión.
 */
export function renovarSesion(): Promise<boolean> {
  renovacionEnCurso ??= fetch(`${BASE}${RUTA_RENOVAR}`, {
    method: 'POST',
    headers: cabecerasBase('POST'),
    credentials: 'same-origin',
  })
    .then((respuesta) => respuesta.ok)
    .catch(() => false)
    .finally(() => {
      renovacionEnCurso = null
    })
  return renovacionEnCurso
}

/**
 * fetch a /api/v1 con la sesión en cookies httpOnly del mismo origen (RI-08): el portal
 * nunca ve ni guarda tokens. Ante un 401 renueva la sesión una vez y repite la petición;
 * si tampoco se puede renovar, lanza `sin_sesion` y las rutas protegidas llevan al ingreso.
 */
async function pedir(ruta: string, init: RequestInit & { method: string }): Promise<Response> {
  const enviar = () =>
    fetch(`${BASE}${ruta}`, {
      ...init,
      headers: { ...cabecerasBase(init.method), ...(init.headers as Record<string, string> | undefined) },
      credentials: 'same-origin',
    })

  let respuesta: Response
  try {
    respuesta = await enviar()
    if (respuesta.status === 401 && !SIN_RENOVACION.some((patron) => patron.test(ruta))) {
      if (!(await renovarSesion())) throw interpretarError(401, undefined)
      respuesta = await enviar()
      if (respuesta.status === 401) throw interpretarError(401, undefined)
    }
  } catch (error) {
    if (error instanceof ErrorApi) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw interpretarError(0, undefined)
  }
  return respuesta
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  cuerpo?: unknown
  formulario?: FormData
  senal?: AbortSignal
}

/** Llama a /api/v1 y devuelve el cuerpo, o lanza un ErrorApi listo para mostrar. */
export async function solicitar<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, formulario, senal } = opciones
  const cabeceras: Record<string, string> = {}
  let body: BodyInit | undefined
  if (formulario) {
    body = formulario
  } else if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json'
    body = JSON.stringify(cuerpo)
  }

  const respuesta = await pedir(ruta, { method: metodo, headers: cabeceras, body, signal: senal })
  const datos = await leerCuerpo(respuesta)
  if (!respuesta.ok) throw interpretarError(respuesta.status, datos)
  return datos as T
}

/** Descarga un archivo de la API (por ejemplo, la exportación de auditoría). */
export async function descargar(ruta: string, nombreArchivo: string): Promise<void> {
  const respuesta = await pedir(ruta, { method: 'GET' })
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
