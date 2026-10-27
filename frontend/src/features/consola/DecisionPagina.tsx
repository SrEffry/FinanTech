import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { obtenerContextoDecision, obtenerExpediente, registrarDecision } from '../../lib/api/consola'
import type { ContextoDecision, Expediente, NuevaDecision, ResultadoDecision } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { formatoFechaHora, formatoMoneda, formatoPorcentaje } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Alert, Panel } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { EstadoBadge } from '../../components/dominio/Estado'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { PanelConcepto, PanelEvaluacion, PanelIngresos } from './PanelesExpediente'

const OPCIONES: { valor: ResultadoDecision; etiqueta: string; descripcion: string }[] = [
  { valor: 'aprobada', etiqueta: 'Aprobar', descripcion: 'Con el monto, plazo y tasa que pidió el cliente.' },
  { valor: 'aprobada_condicionada', etiqueta: 'Aprobar con condiciones', descripcion: 'Ajustas monto, plazo o tasa.' },
  { valor: 'negada', etiqueta: 'Negar', descripcion: 'El cliente verá el motivo y podrá pedir reconsideración.' },
  { valor: 'comite', etiqueta: 'Enviar a comité', descripcion: 'Cuando supera tu atribución o necesita otra instancia.' },
]

/** Decisión del oficial (8.3.4, RF-10). */
export default function DecisionPagina() {
  const { id = '' } = useParams()
  const expediente = useQuery({ queryKey: ['expediente', id], queryFn: () => obtenerExpediente(id) })
  const contexto = useQuery({ queryKey: ['contexto-decision', id], queryFn: () => obtenerContextoDecision(id) })
  if (expediente.isPending || contexto.isPending) return <CargaPagina />
  if (expediente.isError) return <Alert tono="error">{mensajeDe(expediente.error)}</Alert>
  if (contexto.isError) return <Alert tono="error">{mensajeDe(contexto.error)}</Alert>
  if (expediente.data.solicitud.estado !== 'EN_DECISION') return <Navigate to={`/consola/expedientes/${id}`} replace />
  return <FormularioDecision expediente={expediente.data} contexto={contexto.data} />
}

function FormularioDecision({ expediente, contexto }: { expediente: Expediente; contexto: ContextoDecision }) {
  const s = expediente.solicitud
  const cliente = useQueryClient()
  const navegar = useNavigate()
  const { avisar } = useToast()
  const [resultado, setResultado] = useState<ResultadoDecision | null>(null)
  const [monto, setMonto] = useState<number | null>(s.monto)
  const [plazo, setPlazo] = useState<number>(s.plazo_meses)
  const [tasa, setTasa] = useState<number>(s.tasa_ea)
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [confirmando, setConfirmando] = useState(false)

  const superaAtribucion = s.monto > contexto.atribucion_monto
  const montoFinal = resultado === 'aprobada_condicionada' ? (monto ?? 0) : s.monto
  // El portal avisa y deshabilita; el servidor vuelve a verificar todo (RN-53).
  const sinAtribucion = (resultado === 'aprobada' || resultado === 'aprobada_condicionada') && montoFinal > contexto.atribucion_monto

  const decision = useMutation({
    mutationFn: () => {
      const datos: NuevaDecision = { solicitud_id: s.id, resultado: resultado as ResultadoDecision, motivo: motivo.trim() }
      if (resultado === 'aprobada_condicionada') datos.ajustes = { monto: monto ?? 0, plazo_meses: plazo, tasa_ea: tasa }
      return registrarDecision(datos)
    },
    onSuccess: (nuevo) => {
      cliente.setQueryData(['expediente', s.id], nuevo)
      cliente.invalidateQueries({ queryKey: ['bandeja'] })
      avisar(`Decisión registrada para ${s.radicado}.`)
      navegar('/consola/oficial')
    },
    onError: () => setConfirmando(false),
  })

  function revisar() {
    const nuevos: Record<string, string> = {}
    if (!resultado) nuevos.resultado = 'Elige una decisión.'
    // RN-54: el motivo siempre es obligatorio.
    if (motivo.trim().length < 10) nuevos.motivo = 'Escribe el motivo de la decisión (al menos 10 caracteres).'
    if (resultado === 'aprobada_condicionada') {
      if (!monto) nuevos.monto = 'Escribe el monto aprobado.'
      if (tasa > contexto.tasa_maxima_legal_ea) nuevos.tasa = `No puede pasar de la máxima legal (${formatoPorcentaje(contexto.tasa_maxima_legal_ea)}).`
      if (!(plazo > 0)) nuevos.plazo = 'Escribe el plazo.'
    }
    setErrores(nuevos)
    if (Object.keys(nuevos).length === 0) setConfirmando(true)
  }

  const bloqueado = contexto.bloqueo !== null

  return (
    <div>
      <EncabezadoPagina
        titulo={`Decidir ${s.radicado}`}
        descripcion={`${expediente.solicitante.nombre_completo}, ${s.producto.nombre.toLowerCase()} por ${formatoMoneda(s.monto)} a ${s.plazo_meses} meses.`}
        migas={[
          { etiqueta: 'Bandeja', a: '/consola/oficial' },
          { etiqueta: s.radicado ?? '', a: `/consola/expedientes/${s.id}` },
          { etiqueta: 'Decisión' },
        ]}
        acciones={<EstadoBadge estado={s.estado} interno />}
      />

      {contexto.bloqueo ? (
        <Alert tono="error" titulo="No puedes decidir esta solicitud" className="mb-6">
          {contexto.bloqueo.mensaje}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel titulo="Lo que pidió el cliente">
            <CuotaConTea cuota={s.cuota_estimada} tea={s.tasa_ea} tamano="mediano" etiquetaCuota="Cuota estimada" />
          </Panel>
          <PanelIngresos expediente={expediente} />
          <PanelEvaluacion solicitudId={s.id} compacto />
          <PanelConcepto concepto={expediente.concepto} />
          {contexto.decisiones_previas.length > 0 ? (
            <Panel titulo="Decisiones anteriores" descripcion="Las decisiones no se editan: una corrección es una decisión nueva.">
              <ul className="flex flex-col gap-3 text-sm">
                {contexto.decisiones_previas.map((d) => (
                  <li key={d.fecha} className="flex flex-col gap-0.5 border-l-2 border-linea pl-3">
                    <span className="font-medium">
                      {OPCIONES.find((o) => o.valor === d.resultado)?.etiqueta ?? d.resultado} ({d.automatizada ? 'automática' : d.autor})
                    </span>
                    <span className="text-tinta-suave">{d.motivo}</span>
                    <span className="text-xs text-tinta-tenue">{formatoFechaHora(d.fecha)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <aside className="xl:sticky xl:top-6" aria-label="Decisión">
          <Panel variante="destacado" titulo="Tu decisión">
            <div className="flex flex-col gap-5">
              <div
                className={`flex gap-3 rounded-campo px-3 py-2.5 text-sm ${superaAtribucion ? 'bg-advertencia-50 text-advertencia-800' : 'bg-fondo text-tinta-suave'}`}
              >
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p>
                  Tu atribución es de <span className="font-semibold">{formatoMoneda(contexto.atribucion_monto)}</span>.
                  {superaAtribucion
                    ? ' Esta solicitud la supera: solo puedes negarla, enviarla a comité o aprobar un monto dentro de tu atribución.'
                    : ' Esta solicitud está dentro de tu atribución.'}
                </p>
              </div>

              <fieldset disabled={bloqueado} className="flex flex-col gap-2" aria-describedby={errores.resultado ? 'error-resultado' : undefined}>
                <legend className="mb-1 text-sm font-medium">Decisión</legend>
                {OPCIONES.map((o) => {
                  const deshabilitada = o.valor === 'aprobada' && superaAtribucion
                  return (
                    <label
                      key={o.valor}
                      className={`flex min-h-11 items-start gap-3 rounded-campo border px-3 py-2.5 ${
                        deshabilitada ? 'cursor-not-allowed border-linea opacity-60' : 'cursor-pointer'
                      } ${resultado === o.valor ? 'border-primario-600 bg-primario-50' : 'border-linea'}`}
                    >
                      <input
                        type="radio"
                        name="resultado"
                        value={o.valor}
                        checked={resultado === o.valor}
                        disabled={deshabilitada}
                        onChange={() => setResultado(o.valor)}
                        className="mt-1 size-4 accent-primario-600"
                      />
                      <span className="flex flex-col">
                        <span className="font-medium">{o.etiqueta}</span>
                        <span className="text-xs text-tinta-tenue">{deshabilitada ? 'Supera tu atribución.' : o.descripcion}</span>
                      </span>
                    </label>
                  )
                })}
                {errores.resultado ? (
                  <p id="error-resultado" className="text-sm font-medium text-alerta-700">
                    {errores.resultado}
                  </p>
                ) : null}
              </fieldset>

              {resultado === 'aprobada_condicionada' ? (
                <div className="flex flex-col gap-4 rounded-campo bg-fondo p-3">
                  <Field id="ajuste-monto" etiqueta="Monto aprobado" error={errores.monto}>
                    <MoneyInput valor={monto} onCambiar={setMonto} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="ajuste-plazo" etiqueta="Plazo (meses)" error={errores.plazo}>
                      <Input inputMode="numeric" className="cifras" value={plazo} onChange={(e) => setPlazo(Number(e.target.value.replace(/\D/g, '')))} />
                    </Field>
                    <Field id="ajuste-tasa" etiqueta="TEA (%)" error={errores.tasa}>
                      <Input
                        inputMode="decimal"
                        className="cifras"
                        value={tasa}
                        onChange={(e) => setTasa(Number(e.target.value.replace(',', '.')) || 0)}
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-tinta-tenue">Tasa máxima legal: {formatoPorcentaje(contexto.tasa_maxima_legal_ea)} E.A.</p>
                </div>
              ) : null}

              {sinAtribucion ? (
                <Alert tono="advertencia">El monto supera tu atribución. Bájalo o envía la solicitud a comité.</Alert>
              ) : null}

              <Field id="motivo" etiqueta="Motivo" ayuda="Obligatorio. El cliente verá una versión en lenguaje claro." error={errores.motivo}>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={bloqueado} />
              </Field>

              {decision.isError ? <Alert tono="error">{mensajeDe(decision.error)}</Alert> : null}

              <Button onClick={revisar} disabled={bloqueado || sinAtribucion}>
                Revisar y registrar
              </Button>
            </div>
          </Panel>
        </aside>
      </div>

      {/* Modal de confirmación: la decisión no se puede editar después (RN-58). */}
      <Modal
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        titulo="Confirma la decisión"
        descripcion="Las decisiones no se editan. Si luego hay que corregirla, se registra una decisión nueva."
        acciones={
          <>
            <Button variante="secundario" onClick={() => setConfirmando(false)}>
              Volver
            </Button>
            <Button variante={resultado === 'negada' ? 'peligro' : 'primario'} cargando={decision.isPending} onClick={() => decision.mutate()}>
              Registrar decisión
            </Button>
          </>
        }
      >
        <dl className="flex flex-col gap-2 rounded-campo bg-fondo p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-tinta-suave">Decisión</dt>
            <dd className="font-semibold">{OPCIONES.find((o) => o.valor === resultado)?.etiqueta}</dd>
          </div>
          {resultado === 'aprobada_condicionada' ? (
            <div className="flex justify-between gap-4">
              <dt className="text-tinta-suave">Condiciones</dt>
              <dd className="text-right font-semibold">
                {formatoMoneda(monto ?? 0)}, {plazo} meses, {formatoPorcentaje(tasa)} E.A.
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <dt className="text-tinta-suave">Motivo</dt>
            <dd>{motivo}</dd>
          </div>
        </dl>
      </Modal>
    </div>
  )
}
