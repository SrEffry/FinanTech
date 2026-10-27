import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { pedirRecuperacion } from '../../lib/api/identidad'
import { mensajeDe } from '../../lib/errores'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { PantallaAcceso } from '../../components/layouts/PublicoLayout'

const esquema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido, como nombre@correo.com.'),
})

/** Recuperación de contraseña (UC1 A1). La respuesta no revela si el correo existe (RN-17). */
export default function RecuperarPagina() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof esquema>>({ resolver: zodResolver(esquema) })
  const pedido = useMutation({ mutationFn: (email: string) => pedirRecuperacion(email) })

  return (
    <PantallaAcceso>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Recupera tu contraseña</h1>
          <p className="text-tinta-suave">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.</p>
        </div>

        {pedido.isSuccess ? (
          <Alert tono="exito" titulo="Revisa tu correo">
            {pedido.data.mensaje}
          </Alert>
        ) : (
          <form noValidate onSubmit={handleSubmit(({ email }) => pedido.mutate(email))} className="flex flex-col gap-5">
            {pedido.isError ? <Alert tono="error">{mensajeDe(pedido.error)}</Alert> : null}
            <Field id="email" etiqueta="Correo electrónico" error={errors.email?.message}>
              <Input type="email" spellCheck={false} autoComplete="email" inputMode="email" {...register('email')} />
            </Field>
            <Button type="submit" cargando={pedido.isPending} className="w-full">
              Enviar enlace
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
