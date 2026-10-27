import { solicitar } from './cliente'
import type {
  Consentimientos,
  DatosRegistro,
  DesafioMfa,
  EscenarioSimulado,
  EstadoSistema,
  PoliticaVigente,
  RegistroCompletado,
  RegistroPendiente,
  Usuario,
  VerificacionIdentidad,
} from './tipos'

export function obtenerEstadoSistema() {
  return solicitar<EstadoSistema>('/sistema/estado')
}

// Sesión (RF-03). El servidor responde lo mismo exista o no el correo (RN-17).
export function iniciarSesion(email: string, password: string) {
  return solicitar<DesafioMfa>('/identidad/sesiones', { metodo: 'POST', cuerpo: { email, password } })
}

export function verificarSegundoFactor(desafioId: string, codigo: string) {
  return solicitar<{ usuario: Usuario }>(`/identidad/sesiones/${desafioId}/verificar`, {
    metodo: 'POST',
    cuerpo: { codigo },
  })
}

export function reenviarSegundoFactor(desafioId: string) {
  return solicitar<DesafioMfa>(`/identidad/sesiones/${desafioId}/reenviar`, { metodo: 'POST' })
}

export async function obtenerSesion(): Promise<Usuario | null> {
  const { usuario } = await solicitar<{ usuario: Usuario | null }>('/identidad/sesion')
  return usuario
}

export function cerrarSesion() {
  return solicitar<void>('/identidad/sesion', { metodo: 'DELETE' })
}

export function pedirRecuperacion(email: string) {
  return solicitar<{ mensaje: string }>('/identidad/recuperacion', { metodo: 'POST', cuerpo: { email } })
}

// Registro (RF-01): endpoints reales de Laravel.
export function obtenerPoliticaVigente() {
  return solicitar<PoliticaVigente>('/identidad/politica-vigente')
}

export function iniciarRegistro(datos: DatosRegistro) {
  return solicitar<RegistroPendiente>('/clientes/registro', { metodo: 'POST', cuerpo: datos })
}

export function reenviarCodigosRegistro(registroId: string) {
  return solicitar<RegistroPendiente>(`/clientes/registro/${registroId}/reenviar`, { metodo: 'POST' })
}

export function verificarCodigosRegistro(registroId: string, codigoEmail: string, codigoTelefono: string) {
  return solicitar<RegistroCompletado>(`/clientes/registro/${registroId}/verificar`, {
    metodo: 'POST',
    cuerpo: { codigo_email: codigoEmail, codigo_telefono: codigoTelefono },
  })
}

// Verificación de identidad (RF-02).
export function obtenerVerificacionIdentidad() {
  return solicitar<VerificacionIdentidad>('/clientes/verificacion-identidad')
}

export function enviarVerificacionIdentidad(archivos: {
  frente: Blob
  reverso: Blob
  rostro: Blob
  escenario?: EscenarioSimulado
}) {
  const formulario = new FormData()
  formulario.append('documento_frente', archivos.frente)
  formulario.append('documento_reverso', archivos.reverso)
  formulario.append('rostro', archivos.rostro)
  // Solo lo atienden los adaptadores simulados (MR-003): fuerza un escenario de prueba.
  if (archivos.escenario) formulario.append('escenario', archivos.escenario)
  return solicitar<VerificacionIdentidad>('/clientes/verificacion-identidad', {
    metodo: 'POST',
    formulario,
  })
}

// Consentimiento (RF-04).
export function obtenerConsentimientos() {
  return solicitar<Consentimientos>('/identidad/consentimientos')
}

export function cambiarConsentimiento(finalidad: string, accion: 'otorga' | 'revoca') {
  return solicitar<Consentimientos>('/identidad/consentimientos', {
    metodo: 'POST',
    cuerpo: { finalidad, accion, canal: 'web' },
  })
}
