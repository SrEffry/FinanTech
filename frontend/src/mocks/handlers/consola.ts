import { http, HttpResponse } from 'msw'
import type { Bandeja, Concepto, ContextoDecision, EstadoSolicitud, ItemBandeja, NuevaDecision } from '../../lib/api/tipos'
import { enmascarar, formatoMoneda } from '../../lib/formato'
import { obtenerDb, parametrosVigentes, siguienteId, type SolicitudDb, type UsuarioDb } from '../db'
import { avanzarSolicitud, cambiarEstado, clienteDe, emitirOferta, semaforo } from '../flujo'
import { producto } from '../motor'
import { API, auditar, errorNegocio, errorValidacion, exigirSesion, leerJson, manejar, nombreCompleto } from '../utilidades'
import { expediente } from '../vistas'

const DIA = 86_400_000

const COLA_ANALISTA: EstadoSolicitud[] = ['EN_ESTUDIO', 'PENDIENTE_CLIENTE']
const COLA_OFICIAL: EstadoSolicitud[] = ['EN_DECISION', 'EN_COMITE']

function solicitudInterna(id: string): SolicitudDb {
  const solicitud = obtenerDb().solicitudes.find((s) => s.id === id && s.radicado)
  if (!solicitud) throw errorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404)
  avanzarSolicitud(solicitud)
  return solicitud
}

/** RN-55 y RN-56: nadie decide sobre sí mismo, sobre un relacionado, ni si parametrizó. */
function bloqueoDecision(oficial: UsuarioDb, solicitud: SolicitudDb): ContextoDecision['bloqueo'] {
  if (solicitud.cliente_id === oficial.id || oficial.relacionados?.includes(solicitud.cliente_id)) {
    return {
      codigo: 'conflicto_interes',
      mensaje:
        'Tienes un vínculo registrado con este cliente, así que no puedes decidir esta solicitud. Pide que la reasignen a otro oficial.',
    }
  }
  if (oficial.funciones_ejercidas?.includes('parametrizar')) {
    return {
      codigo: 'segregacion',
      mensaje: 'Publicaste parámetros de crédito, así que no puedes decidir solicitudes (segregación de funciones).',
    }
  }
  return null
}

function itemBandeja(solicitud: SolicitudDb): ItemBandeja {
  const cliente = clienteDe(solicitud)
  return {
    id: solicitud.id,
    radicado: solicitud.radicado ?? '',
    cliente: nombreCompleto(cliente),
    documento_enmascarado: enmascarar(cliente.num_documento),
    producto: producto(parametrosVigentes(), solicitud.producto).nombre,
    monto: solicitud.monto,
    estado: solicitud.estado,
    en_cola_desde: solicitud.en_cola_desde ?? solicitud.actualizada_en,
    sla_vence_en: solicitud.sla_vence_en ?? solicitud.actualizada_en,
    semaforo: semaforo(solicitud.en_cola_desde, solicitud.sla_vence_en),
    reconsideracion: solicitud.reconsideracion?.estado === 'en_revision',
  }
}

export const handlersConsola = [
  http.get(
    `${API}/originacion/bandeja`,
    manejar(({ request }) => {
      const usuario = exigirSesion(['analista', 'oficial'])
      const db = obtenerDb()
      db.solicitudes.forEach((s) => avanzarSolicitud(s))
      const filtros = new URL(request.url).searchParams
      const propias =
        usuario.rol === 'analista'
          ? db.solicitudes.filter((s) => s.analista_id === usuario.id && COLA_ANALISTA.includes(s.estado))
          : db.solicitudes.filter((s) => COLA_OFICIAL.includes(s.estado))
      const items = propias.map(itemBandeja)
      const montoMin = Number(filtros.get('monto_min') ?? 0)
      const montoMax = Number(filtros.get('monto_max') ?? Number.POSITIVE_INFINITY)
      const filtradas = items.filter(
        (i) =>
          (!filtros.get('estado') || i.estado === filtros.get('estado')) &&
          (!filtros.get('producto') || i.producto === filtros.get('producto')) &&
          i.monto >= montoMin &&
          i.monto <= montoMax,
      )
      const hoy = new Date().toDateString()
      const atendidasHoy = db.solicitudes.filter(
        (s) =>
          s.atendida_en &&
          new Date(s.atendida_en).toDateString() === hoy &&
          (usuario.rol === 'analista' ? s.analista_id === usuario.id : s.decisiones.some((d) => d.autor_id === usuario.id)),
      ).length
      const bandeja: Bandeja = {
        indicadores: {
          asignadas: items.length,
          atendidas_hoy: atendidasHoy,
          pendientes: items.filter((i) => i.estado === (usuario.rol === 'analista' ? 'EN_ESTUDIO' : 'EN_DECISION')).length,
          proximas_a_vencer: items.filter((i) => i.semaforo !== 'a_tiempo').length,
        },
        solicitudes: [...filtradas].sort((a, b) => a.sla_vence_en.localeCompare(b.sla_vence_en)),
      }
      return HttpResponse.json(bandeja)
    }),
  ),

  http.get(
    `${API}/originacion/expedientes/:id`,
    manejar(({ params }) => {
      exigirSesion(['analista', 'oficial'])
      return HttpResponse.json(expediente(solicitudInterna(String(params.id))))
    }),
  ),

  http.post(
    `${API}/originacion/expedientes/:id/observaciones`,
    manejar(async ({ request, params }) => {
      const usuario = exigirSesion(['analista', 'oficial'])
      const solicitud = solicitudInterna(String(params.id))
      const { texto = '' } = await leerJson<{ texto: string }>(request)
      if (texto.trim().length < 5) return errorValidacion({ texto: 'Escribe la observación.' })
      const observacion = {
        id: siguienteId('observacion'),
        autor: nombreCompleto(usuario),
        rol: usuario.rol,
        texto: texto.trim(),
        fecha: new Date().toISOString(),
      }
      solicitud.observaciones.push(observacion)
      auditar(usuario, 'Observación registrada', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(observacion, { status: 201 })
    }),
  ),

  // UC8: el analista marca los documentos que necesita, con un motivo por cada uno.
  http.post(
    `${API}/originacion/expedientes/:id/documentos-requeridos`,
    manejar(async ({ request, params }) => {
      const analista = exigirSesion(['analista'])
      const solicitud = solicitudInterna(String(params.id))
      if (solicitud.estado !== 'EN_ESTUDIO') {
        return errorNegocio('estado_invalido', 'Solo puedes pedir documentos mientras la solicitud está en estudio.', 409)
      }
      const { documentos = [] } = await leerJson<{ documentos: { tipo: string; motivo: string }[] }>(request)
      if (documentos.length === 0 || documentos.some((d) => d.motivo.trim().length < 10)) {
        return errorValidacion({ documentos: 'Elige al menos un documento y explica el motivo de cada uno.' })
      }
      for (const pedido of documentos) {
        const documento = solicitud.documentos.find((d) => d.tipo === pedido.tipo)
        if (documento) {
          documento.estado = 'rechazado'
          documento.motivo_rechazo = pedido.motivo.trim()
        } else {
          solicitud.documentos.push({
            tipo: pedido.tipo,
            nombre: 'Documento adicional',
            descripcion: pedido.motivo.trim(),
            requerido: true,
            estado: 'pendiente',
            motivo_rechazo: null,
            archivo: null,
          })
        }
      }
      const ahora = new Date()
      cambiarEstado(solicitud, 'PENDIENTE_CLIENTE', ahora)
      // UC8: si el cliente no carga en 15 días, la solicitud se desiste.
      solicitud.en_cola_desde = ahora.toISOString()
      solicitud.sla_vence_en = new Date(ahora.getTime() + 15 * DIA).toISOString()
      solicitud.atendida_en = ahora.toISOString()
      auditar(analista, 'Documentos pedidos al cliente', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(expediente(solicitud))
    }),
  ),

  http.get(
    `${API}/evaluacion/solicitudes/:id/evaluacion`,
    manejar(({ params }) => {
      exigirSesion(['analista', 'oficial'])
      const solicitud = solicitudInterna(String(params.id))
      const evaluacion = obtenerDb().evaluaciones.find((e) => e.id === solicitud.evaluacion_id)
      if (!evaluacion) {
        return errorNegocio(
          'sin_evaluacion',
          'Esta solicitud no tiene evaluación automática: la central de riesgo no respondió y pasó a estudio manual.',
          404,
        )
      }
      const { solicitud_id, ...vista } = evaluacion
      return HttpResponse.json(vista)
    }),
  ),

  http.post(
    `${API}/evaluacion/solicitudes/:id/concepto`,
    manejar(async ({ request, params }) => {
      const analista = exigirSesion(['analista'])
      const solicitud = solicitudInterna(String(params.id))
      if (solicitud.estado !== 'EN_ESTUDIO') {
        return errorNegocio('estado_invalido', 'Esta solicitud ya no está en estudio.', 409)
      }
      const { recomendacion, texto = '' } = await leerJson<{ recomendacion: Concepto['recomendacion']; texto: string }>(request)
      const errores: Record<string, string> = {}
      if (!['aprobar', 'aprobar_condicionado', 'negar'].includes(recomendacion ?? '')) errores.recomendacion = 'Elige tu recomendación.'
      if (texto.trim().length < 20) errores.texto = 'Explica tu concepto en al menos 20 caracteres.'
      if (Object.keys(errores).length > 0) return errorValidacion(errores)

      const ahora = new Date()
      solicitud.concepto = {
        recomendacion: recomendacion as Concepto['recomendacion'],
        texto: texto.trim(),
        autor: nombreCompleto(analista),
        fecha: ahora.toISOString(),
      }
      if (solicitud.reconsideracion?.estado === 'en_revision') {
        solicitud.reconsideracion = { ...solicitud.reconsideracion, estado: 'resuelta', respuesta: 'La revisamos y pasó a decisión de un oficial de crédito.' }
      }
      cambiarEstado(solicitud, 'EN_DECISION', ahora)
      solicitud.en_cola_desde = ahora.toISOString()
      solicitud.sla_vence_en = new Date(ahora.getTime() + DIA).toISOString()
      solicitud.atendida_en = ahora.toISOString()
      auditar(analista, 'Concepto emitido', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(expediente(solicitud))
    }),
  ),

  http.get(
    `${API}/evaluacion/decisiones/contexto/:id`,
    manejar(({ params }) => {
      const oficial = exigirSesion(['oficial'])
      const solicitud = solicitudInterna(String(params.id))
      const contexto: ContextoDecision = {
        atribucion_monto: oficial.atribucion_monto ?? 0,
        tasa_maxima_legal_ea: parametrosVigentes().tasa_maxima_legal_ea,
        bloqueo: bloqueoDecision(oficial, solicitud),
        decisiones_previas: solicitud.decisiones.map((d) => ({
          resultado: d.resultado === 'aprobada_automatica' ? 'aprobada' : d.resultado === 'negada_automatica' ? 'negada' : d.resultado,
          motivo: d.motivo,
          autor: d.autor,
          fecha: d.fecha,
          automatizada: d.automatizada,
        })),
      }
      return HttpResponse.json(contexto)
    }),
  ),

  // RF-10: todas las reglas de la decisión se verifican aquí, no en el portal.
  http.post(
    `${API}/evaluacion/decisiones`,
    manejar(async ({ request }) => {
      const oficial = exigirSesion(['oficial'])
      const datos = await leerJson<NuevaDecision>(request)
      const solicitud = solicitudInterna(String(datos.solicitud_id))
      const radicado = solicitud.radicado ?? solicitud.id
      if (solicitud.estado === 'EN_COMITE') {
        return errorNegocio('en_comite', 'Esta solicitud la decide el comité de crédito.', 409)
      }
      if (solicitud.estado !== 'EN_DECISION') {
        return errorNegocio('estado_invalido', 'Esta solicitud ya no está esperando decisión.', 409)
      }
      // RN-54: el motivo es obligatorio.
      const motivo = (datos.motivo ?? '').trim()
      if (motivo.length < 10) {
        return errorNegocio('motivo_requerido', 'Escribe el motivo de la decisión (al menos 10 caracteres).')
      }
      const bloqueo = bloqueoDecision(oficial, solicitud)
      if (bloqueo) {
        auditar(oficial, `Decisión rechazada: ${bloqueo.codigo}`, 'solicitud', radicado, { resultado: 'rechazado' })
        return errorNegocio(bloqueo.codigo, bloqueo.mensaje, 403)
      }

      const parametros = parametrosVigentes()
      const prod = producto(parametros, solicitud.producto)
      const resultado = datos.resultado
      const ahora = new Date()

      if (resultado === 'comite') {
        solicitud.decisiones.push({ resultado, motivo, autor_id: oficial.id, autor: nombreCompleto(oficial), fecha: ahora.toISOString(), automatizada: false })
        cambiarEstado(solicitud, 'EN_COMITE', ahora)
        solicitud.atendida_en = ahora.toISOString()
        auditar(oficial, 'Enviada a comité', 'solicitud', radicado)
        return HttpResponse.json(expediente(solicitud))
      }

      if (resultado !== 'aprobada' && resultado !== 'aprobada_condicionada' && resultado !== 'negada') {
        return errorNegocio('resultado_invalido', 'Elige aprobar, aprobar con condiciones, negar o enviar a comité.')
      }

      const condiciones =
        resultado === 'aprobada_condicionada' && datos.ajustes
          ? datos.ajustes
          : { monto: solicitud.monto, plazo_meses: solicitud.plazo_meses, tasa_ea: prod.tasa_ea }

      if (resultado !== 'negada') {
        // RN-53: atribución por monto.
        if (condiciones.monto > (oficial.atribucion_monto ?? 0)) {
          auditar(oficial, 'Decisión rechazada: fuera de atribución', 'solicitud', radicado, { resultado: 'rechazado' })
          return errorNegocio(
            'fuera_de_atribucion',
            `El monto supera tu atribución de ${formatoMoneda(oficial.atribucion_monto ?? 0)}. Envía la solicitud al comité.`,
            403,
          )
        }
        // RN-57: la tasa ajustada no supera la máxima legal.
        if (condiciones.tasa_ea > parametros.tasa_maxima_legal_ea) {
          return errorNegocio(
            'tasa_supera_maxima',
            `La tasa no puede pasar de la máxima legal (${parametros.tasa_maxima_legal_ea.toLocaleString('es-CO')} % E.A.).`,
          )
        }
        if (
          condiciones.monto < prod.monto_min ||
          condiciones.monto > prod.monto_max ||
          condiciones.plazo_meses < prod.plazo_min ||
          condiciones.plazo_meses > prod.plazo_max
        ) {
          return errorNegocio('ajuste_fuera_de_rango', 'El monto o el plazo ajustados están fuera del rango del producto.')
        }
      }

      solicitud.decisiones.push({
        resultado,
        motivo,
        autor_id: oficial.id,
        autor: nombreCompleto(oficial),
        fecha: ahora.toISOString(),
        automatizada: false,
        ajustes: resultado === 'aprobada_condicionada' ? condiciones : undefined,
      })
      solicitud.atendida_en = ahora.toISOString()
      solicitud.en_cola_desde = null
      solicitud.sla_vence_en = null
      if (!oficial.funciones_ejercidas?.includes('aprobar')) {
        oficial.funciones_ejercidas = [...(oficial.funciones_ejercidas ?? []), 'aprobar']
      }

      if (resultado === 'negada') {
        cambiarEstado(solicitud, 'NEGADA', ahora)
        auditar(oficial, 'Solicitud negada', 'solicitud', radicado)
      } else {
        cambiarEstado(solicitud, resultado === 'aprobada' ? 'APROBADA' : 'APROBADA_CONDICIONADA', ahora)
        emitirOferta(solicitud, condiciones, resultado === 'aprobada_condicionada' ? motivo : null, ahora)
        auditar(oficial, resultado === 'aprobada' ? 'Solicitud aprobada' : 'Aprobada con condiciones', 'solicitud', radicado)
      }
      return HttpResponse.json(expediente(solicitud))
    }),
  ),
]

