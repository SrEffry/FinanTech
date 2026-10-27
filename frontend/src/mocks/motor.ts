import type {
  CapacidadPago,
  CondicionesOferta,
  ConsultaCentral,
  DatosLaborales,
  DocumentoSolicitud,
  ParametrosVersion,
  Producto,
  VariableEvaluacion,
} from '../lib/api/tipos'
import { formatoMoneda } from '../lib/formato'
import { calcularCredito } from './calculos'
import type { EvaluacionDb, OfertaDb, SolicitudDb, UsuarioDb } from './db'

/**
 * Motor de reglas de la API simulada (RF-08). Funciones puras: no tocan la base.
 * Variables permitidas solamente: nada de sexo, estado civil, origen étnico, religión,
 * afiliación política ni salud, ni sus aproximaciones (RN-43).
 */

export const VERSION_REGLAS = 'R-2026.10-1'

const DIA = 86_400_000

export function producto(parametros: ParametrosVersion, codigo: string): Producto {
  const encontrado = parametros.productos.find((p) => p.codigo === codigo)
  if (!encontrado) throw new Error(`Producto desconocido: ${codigo}`)
  return encontrado
}

/** Documentos requeridos según el perfil laboral (8.2.3). La identidad ya está verificada (RN-32). */
export function documentosRequeridos(
  ocupacion: DatosLaborales['ocupacion'],
  existentes: DocumentoSolicitud[] = [],
): DocumentoSolicitud[] {
  const catalogo: Record<string, Pick<DocumentoSolicitud, 'nombre' | 'descripcion'>> = {
    certificado_laboral: {
      nombre: 'Certificado laboral',
      descripcion: 'Con cargo, salario y fecha de ingreso, de máximo 30 días.',
    },
    desprendibles_nomina: {
      nombre: 'Desprendibles de nómina',
      descripcion: 'Los dos últimos.',
    },
    extractos_bancarios: {
      nombre: 'Extractos bancarios',
      descripcion: 'De los últimos tres meses, de la cuenta donde recibes tus ingresos.',
    },
    declaracion_renta: {
      nombre: 'Declaración de renta',
      descripcion: 'La del último año gravable, si declaras.',
    },
    desprendible_pension: {
      nombre: 'Desprendible de pensión',
      descripcion: 'El último que recibiste.',
    },
  }
  const porPerfil: Record<string, { tipo: string; requerido: boolean }[]> = {
    empleado: [
      { tipo: 'certificado_laboral', requerido: true },
      { tipo: 'desprendibles_nomina', requerido: true },
    ],
    independiente: [
      { tipo: 'extractos_bancarios', requerido: true },
      { tipo: 'declaracion_renta', requerido: false },
    ],
    pensionado: [{ tipo: 'desprendible_pension', requerido: true }],
    '': [],
  }
  return porPerfil[ocupacion].map(({ tipo, requerido }) => {
    const previo = existentes.find((d) => d.tipo === tipo)
    return (
      previo ?? {
        tipo,
        ...catalogo[tipo],
        requerido,
        estado: 'pendiente',
        motivo_rechazo: null,
        archivo: null,
      }
    )
  })
}

/** Perfil crediticio sintético y estable por documento: 0 (malo) a 0,9 (excelente). */
export function perfilCentral(numDocumento: string): number {
  const suma = numDocumento.split('').reduce((total, c) => total + (Number.parseInt(c, 10) || 0), 0)
  return (suma % 10) / 10
}

/** La central simulada "se cae" para documentos que terminan en 0 (RF-08 FA-02). */
export function centralDisponible(numDocumento: string): boolean {
  return !numDocumento.endsWith('0')
}

export function consultarCentral(cliente: UsuarioDb, ingreso: number, ahora: Date): ConsultaCentral {
  const perfil = perfilCentral(cliente.num_documento ?? '')
  return {
    fuente: 'simulada',
    consultada_en: ahora.toISOString(),
    obligaciones_vigentes: Math.round((1 - perfil) * 6),
    saldo_total: Math.round((ingreso * (1 - perfil) * 10) / 10_000) * 10_000,
    mora_maxima_dias: perfil > 0.7 ? 0 : perfil > 0.4 ? 30 : 60,
    consultas_ultimos_6_meses: Math.round((1 - perfil) * 6),
    calificacion: perfil > 0.7 ? 'A' : perfil > 0.4 ? 'B' : 'C',
  }
}

export function capacidadPago(
  cuota: number,
  ingreso: number | null,
  egreso: number | null,
  limite: number,
): CapacidadPago {
  const disponible = Math.max(0, (ingreso ?? 0) - (egreso ?? 0))
  const porcentaje = disponible > 0 ? (cuota / disponible) * 100 : 100
  return {
    cuota_estimada: cuota,
    ingreso_disponible: disponible,
    porcentaje: Number(porcentaje.toFixed(1)),
    limite,
    supera_limite: porcentaje > limite,
  }
}

export function calcularEvaluacion(
  id: string,
  solicitud: SolicitudDb,
  cliente: UsuarioDb,
  central: ConsultaCentral,
  parametros: ParametrosVersion,
  ahora: Date,
): EvaluacionDb {
  const prod = producto(parametros, solicitud.producto)
  const credito = calcularCredito(prod.tasa_ea, solicitud.monto, solicitud.plazo_meses, parametros.tasa_maxima_legal_ea)
  const capacidad = capacidadPago(
    credito.cuota,
    solicitud.financiero.ingreso_mensual,
    solicitud.financiero.egreso_mensual,
    parametros.limite_cuota_ingreso,
  )
  const ingreso = solicitud.financiero.ingreso_mensual ?? 0
  const meses = solicitud.laboral.antiguedad_laboral_meses ?? 0
  const mesesCliente = cliente.cliente_desde
    ? Math.floor((ahora.getTime() - new Date(cliente.cliente_desde).getTime()) / (30 * DIA))
    : 0
  const endeudamiento = ingreso > 0 ? central.saldo_total / ingreso : 10

  const variables: VariableEvaluacion[] = [
    {
      codigo: 'comportamiento_pago',
      nombre: 'Comportamiento de pago en centrales',
      valor:
        central.mora_maxima_dias === 0
          ? 'Al día en los últimos 24 meses'
          : `Mora máxima de ${central.mora_maxima_dias} días`,
      contribucion: central.mora_maxima_dias === 0 ? 140 : central.mora_maxima_dias <= 30 ? 30 : -160,
    },
    {
      codigo: 'cuota_ingreso',
      nombre: 'Cuota frente al ingreso disponible',
      valor: `${capacidad.porcentaje.toLocaleString('es-CO')} %`,
      contribucion:
        capacidad.porcentaje <= 20 ? 110 : capacidad.porcentaje <= 30 ? 60 : capacidad.porcentaje <= 40 ? 10 : -170,
    },
    {
      codigo: 'endeudamiento',
      nombre: 'Endeudamiento con otras entidades',
      valor: `${formatoMoneda(central.saldo_total)} en ${central.obligaciones_vigentes} obligaciones`,
      contribucion: endeudamiento < 3 ? 50 : endeudamiento < 6 ? 0 : -60,
    },
    {
      codigo: 'antiguedad_laboral',
      nombre: 'Antigüedad en la actividad actual',
      valor: `${meses} meses`,
      contribucion: meses >= 24 ? 60 : meses >= 12 ? 30 : -30,
    },
    {
      codigo: 'consultas_recientes',
      nombre: 'Consultas recientes a centrales',
      valor: `${central.consultas_ultimos_6_meses} en 6 meses`,
      contribucion: central.consultas_ultimos_6_meses <= 2 ? 20 : central.consultas_ultimos_6_meses <= 4 ? 0 : -40,
    },
    {
      codigo: 'antiguedad_cliente',
      nombre: 'Antigüedad como cliente',
      valor: mesesCliente === 1 ? '1 mes' : `${mesesCliente} meses`,
      contribucion: mesesCliente >= 6 ? 20 : 0,
    },
  ].sort((a, b) => Math.abs(b.contribucion) - Math.abs(a.contribucion))

  const puntaje = Math.max(0, Math.min(1000, 600 + variables.reduce((s, v) => s + v.contribucion, 0)))
  let decision: EvaluacionDb['decision_sugerida'] =
    puntaje >= parametros.umbral_aprobar ? 'aprobar' : puntaje < parametros.umbral_negar ? 'negar' : 'escalar'
  // RN-41: con la cuota por encima del límite no se aprueba automáticamente.
  if (decision === 'aprobar' && capacidad.supera_limite) decision = 'escalar'

  return {
    id,
    solicitud_id: solicitud.id,
    puntaje,
    escala_min: 0,
    escala_max: 1000,
    nivel_riesgo: puntaje >= 700 ? 'bajo' : puntaje >= 500 ? 'medio' : 'alto',
    decision_sugerida: decision,
    umbrales: { aprobar: parametros.umbral_aprobar, negar: parametros.umbral_negar },
    version_reglas: VERSION_REGLAS,
    evaluada_en: ahora.toISOString(),
    duracion_segundos: 4 + (puntaje % 5),
    variables,
    capacidad_pago: capacidad,
    fuente_central: central.fuente,
  }
}

/** Explicación para el cliente: sin códigos ni pesos del modelo (RN-52). */
export function explicarVariable(codigo: string, contribucion: number): string {
  const favorable = contribucion >= 0
  const textos: Record<string, [string, string]> = {
    comportamiento_pago: [
      'Has pagado a tiempo tus obligaciones con otras entidades.',
      'Registras pagos atrasados recientes con otras entidades.',
    ],
    cuota_ingreso: [
      'La cuota cabe con holgura en lo que te queda de tus ingresos.',
      'La cuota ocupa una parte muy alta de lo que te queda de tus ingresos.',
    ],
    endeudamiento: [
      'Tus deudas actuales son moderadas frente a tus ingresos.',
      'Tus deudas actuales son altas frente a tus ingresos.',
    ],
    antiguedad_laboral: [
      'Llevas un tiempo estable en tu actividad actual.',
      'Llevas poco tiempo en tu actividad actual.',
    ],
    consultas_recientes: [
      'No has pedido muchos créditos en los últimos meses.',
      'Has pedido varios créditos en los últimos meses.',
    ],
    antiguedad_cliente: ['Llevas tiempo con nosotros.', 'Eres cliente reciente.'],
  }
  const [bien, mal] = textos[codigo] ?? ['Factor a tu favor.', 'Factor en contra.']
  return favorable ? bien : mal
}

export function textoPagare(
  radicado: string,
  cliente: UsuarioDb,
  condiciones: CondicionesOferta,
): string {
  const documento = (cliente.num_documento ?? '').slice(-4)
  return [
    `Pagaré número ${radicado}-P. Documento de demostración generado por un sistema académico: no es un título valor.`,
    `Yo, ${cliente.nombres} ${cliente.apellidos}, con documento de identidad terminado en ${documento}, me obligo a pagar incondicionalmente a la orden de FinanTech la suma de ${formatoMoneda(condiciones.monto)}.`,
    `Pagaré esa suma en ${condiciones.plazo_meses} cuotas mensuales de ${formatoMoneda(condiciones.cuota)}, que incluyen capital, intereses y seguro de vida deudor, con una tasa de interés remuneratoria del ${condiciones.tasa_ea.toLocaleString('es-CO')} % efectiva anual, que no supera la tasa máxima legal vigente.`,
    'Si me atraso en el pago, reconoceré intereses de mora a la tasa máxima legal permitida y FinanTech podrá exigir el saldo completo.',
    'Autorizo a FinanTech a llenar los espacios en blanco de este pagaré según la carta de instrucciones que hace parte de él.',
  ].join('\n\n')
}

export function construirOferta(
  id: string,
  solicitud: SolicitudDb,
  cliente: UsuarioDb,
  parametros: ParametrosVersion,
  condiciones: { monto: number; plazo_meses: number; tasa_ea: number },
  motivoCondicion: string | null,
  ahora: Date,
): OfertaDb {
  const prod = producto(parametros, solicitud.producto)
  const credito = calcularCredito(
    condiciones.tasa_ea,
    condiciones.monto,
    condiciones.plazo_meses,
    parametros.tasa_maxima_legal_ea,
    ahora,
  )
  const cambiada =
    condiciones.monto !== solicitud.monto ||
    condiciones.plazo_meses !== solicitud.plazo_meses ||
    condiciones.tasa_ea !== prod.tasa_ea
  const original = cambiada
    ? calcularCredito(prod.tasa_ea, solicitud.monto, solicitud.plazo_meses, parametros.tasa_maxima_legal_ea, ahora)
    : null
  const finales = {
    monto: condiciones.monto,
    plazo_meses: condiciones.plazo_meses,
    tasa_ea: credito.tasa_ea,
    cuota: credito.cuota,
  }
  return {
    id,
    cliente_id: cliente.id,
    solicitud_id: solicitud.id,
    radicado: solicitud.radicado ?? '',
    producto: prod.nombre,
    estado: 'vigente',
    ...finales,
    costo_total: credito.costo_total,
    desglose: credito.desglose,
    plan: credito.plan,
    emitida_en: ahora.toISOString(),
    vence_en: new Date(ahora.getTime() + 15 * DIA).toISOString(),
    condiciones_originales: original
      ? { monto: solicitud.monto, plazo_meses: solicitud.plazo_meses, tasa_ea: original.tasa_ea, cuota: original.cuota }
      : null,
    motivo_condicion: cambiada ? motivoCondicion : null,
    pagare: { version: 'PG-1.0', texto: textoPagare(solicitud.radicado ?? '', cliente, finales) },
    firma: null,
  }
}
