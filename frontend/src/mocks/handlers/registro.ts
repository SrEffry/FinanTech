import { bypass, http } from 'msw'
import type { DatosRegistro } from '../../lib/api/tipos'
import { guardarDb, obtenerDb, siguienteId, type UsuarioDb } from '../db'
import { FINALIDADES, POLITICA } from '../semilla'
import { API, auditar } from '../utilidades'

/**
 * El registro (RF-01) es real: estas peticiones van a Laravel. Los handlers solo miran la
 * respuesta para crear el mismo cliente en la base simulada, de modo que después pueda
 * iniciar sesión y seguir con el resto del portal, que todavía no tiene backend.
 */
export const handlersRegistro = [
  http.post(`${API}/clientes/registro`, async ({ request }) => {
    const datos = (await request.clone().json()) as DatosRegistro
    const respuesta = await fetch(bypass(request))
    if (respuesta.status === 201) {
      const { registro_id } = (await respuesta.clone().json()) as { registro_id: string }
      obtenerDb().registros_pendientes[registro_id] = {
        email: datos.email.trim().toLowerCase(),
        password: datos.password,
        nombres: datos.nombres.trim(),
        apellidos: datos.apellidos.trim(),
        tipo_documento: datos.tipo_documento,
        num_documento: datos.num_documento,
        fecha_nacimiento: datos.fecha_nacimiento,
        telefono: datos.telefono,
        finalidades_opcionales: datos.finalidades_opcionales,
      }
      guardarDb()
    }
    return respuesta
  }),

  http.post(`${API}/clientes/registro/:registro/verificar`, async ({ request, params }) => {
    const respuesta = await fetch(bypass(request))
    const db = obtenerDb()
    const pendiente = db.registros_pendientes[String(params.registro)]
    if (respuesta.status !== 201 || !pendiente) return respuesta

    const ahora = new Date().toISOString()
    db.usuarios = db.usuarios.filter((u) => u.email !== pendiente.email)
    const cliente: UsuarioDb = {
      id: siguienteId('usuario'),
      nombres: pendiente.nombres,
      apellidos: pendiente.apellidos,
      email: pendiente.email,
      password: pendiente.password,
      rol: 'cliente',
      estado: 'activo',
      ultimo_acceso_en: ahora,
      tipo_documento: pendiente.tipo_documento,
      num_documento: pendiente.num_documento,
      fecha_nacimiento: pendiente.fecha_nacimiento,
      telefono: pendiente.telefono,
      estado_kyc: 'pendiente',
      intentos_kyc: 0,
      cliente_desde: ahora,
    }
    db.usuarios.push(cliente)
    const otorgadas = [
      ...FINALIDADES.filter((f) => f.necesaria).map((f) => f.codigo),
      ...pendiente.finalidades_opcionales,
    ]
    for (const finalidad of otorgadas) {
      db.consentimientos.push({
        id: siguienteId('consentimiento'),
        usuario_id: cliente.id,
        finalidad,
        accion: 'otorga',
        canal: 'web',
        version_politica: POLITICA.version,
        fecha_registro: ahora,
      })
    }
    delete db.registros_pendientes[String(params.registro)]
    // Propuesta del contrato: verificar los códigos abre la sesión para seguir con la identidad (RF-02).
    db.sesion_usuario_id = cliente.id
    auditar(cliente, 'Registro de cliente', 'cliente', String(cliente.id))
    guardarDb()
    return respuesta
  }),
]
