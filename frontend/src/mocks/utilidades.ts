import { HttpResponse, delay, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { RegistroAuditoria, Rol, Usuario } from '../lib/api/tipos'
import { enmascarar } from '../lib/formato'
import { guardarDb, obtenerDb, siguienteId, type UsuarioDb } from './db'

export const API = '/api/v1'

type Resolutor = HttpResponseResolver<PathParams, DefaultBodyType, undefined>
type InfoResolutor = Parameters<Resolutor>[0]

/** Error de negocio con la misma forma que App\Shared\Exceptions\ErrorNegocio. */
export function errorNegocio(codigo: string, mensaje: string, estado = 422, datos?: Record<string, unknown>) {
  return HttpResponse.json(datos ? { codigo, mensaje, datos } : { codigo, mensaje }, { status: estado })
}

/** Error de validación con la forma del 422 de Laravel. */
export function errorValidacion(errores: Record<string, string>) {
  const errors = Object.fromEntries(Object.entries(errores).map(([campo, mensaje]) => [campo, [mensaje]]))
  return HttpResponse.json({ message: Object.values(errores)[0], errors }, { status: 422 })
}

/** Latencia de red simulada, para que se vean los estados de carga. */
export function latencia(ms = 180 + Math.floor(Math.random() * 320)) {
  return delay(ms)
}

/**
 * Envuelve un resolver: los `throw errorNegocio(...)` cortan el flujo y se devuelven como
 * respuesta, y todo cambio en la base se guarda al terminar.
 */
export function manejar(resolver: (info: InfoResolutor) => Promise<Response> | Response): Resolutor {
  return async (info) => {
    await latencia()
    try {
      return await resolver(info)
    } catch (error) {
      if (error instanceof Response) return error
      throw error
    } finally {
      guardarDb()
    }
  }
}

export function nombreCompleto(usuario: UsuarioDb): string {
  return `${usuario.nombres} ${usuario.apellidos}`
}

export function usuarioPublico(usuario: UsuarioDb): Usuario {
  return {
    id: usuario.id,
    nombre_completo: nombreCompleto(usuario),
    nombre_corto: usuario.nombres.split(' ')[0],
    email: usuario.email,
    rol: usuario.rol,
    estado_kyc: usuario.estado_kyc,
    documento_enmascarado: usuario.num_documento ? enmascarar(usuario.num_documento) : undefined,
    cargo: usuario.cargo,
    area: usuario.area,
    atribucion_monto: usuario.atribucion_monto,
  }
}

export function usuarioSesion(): UsuarioDb | null {
  const db = obtenerDb()
  return db.usuarios.find((u) => u.id === db.sesion_usuario_id && u.estado === 'activo') ?? null
}

/** Autorización en el "servidor" (RNF-05): sin sesión, 401; con otro rol, 403. */
export function exigirSesion(roles?: Rol[]): UsuarioDb {
  const usuario = usuarioSesion()
  if (!usuario) throw errorNegocio('sin_sesion', 'Tu sesión terminó. Vuelve a ingresar para continuar.', 401)
  if (roles && !roles.includes(usuario.rol)) {
    throw errorNegocio('sin_permiso', 'No tienes permiso para hacer esta acción.', 403)
  }
  return usuario
}

export function auditar(
  actor: UsuarioDb | string,
  accion: string,
  entidad: string,
  entidadId: string,
  extra: Partial<Pick<RegistroAuditoria, 'resultado' | 'simulado' | 'origen'>> = {},
): void {
  const db = obtenerDb()
  const esUsuario = typeof actor !== 'string'
  const rol: RegistroAuditoria['rol'] = esUsuario ? actor.rol : 'sistema'
  db.auditoria.push({
    id: siguienteId('auditoria'),
    momento: new Date().toISOString(),
    actor: esUsuario ? nombreCompleto(actor) : actor,
    rol,
    accion,
    entidad,
    entidad_id: entidadId,
    origen: extra.origen ?? (rol === 'cliente' ? 'Portal web' : rol === 'sistema' ? 'Motor de reglas' : 'Consola interna'),
    resultado: extra.resultado ?? 'exito',
    simulado: extra.simulado ?? false,
  })
}

/** Código numérico de 6 dígitos con el generador criptográfico del navegador. */
export function generarCodigo(): string {
  const [valor] = crypto.getRandomValues(new Uint32Array(1))
  return String(valor % 1_000_000).padStart(6, '0')
}

export async function leerJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}
