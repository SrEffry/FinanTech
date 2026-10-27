import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Check, Lock } from 'lucide-react'
import {
  iniciarRegistro,
  obtenerPoliticaVigente,
  reenviarCodigosRegistro,
  verificarCodigosRegistro,
} from '../../lib/api/identidad'
import type { RegistroPendiente, TipoDocumento } from '../../lib/api/tipos'
import { ErrorApi } from '../../lib/api/cliente'
import { codigoDe, mensajeDe } from '../../lib/errores'
import { enmascarar, enmascararCorreo, formatoFecha } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Choice'
import { CodeInput, TemporizadorCodigo } from '../../components/ui/CodeInput'
import { Field, Input, Select } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { Skeleton } from '../../components/ui/Spinner'
import { Stepper } from '../../components/ui/Stepper'
import { PantallaAcceso } from '../../components/layouts/PublicoLayout'
import { CLAVE_SESION, useSesion } from '../acceso/sesion'
import { VerificacionIdentidad } from '../identidad/VerificacionIdentidad'

const PASOS = ['Tus datos', 'Privacidad', 'Verificación', 'Identidad']

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; texto: string }[] = [
  { valor: 'CC', texto: 'Cédula de ciudadanía' },
  { valor: 'CE', texto: 'Cédula de extranjería' },
  { valor: 'PA', texto: 'Pasaporte' },
  { valor: 'PPT', texto: 'Permiso por protección temporal' },
]

function fechaHace18Anios(): string {
  const fecha = new Date()
  fecha.setFullYear(fecha.getFullYear() - 18)
  return fecha.toISOString().slice(0, 10)
}

const SOLO_LETRAS = /^[\p{L}' -]+$/u

// Las mismas reglas que IniciarRegistroRequest del backend, con los mismos mensajes.
const esquema = z
  .object({
    tipo_documento: z.enum(['CC', 'CE', 'PA', 'PPT'], { message: 'Elige el tipo de documento.' }),
    num_documento: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z]{5,15}$/, 'El número de documento debe tener entre 5 y 15 letras o números, sin puntos ni espacios.'),
    nombres: z.string().trim().min(1, 'Escribe tus nombres.').max(80, 'Usa máximo 80 caracteres.').regex(SOLO_LETRAS, 'El nombre solo puede tener letras y espacios.'),
    apellidos: z.string().trim().min(1, 'Escribe tus apellidos.').max(80, 'Usa máximo 80 caracteres.').regex(SOLO_LETRAS, 'Los apellidos solo pueden tener letras y espacios.'),
    fecha_nacimiento: z
      .string()
      .min(1, 'Escribe tu fecha de nacimiento.')
      .refine((v) => v > '1900-01-01', 'Revisa la fecha de nacimiento.')
      // RN-03: solo mayores de 18 años.
      .refine((v) => v <= fechaHace18Anios(), 'Debes ser mayor de 18 años para registrarte.'),
    email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido, como nombre@correo.com.').max(160),
    telefono: z.string().trim().regex(/^3\d{9}$/, 'Ingresa un celular colombiano de 10 dígitos que empiece por 3.'),
    password: z
      .string()
      .min(10, 'Usa al menos 10 caracteres.')
      .regex(/[a-z]/, 'Incluye al menos una letra minúscula.')
      .regex(/[A-Z]/, 'Incluye al menos una letra mayúscula.')
      .regex(/\d/, 'Incluye al menos un número.')
      .regex(/[^A-Za-z0-9]/, 'Incluye al menos un símbolo, como # o !.'),
    password_confirmation: z.string().min(1, 'Repite tu contraseña.'),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Las contraseñas no coinciden.',
  })

type DatosPersonales = z.infer<typeof esquema>
const CAMPOS = Object.keys(esquema.shape) as (keyof DatosPersonales)[]

const REGLAS_CONTRASENA = [
  { texto: 'Al menos 10 caracteres', cumple: (v: string) => v.length >= 10 },
  { texto: 'Mayúsculas y minúsculas', cumple: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { texto: 'Al menos un número', cumple: (v: string) => /\d/.test(v) },
  { texto: 'Al menos un símbolo', cumple: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

/** Registro y verificación del cliente (8.1.2, RF-01, RF-02). */
export default function RegistroPagina() {
  const [paso, setPaso] = useState(0)
  const [finalidades, setFinalidades] = useState<string[]>([]) // RN-05: ninguna opcional marcada de entrada.
  const [aceptaPolitica, setAceptaPolitica] = useState(false)
  const [errorPolitica, setErrorPolitica] = useState<string>()
  const [registro, setRegistro] = useState<RegistroPendiente | null>(null)
  const [codigoCorreo, setCodigoCorreo] = useState('')
  const [codigoCelular, setCodigoCelular] = useState('')
  const [errorCodigos, setErrorCodigos] = useState<string>()
  const [avisoReinicio, setAvisoReinicio] = useState<string>()
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const { data: sesion } = useSesion()

  const formulario = useForm<DatosPersonales>({
    resolver: zodResolver(esquema),
    mode: 'onTouched',
    defaultValues: {
      tipo_documento: 'CC',
      num_documento: '',
      nombres: '',
      apellidos: '',
      fecha_nacimiento: '',
      email: '',
      telefono: '',
      password: '',
      password_confirmation: '',
    },
  })
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    control,
    formState: { errors },
  } = formulario
  const contrasena = useWatch({ control, name: 'password' }) ?? ''

  const politica = useQuery({ queryKey: ['politica-vigente'], queryFn: obtenerPoliticaVigente, enabled: paso >= 1 })

  const inicio = useMutation({
    mutationFn: () =>
      iniciarRegistro({
        ...getValues(),
        acepta_politica: true,
        finalidades_opcionales: finalidades,
        canal: 'web',
      }),
    onSuccess: (respuesta) => {
      setRegistro(respuesta)
      setAvisoReinicio(undefined)
      setPaso(2)
    },
    onError: (error) => {
      if (error instanceof ErrorApi && error.codigo === 'validacion') {
        const enDatos = Object.keys(error.campos).filter((c) => CAMPOS.includes(c as keyof DatosPersonales))
        enDatos.forEach((c) => setError(c as keyof DatosPersonales, { type: 'server', message: error.campos[c] }))
        if (enDatos.length > 0) setPaso(0)
      }
    },
  })

  const verificacion = useMutation({
    mutationFn: () => verificarCodigosRegistro(registro!.registro_id, codigoCorreo, codigoCelular),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_SESION })
      setPaso(3)
    },
    onError: (error) => {
      const codigo = codigoDe(error)
      if (error instanceof ErrorApi && codigo === 'codigo_incorrecto') {
        const restantes = Number(error.datos?.intentos_restantes ?? 0)
        setErrorCodigos(`${error.message} Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`)
      } else if (codigo === 'intentos_agotados' || codigo === 'registro_vencido' || codigo === 'no_encontrado') {
        // El registro pendiente ya no existe: hay que pedir códigos nuevos sin perder los datos.
        setRegistro(null)
        setAvisoReinicio(mensajeDe(error))
        setPaso(1)
      }
    },
  })

  const reenvio = useMutation({
    mutationFn: () => reenviarCodigosRegistro(registro!.registro_id),
    onSuccess: (respuesta) => {
      setRegistro(respuesta)
      setCodigoCorreo('')
      setCodigoCelular('')
      setErrorCodigos(undefined)
      verificacion.reset()
    },
  })

  const datos = getValues()

  return (
    <PantallaAcceso ancho="amplio">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta</h1>
          <p className="text-tinta-suave">
            Te toma unos 5 minutos. Ten a mano tu documento y tu celular.{' '}
            <Link to="/ingresar" className="font-semibold text-primario-700 underline-offset-4 hover:underline">
              Ya tengo cuenta
            </Link>
          </p>
        </div>

        <Stepper pasos={PASOS} actual={paso} etiqueta="Progreso del registro" />

        {paso === 0 ? (
          <form noValidate onSubmit={handleSubmit(() => setPaso(1))} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <Field id="tipo_documento" etiqueta="Tipo de documento" error={errors.tipo_documento?.message}>
                <Select {...register('tipo_documento')}>
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.texto}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="num_documento" etiqueta="Número de documento" ayuda="Sin puntos ni espacios." error={errors.num_documento?.message}>
                <Input autoComplete="off" inputMode="text" spellCheck={false} {...register('num_documento')} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="nombres" etiqueta="Nombres" error={errors.nombres?.message}>
                <Input autoComplete="given-name" {...register('nombres')} />
              </Field>
              <Field id="apellidos" etiqueta="Apellidos" error={errors.apellidos?.message}>
                <Input autoComplete="family-name" {...register('apellidos')} />
              </Field>
            </div>
            <Field id="fecha_nacimiento" etiqueta="Fecha de nacimiento" ayuda="Debes ser mayor de 18 años." error={errors.fecha_nacimiento?.message}>
              <Input type="date" autoComplete="bday" max={fechaHace18Anios()} className="sm:max-w-60" {...register('fecha_nacimiento')} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="email" etiqueta="Correo electrónico" error={errors.email?.message}>
                <Input type="email" spellCheck={false} inputMode="email" autoComplete="email" {...register('email')} />
              </Field>
              <Field id="telefono" etiqueta="Celular" ayuda="10 dígitos, empieza por 3." error={errors.telefono?.message}>
                <Input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} {...register('telefono')} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="password" etiqueta="Contraseña" error={errors.password?.message}>
                <Input type="password" autoComplete="new-password" {...register('password')} />
              </Field>
              <Field id="password_confirmation" etiqueta="Repite la contraseña" error={errors.password_confirmation?.message}>
                <Input type="password" autoComplete="new-password" {...register('password_confirmation')} />
              </Field>
            </div>
            <ul aria-label="Requisitos de la contraseña" className="grid gap-1 text-sm sm:grid-cols-2">
              {REGLAS_CONTRASENA.map((regla) => {
                const cumple = regla.cumple(contrasena)
                return (
                  <li key={regla.texto} className={`flex items-center gap-2 ${cumple ? 'text-secundario-700' : 'text-tinta-tenue'}`}>
                    <Check aria-hidden="true" className={`size-4 ${cumple ? '' : 'opacity-30'}`} />
                    {regla.texto}
                    <span className="sr-only">{cumple ? ': cumple' : ': falta'}</span>
                  </li>
                )
              })}
            </ul>
            <p className="text-sm text-tinta-tenue">No uses una contraseña que hayas usado en otro sitio: la comparamos con listas de contraseñas filtradas.</p>
            <div className="flex justify-end">
              <Button type="submit">Continuar</Button>
            </div>
          </form>
        ) : null}

        {paso === 1 ? (
          <div className="flex flex-col gap-6">
            {avisoReinicio ? (
              <Alert tono="advertencia" titulo="Necesitamos enviarte códigos nuevos">
                {avisoReinicio} Tus datos siguen aquí: revisa y vuelve a enviar.
              </Alert>
            ) : null}
            {politica.isPending ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : politica.isError ? (
              <Alert tono="error" accion={<Button variante="secundario" tamano="sm" onClick={() => politica.refetch()}>Intentar de nuevo</Button>}>
                {mensajeDe(politica.error)}
              </Alert>
            ) : (
              <>
                <div className="flex flex-col gap-2 rounded-panel bg-fondo p-4">
                  <p className="text-sm font-semibold">
                    Política de tratamiento de datos, versión {politica.data.version} (vigente desde{' '}
                    {formatoFecha(`${politica.data.vigente_desde}T12:00:00`)})
                  </p>
                  <p className="text-sm leading-relaxed text-tinta-suave">{politica.data.resumen}</p>
                </div>

                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-2 font-semibold">Necesarias para darte el servicio</legend>
                  {politica.data.finalidades
                    .filter((f) => f.necesaria)
                    .map((f) => (
                      <div key={f.codigo} className="flex gap-3 rounded-campo border border-dashed border-linea px-3 py-2">
                        <Lock aria-hidden="true" className="mt-1 size-4 shrink-0 text-tinta-tenue" />
                        <div className="flex flex-col">
                          <span className="font-medium">{f.nombre}</span>
                          <span className="text-sm text-tinta-tenue">{f.descripcion}</span>
                        </div>
                      </div>
                    ))}
                </fieldset>

                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 font-semibold">Opcionales</legend>
                  <p className="text-sm text-tinta-suave">Tú decides. Puedes cambiarlas cuando quieras desde Privacidad.</p>
                  {politica.data.finalidades
                    .filter((f) => !f.necesaria)
                    .map((f) => (
                      <Checkbox
                        key={f.codigo}
                        id={`finalidad-${f.codigo}`}
                        etiqueta={f.nombre}
                        descripcion={f.descripcion}
                        checked={finalidades.includes(f.codigo)}
                        onChange={(e) =>
                          setFinalidades((actuales) =>
                            e.target.checked ? [...actuales, f.codigo] : actuales.filter((c) => c !== f.codigo),
                          )
                        }
                      />
                    ))}
                </fieldset>

                <div className="flex flex-col gap-1 border-t border-linea pt-5">
                  <Checkbox
                    id="acepta_politica"
                    etiqueta="Leí y acepto la política de tratamiento de datos"
                    checked={aceptaPolitica}
                    onChange={(e) => {
                      setAceptaPolitica(e.target.checked)
                      setErrorPolitica(undefined)
                    }}
                    aria-invalid={errorPolitica ? true : undefined}
                  />
                  {errorPolitica ? <p className="pl-8 text-sm font-medium text-alerta-700">{errorPolitica}</p> : null}
                </div>

                {inicio.isError && codigoDe(inicio.error) !== 'validacion' ? (
                  <Alert
                    tono="error"
                    accion={
                      codigoDe(inicio.error) === 'cuenta_existente' ? (
                        <Link to="/recuperar" className="font-semibold underline underline-offset-4">
                          Recuperar el acceso
                        </Link>
                      ) : undefined
                    }
                  >
                    {mensajeDe(inicio.error)}
                  </Alert>
                ) : null}
                {inicio.isError && codigoDe(inicio.error) === 'validacion' && !Object.keys(errors).length ? (
                  <Alert tono="error">{mensajeDe(inicio.error)}</Alert>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button variante="secundario" onClick={() => setPaso(0)}>
                    Volver
                  </Button>
                  <Button
                    cargando={inicio.isPending}
                    onClick={() => {
                      if (!aceptaPolitica) {
                        setErrorPolitica('Debes leer y aceptar la política de tratamiento de datos.')
                        return
                      }
                      inicio.mutate()
                    }}
                  >
                    Enviar códigos de verificación
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {paso === 2 && registro ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              setErrorCodigos(undefined)
              if (codigoCorreo.length !== 6 || codigoCelular.length !== 6) {
                setErrorCodigos('Escribe los dos códigos de 6 dígitos.')
                return
              }
              verificacion.mutate()
            }}
            className="flex flex-col gap-6"
          >
            <p className="text-tinta-suave">
              Te enviamos un código al correo <span className="font-semibold text-tinta">{enmascararCorreo(datos.email)}</span> y otro
              por SMS al celular <span className="font-semibold text-tinta">{enmascarar(datos.telefono)}</span>.
            </p>
            {import.meta.env.DEV ? (
              <Alert tono="advertencia" titulo="Entorno de desarrollo">
                No se envían correos ni SMS: los dos códigos aparecen en <code>backend/storage/logs/laravel.log</code>.
              </Alert>
            ) : null}
            {verificacion.isError && !errorCodigos ? <Alert tono="error">{mensajeDe(verificacion.error)}</Alert> : null}
            {reenvio.isError ? <Alert tono="error">{mensajeDe(reenvio.error)}</Alert> : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <CodeInput id="codigo_email" etiqueta="Código del correo" valor={codigoCorreo} onCambiar={setCodigoCorreo} enfocar />
              <CodeInput id="codigo_telefono" etiqueta="Código del SMS" valor={codigoCelular} onCambiar={setCodigoCelular} />
            </div>
            {errorCodigos ? (
              <p role="alert" className="-mt-3 text-sm font-medium text-alerta-700">
                {errorCodigos}
              </p>
            ) : null}
            <TemporizadorCodigo
              expiraEn={registro.codigos_expiran_en}
              reenvioEn={registro.reenvio_disponible_en}
              onReenviar={() => reenvio.mutate()}
              reenviando={reenvio.isPending}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variante="secundario" onClick={() => setPaso(1)}>
                Volver
              </Button>
              <Button type="submit" cargando={verificacion.isPending}>
                Verificar y crear mi cuenta
              </Button>
            </div>
          </form>
        ) : null}

        {paso === 3 ? (
          <div className="flex flex-col gap-6">
            <Alert tono="exito" titulo="Tu cuenta quedó creada">
              Falta un paso: verificar tu identidad. Sin eso no podemos estudiar solicitudes de crédito.
            </Alert>
            {sesion ? (
              <>
                <VerificacionIdentidad onTerminar={() => navegar('/portal', { replace: true })} />
                <Link to="/portal" className="text-center text-sm font-semibold text-primario-700 underline-offset-4 hover:underline">
                  Lo haré después
                </Link>
              </>
            ) : (
              <Alert
                tono="info"
                accion={
                  <Link to="/ingresar" className="font-semibold underline underline-offset-4">
                    Iniciar sesión
                  </Link>
                }
              >
                Inicia sesión con tu correo y contraseña para verificar tu identidad.
              </Alert>
            )}
          </div>
        ) : null}
      </div>
    </PantallaAcceso>
  )
}
