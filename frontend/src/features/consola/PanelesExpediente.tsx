import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { obtenerEvaluacion } from '../../lib/api/consola'
import type { Concepto, Expediente } from '../../lib/api/tipos'
import { codigoDe, mensajeDe } from '../../lib/errores'
import { formatoFecha, formatoFechaHora, formatoMoneda } from '../../lib/formato'
import { Alert, Badge, Panel } from '../../components/ui/Feedback'
import { formatoTamano } from '../../components/ui/FileDrop'
import { Skeleton } from '../../components/ui/Spinner'
import { DistintivoSimulado } from '../../components/dominio/Distintivos'
import { EstadoBadge } from '../../components/dominio/Estado'
import { ContribucionVariables, MedidorPuntaje } from '../../components/dominio/Evaluacion'

const KYC = { pendiente: 'Pendiente', verificado: 'Verificada', revision_manual: 'En revisión manual', bloqueado: 'Bloqueada' }
const OCUPACION = { empleado: 'Empleado', independiente: 'Independiente', pensionado: 'Pensionado', '': 'Sin dato' }
const RECOMENDACION: Record<Concepto['recomendacion'], string> = {
  aprobar: 'Aprobar',
  aprobar_condicionado: 'Aprobar con condiciones',
  negar: 'Negar',
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-tinta-tenue">{etiqueta}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

export function PanelSolicitante({ expediente }: { expediente: Expediente }) {
  const { solicitante: s } = expediente
  return (
    <Panel titulo="Solicitante">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dato etiqueta="Nombre">{s.nombre_completo}</Dato>
        <Dato etiqueta="Documento">{s.documento_enmascarado}</Dato>
        <Dato etiqueta="Edad">{s.edad} años</Dato>
        <Dato etiqueta="Correo">{s.email}</Dato>
        <Dato etiqueta="Celular">{s.telefono_enmascarado}</Dato>
        <Dato etiqueta="Cliente desde">{formatoFecha(s.cliente_desde)}</Dato>
        <Dato etiqueta="Identidad">{KYC[s.estado_kyc]}</Dato>
      </dl>
    </Panel>
  )
}

export function PanelIngresos({ expediente }: { expediente: Expediente }) {
  const { laboral, financiero, capacidad_pago: capacidad, referencia } = expediente.solicitud
  return (
    <Panel titulo="Información laboral y de ingresos">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dato etiqueta="Ocupación">{OCUPACION[laboral.ocupacion]}</Dato>
        <Dato etiqueta="Empresa o actividad">{laboral.empleador}</Dato>
        <Dato etiqueta="Antigüedad">{laboral.antiguedad_laboral_meses ?? '—'} meses</Dato>
        <Dato etiqueta="Ingreso mensual">{formatoMoneda(financiero.ingreso_mensual ?? 0)}</Dato>
        <Dato etiqueta="Gastos mensuales">{formatoMoneda(financiero.egreso_mensual ?? 0)}</Dato>
        {capacidad ? (
          <Dato etiqueta="Cuota frente al disponible">
            <span className={capacidad.supera_limite ? 'text-alerta-700' : ''}>
              {capacidad.porcentaje.toLocaleString('es-CO')} % (límite {capacidad.limite} %)
            </span>
          </Dato>
        ) : null}
        <Dato etiqueta="Referencia">
          {referencia.nombre}, celular terminado en {referencia.celular.slice(-4)}
        </Dato>
      </dl>
    </Panel>
  )
}

/** Resultado de la evaluación (8.3.3). La versión de reglas siempre está a la vista (RN-44). */
export function PanelEvaluacion({ solicitudId, compacto = false }: { solicitudId: string; compacto?: boolean }) {
  const evaluacion = useQuery({
    queryKey: ['evaluacion', solicitudId],
    queryFn: () => obtenerEvaluacion(solicitudId),
    retry: false,
  })

  if (evaluacion.isPending) {
    return (
      <Panel titulo="Resultado de la evaluación">
        <Skeleton className="h-40" />
      </Panel>
    )
  }
  if (evaluacion.isError) {
    return (
      <Panel titulo="Resultado de la evaluación">
        <Alert tono={codigoDe(evaluacion.error) === 'sin_evaluacion' ? 'info' : 'error'}>{mensajeDe(evaluacion.error)}</Alert>
      </Panel>
    )
  }
  const e = evaluacion.data
  return (
    <Panel
      titulo="Resultado de la evaluación"
      descripcion={`Evaluada el ${formatoFechaHora(e.evaluada_en)} en ${e.duracion_segundos} s.`}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tono="info">Reglas {e.version_reglas}</Badge>
          {e.fuente_central === 'simulada' ? <DistintivoSimulado que="Central simulada" /> : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <MedidorPuntaje evaluacion={e} />
        {compacto ? (
          <ContribucionVariables variables={e.variables.slice(0, 4)} />
        ) : (
          <ContribucionVariables variables={e.variables} />
        )}
      </div>
    </Panel>
  )
}

export function PanelCentral({ expediente }: { expediente: Expediente }) {
  const c = expediente.central
  return (
    <Panel
      titulo="Central de riesgo"
      acciones={c?.fuente === 'simulada' ? <DistintivoSimulado que="Consulta simulada" /> : undefined}
      descripcion={c ? `Consultada el ${formatoFechaHora(c.consultada_en)}` : undefined}
    >
      {c ? (
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Calificación">{c.calificacion}</Dato>
          <Dato etiqueta="Obligaciones vigentes">{c.obligaciones_vigentes}</Dato>
          <Dato etiqueta="Saldo total">{formatoMoneda(c.saldo_total)}</Dato>
          <Dato etiqueta="Mora máxima">{c.mora_maxima_dias === 0 ? 'Sin mora' : `${c.mora_maxima_dias} días`}</Dato>
          <Dato etiqueta="Consultas en 6 meses">{c.consultas_ultimos_6_meses}</Dato>
        </dl>
      ) : (
        <Alert tono="info">La central de riesgo no respondió. La solicitud pasó a estudio manual (RF-08 FA-02).</Alert>
      )}
    </Panel>
  )
}

/** Documentos con previsualización (8.3.2). */
export function PanelDocumentos({ expediente }: { expediente: Expediente }) {
  const documentos = expediente.solicitud.documentos
  const [elegido, setElegido] = useState(documentos.find((d) => d.archivo)?.tipo ?? null)
  const documento = documentos.find((d) => d.tipo === elegido)
  return (
    <Panel titulo="Documentos">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="flex flex-col gap-1" aria-label="Documentos de la solicitud">
          {documentos.map((d) => (
            <li key={d.tipo}>
              <button
                type="button"
                onClick={() => setElegido(d.tipo)}
                aria-pressed={elegido === d.tipo}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-campo px-3 py-2 text-left text-sm ${
                  elegido === d.tipo ? 'bg-primario-50 text-primario-800' : 'hover:bg-fondo'
                }`}
              >
                <span className="font-medium">{d.nombre}</span>
                <Badge tono={d.estado === 'rechazado' ? 'negado' : d.estado === 'pendiente' ? 'neutro' : 'progreso'}>
                  {d.estado === 'cargado' ? 'Cargado' : d.estado === 'rechazado' ? 'Rechazado' : d.estado === 'aprobado' ? 'Aprobado' : 'Pendiente'}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-campo border border-dashed border-linea bg-fondo p-4 text-center">
          {documento?.archivo ? (
            <>
              <FileText aria-hidden="true" className="size-10 text-primario-400" />
              <p className="text-sm font-medium">{documento.archivo.nombre}</p>
              <p className="text-xs text-tinta-tenue">
                {formatoTamano(documento.archivo.tamano)}, cargado el {formatoFechaHora(documento.archivo.cargado_en)}
              </p>
              <p className="text-xs text-tinta-tenue">En la demostración no hay archivo real para mostrar.</p>
            </>
          ) : (
            <p className="text-sm text-tinta-suave">{documento ? 'Este documento aún no se ha cargado.' : 'Elige un documento para verlo.'}</p>
          )}
          {documento?.motivo_rechazo ? <p className="text-sm text-alerta-700">Rechazado: {documento.motivo_rechazo}</p> : null}
        </div>
      </div>
    </Panel>
  )
}

export function PanelHistorial({ expediente }: { expediente: Expediente }) {
  return (
    <Panel titulo="Historial con FinanTech">
      {expediente.historial_finantech.length === 0 ? (
        <p className="text-sm text-tinta-suave">Es su primera solicitud.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {expediente.historial_finantech.map((h) => (
            <li key={h.radicado} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{h.radicado}</span>, {h.producto.toLowerCase()} por {formatoMoneda(h.monto)}
              </span>
              <EstadoBadge estado={h.estado} interno />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function PanelConcepto({ concepto }: { concepto: Concepto | null }) {
  return (
    <Panel titulo="Concepto del analista">
      {concepto ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Recomienda: <span className="font-semibold">{RECOMENDACION[concepto.recomendacion]}</span>
          </p>
          <p className="leading-relaxed text-tinta-suave">{concepto.texto}</p>
          <p className="text-xs text-tinta-tenue">
            {concepto.autor}, {formatoFechaHora(concepto.fecha)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-tinta-suave">Todavía no hay concepto.</p>
      )}
    </Panel>
  )
}

export function PanelObservaciones({ expediente }: { expediente: Expediente }) {
  return (
    <Panel titulo="Observaciones">
      {expediente.observaciones.length === 0 ? (
        <p className="text-sm text-tinta-suave">Sin observaciones.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {expediente.observaciones.map((o) => (
            <li key={o.id} className="flex flex-col gap-1 border-l-2 border-linea pl-3">
              <p className="text-sm leading-relaxed">{o.texto}</p>
              <p className="text-xs text-tinta-tenue">
                {o.autor}, {formatoFechaHora(o.fecha)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
