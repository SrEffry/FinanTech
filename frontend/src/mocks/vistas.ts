import type {
  AccionPendiente,
  ExplicacionDecision,
  Expediente,
  SolicitudDetalle,
  SolicitudResumen,
} from '../lib/api/tipos'
import { enmascarar, enmascararCorreo } from '../lib/formato'
import { calcularCredito } from './calculos'
import { obtenerDb, parametrosVigentes, type SolicitudDb } from './db'
import { clienteDe, semaforo } from './flujo'
import { capacidadPago, explicarVariable, producto } from './motor'
import { nombreCompleto } from './utilidades'

const DIA = 86_400_000
/** Plazo para pedir reconsideración (dato sintético; la ERS no lo fija). */
const PLAZO_RECONSIDERACION_DIAS = 30

function accionPendiente(solicitud: SolicitudDb): AccionPendiente | null {
  const oferta = obtenerDb().ofertas.find((o) => o.id === solicitud.oferta_id)
  switch (solicitud.estado) {
    case 'BORRADOR':
      return { tipo: 'borrador', texto: 'Termina de llenar tu solicitud y radícala.' }
    case 'PENDIENTE_CLIENTE':
      return { tipo: 'documentos', texto: 'Necesitamos que vuelvas a cargar un documento.' }
    case 'APROBADA':
    case 'APROBADA_CONDICIONADA':
      return oferta?.estado === 'vigente'
        ? { tipo: 'oferta', texto: 'Tienes una oferta lista para revisar y firmar.', oferta_id: oferta.id }
        : null
    case 'NEGADA':
      return { tipo: 'decision', texto: 'Conoce por qué no fue aprobada y qué puedes hacer.' }
    default:
      return null
  }
}

export function resumenSolicitud(solicitud: SolicitudDb): SolicitudResumen {
  const prod = producto(parametrosVigentes(), solicitud.producto)
  return {
    id: solicitud.id,
    radicado: solicitud.radicado,
    producto: { codigo: prod.codigo, nombre: prod.nombre },
    monto: solicitud.monto,
    plazo_meses: solicitud.plazo_meses,
    estado: solicitud.estado,
    creada_en: solicitud.creada_en,
    actualizada_en: solicitud.actualizada_en,
    accion_pendiente: accionPendiente(solicitud),
  }
}

export function detalleSolicitud(solicitud: SolicitudDb): SolicitudDetalle {
  const parametros = parametrosVigentes()
  const prod = producto(parametros, solicitud.producto)
  const credito = calcularCredito(prod.tasa_ea, solicitud.monto, solicitud.plazo_meses, parametros.tasa_maxima_legal_ea)
  const cliente = clienteDe(solicitud)
  const { ingreso_mensual, egreso_mensual } = solicitud.financiero
  return {
    ...resumenSolicitud(solicitud),
    tasa_ea: credito.tasa_ea,
    cuota_estimada: credito.cuota,
    datos_conocidos: {
      nombre_completo: nombreCompleto(cliente),
      documento_enmascarado: enmascarar(cliente.num_documento),
      fecha_nacimiento: cliente.fecha_nacimiento ?? '',
      email: cliente.email,
      telefono_enmascarado: enmascarar(cliente.telefono),
    },
    laboral: solicitud.laboral,
    financiero: solicitud.financiero,
    referencia: solicitud.referencia,
    documentos: solicitud.documentos,
    acepta_consulta_centrales: solicitud.acepta_consulta_centrales,
    capacidad_pago:
      ingreso_mensual !== null && egreso_mensual !== null
        ? capacidadPago(credito.cuota, ingreso_mensual, egreso_mensual, parametros.limite_cuota_ingreso)
        : null,
    historial: solicitud.historial,
    oferta_id: solicitud.oferta_id,
    borrador_vence_en:
      solicitud.estado === 'BORRADOR' ? new Date(new Date(solicitud.creada_en).getTime() + 30 * DIA).toISOString() : null,
  }
}

export function explicacion(solicitud: SolicitudDb): ExplicacionDecision | null {
  const decisiones = solicitud.decisiones.filter((d) => d.resultado !== 'comite')
  const decision = decisiones[decisiones.length - 1]
  if (!decision) return null
  const evaluacion = obtenerDb().evaluaciones.find((e) => e.id === solicitud.evaluacion_id)
  const resultado: ExplicacionDecision['resultado'] = decision.resultado.startsWith('negada')
    ? 'negada'
    : decision.resultado === 'aprobada_condicionada'
      ? 'aprobada_condicionada'
      : 'aprobada'
  const venceReconsideracion = new Date(new Date(decision.fecha).getTime() + PLAZO_RECONSIDERACION_DIAS * DIA)
  const variables = (evaluacion?.variables ?? [])
    .filter((v) => (resultado === 'negada' ? v.contribucion < 0 : true))
    .slice(0, 3)
    .map((v) => ({
      nombre: v.nombre,
      efecto: v.contribucion >= 0 ? ('favorable' as const) : ('desfavorable' as const),
      explicacion: explicarVariable(v.codigo, v.contribucion),
    }))
  return {
    resultado,
    automatizada: decision.automatizada,
    motivo_principal: decision.motivo,
    variables,
    decidida_en: decision.fecha,
    condicion:
      resultado === 'aprobada_condicionada'
        ? (obtenerDb().ofertas.find((o) => o.id === solicitud.oferta_id)?.motivo_condicion ?? decision.motivo)
        : null,
    reconsideracion: solicitud.reconsideracion,
    puede_reconsiderar:
      solicitud.estado === 'NEGADA' && !solicitud.reconsideracion && venceReconsideracion.getTime() > Date.now(),
    reconsideracion_vence_en: resultado === 'negada' ? venceReconsideracion.toISOString() : null,
    radicado: solicitud.radicado ?? '',
    producto: producto(parametrosVigentes(), solicitud.producto).nombre,
  }
}

function edad(fechaNacimiento: string): number {
  const nacimiento = new Date(fechaNacimiento)
  const hoy = new Date()
  let anios = hoy.getFullYear() - nacimiento.getFullYear()
  const cumplio =
    hoy.getMonth() > nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate())
  if (!cumplio) anios -= 1
  return anios
}

export function expediente(solicitud: SolicitudDb): Expediente {
  const db = obtenerDb()
  const cliente = clienteDe(solicitud)
  const analista = db.usuarios.find((u) => u.id === solicitud.analista_id)
  return {
    solicitud: detalleSolicitud(solicitud),
    solicitante: {
      nombre_completo: nombreCompleto(cliente),
      documento_enmascarado: enmascarar(cliente.num_documento),
      edad: edad(cliente.fecha_nacimiento ?? '2000-01-01'),
      email: enmascararCorreo(cliente.email),
      telefono_enmascarado: enmascarar(cliente.telefono),
      cliente_desde: cliente.cliente_desde ?? solicitud.creada_en,
      estado_kyc: cliente.estado_kyc ?? 'pendiente',
    },
    historial_finantech: db.solicitudes
      .filter((s) => s.cliente_id === cliente.id && s.id !== solicitud.id && s.radicado)
      .map((s) => ({
        radicado: s.radicado as string,
        producto: producto(parametrosVigentes(), s.producto).nombre,
        monto: s.monto,
        estado: s.estado,
        fecha: s.radicada_en ?? s.creada_en,
      })),
    central: solicitud.central,
    observaciones: [...solicitud.observaciones].reverse(),
    concepto: solicitud.concepto,
    analista: analista ? nombreCompleto(analista) : null,
    sla_vence_en: solicitud.sla_vence_en ?? solicitud.actualizada_en,
    semaforo: semaforo(solicitud.en_cola_desde, solicitud.sla_vence_en),
    reconsideracion: solicitud.reconsideracion,
  }
}
