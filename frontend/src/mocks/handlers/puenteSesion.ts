import { bypass, http, type HttpResponseResolver } from 'msw'
import type { Usuario } from '../../lib/api/tipos'
import { guardarDb, obtenerDb, siguienteId, type UsuarioDb } from '../db'
import { API } from '../utilidades'

/**
 * Puente entre la sesión real y la API simulada (modo mixto).
 *
 * La sesión la lleva Laravel en cookies httpOnly (RF-03, RI-08): estas peticiones pasan
 * tal cual al backend. El puente solo lee la respuesta para saber quién está conectado y
 * enlazarlo, por correo, con su usuario de la base simulada. Así los endpoints que aún
 * están simulados (`exigirSesion()`) responden a la misma persona que el servidor real.
 *
 * Solo hace falta mientras queden pantallas simuladas (originación, oferta, consola y
 * administración). Cuando no quede ninguna, se borra este archivo.
 */
export function enlazar(usuario: Usuario | null): UsuarioDb | null {
  const db = obtenerDb()
  if (!usuario) {
    db.sesion_usuario_id = null
    guardarDb()
    return null
  }
  const email = usuario.email.trim().toLowerCase()
  let local = db.usuarios.find((u) => u.email === email)
  if (!local) {
    const [nombres, ...resto] = usuario.nombre_completo.split(' ')
    local = {
      id: siguienteId('usuario'),
      nombres: usuario.nombre_corto || nombres,
      apellidos: resto.join(' '),
      email,
      // La contraseña la valida Laravel: la base simulada no guarda ninguna.
      password: '',
      rol: usuario.rol,
      estado: 'activo',
      ultimo_acceso_en: new Date().toISOString(),
      cargo: usuario.cargo,
      area: usuario.area,
      atribucion_monto: usuario.atribucion_monto,
      // Solo los últimos 4 dígitos, ya enmascarados por el servidor (RNF-06).
      num_documento: usuario.documento_enmascarado,
      estado_kyc: usuario.estado_kyc,
      intentos_kyc: 0,
      cliente_desde: usuario.rol === 'cliente' ? new Date().toISOString() : undefined,
    }
    db.usuarios.push(local)
  } else {
    local.rol = usuario.rol
    local.estado = 'activo'
    // La identidad la verifica Laravel (RF-02): la simulación usa ese estado (RN-07).
    local.estado_kyc = usuario.estado_kyc
  }
  db.sesion_usuario_id = local.id
  guardarDb()
  return local
}

/** Pasa la petición a Laravel y enlaza el usuario que venga en `{usuario}`. */
const pasarYEnlazar: HttpResponseResolver = async ({ request }) => {
  const respuesta = await fetch(bypass(request))
  if (!respuesta.ok) return respuesta
  const cuerpo = (await respuesta.clone().json().catch(() => null)) as { usuario?: Usuario | null } | null
  if (!cuerpo || !('usuario' in cuerpo)) return respuesta
  enlazar(cuerpo.usuario ?? null)
  return respuesta
}

export const handlersPuenteSesion = [
  http.get(`${API}/identidad/sesion`, pasarYEnlazar),
  http.post(`${API}/identidad/sesiones/:desafio/verificar`, pasarYEnlazar),
  // El registro abre la sesión y devuelve `usuario` (RF-01).
  http.post(`${API}/clientes/registro/:registro/verificar`, pasarYEnlazar),
  // La renovación y el cierre no pasan por aquí: van directo a Laravel. La sesión simulada
  // se vuelve a enlazar (o se cierra) en el siguiente `GET identidad/sesion`.
]
