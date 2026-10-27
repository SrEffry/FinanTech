import { http, HttpResponse } from 'msw'
import type { Consentimientos, EscenarioSimulado, VerificacionIdentidad } from '../../lib/api/tipos'
import { obtenerDb, siguienteId, type UsuarioDb } from '../db'
import { FINALIDADES, POLITICA } from '../semilla'
import { API, auditar, errorNegocio, errorValidacion, exigirSesion, leerJson, manejar } from '../utilidades'

const MAXIMO_INTENTOS_KYC = 5

function estadoVerificacion(cliente: UsuarioDb): VerificacionIdentidad {
  return {
    estado_kyc: cliente.estado_kyc ?? 'pendiente',
    resultado: null,
    coincidencia: null,
    mensaje: null,
    intentos_restantes: Math.max(0, MAXIMO_INTENTOS_KYC - (cliente.intentos_kyc ?? 0)),
    simulado: true,
  }
}

function consentimientos(usuarioId: number): Consentimientos {
  const historial = obtenerDb()
    .consentimientos.filter((c) => c.usuario_id === usuarioId)
    .sort((a, b) => a.fecha_registro.localeCompare(b.fecha_registro))
  return {
    politica: POLITICA,
    finalidades: FINALIDADES.map((f) => {
      const ultimo = [...historial].reverse().find((c) => c.finalidad === f.codigo)
      return { ...f, otorgada: ultimo?.accion === 'otorga', actualizada_en: ultimo?.fecha_registro ?? null }
    }),
    historial: [...historial].reverse().map((c) => ({
      id: c.id,
      finalidad: c.finalidad,
      nombre_finalidad: FINALIDADES.find((f) => f.codigo === c.finalidad)?.nombre ?? c.finalidad,
      accion: c.accion,
      canal: c.canal,
      version_politica: c.version_politica,
      fecha_registro: c.fecha_registro,
    })),
  }
}

const ESCENARIOS: EscenarioSimulado[] = ['exito', 'coincidencia_baja', 'documento_ilegible', 'servicio_caido', 'lista_restrictiva']

export const handlersIdentidad = [
  http.get(
    `${API}/clientes/verificacion-identidad`,
    manejar(() => HttpResponse.json(estadoVerificacion(exigirSesion(['cliente'])))),
  ),

  http.post(
    `${API}/clientes/verificacion-identidad`,
    manejar(async ({ request }) => {
      const cliente = exigirSesion(['cliente'])
      const formulario = await request.formData()
      const faltantes: Record<string, string> = {}
      if (!(formulario.get('documento_frente') instanceof Blob)) faltantes.documento_frente = 'Falta la foto del frente del documento.'
      if (!(formulario.get('documento_reverso') instanceof Blob)) faltantes.documento_reverso = 'Falta la foto del reverso del documento.'
      if (!(formulario.get('rostro') instanceof Blob)) faltantes.rostro = 'Falta la foto de tu rostro.'
      if (Object.keys(faltantes).length > 0) return errorValidacion(faltantes)

      if (cliente.estado_kyc === 'verificado') {
        return errorNegocio('identidad_ya_verificada', 'Tu identidad ya está verificada.', 409)
      }
      if (cliente.estado_kyc === 'bloqueado' || cliente.estado_kyc === 'revision_manual') {
        return HttpResponse.json(estadoVerificacion(cliente))
      }

      const pedido = String(formulario.get('escenario') ?? 'exito') as EscenarioSimulado
      const escenario = ESCENARIOS.includes(pedido) ? pedido : 'exito'
      const respuesta = estadoVerificacion(cliente)

      switch (escenario) {
        case 'exito':
          cliente.estado_kyc = 'verificado'
          Object.assign(respuesta, {
            estado_kyc: 'verificado',
            resultado: 'verificado',
            coincidencia: 0.93,
            mensaje: 'Verificamos tu identidad. Ya puedes solicitar créditos.',
          })
          break
        case 'coincidencia_baja':
          // RF-02 FA-02 / RN-08: por debajo de 0,85 pasa a verificación manual.
          cliente.estado_kyc = 'revision_manual'
          Object.assign(respuesta, {
            estado_kyc: 'revision_manual',
            resultado: 'revision_manual',
            coincidencia: 0.71,
            mensaje:
              'No pudimos confirmar que tu foto coincide con el documento. Una persona de nuestro equipo lo revisará y te avisaremos por correo en máximo un día hábil.',
          })
          break
        case 'documento_ilegible':
          cliente.intentos_kyc = (cliente.intentos_kyc ?? 0) + 1
          if (cliente.intentos_kyc >= MAXIMO_INTENTOS_KYC) {
            // RN-11: al quinto intento pasa a verificación manual.
            cliente.estado_kyc = 'revision_manual'
            Object.assign(respuesta, {
              estado_kyc: 'revision_manual',
              resultado: 'revision_manual',
              intentos_restantes: 0,
              mensaje:
                'Hiciste varios intentos sin que pudiéramos leer el documento. Una persona de nuestro equipo lo revisará y te avisaremos por correo.',
            })
          } else {
            Object.assign(respuesta, {
              resultado: 'ilegible',
              intentos_restantes: MAXIMO_INTENTOS_KYC - cliente.intentos_kyc,
              mensaje:
                'No pudimos leer tu documento: la foto salió borrosa o con reflejos. Tómala de nuevo sobre una superficie oscura y con buena luz.',
            })
          }
          break
        case 'servicio_caido':
          Object.assign(respuesta, {
            resultado: 'en_cola',
            mensaje:
              'El servicio de verificación no responde en este momento. Guardamos tus fotos y lo intentaremos de nuevo; te avisaremos por correo.',
          })
          break
        case 'lista_restrictiva':
          // RN-10: el resultado de listas restrictivas nunca se revela al cliente.
          cliente.estado_kyc = 'bloqueado'
          Object.assign(respuesta, {
            estado_kyc: 'bloqueado',
            resultado: 'no_continua',
            mensaje:
              'No podemos continuar con tu vinculación en este momento. Si necesitas más información, comunícate con nuestros canales de atención.',
          })
          break
      }

      auditar('Verificación de identidad', `Verificación de identidad: ${respuesta.resultado}`, 'cliente', String(cliente.id), {
        simulado: true,
        origen: 'Servicio externo',
        resultado: respuesta.resultado === 'verificado' ? 'exito' : 'rechazado',
      })
      return HttpResponse.json(respuesta)
    }),
  ),

  http.get(
    `${API}/identidad/consentimientos`,
    manejar(() => HttpResponse.json(consentimientos(exigirSesion(['cliente']).id))),
  ),

  http.post(
    `${API}/identidad/consentimientos`,
    manejar(async ({ request }) => {
      const cliente = exigirSesion(['cliente'])
      const { finalidad, accion } = await leerJson<{ finalidad: string; accion: 'otorga' | 'revoca' }>(request)
      if (!FINALIDADES.some((f) => f.codigo === finalidad) || (accion !== 'otorga' && accion !== 'revoca')) {
        return errorNegocio('finalidad_invalida', 'Esa finalidad no existe en la política vigente.')
      }
      const actual = consentimientos(cliente.id).finalidades.find((f) => f.codigo === finalidad)
      if ((actual?.otorgada ?? false) !== (accion === 'otorga')) {
        // Solo adición (RN-22): cada cambio es un registro nuevo; nunca se edita el anterior.
        obtenerDb().consentimientos.push({
          id: siguienteId('consentimiento'),
          usuario_id: cliente.id,
          finalidad: finalidad as string,
          accion,
          canal: 'web',
          version_politica: POLITICA.version,
          fecha_registro: new Date().toISOString(),
        })
        auditar(cliente, accion === 'otorga' ? 'Consentimiento otorgado' : 'Consentimiento revocado', 'consentimiento', finalidad as string)
      }
      return HttpResponse.json(consentimientos(cliente.id))
    }),
  ),
]
