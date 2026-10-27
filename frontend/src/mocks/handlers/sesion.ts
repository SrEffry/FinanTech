import { http, HttpResponse } from 'msw'
import { obtenerDb } from '../db'
import { consumirDesafio, crearDesafio, publicarDesafio } from '../flujo'
import { API, auditar, errorNegocio, exigirSesion, generarCodigo, leerJson, manejar, usuarioPublico, usuarioSesion } from '../utilidades'

const MAXIMO_INTENTOS = 5
const BLOQUEO_MINUTOS = 30

// RN-17: el mismo mensaje exista o no el correo, y el contador corre igual en ambos casos.
const CREDENCIALES_INVALIDAS = 'El correo o la contraseña no son correctos.'
const CUENTA_BLOQUEADA =
  'Por seguridad bloqueamos el ingreso con estos datos durante 30 minutos. Mientras tanto puedes recuperar tu contraseña.'

export const handlersSesion = [
  http.get(`${API}/sistema/estado`, () => HttpResponse.json({ servicios_externos: 'simulado' })),

  http.post(
    `${API}/identidad/sesiones`,
    manejar(async ({ request }) => {
      const db = obtenerDb()
      const { email = '', password = '' } = await leerJson<{ email: string; password: string }>(request)
      const correo = email.trim().toLowerCase()
      const intentos = (db.intentos_login[correo] ??= { fallidos: 0, bloqueado_hasta: null })

      if (intentos.bloqueado_hasta && new Date(intentos.bloqueado_hasta).getTime() > Date.now()) {
        return errorNegocio('cuenta_bloqueada', CUENTA_BLOQUEADA, 423)
      }

      const usuario = db.usuarios.find((u) => u.email === correo)
      if (!usuario || usuario.password !== password || usuario.estado !== 'activo') {
        intentos.fallidos += 1
        auditar(usuario ?? 'Usuario desconocido', 'Inicio de sesión fallido', 'sesion', usuario ? String(usuario.id) : '—', {
          resultado: 'rechazado',
        })
        if (intentos.fallidos >= MAXIMO_INTENTOS) {
          intentos.fallidos = 0
          intentos.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60_000).toISOString()
          return errorNegocio('cuenta_bloqueada', CUENTA_BLOQUEADA, 423)
        }
        return errorNegocio('credenciales_invalidas', CREDENCIALES_INVALIDAS, 401)
      }

      delete db.intentos_login[correo]
      // RN-15: segundo factor siempre para internos; los clientes también lo tienen activo (mfa_activo).
      return HttpResponse.json(crearDesafio(usuario, 'sesion'))
    }),
  ),

  http.post(
    `${API}/identidad/sesiones/:desafio/verificar`,
    manejar(async ({ request, params }) => {
      const db = obtenerDb()
      const { codigo = '' } = await leerJson<{ codigo: string }>(request)
      const desafio = consumirDesafio(String(params.desafio), codigo.trim(), 'sesion')
      const usuario = db.usuarios.find((u) => u.id === desafio.usuario_id)
      if (!usuario) return errorNegocio('codigo_vencido', 'El código venció. Pide uno nuevo.')
      db.sesion_usuario_id = usuario.id
      usuario.ultimo_acceso_en = new Date().toISOString()
      auditar(usuario, 'Inicio de sesión', 'sesion', String(usuario.id))
      return HttpResponse.json({ usuario: usuarioPublico(usuario) })
    }),
  ),

  http.post(
    `${API}/identidad/sesiones/:desafio/reenviar`,
    manejar(({ params }) => {
      const db = obtenerDb()
      const desafio = db.desafios.find((d) => d.id === String(params.desafio))
      const usuario = desafio && db.usuarios.find((u) => u.id === desafio.usuario_id)
      if (!desafio || !usuario) return errorNegocio('codigo_vencido', 'El código venció. Vuelve a empezar.', 410)
      if (new Date(desafio.reenvio_disponible_en).getTime() > Date.now()) {
        return errorNegocio('reenvio_muy_pronto', 'Espera 60 segundos antes de pedir otro código.', 429)
      }
      desafio.codigo = generarCodigo()
      desafio.intentos = 0
      desafio.expira_en = new Date(Date.now() + 5 * 60_000).toISOString()
      desafio.reenvio_disponible_en = new Date(Date.now() + 60_000).toISOString()
      return HttpResponse.json(publicarDesafio(desafio, usuario))
    }),
  ),

  http.get(
    `${API}/identidad/sesion`,
    manejar(() => {
      const usuario = usuarioSesion()
      return HttpResponse.json({ usuario: usuario ? usuarioPublico(usuario) : null })
    }),
  ),

  http.delete(
    `${API}/identidad/sesion`,
    manejar(() => {
      const usuario = exigirSesion()
      obtenerDb().sesion_usuario_id = null
      auditar(usuario, 'Cierre de sesión', 'sesion', String(usuario.id))
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // RN-17: la respuesta no dice si el correo existe.
  http.post(
    `${API}/identidad/recuperacion`,
    manejar(() =>
      HttpResponse.json(
        {
          mensaje:
            'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada y la de spam.',
        },
        { status: 202 },
      ),
    ),
  ),
]
