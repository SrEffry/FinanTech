import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { agregarObservacion, emitirConcepto, obtenerExpediente, pedirDocumentos } from '../../lib/api/consola'
import type { Concepto, Expediente } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { formatoFechaHora, formatoMoneda } from '../../lib/formato'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Choice'
import { Field, Textarea } from '../../components/ui/Field'
import { Alert, Panel } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { EstadoBadge } from '../../components/dominio/Estado'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'
import {
  PanelCentral,
  PanelConcepto,
  PanelDocumentos,
  PanelEvaluacion,
  PanelHistorial,
  PanelIngresos,
  PanelObservaciones,
  PanelSolicitante,
} from './PanelesExpediente'

/** Expediente consolidado (8.3.2) con la evaluación (8.3.3) y las acciones del analista. */
export default function ExpedientePagina() {
  const { id = '' } = useParams()
  const usuario = useUsuario()
  const expediente = useQuery({ queryKey: ['expediente', id], queryFn: () => obtenerExpediente(id) })

  if (expediente.isPending) return <CargaPagina />
  if (expediente.isError) return <Alert tono="error">{mensajeDe(expediente.error)}</Alert>
  const x = expediente.data
  const s = x.solicitud
  const bandeja = usuario.rol === 'oficial' ? '/consola/oficial' : '/consola/analista'

  return (
    <div>
      <EncabezadoPagina
        titulo={`Expediente ${s.radicado}`}
        descripcion={`${s.producto.nombre} por ${formatoMoneda(s.monto)} a ${s.plazo_meses} meses. Analista: ${x.analista ?? 'sin asignar'}.`}
        migas={[{ etiqueta: 'Bandeja', a: bandeja }, { etiqueta: s.radicado ?? 'Expediente' }]}
        acciones={<EstadoBadge estado={s.estado} interno />}
      />

      {x.reconsideracion ? (
        <Alert tono="info" titulo="El cliente pidió reconsiderar la decisión" className="mb-6">
          <span className="block">{x.reconsideracion.argumentos}</span>
          <span className="mt-1 block text-xs">Pedida el {formatoFechaHora(x.reconsideracion.radicada_en)}.</span>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <PanelSolicitante expediente={x} />
          <PanelIngresos expediente={x} />
          <PanelEvaluacion solicitudId={s.id} />
          <PanelCentral expediente={x} />
          <PanelDocumentos expediente={x} />
          <PanelHistorial expediente={x} />
        </div>
        <aside className="flex flex-col gap-6 xl:sticky xl:top-6" aria-label="Acciones">
          {usuario.rol === 'analista' ? <AccionesAnalista expediente={x} /> : null}
          {usuario.rol === 'oficial' ? (
            <>
              <PanelConcepto concepto={x.concepto} />
              {s.estado === 'EN_DECISION' ? <ButtonLink to={`/consola/decisiones/${s.id}`}>Ir a decidir</ButtonLink> : null}
            </>
          ) : null}
          <PanelObservaciones expediente={x} />
        </aside>
      </div>
    </div>
  )
}

function AccionesAnalista({ expediente }: { expediente: Expediente }) {
  const s = expediente.solicitud
  const cliente = useQueryClient()
  const navegar = useNavigate()
  const { avisar } = useToast()
  const [observacion, setObservacion] = useState('')
  const [recomendacion, setRecomendacion] = useState<Concepto['recomendacion'] | ''>('')
  const [texto, setTexto] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [pidiendo, setPidiendo] = useState(false)
  const [pedidos, setPedidos] = useState<Record<string, string>>({})

  const actualizar = (nuevo: Expediente) => {
    cliente.setQueryData(['expediente', s.id], nuevo)
    cliente.invalidateQueries({ queryKey: ['bandeja'] })
  }

  const nota = useMutation({
    mutationFn: () => agregarObservacion(s.id, observacion.trim()),
    onSuccess: () => {
      setObservacion('')
      cliente.invalidateQueries({ queryKey: ['expediente', s.id] })
      avisar('Observación registrada.')
    },
  })

  const concepto = useMutation({
    mutationFn: () => emitirConcepto(s.id, recomendacion as Concepto['recomendacion'], texto.trim()),
    onSuccess: (nuevo) => {
      actualizar(nuevo)
      avisar(`Concepto emitido. ${s.radicado} pasó a decisión.`)
      navegar('/consola/analista')
    },
  })

  const documentos = useMutation({
    mutationFn: () => pedirDocumentos(s.id, Object.entries(pedidos).map(([tipo, motivo]) => ({ tipo, motivo: motivo.trim() }))),
    onSuccess: (nuevo) => {
      actualizar(nuevo)
      setPidiendo(false)
      setPedidos({})
      avisar('Le pedimos los documentos al cliente.')
    },
  })

  if (s.estado !== 'EN_ESTUDIO') {
    return (
      <>
        <PanelConcepto concepto={expediente.concepto} />
        <Alert tono="info">
          {s.estado === 'PENDIENTE_CLIENTE'
            ? 'Esperando documentos del cliente. Cuando los envíe, la solicitud vuelve a tu bandeja.'
            : 'Esta solicitud ya no está en estudio.'}
        </Alert>
      </>
    )
  }

  return (
    <>
      <Panel titulo="Emitir concepto">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const nuevos: Record<string, string> = {}
            if (!recomendacion) nuevos.recomendacion = 'Elige tu recomendación.'
            if (texto.trim().length < 20) nuevos.texto = 'Explica tu concepto en al menos 20 caracteres.'
            setErrores(nuevos)
            if (Object.keys(nuevos).length === 0) concepto.mutate()
          }}
        >
          <fieldset className="flex flex-col gap-1" aria-describedby={errores.recomendacion ? 'error-recomendacion' : undefined}>
            <legend className="mb-1 text-sm font-medium">Recomendación</legend>
            {(
              [
                ['aprobar', 'Aprobar'],
                ['aprobar_condicionado', 'Aprobar con condiciones'],
                ['negar', 'Negar'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <label key={valor} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="recomendacion"
                  value={valor}
                  checked={recomendacion === valor}
                  onChange={() => setRecomendacion(valor)}
                  className="size-4 accent-primario-600"
                />
                {etiqueta}
              </label>
            ))}
            {errores.recomendacion ? (
              <p id="error-recomendacion" className="text-sm font-medium text-alerta-700">
                {errores.recomendacion}
              </p>
            ) : null}
          </fieldset>
          <Field id="texto-concepto" etiqueta="Concepto" error={errores.texto}>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Field>
          {concepto.isError ? <Alert tono="error">{mensajeDe(concepto.error)}</Alert> : null}
          <Button type="submit" cargando={concepto.isPending}>
            Enviar a decisión
          </Button>
        </form>
      </Panel>

      <Panel titulo="Otras acciones">
        <div className="flex flex-col gap-4">
          <Button variante="secundario" onClick={() => setPidiendo(true)}>
            Pedir documentos al cliente
          </Button>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (observacion.trim().length >= 5) nota.mutate()
            }}
          >
            <Field id="observacion" etiqueta="Registrar observación">
              <Textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} className="min-h-20" />
            </Field>
            {nota.isError ? <Alert tono="error">{mensajeDe(nota.error)}</Alert> : null}
            <Button type="submit" variante="secundario" cargando={nota.isPending} disabled={observacion.trim().length < 5}>
              Guardar observación
            </Button>
          </form>
        </div>
      </Panel>

      {/* UC8: cada documento pedido lleva su motivo. */}
      <Modal
        abierto={pidiendo}
        onCerrar={() => setPidiendo(false)}
        titulo="Pedir documentos al cliente"
        descripcion="La solicitud pasa a esperar al cliente. Si no carga lo pedido en 15 días, se desiste."
        acciones={
          <>
            <Button variante="secundario" onClick={() => setPidiendo(false)}>
              Cancelar
            </Button>
            <Button
              cargando={documentos.isPending}
              disabled={Object.keys(pedidos).length === 0 || Object.values(pedidos).some((m) => m.trim().length < 10)}
              onClick={() => documentos.mutate()}
            >
              Pedir documentos
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {[...s.documentos.map((d) => ({ tipo: d.tipo, nombre: d.nombre })), { tipo: 'documento_adicional', nombre: 'Otro documento' }].map((d) => (
            <div key={d.tipo} className="flex flex-col gap-2">
              <Checkbox
                id={`pedir-${d.tipo}`}
                etiqueta={d.nombre}
                checked={d.tipo in pedidos}
                onChange={(e) =>
                  setPedidos((actuales) => {
                    const nuevos = { ...actuales }
                    if (e.target.checked) nuevos[d.tipo] = ''
                    else delete nuevos[d.tipo]
                    return nuevos
                  })
                }
              />
              {d.tipo in pedidos ? (
                <Field id={`motivo-${d.tipo}`} etiqueta="Motivo para el cliente" ayuda="Dile exactamente qué falta o qué corregir.">
                  <Textarea
                    value={pedidos[d.tipo]}
                    onChange={(e) => setPedidos((actuales) => ({ ...actuales, [d.tipo]: e.target.value }))}
                    className="min-h-20"
                  />
                </Field>
              ) : null}
            </div>
          ))}
          {documentos.isError ? <Alert tono="error">{mensajeDe(documentos.error)}</Alert> : null}
        </div>
      </Modal>
    </>
  )
}
