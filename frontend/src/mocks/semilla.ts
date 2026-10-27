import type {
  Concepto,
  DatosLaborales,
  EstadoSolicitud,
  HitoEstado,
  ParametrosVersion,
  Producto,
  RegistroAuditoria,
  Rol,
} from '../lib/api/tipos'
import { calcularCredito } from './calculos'
import type { ConsentimientoDb, Db, DecisionDb, SolicitudDb, UsuarioDb } from './db'
import {
  calcularEvaluacion,
  centralDisponible,
  construirOferta,
  consultarCentral,
  documentosRequeridos,
} from './motor'

/**
 * Datos sintéticos de la demostración. Ningún nombre, documento ni teléfono corresponde a
 * una persona real. Las fechas se calculan desde el momento en que se crea la semilla.
 */

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

export const CONTRASENA_DEMO = 'Demo#2026!'

export const PRODUCTOS: Producto[] = [
  {
    codigo: 'libre_inversion',
    nombre: 'Libre inversión',
    descripcion: 'Para lo que necesites, sin justificar el uso del dinero.',
    tasa_ea: 18.9,
    monto_min: 1_000_000,
    monto_max: 50_000_000,
    plazo_min: 12,
    plazo_max: 60,
    paso_monto: 100_000,
  },
  {
    codigo: 'libranza',
    nombre: 'Libranza',
    descripcion: 'La cuota se descuenta de tu nómina o pensión, con una tasa más baja.',
    tasa_ea: 14.9,
    monto_min: 2_000_000,
    monto_max: 80_000_000,
    plazo_min: 12,
    plazo_max: 72,
    paso_monto: 500_000,
  },
  {
    codigo: 'educacion',
    nombre: 'Crédito educativo',
    descripcion: 'Matrículas, cursos y posgrados, en Colombia o en el exterior.',
    tasa_ea: 15.5,
    monto_min: 1_000_000,
    monto_max: 30_000_000,
    plazo_min: 6,
    plazo_max: 48,
    paso_monto: 100_000,
  },
  {
    codigo: 'compra_cartera',
    nombre: 'Compra de cartera',
    descripcion: 'Une tus deudas de otras entidades en una sola cuota.',
    tasa_ea: 17.2,
    monto_min: 5_000_000,
    monto_max: 80_000_000,
    plazo_min: 12,
    plazo_max: 72,
    paso_monto: 500_000,
  },
  {
    codigo: 'tecnologia_hogar',
    nombre: 'Tecnología y hogar',
    descripcion: 'Computadores, celulares, electrodomésticos y muebles.',
    tasa_ea: 21.4,
    monto_min: 500_000,
    monto_max: 8_000_000,
    plazo_min: 6,
    plazo_max: 24,
    paso_monto: 50_000,
  },
  {
    codigo: 'viajes',
    nombre: 'Viajes y experiencias',
    descripcion: 'Tiquetes, alojamiento y planes turísticos.',
    tasa_ea: 22.6,
    monto_min: 1_000_000,
    monto_max: 15_000_000,
    plazo_min: 6,
    plazo_max: 36,
    paso_monto: 100_000,
  },
]

export const FINALIDADES = [
  {
    codigo: 'gestion_cliente',
    nombre: 'Gestión de tu relación con FinanTech',
    descripcion: 'Crear y administrar tu cuenta, atender tus solicitudes y prestarte los productos que contrates.',
    necesaria: true,
  },
  {
    codigo: 'verificacion_identidad',
    nombre: 'Verificación de identidad y prevención de fraude',
    descripcion:
      'Verificar tu identidad y consultar listas restrictivas, como exige la normativa de prevención de lavado de activos.',
    necesaria: true,
  },
  {
    codigo: 'consulta_centrales',
    nombre: 'Consulta y reporte a centrales de información crediticia',
    descripcion:
      'Consultar tu historial crediticio para evaluar tus solicitudes y reportar el comportamiento de tus obligaciones. Puedes autorizarla ahora o al radicar una solicitud.',
    necesaria: false,
  },
  {
    codigo: 'ofertas_comerciales',
    nombre: 'Ofertas comerciales',
    descripcion: 'Enviarte ofertas de productos de FinanTech por correo electrónico o notificación.',
    necesaria: false,
  },
  {
    codigo: 'encuestas_satisfaccion',
    nombre: 'Encuestas de satisfacción',
    descripcion: 'Contactarte para conocer tu opinión sobre nuestro servicio.',
    necesaria: false,
  },
]

export const POLITICA = { version: '1.0', vigente_desde: '2026-10-01' }

/**
 * Ajusta el último dígito para que la suma de dígitos deje el residuo pedido: así el
 * perfil crediticio sintético (motor.perfilCentral) queda fijo. Con `caida`, el documento
 * termina en 0 y la central simulada no responde.
 */
function documento(prefijo: string, residuo: number, caida = false): string {
  const suma = prefijo.split('').reduce((t, c) => t + Number(c), 0)
  if (caida) {
    const penultimo = (((residuo - suma) % 10) + 10) % 10
    return `${prefijo}${penultimo}0`
  }
  const ultimo = (((residuo - suma) % 10) + 10) % 10
  return `${prefijo}${ultimo}`
}

interface EspecificacionCliente {
  id: number
  nombres: string
  apellidos: string
  prefijo: string
  residuo: number
  caida?: boolean
  nacimiento: string
  telefono: string
  clienteHaceDias: number
}

const CLIENTES: EspecificacionCliente[] = [
  { id: 1, nombres: 'Laura', apellidos: 'Mejía Restrepo', prefijo: '102045678', residuo: 5, nacimiento: '1994-03-12', telefono: '3104567821', clienteHaceDias: 22 },
  { id: 10, nombres: 'Carlos Andrés', apellidos: 'Gómez Ruiz', prefijo: '79845123', residuo: 5, nacimiento: '1985-07-02', telefono: '3157841203', clienteHaceDias: 400 },
  { id: 11, nombres: 'Paola Andrea', apellidos: 'Cárdenas Silva', prefijo: '52987412', residuo: 6, nacimiento: '1990-11-23', telefono: '3006624581', clienteHaceDias: 35 },
  { id: 12, nombres: 'Jorge Iván', apellidos: 'Ortiz Lozada', prefijo: '80123654', residuo: 6, nacimiento: '1979-01-15', telefono: '3125547810', clienteHaceDias: 150 },
  { id: 13, nombres: 'María Fernanda', apellidos: 'López Duarte', prefijo: '103254789', residuo: 5, nacimiento: '1992-05-30', telefono: '3014478452', clienteHaceDias: 95 },
  { id: 14, nombres: 'Ricardo', apellidos: 'Salazar Quintero', prefijo: '71654823', residuo: 6, nacimiento: '1976-09-08', telefono: '3176632014', clienteHaceDias: 640 },
  { id: 15, nombres: 'Natalia', apellidos: 'Castro Arango', prefijo: '104789652', residuo: 5, nacimiento: '1998-12-01', telefono: '3208874512', clienteHaceDias: 18 },
  { id: 16, nombres: 'Felipe', apellidos: 'Moreno Zapata', prefijo: '98563214', residuo: 6, nacimiento: '1983-04-19', telefono: '3164521478', clienteHaceDias: 870 },
  { id: 17, nombres: 'Sandra Milena', apellidos: 'Patiño Rueda', prefijo: '63541287', residuo: 5, nacimiento: '1987-08-27', telefono: '3112547896', clienteHaceDias: 60 },
  { id: 18, nombres: 'Óscar Daniel', apellidos: 'Vélez Mejía', prefijo: '101523698', residuo: 6, nacimiento: '1995-02-14', telefono: '3028745123', clienteHaceDias: 12 },
  { id: 19, nombres: 'Luisa Fernanda', apellidos: 'Rincón Toro', prefijo: '1036985', residuo: 5, caida: true, nacimiento: '1993-06-06', telefono: '3145523698', clienteHaceDias: 150 },
  { id: 20, nombres: 'Mauricio', apellidos: 'Acosta Gil', prefijo: '79632541', residuo: 5, nacimiento: '1981-10-10', telefono: '3186654120', clienteHaceDias: 300 },
  { id: 21, nombres: 'Adriana Lucía', apellidos: 'Pérez Niño', prefijo: '52874196', residuo: 6, nacimiento: '1989-03-03', telefono: '3057412589', clienteHaceDias: 45 },
]

function correo(nombres: string, apellidos: string): string {
  const limpiar = (texto: string) =>
    texto
      .split(' ')[0]
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  return `${limpiar(nombres)}.${limpiar(apellidos)}@demo.finantech.co`
}

interface EspecificacionSolicitud {
  id: string
  cliente: number
  producto: string
  monto: number
  plazo: number
  ingreso: number
  /** Cuota / ingreso disponible que se busca; con él se calcula el egreso. */
  proporcion: number
  antiguedad: number
  ocupacion: DatosLaborales['ocupacion']
  empleador: string
  estado: EstadoSolicitud
  radicadaHace: number
  analista?: number
  concepto?: Omit<Concepto, 'fecha' | 'autor'>
}

const SOLICITUDES: EspecificacionSolicitud[] = [
  // Laura (cliente demo): una aprobada con condiciones, una negada y una con un documento pendiente.
  { id: 'sol-1001', cliente: 1, producto: 'libre_inversion', monto: 12_000_000, plazo: 36, ingreso: 3_200_000, proporcion: 0.34, antiguedad: 14, ocupacion: 'empleado', empleador: 'Comercializadora Andina S.A.S.', estado: 'APROBADA_CONDICIONADA', radicadaHace: 6 * DIA, analista: 2,
    concepto: { recomendacion: 'aprobar_condicionado', texto: 'Buen comportamiento de pago. La cuota pedida ocupa el 34 % del ingreso disponible; recomiendo bajar el monto a $10.000.000 para dejar margen.' } },
  { id: 'sol-1002', cliente: 1, producto: 'educacion', monto: 6_000_000, plazo: 24, ingreso: 2_400_000, proporcion: 0.59, antiguedad: 13, ocupacion: 'empleado', empleador: 'Comercializadora Andina S.A.S.', estado: 'NEGADA', radicadaHace: 20 * DIA },
  { id: 'sol-1003', cliente: 1, producto: 'tecnologia_hogar', monto: 3_500_000, plazo: 18, ingreso: 3_200_000, proporcion: 0.18, antiguedad: 14, ocupacion: 'empleado', empleador: 'Comercializadora Andina S.A.S.', estado: 'PENDIENTE_CLIENTE', radicadaHace: 1 * DIA },
  // Bandeja del analista Andrés Rojas (id 2).
  { id: 'sol-1010', cliente: 17, producto: 'libre_inversion', monto: 18_000_000, plazo: 48, ingreso: 5_100_000, proporcion: 0.36, antiguedad: 16, ocupacion: 'empleado', empleador: 'Clínica Santa Ana', estado: 'EN_ESTUDIO', radicadaHace: 30 * HORA, analista: 2 },
  { id: 'sol-1011', cliente: 18, producto: 'viajes', monto: 4_500_000, plazo: 24, ingreso: 2_300_000, proporcion: 0.44, antiguedad: 15, ocupacion: 'independiente', empleador: 'Diseño gráfico independiente', estado: 'EN_ESTUDIO', radicadaHace: 44 * HORA, analista: 2 },
  { id: 'sol-1012', cliente: 19, producto: 'compra_cartera', monto: 25_000_000, plazo: 60, ingreso: 7_800_000, proporcion: 0.31, antiguedad: 40, ocupacion: 'empleado', empleador: 'Universidad del Sinú', estado: 'EN_ESTUDIO', radicadaHace: 6 * HORA, analista: 2 },
  { id: 'sol-1013', cliente: 21, producto: 'libranza', monto: 15_000_000, plazo: 60, ingreso: 4_600_000, proporcion: 0.38, antiguedad: 20, ocupacion: 'pensionado', empleador: 'Colpensiones', estado: 'PENDIENTE_CLIENTE', radicadaHace: 3 * DIA, analista: 2 },
  { id: 'sol-1014', cliente: 11, producto: 'tecnologia_hogar', monto: 5_200_000, plazo: 24, ingreso: 2_900_000, proporcion: 0.39, antiguedad: 12, ocupacion: 'empleado', empleador: 'Almacenes La 14', estado: 'EN_ESTUDIO', radicadaHace: 52 * HORA, analista: 2 },
  { id: 'sol-1015', cliente: 10, producto: 'libre_inversion', monto: 9_000_000, plazo: 36, ingreso: 3_900_000, proporcion: 0.33, antiguedad: 18, ocupacion: 'empleado', empleador: 'Transportes del Caribe', estado: 'EN_ESTUDIO', radicadaHace: 3 * HORA, analista: 7 },
  // Bandeja de la oficial Camila Ortiz (id 3, atribución de $30.000.000).
  { id: 'sol-1020', cliente: 13, producto: 'libre_inversion', monto: 45_000_000, plazo: 60, ingreso: 9_500_000, proporcion: 0.37, antiguedad: 22, ocupacion: 'empleado', empleador: 'Ecopetrol S.A.', estado: 'EN_DECISION', radicadaHace: 3 * DIA, analista: 2,
    concepto: { recomendacion: 'aprobar', texto: 'Ingresos estables y verificados. El monto supera la atribución del oficial: debe ir a comité.' } },
  { id: 'sol-1021', cliente: 12, producto: 'compra_cartera', monto: 18_000_000, plazo: 48, ingreso: 6_100_000, proporcion: 0.35, antiguedad: 19, ocupacion: 'independiente', empleador: 'Ferretería El Tornillo', estado: 'EN_DECISION', radicadaHace: 2 * DIA, analista: 2,
    concepto: { recomendacion: 'aprobar', texto: 'La compra de cartera baja su carga mensual actual. Recomiendo aprobar.' } },
  { id: 'sol-1022', cliente: 14, producto: 'libranza', monto: 22_000_000, plazo: 72, ingreso: 6_800_000, proporcion: 0.34, antiguedad: 10, ocupacion: 'empleado', empleador: 'Gobernación de Córdoba', estado: 'EN_DECISION', radicadaHace: 26 * HORA, analista: 7,
    concepto: { recomendacion: 'aprobar', texto: 'Descuento por nómina con entidad pública. Riesgo controlado.' } },
  { id: 'sol-1023', cliente: 15, producto: 'viajes', monto: 6_000_000, plazo: 24, ingreso: 2_600_000, proporcion: 0.46, antiguedad: 26, ocupacion: 'empleado', empleador: 'Hotel Las Américas', estado: 'EN_DECISION', radicadaHace: 20 * HORA, analista: 2,
    concepto: { recomendacion: 'negar', texto: 'La cuota supera el 40 % del ingreso disponible. Si se aprueba, debe ser con un monto menor.' } },
  { id: 'sol-1024', cliente: 16, producto: 'compra_cartera', monto: 60_000_000, plazo: 72, ingreso: 14_000_000, proporcion: 0.33, antiguedad: 9, ocupacion: 'independiente', empleador: 'Consultoría Moreno & Asociados', estado: 'EN_COMITE', radicadaHace: 5 * DIA, analista: 7,
    concepto: { recomendacion: 'aprobar', texto: 'Perfil sólido. Supera la atribución individual.' } },
  // Reconsideración pedida después de una negación (RN-49).
  { id: 'sol-1025', cliente: 20, producto: 'libre_inversion', monto: 14_000_000, plazo: 48, ingreso: 3_700_000, proporcion: 0.45, antiguedad: 10, ocupacion: 'empleado', empleador: 'Distribuidora del Norte', estado: 'EN_ESTUDIO', radicadaHace: 9 * DIA, analista: 2 },
]

const ANALISTAS: Record<number, string> = { 2: 'Andrés Felipe Rojas Pineda', 7: 'Valentina Suárez Mora' }

export function crearSemilla(version: number): Db {
  const ahora = new Date()
  const t = ahora.getTime()
  const iso = (ms: number) => new Date(ms).toISOString()

  const parametros: ParametrosVersion[] = [
    {
      version: 'P-2026.09-1',
      vigente_desde: '2026-09-01T05:00:00.000Z',
      publicado_por: 'Sergio Páez Molina',
      tasa_maxima_legal_ea: 25.8,
      umbral_aprobar: 720,
      umbral_negar: 500,
      limite_cuota_ingreso: 40,
      productos: PRODUCTOS.map((p) => ({ ...p, tasa_ea: p.tasa_ea + 0.4 })),
    },
    {
      version: 'P-2026.10-1',
      vigente_desde: '2026-10-01T05:00:00.000Z',
      publicado_por: 'Sergio Páez Molina',
      tasa_maxima_legal_ea: 25.8,
      umbral_aprobar: 700,
      umbral_negar: 500,
      limite_cuota_ingreso: 40,
      productos: PRODUCTOS,
    },
  ]
  const vigentes = parametros[1]

  const internos: UsuarioDb[] = [
    { id: 2, nombres: 'Andrés Felipe', apellidos: 'Rojas Pineda', rol: 'analista', cargo: 'Analista de crédito', area: 'Riesgo de crédito', atribucion_monto: 0, funciones_ejercidas: [] },
    { id: 3, nombres: 'Camila', apellidos: 'Ortiz Beltrán', rol: 'oficial', cargo: 'Oficial de crédito', area: 'Crédito de consumo', atribucion_monto: 30_000_000, funciones_ejercidas: ['aprobar'], relacionados: [12] },
    { id: 4, nombres: 'Sergio', apellidos: 'Páez Molina', rol: 'administrador', cargo: 'Administrador de plataforma', area: 'Tecnología', atribucion_monto: 0, funciones_ejercidas: ['parametrizar'] },
    { id: 5, nombres: 'Diana', apellidos: 'Vargas Lozano', rol: 'contabilidad', cargo: 'Auxiliar contable', area: 'Contabilidad', atribucion_monto: 0, funciones_ejercidas: [] },
    { id: 6, nombres: 'Hernán', apellidos: 'Cuéllar Ríos', rol: 'directivo', cargo: 'Gerente de crédito', area: 'Dirección', atribucion_monto: 0, funciones_ejercidas: [] },
    { id: 7, nombres: 'Valentina', apellidos: 'Suárez Mora', rol: 'analista', cargo: 'Analista de crédito', area: 'Riesgo de crédito', atribucion_monto: 0, funciones_ejercidas: [] },
    { id: 8, nombres: 'Julián', apellidos: 'Herrera Castaño', rol: 'oficial', cargo: 'Oficial de crédito sénior', area: 'Crédito de consumo', atribucion_monto: 80_000_000, funciones_ejercidas: ['aprobar'] },
  ].map((u) => ({
    ...u,
    rol: u.rol as Rol,
    email: correo(u.nombres, u.apellidos),
    password: CONTRASENA_DEMO,
    estado: 'activo' as const,
    ultimo_acceso_en: iso(t - (u.id % 4) * DIA - 2 * HORA),
    funciones_ejercidas: u.funciones_ejercidas as UsuarioDb['funciones_ejercidas'],
  }))

  const clientes: UsuarioDb[] = CLIENTES.map((c) => ({
    id: c.id,
    nombres: c.nombres,
    apellidos: c.apellidos,
    email: correo(c.nombres, c.apellidos),
    password: CONTRASENA_DEMO,
    rol: 'cliente',
    estado: 'activo',
    ultimo_acceso_en: iso(t - 2 * DIA),
    tipo_documento: 'CC',
    num_documento: documento(c.prefijo, c.residuo, c.caida),
    fecha_nacimiento: c.nacimiento,
    telefono: c.telefono,
    estado_kyc: 'verificado',
    intentos_kyc: 0,
    cliente_desde: iso(t - c.clienteHaceDias * DIA),
  }))
  const usuarios = [...clientes, ...internos]
  const porId = new Map(usuarios.map((u) => [u.id, u]))

  const auditoria: RegistroAuditoria[] = []
  let idAuditoria = 0
  const auditar = (
    momento: number,
    actor: string,
    rol: RegistroAuditoria['rol'],
    accion: string,
    entidad: string,
    entidadId: string,
    extra: Partial<Pick<RegistroAuditoria, 'resultado' | 'simulado' | 'origen'>> = {},
  ) => {
    auditoria.push({
      id: ++idAuditoria,
      momento: iso(momento),
      actor,
      rol,
      accion,
      entidad,
      entidad_id: entidadId,
      origen: extra.origen ?? (rol === 'cliente' ? 'Portal web' : rol === 'sistema' ? 'Motor de reglas' : 'Consola interna'),
      resultado: extra.resultado ?? 'exito',
      simulado: extra.simulado ?? false,
    })
  }

  const db: Db = {
    version,
    usuarios,
    solicitudes: [],
    evaluaciones: [],
    ofertas: [],
    consentimientos: [],
    auditoria,
    parametros,
    intentos_login: {},
    desafios: [],
    registros_pendientes: {},
    sesion_usuario_id: null,
    secuencias: { usuario: 100, solicitud: 2000, oferta: 6000, evaluacion: 3000, auditoria: 0, consentimiento: 0, observacion: 0, radicado: {} },
  }

  // Consentimientos: los necesarios otorgados al registrarse; consulta a centrales también.
  let idConsentimiento = 0
  for (const cliente of clientes) {
    const momento = new Date(cliente.cliente_desde ?? ahora).getTime()
    const otorgadas = ['gestion_cliente', 'verificacion_identidad', 'consulta_centrales']
    if (cliente.id === 1) otorgadas.push('encuestas_satisfaccion')
    for (const finalidad of otorgadas) {
      const movimiento: ConsentimientoDb = {
        id: ++idConsentimiento,
        usuario_id: cliente.id,
        finalidad,
        accion: 'otorga',
        canal: 'web',
        version_politica: POLITICA.version,
        fecha_registro: iso(momento),
      }
      db.consentimientos.push(movimiento)
    }
    auditar(momento, `${cliente.nombres} ${cliente.apellidos}`, 'cliente', 'Registro de cliente', 'cliente', String(cliente.id))
    auditar(momento + 4 * MINUTO, 'Verificación de identidad', 'sistema', 'Identidad verificada', 'cliente', String(cliente.id), { simulado: true, origen: 'Servicio externo' })
  }
  // Laura revocó encuestas hace poco: el histórico muestra ambos movimientos.
  db.consentimientos.push({
    id: ++idConsentimiento,
    usuario_id: 1,
    finalidad: 'encuestas_satisfaccion',
    accion: 'revoca',
    canal: 'web',
    version_politica: POLITICA.version,
    fecha_registro: iso(t - 3 * DIA),
  })
  db.secuencias.consentimiento = idConsentimiento

  let numeroRadicado = 0
  let numeroEvaluacion = 3000
  let numeroOferta = 6000
  let numeroObservacion = 0

  for (const e of [...SOLICITUDES].sort((a, b) => b.radicadaHace - a.radicadaHace)) {
    const cliente = porId.get(e.cliente) as UsuarioDb
    const nombreCliente = `${cliente.nombres} ${cliente.apellidos}`
    const prod = vigentes.productos.find((p) => p.codigo === e.producto) as Producto
    const credito = calcularCredito(prod.tasa_ea, e.monto, e.plazo, vigentes.tasa_maxima_legal_ea)
    const disponible = Math.round(credito.cuota / e.proporcion / 10_000) * 10_000
    const radicada = t - e.radicadaHace
    const radicado = `FT-2026-${String(++numeroRadicado + 400).padStart(6, '0')}`

    const historial: HitoEstado[] = [
      { estado: 'BORRADOR', fecha: iso(radicada - 25 * MINUTO) },
      { estado: 'RADICADA', fecha: iso(radicada) },
    ]
    const hito = (estado: EstadoSolicitud, ms: number) => historial.push({ estado, fecha: iso(ms) })

    const solicitud: SolicitudDb = {
      id: e.id,
      radicado,
      cliente_id: cliente.id,
      producto: e.producto,
      monto: e.monto,
      plazo_meses: e.plazo,
      estado: e.estado,
      creada_en: iso(radicada - 25 * MINUTO),
      actualizada_en: iso(radicada),
      radicada_en: iso(radicada),
      avance_desde: null,
      historial,
      laboral: { ocupacion: e.ocupacion, empleador: e.empleador, antiguedad_laboral_meses: e.antiguedad },
      financiero: { ingreso_mensual: e.ingreso, egreso_mensual: e.ingreso - disponible },
      referencia: { nombre: 'Martha Lucía Ríos', celular: '3119876543' },
      documentos: documentosRequeridos(e.ocupacion).map((d) => ({
        ...d,
        estado: 'cargado',
        archivo: { nombre: `${d.tipo.replace(/_/g, '-')}.pdf`, tamano: 420_000 + d.tipo.length * 9_000, cargado_en: iso(radicada - 10 * MINUTO) },
      })),
      acepta_consulta_centrales: true,
      analista_id: e.analista ?? null,
      en_cola_desde: null,
      sla_vence_en: null,
      observaciones: [],
      concepto: null,
      central: null,
      evaluacion_id: null,
      decisiones: [],
      oferta_id: null,
      reconsideracion: null,
      atendida_en: null,
    }
    auditar(radicada, nombreCliente, 'cliente', 'Radicación de solicitud', 'solicitud', radicado)

    // Documento rechazado: la solicitud vuelve al cliente antes de evaluarse.
    if (e.estado === 'PENDIENTE_CLIENTE') {
      const rechazado = solicitud.documentos[0]
      rechazado.estado = 'rechazado'
      rechazado.motivo_rechazo =
        e.cliente === 1
          ? 'La foto del certificado está borrosa y no se leen el salario ni la fecha. Sube una foto nítida o el PDF original.'
          : 'El desprendible tiene más de 30 días. Sube el del último mes.'
      hito('PENDIENTE_CLIENTE', radicada + 3 * HORA)
      solicitud.actualizada_en = iso(radicada + 3 * HORA)
      if (e.analista) {
        solicitud.observaciones.push({
          id: ++numeroObservacion,
          autor: ANALISTAS[e.analista],
          rol: 'analista',
          texto: `Se pide de nuevo ${rechazado.nombre.toLowerCase()}: ${rechazado.motivo_rechazo}`,
          fecha: iso(radicada + 3 * HORA),
        })
        solicitud.en_cola_desde = iso(radicada + 3 * HORA)
        solicitud.sla_vence_en = iso(radicada + 3 * HORA + 15 * DIA)
      }
      auditar(radicada + 3 * HORA, e.analista ? ANALISTAS[e.analista] : 'Revisión documental', e.analista ? 'analista' : 'sistema', 'Documento rechazado', 'solicitud', radicado)
      db.solicitudes.push(solicitud)
      continue
    }

    // Evaluación automática (RF-08). La central simulada no responde para documentos que terminan en 0.
    const evaluadaEn = radicada + 6 * MINUTO
    hito('EN_EVALUACION', radicada + 1 * MINUTO)
    if (centralDisponible(cliente.num_documento ?? '')) {
      solicitud.central = consultarCentral(cliente, e.ingreso, new Date(radicada + 2 * MINUTO))
      auditar(radicada + 2 * MINUTO, 'Central de riesgo', 'sistema', 'Consulta a central de riesgo', 'solicitud', radicado, { simulado: true, origen: 'Servicio externo' })
      const evaluacion = calcularEvaluacion(`ev-${++numeroEvaluacion}`, solicitud, cliente, solicitud.central, vigentes, new Date(evaluadaEn))
      db.evaluaciones.push(evaluacion)
      solicitud.evaluacion_id = evaluacion.id
      auditar(evaluadaEn, 'Motor de reglas', 'sistema', `Evaluación: puntaje ${evaluacion.puntaje}`, 'solicitud', radicado)
    } else {
      solicitud.observaciones.push({
        id: ++numeroObservacion,
        autor: 'Motor de reglas',
        rol: 'analista',
        texto: 'La central de riesgo no respondió. La solicitud pasó a estudio manual sin evaluación automática (RF-08 FA-02).',
        fecha: iso(evaluadaEn),
      })
      auditar(radicada + 2 * MINUTO, 'Central de riesgo', 'sistema', 'Consulta a central de riesgo', 'solicitud', radicado, { simulado: true, resultado: 'rechazado', origen: 'Servicio externo' })
    }

    if (e.estado === 'NEGADA') {
      hito('NEGADA', evaluadaEn)
      const decision: DecisionDb = {
        resultado: 'negada_automatica',
        motivo: 'La cuota pedida ocupa más del 40 % de tu ingreso disponible.',
        autor_id: null,
        autor: 'Motor de reglas',
        fecha: iso(evaluadaEn),
        automatizada: true,
      }
      solicitud.decisiones.push(decision)
      solicitud.actualizada_en = iso(evaluadaEn)
      db.solicitudes.push(solicitud)
      continue
    }

    hito('EN_ESTUDIO', evaluadaEn)
    const enEstudio = evaluadaEn
    solicitud.en_cola_desde = iso(enEstudio)
    solicitud.sla_vence_en = iso(enEstudio + 2 * DIA)
    solicitud.actualizada_en = iso(enEstudio)

    if (e.id === 'sol-1025') {
      // Negada antes y luego reconsiderada: vuelve a estudio (RN-49).
      historial.splice(historial.length - 1, 1)
      hito('NEGADA', evaluadaEn)
      solicitud.decisiones.push({
        resultado: 'negada_automatica',
        motivo: 'La cuota pedida ocupa más del 40 % de tu ingreso disponible.',
        autor_id: null,
        autor: 'Motor de reglas',
        fecha: iso(evaluadaEn),
        automatizada: true,
      })
      const pedida = t - 20 * HORA
      solicitud.reconsideracion = {
        estado: 'en_revision',
        radicada_en: iso(pedida),
        argumentos: 'Desde este mes recibo una prima de antigüedad que sube mi ingreso en $600.000. Adjunto la carta de la empresa.',
        respuesta: null,
      }
      hito('EN_ESTUDIO', pedida)
      solicitud.en_cola_desde = iso(pedida)
      solicitud.sla_vence_en = iso(pedida + 2 * DIA)
      solicitud.actualizada_en = iso(pedida)
      auditar(pedida, nombreCliente, 'cliente', 'Reconsideración pedida', 'solicitud', radicado)
    }

    if (e.concepto && e.analista) {
      const conceptoEn = enEstudio + Math.min(e.radicadaHace / 3, 20 * HORA)
      solicitud.concepto = { ...e.concepto, autor: ANALISTAS[e.analista], fecha: iso(conceptoEn) }
      solicitud.observaciones.push({
        id: ++numeroObservacion,
        autor: ANALISTAS[e.analista],
        rol: 'analista',
        texto: 'Ingresos verificados con los documentos cargados.',
        fecha: iso(conceptoEn - 40 * MINUTO),
      })
      auditar(conceptoEn, ANALISTAS[e.analista], 'analista', 'Concepto emitido', 'solicitud', radicado)
      hito('EN_DECISION', conceptoEn)
      solicitud.en_cola_desde = iso(conceptoEn)
      solicitud.sla_vence_en = iso(conceptoEn + 1 * DIA)
      solicitud.actualizada_en = iso(conceptoEn)
      solicitud.atendida_en = iso(conceptoEn)

      if (e.estado === 'EN_COMITE') {
        const enviada = conceptoEn + 3 * HORA
        solicitud.decisiones.push({
          resultado: 'comite',
          motivo: 'El monto supera mi atribución individual.',
          autor_id: 8,
          autor: 'Julián Herrera Castaño',
          fecha: iso(enviada),
          automatizada: false,
        })
        hito('EN_COMITE', enviada)
        solicitud.actualizada_en = iso(enviada)
        auditar(enviada, 'Julián Herrera Castaño', 'oficial', 'Enviada a comité', 'solicitud', radicado)
      }

      if (e.estado === 'APROBADA_CONDICIONADA') {
        const decidida = conceptoEn + 20 * HORA
        const ajustes = { monto: 10_000_000, plazo_meses: e.plazo, tasa_ea: prod.tasa_ea }
        solicitud.decisiones.push({
          resultado: 'aprobada_condicionada',
          motivo: 'Aprobamos un monto menor para que la cuota no pase del 30 % de tu ingreso disponible.',
          autor_id: 3,
          autor: 'Camila Ortiz Beltrán',
          fecha: iso(decidida),
          automatizada: false,
          ajustes,
        })
        hito('APROBADA_CONDICIONADA', decidida)
        solicitud.actualizada_en = iso(decidida)
        solicitud.en_cola_desde = null
        solicitud.sla_vence_en = null
        const oferta = construirOferta(
          `of-${++numeroOferta}`,
          solicitud,
          cliente,
          vigentes,
          ajustes,
          'Bajamos el monto a $10.000.000 para que la cuota no pase del 30 % de tu ingreso disponible.',
          new Date(decidida),
        )
        db.ofertas.push(oferta)
        solicitud.oferta_id = oferta.id
        auditar(decidida, 'Camila Ortiz Beltrán', 'oficial', 'Aprobada con condiciones', 'solicitud', radicado)
        auditar(decidida + MINUTO, 'Sistema', 'sistema', 'Oferta emitida', 'oferta', oferta.id)
      }
    }

    db.solicitudes.push(solicitud)
  }

  // Actividad interna reciente para la auditoría.
  auditar(t - 2 * DIA - 3 * HORA, 'Sergio Páez Molina', 'administrador', 'Inicio de sesión', 'sesion', '4')
  auditar(t - 2 * DIA - 2 * HORA, 'Sergio Páez Molina', 'administrador', 'Usuario actualizado', 'usuario', '8')
  auditar(t - 1 * DIA - 5 * HORA, 'Usuario desconocido', 'cliente', 'Inicio de sesión fallido', 'sesion', '—', { resultado: 'rechazado' })
  auditar(t - 1 * DIA - 4 * HORA, 'Camila Ortiz Beltrán', 'oficial', 'Inicio de sesión', 'sesion', '3')
  auditar(t - 6 * HORA, 'Andrés Felipe Rojas Pineda', 'analista', 'Inicio de sesión', 'sesion', '2')
  const fueraDeAtribucion = db.solicitudes.find((s) => s.id === 'sol-1020')?.radicado ?? ''
  auditar(t - 5 * HORA, 'Camila Ortiz Beltrán', 'oficial', 'Decisión rechazada: fuera de atribución', 'solicitud', fueraDeAtribucion, { resultado: 'rechazado' })
  auditoria.sort((a, b) => a.momento.localeCompare(b.momento))
  auditoria.forEach((registro, i) => (registro.id = i + 1))

  db.secuencias.auditoria = auditoria.length
  db.secuencias.radicado = { [String(ahora.getFullYear())]: numeroRadicado + 400 }
  db.secuencias.evaluacion = numeroEvaluacion
  db.secuencias.oferta = numeroOferta
  db.secuencias.observacion = numeroObservacion
  return db
}
