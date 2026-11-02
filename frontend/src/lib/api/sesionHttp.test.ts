import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { ErrorApi, interpretarError, solicitar } from './cliente'

/**
 * Sesión con cookies httpOnly (RI-08) y tokens de 15 min y 7 días (RF-03): el portal no ve
 * los tokens; ante un 401 pide una renovación y repite la petición una sola vez.
 */
const servidor = setupServer()
beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }))
afterEach(() => servidor.resetHandlers())
afterAll(() => servidor.close())

const API = '/api/v1'

async function errorDe(promesa: Promise<unknown>): Promise<ErrorApi> {
  try {
    await promesa
  } catch (error) {
    if (error instanceof ErrorApi) return error
    throw error
  }
  throw new Error('Se esperaba un error')
}

describe('renovación de la sesión ante un 401', () => {
  it('renueva una vez y repite la petición original', async () => {
    let renovada = false
    let renovaciones = 0
    servidor.use(
      http.get(`${API}/originacion/solicitudes`, () =>
        renovada ? HttpResponse.json([{ id: 's-1' }]) : HttpResponse.json({ codigo: 'sin_sesion', mensaje: 'x' }, { status: 401 }),
      ),
      http.post(`${API}/identidad/sesion/renovar`, () => {
        renovaciones += 1
        renovada = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await expect(solicitar('/originacion/solicitudes')).resolves.toEqual([{ id: 's-1' }])
    expect(renovaciones).toBe(1)
  })

  it('las peticiones simultáneas comparten una sola renovación (la rotación invalida la anterior)', async () => {
    let renovada = false
    let renovaciones = 0
    const protegido = () => (renovada ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status: 401 }))
    servidor.use(
      http.get(`${API}/a`, protegido),
      http.get(`${API}/b`, protegido),
      http.get(`${API}/c`, protegido),
      http.post(`${API}/identidad/sesion/renovar`, async () => {
        renovaciones += 1
        await new Promise((r) => setTimeout(r, 30))
        renovada = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await Promise.all([solicitar('/a'), solicitar('/b'), solicitar('/c')])
    expect(renovaciones).toBe(1)
  })

  it('si no se puede renovar, lanza sin_sesion con un mensaje en español', async () => {
    servidor.use(
      http.get(`${API}/originacion/solicitudes`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API}/identidad/sesion/renovar`, () => new HttpResponse(null, { status: 401 })),
    )
    const error = await errorDe(solicitar('/originacion/solicitudes'))
    expect(error.codigo).toBe('sin_sesion')
    expect(error.estado).toBe(401)
    expect(error.message).toBe('Tu sesión terminó. Vuelve a ingresar para continuar.')
  })

  it('no repite más de una vez si el servidor sigue respondiendo 401', async () => {
    let llamadas = 0
    servidor.use(
      http.get(`${API}/x`, () => {
        llamadas += 1
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${API}/identidad/sesion/renovar`, () => new HttpResponse(null, { status: 204 })),
    )
    expect((await errorDe(solicitar('/x'))).codigo).toBe('sin_sesion')
    expect(llamadas).toBe(2)
  })

  it('el 401 del ingreso es de credenciales: no intenta renovar (RN-17)', async () => {
    let renovaciones = 0
    servidor.use(
      http.post(`${API}/identidad/sesiones`, () =>
        HttpResponse.json({ codigo: 'credenciales_invalidas', mensaje: 'El correo o la contraseña no son correctos.' }, { status: 401 }),
      ),
      http.post(`${API}/identidad/sesion/renovar`, () => {
        renovaciones += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const error = await errorDe(solicitar('/identidad/sesiones', { metodo: 'POST', cuerpo: { email: 'a@b.co', password: 'x' } }))
    expect(error.codigo).toBe('credenciales_invalidas')
    expect(renovaciones).toBe(0)
  })
})

describe('cabeceras: ningún token en el navegador (RI-08)', () => {
  it('manda X-Requested-With y nunca Authorization', async () => {
    let cabeceras: Headers | undefined
    servidor.use(
      http.get(`${API}/identidad/sesion`, ({ request }) => {
        cabeceras = request.headers
        return HttpResponse.json({ usuario: null })
      }),
    )
    await solicitar('/identidad/sesion')
    expect(cabeceras?.get('x-requested-with')).toBe('XMLHttpRequest')
    expect(cabeceras?.get('authorization')).toBeNull()
  })

  it('devuelve el token CSRF de la cookie XSRF-TOKEN en las peticiones que cambian datos', async () => {
    document.cookie = 'XSRF-TOKEN=abc%3D123; path=/'
    let xsrf: string | null = null
    servidor.use(
      http.delete(`${API}/identidad/sesion`, ({ request }) => {
        xsrf = request.headers.get('x-xsrf-token')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await solicitar('/identidad/sesion', { metodo: 'DELETE' })
    expect(xsrf).toBe('abc=123')
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('no deja nada de la sesión en localStorage ni en sessionStorage', async () => {
    localStorage.clear()
    sessionStorage.clear()
    servidor.use(http.get(`${API}/identidad/sesion`, () => HttpResponse.json({ usuario: { id: 1, rol: 'cliente' } })))
    await solicitar('/identidad/sesion')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})

describe('estados sin cuerpo de negocio (RNF-09)', () => {
  it('traduce 413, 419 y 503 a mensajes propios en español', () => {
    expect(interpretarError(413, '<html>413 Request Entity Too Large</html>').message).toMatch(/pesan demasiado/)
    expect(interpretarError(419, { message: 'CSRF token mismatch.' }).message).toMatch(/Recárgala/)
    expect(interpretarError(503, { message: 'Service Unavailable' }).message).not.toMatch(/Service/)
  })
})
