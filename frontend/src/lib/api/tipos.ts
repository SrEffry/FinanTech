/**
 * Contrato de /api/v1 que usa el portal. Lo que existe en Laravel hoy es solo el registro
 * (RF-01); el resto es la propuesta documentada en docs/contrato-api-v1-frontend.md y
 * simulada con MSW en src/mocks mientras el backend la implementa.
 */

// ── Identidad ────────────────────────────────────────────────────────────────

export type Rol = 'cliente' | 'analista' | 'oficial' | 'contabilidad' | 'directivo' | 'administrador'

export type EstadoKyc = 'pendiente' | 'verificado' | 'revision_manual' | 'bloqueado'

export interface Usuario {
  id: number
  nombre_completo: string
  /** Primer nombre, para saludar. */
  nombre_corto: string
  email: string
  rol: Rol
  /** Solo clientes. */
  estado_kyc?: EstadoKyc
  /** Solo clientes; ya viene enmascarado del servidor (RNF-06). */
  documento_enmascarado?: string
  /** Solo empleados. */
  cargo?: string
  area?: string
  atribucion_monto?: number
}

export interface DesafioMfa {
  desafio_id: string
  /** Destino enmascarado: "l•••@correo.co". */
  enviado_a: string
  expira_en: string
  reenvio_disponible_en: string
  /** Solo lo devuelve la API simulada, para poder probar sin correo real. */
  codigo_demo?: string
}

export interface EstadoSistema {
  servicios_externos: 'simulado' | 'real'
}

// Registro (RF-01): estos endpoints ya existen en Laravel.
export type TipoDocumento = 'CC' | 'CE' | 'PA' | 'PPT'

export interface Finalidad {
  codigo: string
  nombre: string
  descripcion: string
  necesaria: boolean
}

export interface PoliticaVigente {
  version: string
  vigente_desde: string
  resumen: string
  finalidades: Finalidad[]
}

export interface DatosRegistro {
  tipo_documento: TipoDocumento
  num_documento: string
  nombres: string
  apellidos: string
  fecha_nacimiento: string
  email: string
  telefono: string
  password: string
  password_confirmation: string
  acepta_politica: boolean
  finalidades_opcionales: string[]
  canal: 'web'
}

export interface RegistroPendiente {
  registro_id: string
  codigos_expiran_en: string
  reenvio_disponible_en: string
}

export interface RegistroCompletado {
  cliente_id: number
  estado_kyc: EstadoKyc
  siguiente_paso: 'verificacion_identidad'
}

// Verificación de identidad (RF-02).
export type EscenarioSimulado =
  | 'exito'
  | 'coincidencia_baja'
  | 'documento_ilegible'
  | 'servicio_caido'
  | 'lista_restrictiva'

export type ResultadoVerificacion =
  | 'verificado'
  | 'revision_manual'
  | 'ilegible'
  | 'en_cola'
  | 'no_continua'

export interface VerificacionIdentidad {
  estado_kyc: EstadoKyc
  resultado: ResultadoVerificacion | null
  /** Coincidencia biométrica de 0 a 1; el umbral es 0,85 (RN-08). */
  coincidencia: number | null
  mensaje: string | null
  intentos_restantes: number
  simulado: boolean
}

// Consentimiento (RF-04).
export interface FinalidadConEstado extends Finalidad {
  otorgada: boolean
  actualizada_en: string | null
}

export interface MovimientoConsentimiento {
  id: number
  finalidad: string
  nombre_finalidad: string
  accion: 'otorga' | 'revoca'
  canal: 'web' | 'movil'
  version_politica: string
  fecha_registro: string
}

export interface Consentimientos {
  politica: { version: string; vigente_desde: string }
  finalidades: FinalidadConEstado[]
  historial: MovimientoConsentimiento[]
}

// ── Simulación (RF-05) ──────────────────────────────────────────────────────

export interface Producto {
  codigo: string
  nombre: string
  descripcion: string
  tasa_ea: number
  monto_min: number
  monto_max: number
  plazo_min: number
  plazo_max: number
  paso_monto: number
}

export interface ConceptoCosto {
  concepto: string
  descripcion: string
  valor: number
}

export interface CuotaPlan {
  numero: number
  fecha: string
  cuota: number
  capital: number
  interes: number
  seguro: number
  saldo: number
}

export interface Simulacion {
  id: string
  producto: Pick<Producto, 'codigo' | 'nombre'>
  monto: number
  plazo_meses: number
  tasa_ea: number
  tasa_mensual: number
  cuota: number
  /** Suma del desglose (CP0011). */
  costo_total: number
  total_a_pagar: number
  desglose: ConceptoCosto[]
  plan: CuotaPlan[]
  tasa_maxima_legal_ea: number
  /** Los valores se conservan 30 días (RN-26). */
  vigente_hasta: string
}

// ── Originación (RF-06, RF-07, RF-09) ───────────────────────────────────────

export type EstadoSolicitud =
  | 'BORRADOR'
  | 'RADICADA'
  | 'PENDIENTE_CLIENTE'
  | 'EN_EVALUACION'
  | 'EN_ESTUDIO'
  | 'EN_DECISION'
  | 'EN_COMITE'
  | 'APROBADA'
  | 'APROBADA_CONDICIONADA'
  | 'NEGADA'
  | 'OFERTA_ACEPTADA'
  | 'FORMALIZADA'
  | 'DESEMBOLSADA'
  | 'DESISTIDA'
  | 'OFERTA_RECHAZADA'
  | 'OFERTA_VENCIDA'

export interface HitoEstado {
  estado: EstadoSolicitud
  fecha: string
}

export type AccionPendiente =
  | { tipo: 'documentos'; texto: string }
  | { tipo: 'oferta'; texto: string; oferta_id: string }
  | { tipo: 'decision'; texto: string }
  | { tipo: 'borrador'; texto: string }

export interface SolicitudResumen {
  id: string
  radicado: string | null
  producto: Pick<Producto, 'codigo' | 'nombre'>
  monto: number
  plazo_meses: number
  estado: EstadoSolicitud
  creada_en: string
  actualizada_en: string
  accion_pendiente: AccionPendiente | null
}

export type EstadoDocumento = 'pendiente' | 'cargado' | 'rechazado' | 'aprobado'

export interface DocumentoSolicitud {
  tipo: string
  nombre: string
  descripcion: string
  requerido: boolean
  estado: EstadoDocumento
  motivo_rechazo: string | null
  archivo: { nombre: string; tamano: number; cargado_en: string } | null
}

/** Datos que el cliente ya entregó: se muestran bloqueados (RN-32). */
export interface DatosConocidos {
  nombre_completo: string
  documento_enmascarado: string
  fecha_nacimiento: string
  email: string
  telefono_enmascarado: string
}

/** C:206. No hay campos de sexo, estado civil ni salud (RN-43). */
export interface DatosLaborales {
  ocupacion: 'empleado' | 'independiente' | 'pensionado' | ''
  empleador: string
  antiguedad_laboral_meses: number | null
}

export interface DatosFinancieros {
  ingreso_mensual: number | null
  egreso_mensual: number | null
}

/** Solo nombre y celular: el parentesco aproxima el estado civil (RN-43). */
export interface ReferenciaPersonal {
  nombre: string
  celular: string
}

export interface CapacidadPago {
  cuota_estimada: number
  ingreso_disponible: number
  porcentaje: number
  /** RN-41: 40 %. */
  limite: number
  supera_limite: boolean
}

export interface SolicitudDetalle extends SolicitudResumen {
  tasa_ea: number
  cuota_estimada: number
  datos_conocidos: DatosConocidos
  laboral: DatosLaborales
  financiero: DatosFinancieros
  referencia: ReferenciaPersonal
  documentos: DocumentoSolicitud[]
  acepta_consulta_centrales: boolean
  capacidad_pago: CapacidadPago | null
  historial: HitoEstado[]
  oferta_id: string | null
  /** El borrador se borra a los 30 días (RN-31). */
  borrador_vence_en: string | null
}

export interface CambiosBorrador {
  monto?: number
  plazo_meses?: number
  laboral?: DatosLaborales
  financiero?: DatosFinancieros
  referencia?: ReferenciaPersonal
  acepta_consulta_centrales?: boolean
}

export type EfectoVariable = 'favorable' | 'desfavorable'

export interface Reconsideracion {
  estado: 'en_revision' | 'resuelta'
  radicada_en: string
  argumentos: string
  respuesta: string | null
}

export interface ExplicacionDecision {
  resultado: 'negada' | 'aprobada_condicionada' | 'aprobada'
  automatizada: boolean
  /** Sin códigos ni tecnicismos (RF-09). */
  motivo_principal: string
  variables: { nombre: string; efecto: EfectoVariable; explicacion: string }[]
  decidida_en: string
  condicion: string | null
  reconsideracion: Reconsideracion | null
  puede_reconsiderar: boolean
  reconsideracion_vence_en: string | null
  radicado: string
  producto: string
}

// ── Oferta y pagaré (RF-11) ─────────────────────────────────────────────────

export type EstadoOferta = 'vigente' | 'firmada' | 'rechazada' | 'vencida'

export interface CondicionesOferta {
  monto: number
  plazo_meses: number
  tasa_ea: number
  cuota: number
}

export interface FirmaPagare {
  huella_sha256: string
  sellado_en: string
  simulada: boolean
}

export interface Oferta extends CondicionesOferta {
  id: string
  solicitud_id: string
  radicado: string
  producto: string
  estado: EstadoOferta
  costo_total: number
  desglose: ConceptoCosto[]
  plan: CuotaPlan[]
  emitida_en: string
  /** 15 días calendario (RN-59). */
  vence_en: string
  /** Si la aprobación fue condicionada, lo que pidió el cliente. */
  condiciones_originales: CondicionesOferta | null
  motivo_condicion: string | null
  pagare: { version: string; texto: string }
  firma: FirmaPagare | null
}

// ── Consola interna (RF-07, RF-08, RF-10) ───────────────────────────────────

export type Semaforo = 'a_tiempo' | 'por_vencer' | 'vencida'

export interface ItemBandeja {
  id: string
  radicado: string
  cliente: string
  documento_enmascarado: string
  producto: string
  monto: number
  estado: EstadoSolicitud
  en_cola_desde: string
  sla_vence_en: string
  semaforo: Semaforo
  reconsideracion: boolean
}

export interface Bandeja {
  indicadores: { asignadas: number; atendidas_hoy: number; pendientes: number; proximas_a_vencer: number }
  solicitudes: ItemBandeja[]
}

export interface FiltrosBandeja {
  estado?: string
  producto?: string
  monto_min?: number
  monto_max?: number
}

export interface Observacion {
  id: number
  autor: string
  rol: Rol
  texto: string
  fecha: string
}

export interface Concepto {
  recomendacion: 'aprobar' | 'aprobar_condicionado' | 'negar'
  texto: string
  autor: string
  fecha: string
}

export interface ConsultaCentral {
  fuente: 'simulada' | 'real'
  consultada_en: string
  obligaciones_vigentes: number
  saldo_total: number
  mora_maxima_dias: number
  consultas_ultimos_6_meses: number
  calificacion: string
}

export interface Expediente {
  solicitud: SolicitudDetalle
  solicitante: {
    nombre_completo: string
    documento_enmascarado: string
    edad: number
    email: string
    telefono_enmascarado: string
    cliente_desde: string
    estado_kyc: EstadoKyc
  }
  historial_finantech: { radicado: string; producto: string; monto: number; estado: EstadoSolicitud; fecha: string }[]
  central: ConsultaCentral | null
  observaciones: Observacion[]
  concepto: Concepto | null
  analista: string | null
  sla_vence_en: string
  semaforo: Semaforo
  reconsideracion: Reconsideracion | null
}

export interface VariableEvaluacion {
  codigo: string
  nombre: string
  valor: string
  /** Puntos que suma o resta al puntaje. */
  contribucion: number
}

export interface Evaluacion {
  id: string
  puntaje: number
  escala_min: number
  escala_max: number
  nivel_riesgo: 'bajo' | 'medio' | 'alto'
  decision_sugerida: 'aprobar' | 'escalar' | 'negar'
  umbrales: { aprobar: number; negar: number }
  /** RN-44: siempre visible. */
  version_reglas: string
  evaluada_en: string
  duracion_segundos: number
  variables: VariableEvaluacion[]
  capacidad_pago: CapacidadPago
  fuente_central: 'simulada' | 'real'
}

export type ResultadoDecision = 'aprobada' | 'aprobada_condicionada' | 'negada' | 'comite'

export interface ContextoDecision {
  atribucion_monto: number
  tasa_maxima_legal_ea: number
  /** El servidor ya sabe si hay conflicto de interés o si quien decide parametrizó (RN-55, RN-56). */
  bloqueo: { codigo: string; mensaje: string } | null
  decisiones_previas: { resultado: ResultadoDecision; motivo: string; autor: string; fecha: string; automatizada: boolean }[]
}

export interface NuevaDecision {
  solicitud_id: string
  resultado: ResultadoDecision
  motivo: string
  ajustes?: { monto: number; plazo_meses: number; tasa_ea: number }
}

// ── Administración (UC15-UC17) ──────────────────────────────────────────────

export type EstadoUsuario = 'activo' | 'bloqueado' | 'inactivo'

export interface UsuarioInterno {
  id: number
  nombre_completo: string
  email: string
  rol: Exclude<Rol, 'cliente'>
  cargo: string
  area: string
  atribucion_monto: number
  estado: EstadoUsuario
  ultimo_acceso_en: string | null
  /** Funciones ya ejercidas: no se pueden combinar (segregación de funciones). */
  funciones_ejercidas: ('parametrizar' | 'aprobar' | 'desembolsar')[]
}

export interface DatosUsuarioInterno {
  nombre_completo: string
  email: string
  rol: Exclude<Rol, 'cliente'>
  cargo: string
  area: string
  atribucion_monto: number
}

export interface ParametrosVersion {
  version: string
  vigente_desde: string
  publicado_por: string
  tasa_maxima_legal_ea: number
  umbral_aprobar: number
  umbral_negar: number
  limite_cuota_ingreso: number
  productos: Producto[]
}

export interface Parametros {
  vigente: ParametrosVersion
  historial: Pick<ParametrosVersion, 'version' | 'vigente_desde' | 'publicado_por'>[]
}

export type PropuestaParametros = Omit<ParametrosVersion, 'version' | 'publicado_por'>

export interface ImpactoParametros {
  evaluaciones: number
  antes: { aprobadas: number; escaladas: number; negadas: number }
  despues: { aprobadas: number; escaladas: number; negadas: number }
}

export interface RegistroAuditoria {
  id: number
  momento: string
  actor: string
  rol: Rol | 'sistema'
  accion: string
  entidad: string
  entidad_id: string
  origen: string
  resultado: 'exito' | 'rechazado'
  simulado: boolean
}

export interface FiltrosAuditoria {
  actor?: string
  desde?: string
  hasta?: string
  entidad?: string
  accion?: string
  pagina?: number
}

export interface PaginaAuditoria {
  registros: RegistroAuditoria[]
  total: number
  pagina: number
  por_pagina: number
  entidades: string[]
  acciones: string[]
}
