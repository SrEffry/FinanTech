import { http, HttpResponse } from 'msw'
import type { CambiosBorrador } from '../../lib/api/tipos'
import { ETIQUETA_CLIENTE, estaActiva } from '../../lib/estados'
import { obtenerDb, parametrosVigentes, siguienteId, siguienteRadicado, type SolicitudDb, type UsuarioDb } from '../db'
import { avanzarSolicitud, cambiarEstado, enviarAEstudio, revisarVencimiento } from '../flujo'
import { documentosRequeridos } from '../motor'
import { POLITICA } from '../semilla'
import { API, auditar, errorNegocio, errorValidacion, exigirSesion, leerJson, manejar } from '../utilidades'
import { detalleSolicitud, explicacion, resumenSolicitud } from '../vistas'

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf']
const TAMANO_MAXIMO = 10 * 1024 * 1024

/** RN-35: el cliente solo ve sus propias solicitudes; las demás no existen para él. */
function solicitudPropia(cliente: UsuarioDb, id: string): SolicitudDb {
  const solicitud = obtenerDb().solicitudes.find((s) => s.id === id && s.cliente_id === cliente.id)
  if (!solicitud) throw errorNegocio('no_encontrada', 'No encontramos esa solicitud.', 404)
  avanzarSolicitud(solicitud)
  const oferta = obtenerDb().ofertas.find((o) => o.id === solicitud.oferta_id)
  if (oferta) revisarVencimiento(oferta)
  return solicitud
}

function consentimientoCentralesVigente(clienteId: number): boolean {
  const movimientos = obtenerDb().consentimientos.filter(
    (c) => c.usuario_id === clienteId && c.finalidad === 'consulta_centrales',
  )
  return movimientos[movimientos.length - 1]?.accion === 'otorga'
}

export const handlersSolicitudes = [
  http.get(
    `${API}/originacion/solicitudes`,
    manejar(() => {
      const cliente = exigirSesion(['cliente'])
      const db = obtenerDb()
      const propias = db.solicitudes.filter((s) => s.cliente_id === cliente.id)
      for (const solicitud of propias) {
        avanzarSolicitud(solicitud)
        const oferta = db.ofertas.find((o) => o.id === solicitud.oferta_id)
        if (oferta) revisarVencimiento(oferta)
      }
      const ordenadas = [...propias].sort((a, b) => b.actualizada_en.localeCompare(a.actualizada_en))
      return HttpResponse.json(ordenadas.map(resumenSolicitud))
    }),
  ),

  http.post(
    `${API}/originacion/solicitudes`,
    manejar(async ({ request }) => {
      const cliente = exigirSesion(['cliente'])
      const db = obtenerDb()
      // RN-07: no se radica sin identidad verificada.
      if (cliente.estado_kyc !== 'verificado') {
        return errorNegocio(
          'identidad_no_verificada',
          'Antes de solicitar un crédito necesitamos verificar tu identidad. Te toma unos minutos.',
          409,
        )
      }
      const { producto: codigo, monto = 0, plazo_meses: plazo = 0 } = await leerJson<{
        producto: string
        monto: number
        plazo_meses: number
      }>(request)
      const producto = parametrosVigentes().productos.find((p) => p.codigo === codigo)
      if (!producto) return errorNegocio('producto_invalido', 'Elige uno de los productos disponibles.')

      // RN-28: una sola solicitud activa por producto (RF-06 FA-03).
      const activa = db.solicitudes.find(
        (s) => s.cliente_id === cliente.id && s.producto === codigo && estaActiva(s.estado),
      )
      if (activa) {
        return errorNegocio(
          'solicitud_activa',
          `Ya tienes una solicitud de ${producto.nombre.toLowerCase()} en curso. Puedes seguirla desde tus solicitudes.`,
          409,
          { solicitud_id: activa.id, estado: ETIQUETA_CLIENTE[activa.estado] },
        )
      }

      // RN-32: lo que el cliente ya nos dio en otra solicitud se reutiliza.
      const anterior = [...db.solicitudes]
        .filter((s) => s.cliente_id === cliente.id)
        .sort((a, b) => b.creada_en.localeCompare(a.creada_en))[0]
      const ahora = new Date().toISOString()
      const laboral = anterior?.laboral ?? { ocupacion: '' as const, empleador: '', antiguedad_laboral_meses: null }
      const solicitud: SolicitudDb = {
        id: `sol-${siguienteId('solicitud')}`,
        radicado: null,
        cliente_id: cliente.id,
        producto: producto.codigo,
        monto: Math.min(producto.monto_max, Math.max(producto.monto_min, monto)),
        plazo_meses: Math.min(producto.plazo_max, Math.max(producto.plazo_min, plazo)),
        estado: 'BORRADOR',
        creada_en: ahora,
        actualizada_en: ahora,
        radicada_en: null,
        avance_desde: null,
        historial: [{ estado: 'BORRADOR', fecha: ahora }],
        laboral,
        financiero: anterior?.financiero ?? { ingreso_mensual: null, egreso_mensual: null },
        referencia: anterior?.referencia ?? { nombre: '', celular: '' },
        documentos: documentosRequeridos(laboral.ocupacion),
        acepta_consulta_centrales: consentimientoCentralesVigente(cliente.id),
        analista_id: null,
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
      db.solicitudes.push(solicitud)
      return HttpResponse.json(detalleSolicitud(solicitud), { status: 201 })
    }),
  ),

  http.get(
    `${API}/originacion/solicitudes/:id`,
    manejar(({ params }) => {
      const cliente = exigirSesion(['cliente'])
      return HttpResponse.json(detalleSolicitud(solicitudPropia(cliente, String(params.id))))
    }),
  ),

  http.patch(
    `${API}/originacion/solicitudes/:id`,
    manejar(async ({ request, params }) => {
      const cliente = exigirSesion(['cliente'])
      const solicitud = solicitudPropia(cliente, String(params.id))
      if (solicitud.estado !== 'BORRADOR') {
        return errorNegocio('no_editable', 'Esta solicitud ya fue radicada y no se puede cambiar.', 409)
      }
      const cambios = await leerJson<CambiosBorrador>(request)
      const producto = parametrosVigentes().productos.find((p) => p.codigo === solicitud.producto)
      const errores: Record<string, string> = {}
      if (cambios.monto !== undefined && producto && (cambios.monto < producto.monto_min || cambios.monto > producto.monto_max)) {
        errores.monto = 'El monto está fuera del rango del producto.'
      }
      if (cambios.plazo_meses !== undefined && producto && (cambios.plazo_meses < producto.plazo_min || cambios.plazo_meses > producto.plazo_max)) {
        errores.plazo_meses = 'El plazo está fuera del rango del producto.'
      }
      if (Object.keys(errores).length > 0) return errorValidacion(errores)

      if (cambios.monto !== undefined) solicitud.monto = cambios.monto
      if (cambios.plazo_meses !== undefined) solicitud.plazo_meses = cambios.plazo_meses
      if (cambios.financiero) solicitud.financiero = cambios.financiero
      if (cambios.referencia) solicitud.referencia = cambios.referencia
      if (cambios.acepta_consulta_centrales !== undefined) solicitud.acepta_consulta_centrales = cambios.acepta_consulta_centrales
      if (cambios.laboral) {
        const cambioPerfil = cambios.laboral.ocupacion !== solicitud.laboral.ocupacion
        solicitud.laboral = cambios.laboral
        if (cambioPerfil) solicitud.documentos = documentosRequeridos(cambios.laboral.ocupacion, solicitud.documentos)
      }
      solicitud.actualizada_en = new Date().toISOString()
      return HttpResponse.json(detalleSolicitud(solicitud))
    }),
  ),

  http.post(
    `${API}/originacion/solicitudes/:id/documentos`,
    manejar(async ({ request, params }) => {
      const cliente = exigirSesion(['cliente'])
      const solicitud = solicitudPropia(cliente, String(params.id))
      if (solicitud.estado !== 'BORRADOR' && solicitud.estado !== 'PENDIENTE_CLIENTE') {
        return errorNegocio('no_editable', 'En este momento no puedes cambiar los documentos de esta solicitud.', 409)
      }
      const formulario = await request.formData()
      const tipo = String(formulario.get('tipo') ?? '')
      const archivo = formulario.get('archivo')
      const documento = solicitud.documentos.find((d) => d.tipo === tipo)
      if (!documento) return errorNegocio('documento_invalido', 'Ese documento no hace parte de tu solicitud.')
      // RN-30: JPG, PNG o PDF de máximo 10 MB, también verificado en el servidor.
      if (!(archivo instanceof File) || !TIPOS_PERMITIDOS.includes(archivo.type)) {
        return errorNegocio('archivo_no_permitido', 'Sube el documento en JPG, PNG o PDF.')
      }
      if (archivo.size > TAMANO_MAXIMO) {
        return errorNegocio('archivo_no_permitido', 'El archivo pesa más de 10 MB. Comprímelo o tómale una foto.')
      }
      documento.estado = 'cargado'
      documento.motivo_rechazo = null
      documento.archivo = { nombre: archivo.name, tamano: archivo.size, cargado_en: new Date().toISOString() }
      solicitud.actualizada_en = new Date().toISOString()
      auditar(cliente, 'Documento cargado', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(documento)
    }),
  ),

  http.post(
    `${API}/originacion/solicitudes/:id/radicar`,
    manejar(({ params }) => {
      const cliente = exigirSesion(['cliente'])
      const solicitud = solicitudPropia(cliente, String(params.id))
      if (solicitud.estado !== 'BORRADOR') return errorNegocio('no_editable', 'Esta solicitud ya fue radicada.', 409)
      if (cliente.estado_kyc !== 'verificado') {
        return errorNegocio('identidad_no_verificada', 'Antes de radicar necesitamos verificar tu identidad.', 409)
      }

      const errores: Record<string, string> = {}
      const { laboral, financiero, referencia } = solicitud
      if (!laboral.ocupacion) errores['laboral.ocupacion'] = 'Elige tu ocupación.'
      if (!laboral.empleador.trim()) errores['laboral.empleador'] = 'Escribe dónde trabajas o tu actividad.'
      if (laboral.antiguedad_laboral_meses === null) errores['laboral.antiguedad_laboral_meses'] = 'Indica cuánto tiempo llevas.'
      if (!financiero.ingreso_mensual) errores['financiero.ingreso_mensual'] = 'Escribe tu ingreso mensual.'
      if (financiero.egreso_mensual === null) errores['financiero.egreso_mensual'] = 'Escribe tus gastos mensuales.'
      if (!referencia.nombre.trim()) errores['referencia.nombre'] = 'Escribe el nombre de tu referencia.'
      if (!/^3\d{9}$/.test(referencia.celular)) errores['referencia.celular'] = 'Escribe un celular de 10 dígitos que empiece por 3.'
      if (Object.keys(errores).length > 0) return errorValidacion(errores)

      const faltan = solicitud.documentos.filter((d) => d.requerido && d.estado !== 'cargado' && d.estado !== 'aprobado')
      if (faltan.length > 0) {
        return errorNegocio('documentos_incompletos', `Falta cargar: ${faltan.map((d) => d.nombre.toLowerCase()).join(', ')}.`, 422, {
          documentos: faltan.map((d) => d.tipo),
        })
      }
      // RN-33: autorización expresa para consultar centrales.
      if (!solicitud.acepta_consulta_centrales) {
        return errorNegocio(
          'consulta_centrales_requerida',
          'Para estudiar tu solicitud necesitamos tu autorización para consultar las centrales de riesgo.',
        )
      }

      const db = obtenerDb()
      const ahora = new Date()
      if (!consentimientoCentralesVigente(cliente.id)) {
        db.consentimientos.push({
          id: siguienteId('consentimiento'),
          usuario_id: cliente.id,
          finalidad: 'consulta_centrales',
          accion: 'otorga',
          canal: 'web',
          version_politica: POLITICA.version,
          fecha_registro: ahora.toISOString(),
        })
      }
      solicitud.radicado = siguienteRadicado(ahora)
      solicitud.radicada_en = ahora.toISOString()
      solicitud.avance_desde = ahora.toISOString()
      cambiarEstado(solicitud, 'RADICADA', ahora)
      auditar(cliente, 'Radicación de solicitud', 'solicitud', solicitud.radicado)
      return HttpResponse.json(detalleSolicitud(solicitud))
    }),
  ),

  http.post(
    `${API}/originacion/solicitudes/:id/enviar-documentos`,
    manejar(({ params }) => {
      const cliente = exigirSesion(['cliente'])
      const solicitud = solicitudPropia(cliente, String(params.id))
      if (solicitud.estado !== 'PENDIENTE_CLIENTE') {
        return errorNegocio('no_editable', 'Esta solicitud no está esperando documentos.', 409)
      }
      const faltan = solicitud.documentos.filter((d) => d.requerido && (d.estado === 'pendiente' || d.estado === 'rechazado'))
      if (faltan.length > 0) {
        return errorNegocio('documentos_incompletos', `Falta cargar: ${faltan.map((d) => d.nombre.toLowerCase()).join(', ')}.`)
      }
      const ahora = new Date()
      cambiarEstado(solicitud, 'RADICADA', ahora)
      // Si ya tenía evaluación, vuelve con el analista; si no, la evalúa el motor.
      if (solicitud.evaluacion_id || solicitud.analista_id) {
        enviarAEstudio(solicitud, ahora)
      } else {
        solicitud.avance_desde = ahora.toISOString()
      }
      auditar(cliente, 'Documentos enviados', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(detalleSolicitud(solicitud))
    }),
  ),

  http.get(
    `${API}/originacion/solicitudes/:id/decision`,
    manejar(({ params }) => {
      const cliente = exigirSesion(['cliente'])
      const vista = explicacion(solicitudPropia(cliente, String(params.id)))
      if (!vista) return errorNegocio('sin_decision', 'Esta solicitud todavía no tiene una decisión.', 404)
      return HttpResponse.json(vista)
    }),
  ),

  http.post(
    `${API}/originacion/solicitudes/:id/reconsideraciones`,
    manejar(async ({ request, params }) => {
      const cliente = exigirSesion(['cliente'])
      const solicitud = solicitudPropia(cliente, String(params.id))
      const vista = explicacion(solicitud)
      // RF-09 FA-03: no se permite una segunda reconsideración.
      if (solicitud.reconsideracion) {
        return errorNegocio('reconsideracion_existente', 'Ya pediste la reconsideración de esta solicitud.', 409)
      }
      if (!vista?.puede_reconsiderar) {
        return errorNegocio('reconsideracion_no_disponible', 'El plazo para pedir la reconsideración ya venció.', 409)
      }
      const formulario = await request.formData()
      const argumentos = String(formulario.get('argumentos') ?? '').trim()
      if (argumentos.length < 20) {
        return errorValidacion({ argumentos: 'Cuéntanos en al menos 20 caracteres por qué debemos revisar la decisión.' })
      }
      const ahora = new Date()
      solicitud.reconsideracion = { estado: 'en_revision', radicada_en: ahora.toISOString(), argumentos, respuesta: null }
      // RN-49: la reconsideración devuelve la solicitud a estudio.
      enviarAEstudio(solicitud, ahora)
      auditar(cliente, 'Reconsideración pedida', 'solicitud', solicitud.radicado ?? solicitud.id)
      return HttpResponse.json(explicacion(solicitud))
    }),
  ),
]
