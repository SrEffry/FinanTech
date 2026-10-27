import { consulta, descargar, solicitar } from './cliente'
import type {
  DatosUsuarioInterno,
  EstadoUsuario,
  FiltrosAuditoria,
  ImpactoParametros,
  PaginaAuditoria,
  Parametros,
  PropuestaParametros,
  UsuarioInterno,
} from './tipos'

export function listarUsuarios() {
  return solicitar<UsuarioInterno[]>('/identidad/usuarios')
}

export function crearUsuario(datos: DatosUsuarioInterno) {
  return solicitar<UsuarioInterno>('/identidad/usuarios', { metodo: 'POST', cuerpo: datos })
}

/** Responde 422 `segregacion_funciones` si el cambio junta parametrizar, aprobar o desembolsar. */
export function actualizarUsuario(id: number, cambios: Partial<DatosUsuarioInterno> & { estado?: EstadoUsuario }) {
  return solicitar<UsuarioInterno>(`/identidad/usuarios/${id}`, { metodo: 'PATCH', cuerpo: cambios })
}

export function obtenerParametros() {
  return solicitar<Parametros>('/evaluacion/parametros')
}

/** Simula la propuesta contra las evaluaciones históricas antes de publicarla (8.6.2). */
export function simularParametros(propuesta: PropuestaParametros) {
  return solicitar<ImpactoParametros>('/evaluacion/parametros/simulaciones', {
    metodo: 'POST',
    cuerpo: propuesta,
  })
}

export function publicarParametros(propuesta: PropuestaParametros) {
  return solicitar<Parametros>('/evaluacion/parametros', { metodo: 'POST', cuerpo: propuesta })
}

export function consultarAuditoria(filtros: FiltrosAuditoria) {
  return solicitar<PaginaAuditoria>(`/identidad/auditoria${consulta(filtros)}`)
}

export function exportarAuditoria(filtros: FiltrosAuditoria) {
  // La exportación lleva todos los registros del filtro, no solo la página visible.
  const sinPagina = { ...filtros, pagina: undefined }
  return descargar(`/identidad/auditoria/exportar${consulta(sinPagina)}`, 'auditoria-finantech.csv')
}
