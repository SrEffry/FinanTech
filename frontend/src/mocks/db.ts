import type {
  Concepto,
  ConsultaCentral,
  DatosFinancieros,
  DatosLaborales,
  DocumentoSolicitud,
  EstadoKyc,
  EstadoSolicitud,
  EstadoUsuario,
  Evaluacion,
  HitoEstado,
  Observacion,
  Oferta,
  ParametrosVersion,
  Reconsideracion,
  ReferenciaPersonal,
  RegistroAuditoria,
  ResultadoDecision,
  Rol,
  TipoDocumento,
  UsuarioInterno,
} from '../lib/api/tipos'
import { crearSemilla } from './semilla'

/**
 * Base de datos de la API simulada. Solo datos sintéticos (CLAUDE.md: nada real fuera de
 * producción). Vive en memoria y se copia a localStorage para sobrevivir a recargas.
 */

export interface UsuarioDb {
  id: number
  nombres: string
  apellidos: string
  email: string
  /** Contraseña de demostración en claro: solo existe en el navegador de desarrollo. */
  password: string
  rol: Rol
  estado: EstadoUsuario
  ultimo_acceso_en: string | null
  // Empleados
  cargo?: string
  area?: string
  atribucion_monto?: number
  funciones_ejercidas?: UsuarioInterno['funciones_ejercidas']
  /** Clientes con los que tiene un vínculo (RN-55: no puede decidir sobre ellos). */
  relacionados?: number[]
  // Clientes
  tipo_documento?: TipoDocumento
  num_documento?: string
  fecha_nacimiento?: string
  telefono?: string
  estado_kyc?: EstadoKyc
  intentos_kyc?: number
  cliente_desde?: string
}

export interface DecisionDb {
  resultado: ResultadoDecision | 'aprobada_automatica' | 'negada_automatica'
  motivo: string
  autor_id: number | null
  autor: string
  fecha: string
  automatizada: boolean
  ajustes?: { monto: number; plazo_meses: number; tasa_ea: number }
}

export interface SolicitudDb {
  id: string
  radicado: string | null
  cliente_id: number
  producto: string
  monto: number
  plazo_meses: number
  estado: EstadoSolicitud
  creada_en: string
  actualizada_en: string
  radicada_en: string | null
  /** Desde cuándo corre el reloj de la evaluación automática simulada. */
  avance_desde: string | null
  historial: HitoEstado[]
  laboral: DatosLaborales
  financiero: DatosFinancieros
  referencia: ReferenciaPersonal
  documentos: DocumentoSolicitud[]
  acepta_consulta_centrales: boolean
  analista_id: number | null
  en_cola_desde: string | null
  sla_vence_en: string | null
  observaciones: Observacion[]
  concepto: Concepto | null
  central: ConsultaCentral | null
  evaluacion_id: string | null
  /** Solo adición (CLAUDE.md): una corrección es una decisión nueva. */
  decisiones: DecisionDb[]
  oferta_id: string | null
  reconsideracion: Reconsideracion | null
  atendida_en: string | null
}

export interface EvaluacionDb extends Evaluacion {
  solicitud_id: string
}

export interface OfertaDb extends Oferta {
  cliente_id: number
}

export interface ConsentimientoDb {
  id: number
  usuario_id: number
  finalidad: string
  accion: 'otorga' | 'revoca'
  canal: 'web' | 'movil'
  version_politica: string
  fecha_registro: string
}

export interface DesafioDb {
  id: string
  usuario_id: number
  proposito: 'sesion' | 'oferta'
  oferta_id?: string
  codigo: string
  expira_en: string
  reenvio_disponible_en: string
  intentos: number
}

export interface RegistroPendienteDb {
  email: string
  password: string
  nombres: string
  apellidos: string
  tipo_documento: TipoDocumento
  num_documento: string
  fecha_nacimiento: string
  telefono: string
  finalidades_opcionales: string[]
}

export interface Db {
  version: number
  usuarios: UsuarioDb[]
  solicitudes: SolicitudDb[]
  evaluaciones: EvaluacionDb[]
  ofertas: OfertaDb[]
  consentimientos: ConsentimientoDb[]
  auditoria: RegistroAuditoria[]
  parametros: ParametrosVersion[]
  intentos_login: Record<string, { fallidos: number; bloqueado_hasta: string | null }>
  desafios: DesafioDb[]
  registros_pendientes: Record<string, RegistroPendienteDb>
  sesion_usuario_id: number | null
  secuencias: { usuario: number; solicitud: number; oferta: number; evaluacion: number; auditoria: number; consentimiento: number; observacion: number; radicado: Record<string, number> }
}

/** Cambiarla invalida los datos guardados con un formato anterior. */
const VERSION = 3
const CLAVE = 'finantech-demo'

let db: Db | null = null

function cargar(): Db {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado) {
      const datos = JSON.parse(guardado) as Db
      if (datos.version === VERSION) return datos
    }
  } catch {
    // Almacenamiento bloqueado o dañado: se empieza de cero.
  }
  return crearSemilla(VERSION)
}

export function obtenerDb(): Db {
  db ??= cargar()
  return db
}

export function guardarDb(): void {
  if (!db) return
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db))
  } catch {
    // Sin almacenamiento la demo sigue funcionando en memoria.
  }
}

export function reiniciarDb(): void {
  db = crearSemilla(VERSION)
  guardarDb()
}

export function siguienteId(clave: Exclude<keyof Db['secuencias'], 'radicado'>): number {
  const datos = obtenerDb()
  datos.secuencias[clave] += 1
  return datos.secuencias[clave]
}

/** Radicado único y secuencial por año (RN-29): FT-2026-000123. */
export function siguienteRadicado(ahora: Date): string {
  const datos = obtenerDb()
  const anio = String(ahora.getFullYear())
  datos.secuencias.radicado[anio] = (datos.secuencias.radicado[anio] ?? 0) + 1
  return `FT-${anio}-${String(datos.secuencias.radicado[anio]).padStart(6, '0')}`
}

export function parametrosVigentes(ahora = new Date()): ParametrosVersion {
  const { parametros } = obtenerDb()
  const vigentes = parametros.filter((p) => new Date(p.vigente_desde) <= ahora)
  return vigentes[vigentes.length - 1] ?? parametros[0]
}
