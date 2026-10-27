import type { DesafioMfa, EstadoSolicitud, Semaforo } from '../lib/api/tipos'
import { enmascararCorreo } from '../lib/formato'
import { obtenerDb, parametrosVigentes, siguienteId, type DesafioDb, type OfertaDb, type SolicitudDb, type UsuarioDb } from './db'
import { calcularEvaluacion, centralDisponible, construirOferta, consultarCentral } from './motor'
import { auditar, errorNegocio, generarCodigo } from './utilidades'

const SEGUNDO = 1000
const HORA = 3_600_000
const DIA = 24 * HORA

/** Tiempos de la evaluación simulada: así se ve el seguimiento en vivo (RN-34). */
const PASA_A_EVALUACION = 4 * SEGUNDO
const TERMINA_EVALUACION = 9 * SEGUNDO

export function cambiarEstado(solicitud: SolicitudDb, estado: EstadoSolicitud, ahora = new Date()): void {
  solicitud.estado = estado
  solicitud.actualizada_en = ahora.toISOString()
  solicitud.historial.push({ estado, fecha: ahora.toISOString() })
}

export function clienteDe(solicitud: SolicitudDb): UsuarioDb {
  return obtenerDb().usuarios.find((u) => u.id === solicitud.cliente_id) as UsuarioDb
}

/** Reparte el estudio entre analistas activos, al que tenga menos solicitudes en cola. */
export function asignarAnalista(): number | null {
  const db = obtenerDb()
  const analistas = db.usuarios.filter((u) => u.rol === 'analista' && u.estado === 'activo')
  if (analistas.length === 0) return null
  const carga = (id: number) =>
    db.solicitudes.filter((s) => s.analista_id === id && ['EN_ESTUDIO', 'PENDIENTE_CLIENTE'].includes(s.estado)).length
  return [...analistas].sort((a, b) => carga(a.id) - carga(b.id))[0].id
}

export function enviarAEstudio(solicitud: SolicitudDb, ahora: Date): void {
  cambiarEstado(solicitud, 'EN_ESTUDIO', ahora)
  solicitud.analista_id ??= asignarAnalista()
  solicitud.en_cola_desde = ahora.toISOString()
  solicitud.sla_vence_en = new Date(ahora.getTime() + 2 * DIA).toISOString()
}

export function emitirOferta(
  solicitud: SolicitudDb,
  condiciones: { monto: number; plazo_meses: number; tasa_ea: number },
  motivoCondicion: string | null,
  ahora: Date,
): OfertaDb {
  const db = obtenerDb()
  const oferta = construirOferta(
    `of-${siguienteId('oferta')}`,
    solicitud,
    clienteDe(solicitud),
    parametrosVigentes(ahora),
    condiciones,
    motivoCondicion,
    ahora,
  )
  db.ofertas.push(oferta)
  solicitud.oferta_id = oferta.id
  auditar('Sistema', 'Oferta emitida', 'oferta', oferta.id)
  return oferta
}

/**
 * Hace avanzar la evaluación automática simulada según el tiempo transcurrido desde la
 * radicación. Se llama cada vez que alguien lee la solicitud.
 */
export function avanzarSolicitud(solicitud: SolicitudDb, ahora = new Date()): void {
  if (!solicitud.avance_desde) return
  const transcurrido = ahora.getTime() - new Date(solicitud.avance_desde).getTime()

  if (solicitud.estado === 'RADICADA' && transcurrido >= PASA_A_EVALUACION) {
    cambiarEstado(solicitud, 'EN_EVALUACION', new Date(new Date(solicitud.avance_desde).getTime() + PASA_A_EVALUACION))
  }
  if (solicitud.estado !== 'EN_EVALUACION' || transcurrido < TERMINA_EVALUACION) return

  const db = obtenerDb()
  const momento = new Date(new Date(solicitud.avance_desde).getTime() + TERMINA_EVALUACION)
  solicitud.avance_desde = null
  const cliente = clienteDe(solicitud)
  const radicado = solicitud.radicado ?? solicitud.id

  // RF-08 FA-02: si la central no responde, la solicitud pasa a estudio; nunca se niega por eso.
  if (!centralDisponible(cliente.num_documento ?? '')) {
    auditar('Central de riesgo', 'Consulta a central de riesgo', 'solicitud', radicado, {
      simulado: true,
      resultado: 'rechazado',
      origen: 'Servicio externo',
    })
    solicitud.observaciones.push({
      id: siguienteId('observacion'),
      autor: 'Motor de reglas',
      rol: 'analista',
      texto: 'La central de riesgo no respondió. La solicitud pasó a estudio manual sin evaluación automática (RF-08 FA-02).',
      fecha: momento.toISOString(),
    })
    enviarAEstudio(solicitud, momento)
    return
  }

  const parametros = parametrosVigentes(momento)
  solicitud.central = consultarCentral(cliente, solicitud.financiero.ingreso_mensual ?? 0, momento)
  auditar('Central de riesgo', 'Consulta a central de riesgo', 'solicitud', radicado, {
    simulado: true,
    origen: 'Servicio externo',
  })
  const evaluacion = calcularEvaluacion(`ev-${siguienteId('evaluacion')}`, solicitud, cliente, solicitud.central, parametros, momento)
  db.evaluaciones.push(evaluacion)
  solicitud.evaluacion_id = evaluacion.id
  auditar('Motor de reglas', `Evaluación: puntaje ${evaluacion.puntaje}`, 'solicitud', radicado)

  if (evaluacion.decision_sugerida === 'aprobar') {
    solicitud.decisiones.push({
      resultado: 'aprobada_automatica',
      motivo: 'Tu perfil cumple las condiciones del producto.',
      autor_id: null,
      autor: 'Motor de reglas',
      fecha: momento.toISOString(),
      automatizada: true,
    })
    cambiarEstado(solicitud, 'APROBADA', momento)
    const producto = parametros.productos.find((p) => p.codigo === solicitud.producto)
    emitirOferta(
      solicitud,
      { monto: solicitud.monto, plazo_meses: solicitud.plazo_meses, tasa_ea: producto?.tasa_ea ?? 0 },
      null,
      momento,
    )
  } else if (evaluacion.decision_sugerida === 'negar') {
    const principal = [...evaluacion.variables].sort((a, b) => a.contribucion - b.contribucion)[0]
    solicitud.decisiones.push({
      resultado: 'negada_automatica',
      motivo:
        principal?.codigo === 'cuota_ingreso'
          ? 'La cuota pedida ocupa más del 40 % de tu ingreso disponible.'
          : 'Tu historial reciente con otras entidades no cumple las condiciones del producto.',
      autor_id: null,
      autor: 'Motor de reglas',
      fecha: momento.toISOString(),
      automatizada: true,
    })
    cambiarEstado(solicitud, 'NEGADA', momento)
  } else {
    enviarAEstudio(solicitud, momento)
  }
}

/** La oferta vence a los 15 días calendario (RN-59, RF-11 FA-01). */
export function revisarVencimiento(oferta: OfertaDb, ahora = new Date()): void {
  if (oferta.estado !== 'vigente' || new Date(oferta.vence_en) > ahora) return
  oferta.estado = 'vencida'
  const solicitud = obtenerDb().solicitudes.find((s) => s.id === oferta.solicitud_id)
  if (solicitud) cambiarEstado(solicitud, 'OFERTA_VENCIDA', new Date(oferta.vence_en))
}

export function semaforo(enColaDesde: string | null, venceEn: string | null, ahora = Date.now()): Semaforo {
  if (!enColaDesde || !venceEn) return 'a_tiempo'
  const total = new Date(venceEn).getTime() - new Date(enColaDesde).getTime()
  const restante = new Date(venceEn).getTime() - ahora
  if (restante <= 0) return 'vencida'
  return restante / total <= 0.25 ? 'por_vencer' : 'a_tiempo'
}

// ── Segundo factor ──────────────────────────────────────────────────────────

export function crearDesafio(usuario: UsuarioDb, proposito: DesafioDb['proposito'], ofertaId?: string): DesafioMfa {
  const db = obtenerDb()
  const ahora = Date.now()
  db.desafios = db.desafios.filter((d) => !(d.usuario_id === usuario.id && d.proposito === proposito))
  const desafio: DesafioDb = {
    id: crypto.randomUUID(),
    usuario_id: usuario.id,
    proposito,
    oferta_id: ofertaId,
    codigo: generarCodigo(),
    expira_en: new Date(ahora + 5 * 60_000).toISOString(),
    reenvio_disponible_en: new Date(ahora + 60_000).toISOString(),
    intentos: 0,
  }
  db.desafios.push(desafio)
  return publicarDesafio(desafio, usuario)
}

export function publicarDesafio(desafio: DesafioDb, usuario: UsuarioDb): DesafioMfa {
  return {
    desafio_id: desafio.id,
    enviado_a: enmascararCorreo(usuario.email),
    expira_en: desafio.expira_en,
    reenvio_disponible_en: desafio.reenvio_disponible_en,
    codigo_demo: desafio.codigo,
  }
}

/** Valida el código y consume el desafío. Lanza el error de negocio que corresponda. */
export function consumirDesafio(desafioId: string, codigo: string, proposito: DesafioDb['proposito']): DesafioDb {
  const db = obtenerDb()
  const desafio = db.desafios.find((d) => d.id === desafioId && d.proposito === proposito)
  if (!desafio || new Date(desafio.expira_en).getTime() < Date.now()) {
    throw errorNegocio('codigo_vencido', 'El código venció. Pide uno nuevo.')
  }
  if (desafio.codigo !== codigo) {
    desafio.intentos += 1
    if (desafio.intentos >= 5) {
      db.desafios = db.desafios.filter((d) => d.id !== desafio.id)
      throw errorNegocio('intentos_agotados', 'Superaste los intentos permitidos. Vuelve a empezar.')
    }
    throw errorNegocio('codigo_incorrecto', 'El código no es correcto.', 422, { intentos_restantes: 5 - desafio.intentos })
  }
  db.desafios = db.desafios.filter((d) => d.id !== desafio.id)
  return desafio
}
