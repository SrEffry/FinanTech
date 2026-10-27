import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { Bot, Printer, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react'
import { obtenerExplicacion, pedirReconsideracion } from '../../lib/api/solicitudes'
import { mensajeDe } from '../../lib/errores'
import { formatoFecha, formatoFechaHora } from '../../lib/formato'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Textarea } from '../../components/ui/Field'
import { FileDrop } from '../../components/ui/FileDrop'
import { Alert, Panel } from '../../components/ui/Feedback'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { EncabezadoPagina } from '../../components/layouts/Comunes'

const TITULO = {
  negada: 'Tu solicitud no fue aprobada',
  aprobada_condicionada: 'Tu solicitud fue aprobada con condiciones',
  aprobada: 'Tu solicitud fue aprobada',
}

/**
 * Explicación de la decisión (8.2.6, RF-09): el motivo en lenguaje claro, los factores
 * que más pesaron, si la decidió un sistema o una persona, y la reconsideración.
 */
export default function ExplicacionPagina() {
  const { id = '' } = useParams()
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const [argumentos, setArgumentos] = useState('')
  const [adjunto, setAdjunto] = useState<File | null>(null)
  const [error, setError] = useState<string>()
  const explicacion = useQuery({ queryKey: ['explicacion', id], queryFn: () => obtenerExplicacion(id) })

  const reconsideracion = useMutation({
    mutationFn: () => pedirReconsideracion(id, argumentos.trim(), adjunto ? [adjunto] : []),
    onSuccess: (nueva) => {
      cliente.setQueryData(['explicacion', id], nueva)
      cliente.invalidateQueries({ queryKey: ['solicitud', id] })
      cliente.invalidateQueries({ queryKey: ['solicitudes'] })
      avisar('Recibimos tu solicitud de reconsideración. Te respondemos en máximo 15 días hábiles.')
    },
  })

  if (explicacion.isPending) return <CargaPagina />
  if (explicacion.isError) return <Alert tono="error">{mensajeDe(explicacion.error)}</Alert>
  const e = explicacion.data

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <EncabezadoPagina
        titulo={TITULO[e.resultado]}
        descripcion={`${e.producto}, radicado ${e.radicado}. Decisión del ${formatoFecha(e.decidida_en)}.`}
        migas={[
          { etiqueta: 'Solicitudes', a: '/portal/solicitudes' },
          { etiqueta: e.radicado, a: `/portal/solicitudes/${id}` },
          { etiqueta: 'Decisión' },
        ]}
        acciones={
          <Button variante="secundario" tamano="sm" className="no-imprimir" icono={<Printer aria-hidden="true" className="size-4" />} onClick={() => window.print()}>
            Descargar constancia
          </Button>
        }
      />

      <Panel variante="destacado">
        <div className="flex flex-col gap-4">
          <p className="text-lg leading-relaxed">{e.motivo_principal}</p>
          {e.condicion ? (
            <p className="rounded-campo bg-fondo px-4 py-3 text-sm">
              <span className="font-semibold">Qué cambió: </span>
              {e.condicion}
            </p>
          ) : null}
          <p className="flex items-start gap-2 text-sm text-tinta-suave">
            {e.automatizada ? (
              <>
                <Bot aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                La tomó un sistema automático con reglas aprobadas por FinanTech. Puedes pedir que una persona la revise.
              </>
            ) : (
              <>
                <UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                La tomó un oficial de crédito después de estudiar tu solicitud.
              </>
            )}
          </p>
        </div>
      </Panel>

      {e.variables.length > 0 ? (
        <Panel titulo="Lo que más pesó en la decisión">
          <ul className="flex flex-col gap-3">
            {e.variables.map((v) => (
              <li key={v.nombre} className="flex gap-3">
                {v.efecto === 'favorable' ? (
                  <ThumbsUp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-secundario-700" />
                ) : (
                  <ThumbsDown aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-dato-desfavorable" />
                )}
                <div className="flex flex-col">
                  <span className="font-medium">
                    {v.nombre}
                    <span className="sr-only">{v.efecto === 'favorable' ? ', a tu favor' : ', en tu contra'}</span>
                  </span>
                  <span className="text-sm text-tinta-suave">{v.explicacion}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {e.resultado === 'aprobada_condicionada' || e.resultado === 'aprobada' ? (
        <ButtonLink to={`/portal/solicitudes/${id}`} className="no-imprimir self-start">
          Ver la oferta en el seguimiento
        </ButtonLink>
      ) : null}

      {e.reconsideracion ? (
        // RF-09 FA-03: no se permite pedirla dos veces; se muestra su estado.
        <Panel titulo="Tu reconsideración">
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="font-semibold">{e.reconsideracion.estado === 'en_revision' ? 'En revisión' : 'Resuelta'}.</span> La pediste el{' '}
              {formatoFechaHora(e.reconsideracion.radicada_en)}.
            </p>
            <p className="text-tinta-suave">{e.reconsideracion.argumentos}</p>
            {e.reconsideracion.respuesta ? <p className="font-medium">{e.reconsideracion.respuesta}</p> : null}
          </div>
        </Panel>
      ) : e.resultado === 'negada' ? (
        <Panel titulo="¿Crees que debemos revisarla?" className="no-imprimir">
          {e.puede_reconsiderar ? (
            <form
              noValidate
              className="flex flex-col gap-5"
              onSubmit={(ev) => {
                ev.preventDefault()
                if (argumentos.trim().length < 20) {
                  setError('Cuéntanos en al menos 20 caracteres por qué debemos revisar la decisión.')
                  return
                }
                setError(undefined)
                reconsideracion.mutate()
              }}
            >
              <p className="text-sm text-tinta-suave">
                Puedes pedir la reconsideración hasta el {formatoFecha(e.reconsideracion_vence_en ?? e.decidida_en)}. Una persona la estudia y te
                responde en máximo 15 días hábiles.
              </p>
              <Field id="argumentos" etiqueta="Por qué debemos revisarla" ayuda="Por ejemplo, un ingreso que no tuvimos en cuenta." error={error}>
                <Textarea value={argumentos} onChange={(ev) => setArgumentos(ev.target.value)} maxLength={2000} />
              </Field>
              <FileDrop
                etiqueta="Adjuntar un soporte (opcional)"
                onSeleccionar={setAdjunto}
                archivoActual={adjunto ? { nombre: adjunto.name, tamano: adjunto.size } : null}
              />
              {reconsideracion.isError ? <Alert tono="error">{mensajeDe(reconsideracion.error)}</Alert> : null}
              <Button type="submit" cargando={reconsideracion.isPending} className="self-start">
                Solicitar reconsideración
              </Button>
            </form>
          ) : (
            <p className="text-sm text-tinta-suave">El plazo para pedir la reconsideración ya venció. Puedes radicar una solicitud nueva cuando quieras.</p>
          )}
        </Panel>
      ) : null}
    </div>
  )
}
