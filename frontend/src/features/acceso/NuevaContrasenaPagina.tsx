import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Check } from 'lucide-react'
import { confirmarRecuperacion } from '../../lib/api/identidad'
import { REGLAS_CONTRASENA, esquemaContrasena } from '../../lib/contrasena'
import { aplicarErroresCampos, codigoDe, mensajeDe } from '../../lib/errores'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { PantallaAcceso } from '../../components/layouts/PublicoLayout'

const esquema = z
  .object({
    password: esquemaContrasena,
    password_confirmation: z.string().min(1, 'Repite tu contraseña.'),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Las contraseñas no coinciden.',
  })

type Datos = z.infer<typeof esquema>

/**
 * Contraseña nueva desde el enlace del correo (RF-03 FA-04): `/recuperar/nueva?token&email`.
 * Al guardarla, el servidor cierra todas las sesiones y levanta el bloqueo por intentos.
 */
export default function NuevaContrasenaPagina() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token') ?? ''
  const email = parametros.get('email') ?? ''
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: { password: '', password_confirmation: '' } })
  const contrasena = useWatch({ control, name: 'password' }) ?? ''

  const cambio = useMutation({
    mutationFn: (datos: Datos) => confirmarRecuperacion({ email, token, ...datos }),
    onError: (error) => aplicarErroresCampos(error, setError, ['password', 'password_confirmation']),
  })

  const enlaceRoto = !token || !email || codigoDe(cambio.error) === 'enlace_invalido'

  return (
    <PantallaAcceso>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <title>Crea una contraseña nueva · FinanTech</title>
          <h1 className="text-2xl font-semibold tracking-tight">Crea una contraseña nueva</h1>
          {email ? <p className="text-tinta-suave">Para la cuenta {email}.</p> : null}
        </div>

        {cambio.isSuccess ? (
          <Alert tono="exito" titulo="Listo" accion={<ButtonLink to="/ingresar" tamano="sm">Iniciar sesión</ButtonLink>}>
            {cambio.data.mensaje}
          </Alert>
        ) : enlaceRoto ? (
          <Alert tono="advertencia" titulo="Este enlace ya no sirve" accion={<ButtonLink to="/recuperar" tamano="sm">Pedir otro enlace</ButtonLink>}>
            {cambio.isError ? mensajeDe(cambio.error) : 'El enlace está incompleto.'} Los enlaces valen 60 minutos y se usan una sola vez.
          </Alert>
        ) : (
          <form noValidate onSubmit={handleSubmit((datos) => cambio.mutate(datos))} className="flex flex-col gap-5">
            {cambio.isError && codigoDe(cambio.error) !== 'validacion' ? <Alert tono="error">{mensajeDe(cambio.error)}</Alert> : null}
            {/* Campo oculto para que el gestor de contraseñas asocie la nueva a la cuenta. */}
            <input type="email" autoComplete="username" value={email} readOnly hidden />
            <Field id="password" etiqueta="Contraseña nueva" error={errors.password?.message}>
              <Input type="password" autoComplete="new-password" {...register('password')} />
            </Field>
            <Field id="password_confirmation" etiqueta="Repite la contraseña" error={errors.password_confirmation?.message}>
              <Input type="password" autoComplete="new-password" {...register('password_confirmation')} />
            </Field>
            <ul aria-label="Requisitos de la contraseña" className="grid gap-1 text-sm">
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
            <p className="text-sm text-tinta-tenue">Al guardarla cerramos tu sesión en todos los dispositivos.</p>
            <Button type="submit" cargando={cambio.isPending} className="w-full">
              Guardar contraseña
            </Button>
          </form>
        )}

        <Link to="/ingresar" className="text-sm font-semibold text-primario-700 underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </PantallaAcceso>
  )
}
