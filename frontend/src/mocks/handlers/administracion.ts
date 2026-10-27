import { http, HttpResponse } from 'msw'
import type {
  DatosUsuarioInterno,
  EstadoUsuario,
  ImpactoParametros,
  Parametros,
  PropuestaParametros,
  Rol,
  UsuarioInterno,
} from '../../lib/api/tipos'
import { obtenerDb, parametrosVigentes, siguienteId, type UsuarioDb } from '../db'
import { CONTRASENA_DEMO } from '../semilla'
import { API, auditar, errorNegocio, errorValidacion, exigirSesion, leerJson, manejar, nombreCompleto } from '../utilidades'

type Funcion = UsuarioInterno['funciones_ejercidas'][number]

/** Función sensible de cada rol: una misma persona no puede ejercer dos (segregación de funciones). */
const FUNCION_DEL_ROL: Partial<Record<Rol, Funcion>> = {
  administrador: 'parametrizar',
  oficial: 'aprobar',
  contabilidad: 'desembolsar',
}

const PARTICIPIO: Record<Funcion, string> = {
  parametrizar: 'publicó parámetros de crédito',
  aprobar: 'decidió solicitudes de crédito',
  desembolsar: 'autorizó desembolsos',
}

const ROLES_INTERNOS: Exclude<Rol, 'cliente'>[] = ['analista', 'oficial', 'contabilidad', 'directivo', 'administrador']

function vistaUsuario(usuario: UsuarioDb): UsuarioInterno {
  return {
    id: usuario.id,
    nombre_completo: nombreCompleto(usuario),
    email: usuario.email,
    rol: usuario.rol as UsuarioInterno['rol'],
    cargo: usuario.cargo ?? '',
    area: usuario.area ?? '',
    atribucion_monto: usuario.atribucion_monto ?? 0,
    estado: usuario.estado,
    ultimo_acceso_en: usuario.ultimo_acceso_en,
    funciones_ejercidas: usuario.funciones_ejercidas ?? [],
  }
}

function validarDatos(datos: Partial<DatosUsuarioInterno>, idActual?: number): Record<string, string> {
  const errores: Record<string, string> = {}
  const db = obtenerDb()
  if (datos.nombre_completo !== undefined && datos.nombre_completo.trim().split(/\s+/).length < 2) {
    errores.nombre_completo = 'Escribe el nombre y el apellido.'
  }
  if (datos.email !== undefined) {
    const correo = datos.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.email = 'Escribe un correo válido.'
    else if (db.usuarios.some((u) => u.email === correo && u.id !== idActual)) errores.email = 'Ya existe un usuario con este correo.'
  }
  if (datos.rol !== undefined && !ROLES_INTERNOS.includes(datos.rol)) errores.rol = 'Elige un rol interno.'
  if (datos.cargo !== undefined && !datos.cargo.trim()) errores.cargo = 'Escribe el cargo.'
  if (datos.area !== undefined && !datos.area.trim()) errores.area = 'Escribe el área.'
  if (datos.atribucion_monto !== undefined && (datos.atribucion_monto < 0 || !Number.isFinite(datos.atribucion_monto))) {
    errores.atribucion_monto = 'La atribución no puede ser negativa.'
  }
  return errores
}

function conflictoSegregacion(usuario: UsuarioDb, rolNuevo: Rol): string | null {
  const nueva = FUNCION_DEL_ROL[rolNuevo]
  if (!nueva) return null
  const ejercida = (usuario.funciones_ejercidas ?? []).find((f) => f !== nueva)
  if (!ejercida) return null
  return `${nombreCompleto(usuario)} ya ${PARTICIPIO[ejercida]}. Una misma persona no puede parametrizar, aprobar y desembolsar, así que no puede recibir este rol.`
}

function parametros(): Parametros {
  const db = obtenerDb()
  return {
    vigente: parametrosVigentes(),
    historial: [...db.parametros].reverse().map(({ version, vigente_desde, publicado_por }) => ({ version, vigente_desde, publicado_por })),
  }
}

function validarPropuesta(propuesta: Partial<PropuestaParametros>): Record<string, string> {
  const errores: Record<string, string> = {}
  const maxima = propuesta.tasa_maxima_legal_ea ?? 0
  if (!(maxima > 0 && maxima < 100)) errores.tasa_maxima_legal_ea = 'Escribe la tasa máxima legal vigente.'
  if (!(Number(propuesta.umbral_negar) < Number(propuesta.umbral_aprobar))) {
    errores.umbral_negar = 'El umbral para negar debe ser menor que el de aprobación.'
  }
  if (!(Number(propuesta.limite_cuota_ingreso) > 0 && Number(propuesta.limite_cuota_ingreso) <= 100)) {
    errores.limite_cuota_ingreso = 'El límite debe estar entre 1 % y 100 %.'
  }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (!propuesta.vigente_desde || new Date(propuesta.vigente_desde) < hoy) {
    errores.vigente_desde = 'La vigencia empieza hoy o en una fecha futura.'
  }
  ;(propuesta.productos ?? []).forEach((p, i) => {
    // RN-23 / RN-57: ninguna tasa puede superar la máxima legal.
    if (p.tasa_ea > maxima) errores[`productos.${i}.tasa_ea`] = 'Supera la tasa máxima legal.'
    if (p.tasa_ea <= 0) errores[`productos.${i}.tasa_ea`] = 'Escribe una tasa válida.'
    if (p.monto_min >= p.monto_max) errores[`productos.${i}.monto_max`] = 'El máximo debe ser mayor que el mínimo.'
    if (p.plazo_min >= p.plazo_max) errores[`productos.${i}.plazo_max`] = 'El plazo máximo debe ser mayor que el mínimo.'
  })
  return errores
}

function clasificar(puntaje: number, porcentaje: number, aprobar: number, negar: number, limite: number) {
  if (puntaje >= aprobar && porcentaje <= limite) return 'aprobadas'
  if (puntaje < negar) return 'negadas'
  return 'escaladas'
}

function csv(valor: string | number | boolean): string {
  const texto = String(valor)
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export const handlersAdministracion = [
  http.get(
    `${API}/identidad/usuarios`,
    manejar(() => {
      exigirSesion(['administrador'])
      const internos = obtenerDb().usuarios.filter((u) => u.rol !== 'cliente')
      return HttpResponse.json(internos.map(vistaUsuario))
    }),
  ),

  http.post(
    `${API}/identidad/usuarios`,
    manejar(async ({ request }) => {
      const admin = exigirSesion(['administrador'])
      const datos = await leerJson<DatosUsuarioInterno>(request)
      const errores = validarDatos({
        nombre_completo: datos.nombre_completo ?? '',
        email: datos.email ?? '',
        rol: datos.rol,
        cargo: datos.cargo ?? '',
        area: datos.area ?? '',
        atribucion_monto: datos.atribucion_monto ?? 0,
      })
      if (Object.keys(errores).length > 0) return errorValidacion(errores)
      const [nombres, ...apellidos] = (datos.nombre_completo ?? '').trim().split(/\s+/)
      const usuario: UsuarioDb = {
        id: siguienteId('usuario'),
        nombres,
        apellidos: apellidos.join(' '),
        email: (datos.email ?? '').trim().toLowerCase(),
        password: CONTRASENA_DEMO,
        rol: datos.rol as Rol,
        estado: 'activo',
        ultimo_acceso_en: null,
        cargo: datos.cargo,
        area: datos.area,
        atribucion_monto: datos.rol === 'oficial' ? (datos.atribucion_monto ?? 0) : 0,
        funciones_ejercidas: [],
      }
      obtenerDb().usuarios.push(usuario)
      auditar(admin, 'Usuario creado', 'usuario', String(usuario.id))
      return HttpResponse.json(vistaUsuario(usuario), { status: 201 })
    }),
  ),

  http.patch(
    `${API}/identidad/usuarios/:id`,
    manejar(async ({ request, params }) => {
      const admin = exigirSesion(['administrador'])
      const usuario = obtenerDb().usuarios.find((u) => u.id === Number(params.id) && u.rol !== 'cliente')
      if (!usuario) return errorNegocio('no_encontrado', 'No encontramos ese usuario.', 404)
      const cambios = await leerJson<Partial<DatosUsuarioInterno> & { estado: EstadoUsuario }>(request)

      if (cambios.estado && usuario.id === admin.id) {
        return errorNegocio('propia_cuenta', 'No puedes bloquear ni desactivar tu propia cuenta.', 409)
      }
      const errores = validarDatos(cambios, usuario.id)
      if (Object.keys(errores).length > 0) return errorValidacion(errores)
      if (cambios.rol && cambios.rol !== usuario.rol) {
        const conflicto = conflictoSegregacion(usuario, cambios.rol)
        if (conflicto) {
          auditar(admin, 'Cambio de rol rechazado: segregación de funciones', 'usuario', String(usuario.id), { resultado: 'rechazado' })
          return errorNegocio('segregacion_funciones', conflicto)
        }
        usuario.rol = cambios.rol
      }
      if (cambios.nombre_completo) {
        const [nombres, ...apellidos] = cambios.nombre_completo.trim().split(/\s+/)
        usuario.nombres = nombres
        usuario.apellidos = apellidos.join(' ')
      }
      if (cambios.email) usuario.email = cambios.email.trim().toLowerCase()
      if (cambios.cargo) usuario.cargo = cambios.cargo
      if (cambios.area) usuario.area = cambios.area
      if (cambios.atribucion_monto !== undefined) usuario.atribucion_monto = usuario.rol === 'oficial' ? cambios.atribucion_monto : 0
      if (cambios.estado) usuario.estado = cambios.estado
      auditar(
        admin,
        cambios.estado === 'bloqueado' ? 'Usuario bloqueado' : cambios.estado === 'activo' ? 'Usuario desbloqueado' : 'Usuario actualizado',
        'usuario',
        String(usuario.id),
      )
      return HttpResponse.json(vistaUsuario(usuario))
    }),
  ),

  http.get(
    `${API}/evaluacion/parametros`,
    manejar(() => {
      exigirSesion(['administrador'])
      return HttpResponse.json(parametros())
    }),
  ),

  // 8.6.2: simulación del cambio contra las evaluaciones históricas.
  http.post(
    `${API}/evaluacion/parametros/simulaciones`,
    manejar(async ({ request }) => {
      exigirSesion(['administrador'])
      const propuesta = await leerJson<PropuestaParametros>(request)
      const actual = parametrosVigentes()
      const vacio = () => ({ aprobadas: 0, escaladas: 0, negadas: 0 })
      const impacto: ImpactoParametros = { evaluaciones: 0, antes: vacio(), despues: vacio() }
      for (const evaluacion of obtenerDb().evaluaciones) {
        const porcentaje = evaluacion.capacidad_pago.porcentaje
        impacto.evaluaciones += 1
        impacto.antes[clasificar(evaluacion.puntaje, porcentaje, actual.umbral_aprobar, actual.umbral_negar, actual.limite_cuota_ingreso)] += 1
        impacto.despues[
          clasificar(
            evaluacion.puntaje,
            porcentaje,
            Number(propuesta.umbral_aprobar),
            Number(propuesta.umbral_negar),
            Number(propuesta.limite_cuota_ingreso),
          )
        ] += 1
      }
      return HttpResponse.json(impacto)
    }),
  ),

  http.post(
    `${API}/evaluacion/parametros`,
    manejar(async ({ request }) => {
      const admin = exigirSesion(['administrador'])
      const propuesta = await leerJson<PropuestaParametros>(request)
      const errores = validarPropuesta(propuesta)
      if (Object.keys(errores).length > 0) return errorValidacion(errores)
      const db = obtenerDb()
      const fecha = new Date(propuesta.vigente_desde as string)
      const prefijo = `P-${fecha.getFullYear()}.${String(fecha.getMonth() + 1).padStart(2, '0')}`
      const consecutivo = db.parametros.filter((p) => p.version.startsWith(prefijo)).length + 1
      const version = `${prefijo}-${consecutivo}`
      db.parametros.push({ ...(propuesta as PropuestaParametros), version, publicado_por: nombreCompleto(admin) })
      db.parametros.sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
      if (!admin.funciones_ejercidas?.includes('parametrizar')) {
        admin.funciones_ejercidas = [...(admin.funciones_ejercidas ?? []), 'parametrizar']
      }
      auditar(admin, `Parámetros publicados (${version})`, 'parametros', version)
      return HttpResponse.json(parametros(), { status: 201 })
    }),
  ),

  // Auditoría completa para administrador y directivo; oficial y contabilidad ven solo la propia (S:1295).
  http.get(
    `${API}/identidad/auditoria`,
    manejar(({ request }) => {
      const usuario = exigirSesion(['administrador', 'directivo', 'oficial', 'contabilidad'])
      const filtros = new URL(request.url).searchParams
      const registros = filtrarAuditoria(usuario, filtros)
      const pagina = Math.max(1, Number(filtros.get('pagina') ?? 1))
      const porPagina = 15
      const todos = visiblesPara(usuario)
      return HttpResponse.json({
        registros: registros.slice((pagina - 1) * porPagina, pagina * porPagina),
        total: registros.length,
        pagina,
        por_pagina: porPagina,
        entidades: [...new Set(todos.map((r) => r.entidad))].sort(),
        acciones: [...new Set(todos.map((r) => r.accion.replace(/:.*$/, '')))].sort(),
      })
    }),
  ),

  http.get(
    `${API}/identidad/auditoria/exportar`,
    manejar(({ request }) => {
      const usuario = exigirSesion(['administrador', 'directivo', 'oficial', 'contabilidad'])
      const registros = filtrarAuditoria(usuario, new URL(request.url).searchParams)
      const filas = [
        ['id', 'momento', 'actor', 'rol', 'accion', 'entidad', 'entidad_id', 'origen', 'resultado', 'simulado'],
        ...registros.map((r) => [r.id, r.momento, r.actor, r.rol, r.accion, r.entidad, r.entidad_id, r.origen, r.resultado, r.simulado]),
      ]
      auditar(usuario, 'Exportación de evidencias', 'auditoria', `${registros.length} registros`)
      // BOM para que Excel abra el CSV con tildes correctas.
      const contenido = String.fromCharCode(0xfeff) + `${filas.map((f) => f.map(csv).join(',')).join('\n')}`
      return new HttpResponse(contenido, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
    }),
  ),
]

function visiblesPara(usuario: UsuarioDb) {
  const { auditoria } = obtenerDb()
  if (usuario.rol === 'administrador' || usuario.rol === 'directivo') return auditoria
  const nombre = nombreCompleto(usuario)
  return auditoria.filter((r) => r.actor === nombre)
}

function filtrarAuditoria(usuario: UsuarioDb, filtros: URLSearchParams) {
  const actor = (filtros.get('actor') ?? '').toLowerCase()
  const entidad = filtros.get('entidad') ?? ''
  const accion = filtros.get('accion') ?? ''
  const desde = filtros.get('desde')
  const hasta = filtros.get('hasta')
  return [...visiblesPara(usuario)]
    .filter(
      (r) =>
        (!actor || r.actor.toLowerCase().includes(actor)) &&
        (!entidad || r.entidad === entidad) &&
        (!accion || r.accion.startsWith(accion)) &&
        (!desde || r.momento >= new Date(`${desde}T00:00:00`).toISOString()) &&
        (!hasta || r.momento <= new Date(`${hasta}T23:59:59`).toISOString()),
    )
    .sort((a, b) => b.momento.localeCompare(a.momento))
}
