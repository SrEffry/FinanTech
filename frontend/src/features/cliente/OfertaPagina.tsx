import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { FileSignature, Printer } from 'lucide-react'
import { aceptarOferta, obtenerOferta, pedirCodigoAceptacion, rechazarOferta } from '../../lib/api/ofertas'
import type { DesafioMfa, Oferta } from '../../lib/api/tipos'
import { ErrorApi } from '../../lib/api/cliente'
import { mensajeDe } from '../../lib/errores'
import { formatoFecha, formatoFechaHora, formatoMoneda, formatoPorcentaje, segundosHasta } from '../../lib/formato'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Choice'
import { CodeInput, TemporizadorCodigo } from '../../components/ui/CodeInput'
import { Field, Textarea } from '../../components/ui/Field'
import { Alert, Badge, Panel } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { DesgloseCostos, PlanPagos } from '../../components/dominio/Costos'
import { DistintivoSimulado } from '../../components/dominio/Distintivos'
import { Dinero } from '../../components/dominio/Marca'
import { EncabezadoPagina } from '../../components/layouts/Comunes'

/** Condición que cambió frente a lo pedido: el valor nuevo junto al original (8.2.5). */
function Condicion({ etiqueta, valor, original }: { etiqueta: string; valor: string; original?: string }) {
  const cambio = original !== undefined && original !== valor
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-tinta-suave">{etiqueta}</dt>
      <dd className="font-semibold">
        {valor}
        {cambio ? (
          <span className="ml-2 text-sm font-normal text-tinta-tenue">
            <span className="sr-only">Antes: </span>
            <s>{original}</s>
          </span>
        ) : null}
      </dd>
    </div>
  )
}

export default function OfertaPagina() {
  const { id = '' } = useParams()
  const oferta = useQuery({ queryKey: ['oferta', id], queryFn: () => obtenerOferta(id) })
  if (oferta.isPending) return <CargaPagina />
  if (oferta.isError) return <Alert tono="error">{mensajeDe(oferta.error)}</Alert>
  return <VistaOferta oferta={oferta.data} />
}

/** Oferta y firma del pagaré (8.2.5, RF-11). */
function VistaOferta({ oferta }: { oferta: Oferta }) {
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const [declaracion, setDeclaracion] = useState(false)
  const [errorDeclaracion, setErrorDeclaracion] = useState<string>()
  const [desafio, setDesafio] = useState<DesafioMfa | null>(null)
  const [codigo, setCodigo] = useState('')
  const [errorCodigo, setErrorCodigo] = useState<string>()
  const [rechazando, setRechazando] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  const actualizar = (nueva: Oferta) => {
    cliente.setQueryData(['oferta', oferta.id], nueva)
    cliente.invalidateQueries({ queryKey: ['solicitudes'] })
    cliente.invalidateQueries({ queryKey: ['solicitud', oferta.solicitud_id] })
  }

  const pedirCodigo = useMutation({
    mutationFn: () => pedirCodigoAceptacion(oferta.id),
    onSuccess: (nuevo) => {
      setDesafio(nuevo)
      setCodigo('')
      setErrorCodigo(undefined)
    },
  })

  const aceptacion = useMutation({
    mutationFn: () => aceptarOferta(oferta.id, desafio!.desafio_id, codigo),
    onSuccess: (firmada) => {
      setDesafio(null)
      actualizar(firmada)
      avisar('Firmaste el pagaré. Tu crédito quedó formalizado.')
    },
    onError: (error) => {
      if (error instanceof ErrorApi && error.codigo === 'codigo_incorrecto') {
        const restantes = Number(error.datos?.intentos_restantes ?? 0)
        setErrorCodigo(`${error.message} Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`)
      }
    },
  })

  const rechazo = useMutation({
    mutationFn: () => rechazarOferta(oferta.id, motivoRechazo.trim()),
    onSuccess: (rechazada) => {
      setRechazando(false)
      actualizar(rechazada)
      avisar('Rechazaste la oferta.')
    },
  })

  const original = oferta.condiciones_originales
  const diasRestantes = Math.ceil(segundosHasta(oferta.vence_en) / 86_400)
  const firmada = oferta.estado === 'firmada'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <EncabezadoPagina
        titulo={firmada ? 'Pagaré firmado' : 'Tu oferta de crédito'}
        descripcion={`${oferta.producto}, radicado ${oferta.radicado}.`}
        migas={[
          { etiqueta: 'Solicitudes', a: '/portal/solicitudes' },
          { etiqueta: oferta.radicado, a: `/portal/solicitudes/${oferta.solicitud_id}` },
          { etiqueta: 'Oferta' },
        ]}
        acciones={
          oferta.estado === 'vigente' ? (
            <Badge tono={diasRestantes <= 3 ? 'accion' : 'progreso'}>
              {diasRestantes <= 1 ? 'Vence hoy' : `Vence en ${diasRestantes} días`}
            </Badge>
          ) : (
            <Badge tono={firmada ? 'exito' : 'neutro'}>{firmada ? 'Firmada' : oferta.estado === 'vencida' ? 'Vencida' : 'Rechazada'}</Badge>
          )
        }
      />

      {oferta.estado === 'vencida' ? (
        // RF-11 FA-01
        <Alert tono="advertencia" titulo="Esta oferta venció" accion={<ButtonLink to="/portal/simular" tamano="sm">Simular de nuevo</ButtonLink>}>
          Las ofertas valen 15 días. Puedes radicar una solicitud nueva cuando quieras.
        </Alert>
      ) : null}
      {oferta.estado === 'rechazada' ? <Alert tono="info" titulo="Rechazaste esta oferta">Si cambias de opinión, puedes radicar una solicitud nueva.</Alert> : null}

      {firmada && oferta.firma ? (
        <Panel variante="destacado">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <FileSignature aria-hidden="true" className="size-6 text-secundario-700" />
              <p className="text-lg font-semibold">Firmaste el pagaré el {formatoFechaHora(oferta.firma.sellado_en)}</p>
              {oferta.firma.simulada ? <DistintivoSimulado que="Firma simulada" /> : null}
            </div>
            <dl className="grid gap-1 text-sm">
              <dt className="text-tinta-suave">Huella del documento firmado (SHA-256)</dt>
              <dd className="font-mono text-xs break-all">{oferta.firma.huella_sha256}</dd>
            </dl>
            <p className="text-sm text-tinta-suave">
              El desembolso a tu cuenta llega en la segunda entrega del sistema. Guarda una copia del pagaré y del plan de pagos.
            </p>
            <Button variante="secundario" className="no-imprimir self-start" icono={<Printer aria-hidden="true" className="size-4" />} onClick={() => window.print()}>
              Descargar pagaré y plan
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel titulo="Condiciones">
        <div className="flex flex-col gap-6">
          <CuotaConTea cuota={oferta.cuota} tea={oferta.tasa_ea} explicar />
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Condicion etiqueta="Monto aprobado" valor={formatoMoneda(oferta.monto)} original={original ? formatoMoneda(original.monto) : undefined} />
            <Condicion etiqueta="Plazo" valor={`${oferta.plazo_meses} meses`} original={original ? `${original.plazo_meses} meses` : undefined} />
            <Condicion etiqueta="Tasa efectiva anual" valor={formatoPorcentaje(oferta.tasa_ea)} original={original ? formatoPorcentaje(original.tasa_ea) : undefined} />
            <Condicion etiqueta="La oferta vence" valor={formatoFecha(oferta.vence_en)} />
          </dl>
          {original && oferta.motivo_condicion ? (
            <Alert tono="info" titulo="Cambiamos algunas condiciones frente a lo que pediste">
              {oferta.motivo_condicion} Con lo que pediste la cuota habría sido <Dinero valor={original.cuota} />.
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel titulo="Qué pagas en total">
        <DesgloseCostos monto={oferta.monto} desglose={oferta.desglose} costoTotal={oferta.costo_total} totalAPagar={oferta.monto + oferta.costo_total} />
      </Panel>

      <Panel titulo="Plan de amortización">
        <PlanPagos plan={oferta.plan} nombreArchivo={`plan-${oferta.radicado}.csv`} />
      </Panel>

      <Panel titulo="Pagaré" descripcion={`Versión ${oferta.pagare.version}. Léelo completo antes de firmar.`}>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-bold tracking-widest text-advertencia-500/15 select-none sm:text-8xl">
            SIMULADO
          </span>
          <div tabIndex={0} role="region" aria-label="Texto del pagaré" className="max-h-80 overflow-y-auto rounded-campo border border-linea bg-fondo p-4 text-sm leading-relaxed whitespace-pre-line print:max-h-none">
            {oferta.pagare.texto}
          </div>
        </div>
        {/* MR-004: el modo simulado se ve también en el documento generado. */}
        <p className="mt-3 text-xs text-tinta-tenue">Documento de demostración: la firma es simulada y este pagaré no es un título valor.</p>
      </Panel>

      {oferta.estado === 'vigente' ? (
        <Panel variante="destacado" titulo="Aceptar y firmar" className="no-imprimir">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <Checkbox
                id="declaracion"
                etiqueta="Leí las condiciones, el plan de pagos y el pagaré, y acepto el crédito"
                descripcion="Al firmar te obligas a pagar las cuotas en las fechas del plan."
                checked={declaracion}
                onChange={(e) => {
                  setDeclaracion(e.target.checked)
                  setErrorDeclaracion(undefined)
                }}
              />
              {errorDeclaracion ? <p className="pl-8 text-sm font-medium text-alerta-700">{errorDeclaracion}</p> : null}
            </div>
            {pedirCodigo.isError ? <Alert tono="error">{mensajeDe(pedirCodigo.error)}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variante="fantasma" onClick={() => setRechazando(true)}>
                No me interesa
              </Button>
              <Button
                variante="exito"
                cargando={pedirCodigo.isPending}
                onClick={() => {
                  if (!declaracion) {
                    setErrorDeclaracion('Confirma que leíste y aceptas las condiciones y el pagaré.')
                    return
                  }
                  pedirCodigo.mutate()
                }}
              >
                Firmar pagaré
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* RN-61: aceptar exige segundo factor. */}
      <Modal
        abierto={desafio !== null}
        onCerrar={() => setDesafio(null)}
        titulo="Confirma tu firma"
        descripcion={desafio ? <>Te enviamos un código a {desafio.enviado_a}. Escríbelo para firmar el pagaré.</> : null}
      >
        {desafio ? (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (codigo.length !== 6) {
                setErrorCodigo('Escribe los 6 dígitos del código.')
                return
              }
              setErrorCodigo(undefined)
              aceptacion.mutate()
            }}
          >
            {desafio.codigo_demo ? (
              <Alert tono="advertencia">
                Código de demostración: <span className="cifras font-semibold">{desafio.codigo_demo}</span>
              </Alert>
            ) : null}
            <CodeInput id="codigo-firma" etiqueta="Código" valor={codigo} onCambiar={setCodigo} error={errorCodigo} enfocar />
            <TemporizadorCodigo
              expiraEn={desafio.expira_en}
              reenvioEn={desafio.reenvio_disponible_en}
              onReenviar={() => pedirCodigo.mutate()}
              reenviando={pedirCodigo.isPending}
            />
            {aceptacion.isError && !errorCodigo ? <Alert tono="error">{mensajeDe(aceptacion.error)}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variante="secundario" onClick={() => setDesafio(null)}>
                Cancelar
              </Button>
              <Button type="submit" variante="exito" cargando={aceptacion.isPending}>
                Firmar
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* RF-11 FA-02: rechazo expreso con motivo opcional. */}
      <Modal
        abierto={rechazando}
        onCerrar={() => setRechazando(false)}
        titulo="¿Rechazar la oferta?"
        descripcion="La oferta se cierra y no podrás firmarla después. Si cambias de opinión, tendrás que radicar una solicitud nueva."
        acciones={
          <>
            <Button variante="secundario" onClick={() => setRechazando(false)}>
              Volver
            </Button>
            <Button variante="peligro" cargando={rechazo.isPending} onClick={() => rechazo.mutate()}>
              Rechazar oferta
            </Button>
          </>
        }
      >
        <Field id="motivo-rechazo" etiqueta="¿Por qué la rechazas?" opcional>
          <Textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} maxLength={500} />
        </Field>
        {rechazo.isError ? <Alert tono="error">{mensajeDe(rechazo.error)}</Alert> : null}
      </Modal>
    </div>
  )
}
