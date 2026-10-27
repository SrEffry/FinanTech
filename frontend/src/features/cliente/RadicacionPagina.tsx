import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Save } from 'lucide-react'
import { obtenerProductos } from '../../lib/api/simulacion'
import { crearSolicitud, guardarBorrador, obtenerSolicitud, radicar } from '../../lib/api/solicitudes'
import type { CambiosBorrador, Producto, SolicitudDetalle } from '../../lib/api/tipos'
import { ErrorApi } from '../../lib/api/cliente'
import { codigoDe, mensajeDe } from '../../lib/errores'
import { formatoFecha, formatoMoneda, formatoPorcentaje } from '../../lib/formato'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Choice'
import { DatoBloqueado, Field, Input, Select } from '../../components/ui/Field'
import { Alert, Panel } from '../../components/ui/Feedback'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { CargaPagina } from '../../components/ui/Spinner'
import { Stepper } from '../../components/ui/Stepper'
import { useToast } from '../../components/ui/Toast'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { Dinero } from '../../components/dominio/Marca'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'
import { leerSimulacion, olvidarSimulacion } from '../simulacion/simulacionGuardada'
import { DocumentosSolicitud } from './DocumentosSolicitud'

export default function RadicacionPagina() {
  const { id } = useParams()
  return id ? <CargaBorrador id={id} /> : <InicioSolicitud />
}

// ── Inicio: producto, monto y plazo ─────────────────────────────────────────

function InicioSolicitud() {
  const usuario = useUsuario()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const productos = useQuery({ queryKey: ['productos'], queryFn: obtenerProductos, staleTime: 10 * 60_000 })
  const guardada = leerSimulacion()
  const [codigo, setCodigo] = useState(parametros.get('producto') ?? guardada?.producto ?? '')
  const [monto, setMonto] = useState<number | null>(Number(parametros.get('monto') ?? guardada?.monto ?? 0) || null)
  const [plazo, setPlazo] = useState<number | null>(Number(parametros.get('plazo') ?? guardada?.plazo ?? 0) || null)

  const creacion = useMutation({
    mutationFn: (p: Producto) => crearSolicitud(p.codigo, monto ?? p.monto_min, plazo ?? p.plazo_min),
    onSuccess: (solicitud) => {
      olvidarSimulacion()
      navegar(`/portal/solicitar/${solicitud.id}`, { replace: true })
    },
  })

  // RN-07: sin identidad verificada no se radica.
  if (usuario.estado_kyc !== 'verificado') {
    return (
      <div className="mx-auto max-w-2xl">
        <EncabezadoPagina titulo="Solicitar crédito" migas={[{ etiqueta: 'Inicio', a: '/portal' }, { etiqueta: 'Solicitar crédito' }]} />
        <Alert tono="advertencia" titulo="Primero verifica tu identidad" accion={<ButtonLink to="/portal/identidad">Verificar mi identidad</ButtonLink>}>
          Antes de estudiar una solicitud necesitamos confirmar que eres tú. Te toma unos minutos.
        </Alert>
      </div>
    )
  }
  if (productos.isPending) return <CargaPagina />
  if (productos.isError) return <Alert tono="error">{mensajeDe(productos.error)}</Alert>

  const producto = productos.data.find((p) => p.codigo === codigo) ?? productos.data[0]
  const montoFuera = monto !== null && (monto < producto.monto_min || monto > producto.monto_max)
  const plazoFuera = plazo !== null && (plazo < producto.plazo_min || plazo > producto.plazo_max)
  const activa = creacion.error instanceof ErrorApi && creacion.error.codigo === 'solicitud_activa' ? String(creacion.error.datos?.solicitud_id ?? '') : null

  return (
    <div className="mx-auto max-w-2xl">
      <EncabezadoPagina
        titulo="Solicitar crédito"
        descripcion="Confirma el producto, el monto y el plazo. Después te pedimos tus ingresos y unos documentos: en total, menos de 8 minutos."
        migas={[{ etiqueta: 'Inicio', a: '/portal' }, { etiqueta: 'Solicitar crédito' }]}
      />
      <Panel>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!montoFuera && !plazoFuera) creacion.mutate(producto)
          }}
        >
          <Field id="producto" etiqueta="Producto">
            <Select value={producto.codigo} onChange={(e) => setCodigo(e.target.value)}>
              {productos.data.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.nombre} (desde {formatoPorcentaje(p.tasa_ea)} E.A.)
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="monto"
              etiqueta="Monto"
              ayuda={`Entre ${formatoMoneda(producto.monto_min)} y ${formatoMoneda(producto.monto_max)}.`}
              error={montoFuera ? 'El monto está fuera del rango del producto.' : undefined}
            >
              <MoneyInput valor={monto} onCambiar={setMonto} />
            </Field>
            <Field
              id="plazo"
              etiqueta="Plazo en meses"
              ayuda={`Entre ${producto.plazo_min} y ${producto.plazo_max} meses.`}
              error={plazoFuera ? 'El plazo está fuera del rango del producto.' : undefined}
            >
              <Input
                inputMode="numeric"
                value={plazo ?? ''}
                onChange={(e) => setPlazo(Number(e.target.value.replace(/\D/g, '')) || null)}
                className="cifras"
              />
            </Field>
          </div>
          {creacion.isError ? (
            <Alert
              tono="error"
              accion={
                activa ? (
                  <Link to={`/portal/solicitudes/${activa}`} className="font-semibold underline underline-offset-4">
                    Ver esa solicitud
                  </Link>
                ) : undefined
              }
            >
              {mensajeDe(creacion.error)}
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <ButtonLink to="/portal/simular" variante="secundario">
              Simular primero
            </ButtonLink>
            <Button type="submit" cargando={creacion.isPending} disabled={!monto || !plazo}>
              Empezar solicitud
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

// ── Borrador: secciones con progreso ───────────────────────────────────────

function CargaBorrador({ id }: { id: string }) {
  const solicitud = useQuery({ queryKey: ['solicitud', id], queryFn: () => obtenerSolicitud(id) })
  const productos = useQuery({ queryKey: ['productos'], queryFn: obtenerProductos, staleTime: 10 * 60_000 })
  if (solicitud.isPending || productos.isPending) return <CargaPagina />
  if (solicitud.isError) return <Alert tono="error">{mensajeDe(solicitud.error)}</Alert>
  if (productos.isError) return <Alert tono="error">{mensajeDe(productos.error)}</Alert>
  if (solicitud.data.estado !== 'BORRADOR') return <Navigate to={`/portal/solicitudes/${id}`} replace />
  const producto = productos.data.find((p) => p.codigo === solicitud.data.producto.codigo)
  if (!producto) return <Alert tono="error">Este producto ya no está disponible.</Alert>
  return <EditorBorrador key={id} solicitud={solicitud.data} producto={producto} />
}

const SECCIONES = ['Crédito', 'Tus datos', 'Trabajo e ingresos', 'Referencia', 'Documentos', 'Revisión']

const esquema = z.object({
  monto: z.number({ message: 'Escribe el monto.' }).positive('Escribe el monto.'),
  plazo_meses: z.number({ message: 'Escribe el plazo.' }).int().positive('Escribe el plazo.'),
  ocupacion: z.enum(['empleado', 'independiente', 'pensionado', ''], { message: 'Elige tu ocupación.' }).refine((v) => v.length > 0, 'Elige tu ocupación.'),
  empleador: z.string().trim().min(2, 'Escribe dónde trabajas o tu actividad.'),
  antiguedad_laboral_meses: z.number({ message: 'Indica cuánto tiempo llevas.' }).int().min(0, 'Indica cuánto tiempo llevas.'),
  ingreso_mensual: z.number({ message: 'Escribe tu ingreso mensual.' }).positive('Escribe tu ingreso mensual.'),
  egreso_mensual: z.number({ message: 'Escribe tus gastos mensuales.' }).min(0, 'Escribe tus gastos mensuales.'),
  referencia_nombre: z.string().trim().min(3, 'Escribe el nombre de tu referencia.'),
  referencia_celular: z.string().trim().regex(/^3\d{9}$/, 'Escribe un celular de 10 dígitos que empiece por 3.'),
  acepta_consulta_centrales: z.boolean(),
})

type Datos = z.infer<typeof esquema>

const CAMPOS_POR_SECCION: (keyof Datos)[][] = [
  ['monto', 'plazo_meses'],
  [],
  ['ocupacion', 'empleador', 'antiguedad_laboral_meses', 'ingreso_mensual', 'egreso_mensual'],
  ['referencia_nombre', 'referencia_celular'],
  [],
  ['acepta_consulta_centrales'],
]

/** Campos del servidor → campos del formulario, para ubicar el error en su sección. */
const CAMPO_SERVIDOR: Record<string, keyof Datos> = {
  monto: 'monto',
  plazo_meses: 'plazo_meses',
  'laboral.ocupacion': 'ocupacion',
  'laboral.empleador': 'empleador',
  'laboral.antiguedad_laboral_meses': 'antiguedad_laboral_meses',
  'financiero.ingreso_mensual': 'ingreso_mensual',
  'financiero.egreso_mensual': 'egreso_mensual',
  'referencia.nombre': 'referencia_nombre',
  'referencia.celular': 'referencia_celular',
}

function cambiosDe(d: Partial<Datos>): CambiosBorrador {
  return {
    monto: d.monto,
    plazo_meses: d.plazo_meses,
    laboral: {
      ocupacion: d.ocupacion ?? '',
      empleador: d.empleador ?? '',
      antiguedad_laboral_meses: Number.isFinite(d.antiguedad_laboral_meses) ? (d.antiguedad_laboral_meses as number) : null,
    },
    financiero: { ingreso_mensual: d.ingreso_mensual ?? null, egreso_mensual: d.egreso_mensual ?? null },
    referencia: { nombre: d.referencia_nombre ?? '', celular: d.referencia_celular ?? '' },
    acepta_consulta_centrales: d.acepta_consulta_centrales,
  }
}

function EditorBorrador({ solicitud, producto }: { solicitud: SolicitudDetalle; producto: Producto }) {
  const [seccion, setSeccion] = useState(0)
  const [faltaAutorizacion, setFaltaAutorizacion] = useState(false)
  const cliente = useQueryClient()
  const navegar = useNavigate()
  const { avisar } = useToast()
  const clave = ['solicitud', solicitud.id]

  const {
    register,
    control,
    trigger,
    getValues,
    setError,
    watch,
    formState: { errors },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    mode: 'onTouched',
    defaultValues: {
      monto: solicitud.monto,
      plazo_meses: solicitud.plazo_meses,
      ocupacion: solicitud.laboral.ocupacion,
      empleador: solicitud.laboral.empleador,
      antiguedad_laboral_meses: solicitud.laboral.antiguedad_laboral_meses ?? undefined,
      ingreso_mensual: solicitud.financiero.ingreso_mensual ?? undefined,
      egreso_mensual: solicitud.financiero.egreso_mensual ?? undefined,
      referencia_nombre: solicitud.referencia.nombre,
      referencia_celular: solicitud.referencia.celular,
      acepta_consulta_centrales: solicitud.acepta_consulta_centrales,
    },
  })

  const guardado = useMutation({
    mutationFn: () => guardarBorrador(solicitud.id, cambiosDe(getValues())),
    onSuccess: (actualizada) => cliente.setQueryData(clave, actualizada),
  })

  const radicacion = useMutation({
    mutationFn: async () => {
      await guardarBorrador(solicitud.id, cambiosDe(getValues()))
      return radicar(solicitud.id)
    },
    onSuccess: (radicada) => {
      cliente.setQueryData(clave, radicada)
      cliente.invalidateQueries({ queryKey: ['solicitudes'] })
      avisar(`Radicamos tu solicitud ${radicada.radicado}. Ya empezamos a evaluarla.`)
      navegar(`/portal/solicitudes/${radicada.id}`, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ErrorApi && error.codigo === 'validacion') {
        let primera: number | null = null
        for (const [campo, mensaje] of Object.entries(error.campos)) {
          const local = CAMPO_SERVIDOR[campo]
          if (!local) continue
          setError(local, { type: 'server', message: mensaje })
          const indice = CAMPOS_POR_SECCION.findIndex((c) => c.includes(local))
          primera = primera === null ? indice : Math.min(primera, indice)
        }
        if (primera !== null) setSeccion(primera)
      }
      if (codigoDe(error) === 'documentos_incompletos') setSeccion(4)
    },
  })

  async function continuar() {
    const valido = await trigger(CAMPOS_POR_SECCION[seccion])
    if (!valido) return
    if (CAMPOS_POR_SECCION[seccion].length > 0) await guardado.mutateAsync().catch(() => undefined)
    setSeccion((s) => Math.min(SECCIONES.length - 1, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const monto = watch('monto')
  const plazo = watch('plazo_meses')
  const capacidad = solicitud.capacidad_pago
  const conocidos = solicitud.datos_conocidos

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <EncabezadoPagina
        titulo={`Solicitud de ${producto.nombre.toLowerCase()}`}
        descripcion={solicitud.borrador_vence_en ? `Guardamos tu borrador hasta el ${formatoFecha(solicitud.borrador_vence_en)}.` : undefined}
        migas={[{ etiqueta: 'Solicitudes', a: '/portal/solicitudes' }, { etiqueta: 'Nueva solicitud' }]}
      />
      <div className="mb-6">
        <Stepper pasos={SECCIONES} actual={seccion} etiqueta="Progreso de la solicitud" />
      </div>

      <Panel>
        <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
          {seccion === 0 ? (
            <section aria-label="Crédito" className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="monto"
                  etiqueta="Monto"
                  ayuda={`Entre ${formatoMoneda(producto.monto_min)} y ${formatoMoneda(producto.monto_max)}.`}
                  error={errors.monto?.message}
                >
                  <Controller
                    control={control}
                    name="monto"
                    rules={{ min: producto.monto_min, max: producto.monto_max }}
                    render={({ field }) => <MoneyInput valor={field.value} onCambiar={(v) => field.onChange(v ?? undefined)} onBlur={field.onBlur} name={field.name} />}
                  />
                </Field>
                <Field id="plazo_meses" etiqueta="Plazo en meses" ayuda={`Entre ${producto.plazo_min} y ${producto.plazo_max} meses.`} error={errors.plazo_meses?.message}>
                  <Input inputMode="numeric" className="cifras" {...register('plazo_meses', { valueAsNumber: true })} />
                </Field>
              </div>
              {monto < producto.monto_min || monto > producto.monto_max || plazo < producto.plazo_min || plazo > producto.plazo_max ? (
                <Alert tono="advertencia">El monto o el plazo están fuera del rango de {producto.nombre.toLowerCase()}.</Alert>
              ) : (
                <div className="rounded-campo bg-fondo p-4">
                  <CuotaConTea cuota={solicitud.cuota_estimada} tea={solicitud.tasa_ea} tamano="mediano" etiquetaCuota="Cuota estimada" />
                  <p className="mt-3 text-xs text-tinta-tenue">La cuota se recalcula al guardar. No es una aprobación.</p>
                </div>
              )}
            </section>
          ) : null}

          {seccion === 1 ? (
            <section aria-label="Tus datos" className="flex flex-col gap-4">
              <p className="text-sm text-tinta-suave">Estos datos ya los tenemos de tu registro: no te los volvemos a pedir.</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DatoBloqueado etiqueta="Nombre" valor={conocidos.nombre_completo} />
                <DatoBloqueado etiqueta="Documento" valor={conocidos.documento_enmascarado} />
                <DatoBloqueado etiqueta="Fecha de nacimiento" valor={formatoFecha(`${conocidos.fecha_nacimiento}T12:00:00`)} />
                <DatoBloqueado etiqueta="Correo" valor={conocidos.email} />
                <DatoBloqueado etiqueta="Celular" valor={conocidos.telefono_enmascarado} />
              </dl>
              <p className="text-sm text-tinta-tenue">
                ¿Algo cambió? Actualízalo desde <Link to="/portal/privacidad" className="font-semibold text-primario-700 hover:underline">Mis datos y privacidad</Link>.
              </p>
            </section>
          ) : null}

          {seccion === 2 ? (
            <section aria-label="Trabajo e ingresos" className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="ocupacion" etiqueta="Ocupación" error={errors.ocupacion?.message}>
                  <Select {...register('ocupacion')}>
                    <option value="">Elige una opción</option>
                    <option value="empleado">Empleado</option>
                    <option value="independiente">Independiente</option>
                    <option value="pensionado">Pensionado</option>
                  </Select>
                </Field>
                <Field id="empleador" etiqueta="Empresa o actividad" error={errors.empleador?.message}>
                  <Input autoComplete="organization" {...register('empleador')} />
                </Field>
              </div>
              <Field
                id="antiguedad_laboral_meses"
                etiqueta="Meses en tu trabajo o actividad actual"
                error={errors.antiguedad_laboral_meses?.message}
              >
                <Input inputMode="numeric" className="cifras sm:max-w-40" {...register('antiguedad_laboral_meses', { valueAsNumber: true })} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="ingreso_mensual" etiqueta="Ingreso mensual" ayuda="Lo que recibes al mes, después de descuentos." error={errors.ingreso_mensual?.message}>
                  <Controller
                    control={control}
                    name="ingreso_mensual"
                    render={({ field }) => <MoneyInput valor={field.value} onCambiar={(v) => field.onChange(v ?? undefined)} onBlur={field.onBlur} name={field.name} />}
                  />
                </Field>
                <Field
                  id="egreso_mensual"
                  etiqueta="Gastos mensuales"
                  ayuda="Arriendo, otras cuotas y gastos fijos. Con esto calculamos cuánto te queda disponible."
                  error={errors.egreso_mensual?.message}
                >
                  <Controller
                    control={control}
                    name="egreso_mensual"
                    render={({ field }) => <MoneyInput valor={field.value} onCambiar={(v) => field.onChange(v ?? undefined)} onBlur={field.onBlur} name={field.name} />}
                  />
                </Field>
              </div>
              {capacidad?.supera_limite ? (
                // RF-06 FA-04: capacidad insuficiente, se advierte y se ofrece ajustar.
                <Alert
                  tono="advertencia"
                  titulo="La cuota ocuparía una parte muy alta de tus ingresos"
                  accion={
                    <Button variante="secundario" tamano="sm" onClick={() => setSeccion(0)}>
                      Ajustar monto o plazo
                    </Button>
                  }
                >
                  La cuota estimada de <Dinero valor={capacidad.cuota_estimada} /> es el {capacidad.porcentaje.toLocaleString('es-CO')} % de lo que te
                  queda disponible (<Dinero valor={capacidad.ingreso_disponible} />). El máximo que aprobamos es el {capacidad.limite} %. Puedes radicar igual,
                  pero es probable que no sea aprobada así.
                </Alert>
              ) : null}
            </section>
          ) : null}

          {seccion === 3 ? (
            <section aria-label="Referencia" className="flex flex-col gap-5">
              <p className="text-sm text-tinta-suave">Una persona que te conozca y a quien podamos llamar. No la contactamos para cobrar.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="referencia_nombre" etiqueta="Nombre completo" error={errors.referencia_nombre?.message}>
                  <Input autoComplete="off" {...register('referencia_nombre')} />
                </Field>
                <Field id="referencia_celular" etiqueta="Celular" error={errors.referencia_celular?.message}>
                  <Input type="tel" inputMode="numeric" maxLength={10} {...register('referencia_celular')} />
                </Field>
              </div>
            </section>
          ) : null}

          {seccion === 4 ? (
            <section aria-label="Documentos" className="flex flex-col gap-4">
              <p className="text-sm text-tinta-suave">
                Según tu ocupación necesitamos estos documentos. JPG, PNG o PDF de hasta 10 MB. Tu documento de identidad ya lo verificamos.
              </p>
              {radicacion.isError && codigoDe(radicacion.error) === 'documentos_incompletos' ? <Alert tono="error">{mensajeDe(radicacion.error)}</Alert> : null}
              <DocumentosSolicitud solicitudId={solicitud.id} documentos={solicitud.documentos} editable />
            </section>
          ) : null}

          {seccion === 5 ? (
            <section aria-label="Revisión" className="flex flex-col gap-5">
              <dl className="divide-y divide-linea-suave">
                {[
                  ['Producto', producto.nombre],
                  ['Monto', formatoMoneda(getValues('monto'))],
                  ['Plazo', `${getValues('plazo_meses')} meses`],
                  ['Ocupación', `${getValues('ocupacion')}, ${getValues('empleador')}`],
                  ['Ingreso mensual', formatoMoneda(getValues('ingreso_mensual') ?? 0)],
                  ['Gastos mensuales', formatoMoneda(getValues('egreso_mensual') ?? 0)],
                  ['Referencia', getValues('referencia_nombre')],
                  ['Documentos', `${solicitud.documentos.filter((d) => d.estado === 'cargado').length} de ${solicitud.documentos.length} cargados`],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="flex justify-between gap-4 py-2.5 text-sm">
                    <dt className="text-tinta-suave">{etiqueta}</dt>
                    <dd className="text-right font-medium first-letter:uppercase">{valor}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-campo bg-fondo p-4">
                <CuotaConTea cuota={solicitud.cuota_estimada} tea={solicitud.tasa_ea} tamano="mediano" etiquetaCuota="Cuota estimada" />
              </div>
              <Controller
                control={control}
                name="acepta_consulta_centrales"
                render={({ field }) => (
                  <Checkbox
                    id="acepta_consulta_centrales"
                    etiqueta="Autorizo a FinanTech a consultar mi historial en las centrales de riesgo para estudiar esta solicitud"
                    descripcion="Sin esta autorización no podemos evaluarla. Queda registrada con la fecha de hoy."
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked)
                      setFaltaAutorizacion(false)
                    }}
                    aria-invalid={faltaAutorizacion || undefined}
                  />
                )}
              />
              {faltaAutorizacion ? (
                <p role="alert" className="-mt-3 pl-8 text-sm font-medium text-alerta-700">
                  Marca la autorización para poder radicar (RN-33).
                </p>
              ) : null}
              {radicacion.isError && codigoDe(radicacion.error) !== 'documentos_incompletos' ? <Alert tono="error">{mensajeDe(radicacion.error)}</Alert> : null}
            </section>
          ) : null}

          {guardado.isError ? <Alert tono="error">{mensajeDe(guardado.error)}</Alert> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-linea pt-5 sm:flex-row sm:justify-between">
            <Button variante="secundario" onClick={() => setSeccion((s) => Math.max(0, s - 1))} disabled={seccion === 0}>
              Volver
            </Button>
            {seccion < SECCIONES.length - 1 ? (
              <Button onClick={continuar} cargando={guardado.isPending}>
                Continuar
              </Button>
            ) : (
              <Button
                variante="exito"
                cargando={radicacion.isPending}
                onClick={() => {
                  if (!getValues('acepta_consulta_centrales')) {
                    setFaltaAutorizacion(true)
                    return
                  }
                  radicacion.mutate()
                }}
              >
                Radicar solicitud
              </Button>
            )}
          </div>
        </form>
      </Panel>

      {/* "Guardar borrador" siempre a mano (8.2.3). */}
      <div className="no-imprimir fixed inset-x-0 bottom-16 z-20 flex justify-center px-4 md:bottom-6">
        <Button
          variante="secundario"
          className="shadow-md shadow-tinta/10"
          icono={<Save aria-hidden="true" className="size-4" />}
          cargando={guardado.isPending}
          onClick={() =>
            guardado.mutate(undefined, {
              onSuccess: () => avisar('Borrador guardado. Lo conservamos 30 días.'),
              onError: (error) => avisar(mensajeDe(error), 'error'),
            })
          }
        >
          Guardar borrador
        </Button>
      </div>
    </div>
  )
}
