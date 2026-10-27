import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { iniciarSesion } from '../../lib/api/identidad'
import { codigoDe, mensajeDe } from '../../lib/errores'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { CargaPagina } from '../../components/ui/Spinner'
import { PantallaAcceso } from '../../components/layouts/PublicoLayout'
import { API_SIMULADA } from '../../components/dominio/Distintivos'
import { inicioDeRol, useSesion } from './sesion'

const esquema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido, como nombre@correo.com.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

type Datos = z.infer<typeof esquema>

const CUENTAS_DEMO = [
  { rol: 'Cliente', email: 'laura.mejia@demo.finantech.co' },
  { rol: 'Analista de crédito', email: 'andres.rojas@demo.finantech.co' },
  { rol: 'Oficial de crédito', email: 'camila.ortiz@demo.finantech.co' },
  { rol: 'Administrador', email: 'sergio.paez@demo.finantech.co' },
  { rol: 'Auxiliar contable', email: 'diana.vargas@demo.finantech.co' },
  { rol: 'Directivo', email: 'hernan.cuellar@demo.finantech.co' },
]
const CONTRASENA_DEMO = 'Demo#2026!'

/** Inicio de sesión (8.1.1, RF-03): punto de entrada único para los seis roles. */
export default function IngresarPagina() {
  const { data: usuario, isPending: cargandoSesion } = useSesion()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const volver = parametros.get('volver')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: { email: '', password: '' } })

  const ingreso = useMutation({
    mutationFn: (datos: Datos) => iniciarSesion(datos.email, datos.password),
    onSuccess: (desafio, datos) => {
      navegar('/ingresar/verificacion', { state: { desafio, email: datos.email, volver } })
    },
  })

  if (cargandoSesion) return <CargaPagina />
  if (usuario) return <Navigate to={volver ?? inicioDeRol(usuario.rol)} replace />

  const bloqueada = codigoDe(ingreso.error) === 'cuenta_bloqueada'

  return (
    <PantallaAcceso>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="text-tinta-suave">Clientes y equipo de FinanTech entran por aquí.</p>
        </div>

        {ingreso.isError ? (
          <Alert
            tono="error"
            accion={
              bloqueada ? (
                <Link to="/recuperar" className="font-semibold underline underline-offset-4">
                  Recuperar mi contraseña
                </Link>
              ) : undefined
            }
          >
            {mensajeDe(ingreso.error)}
          </Alert>
        ) : null}

        <form noValidate onSubmit={handleSubmit((datos) => ingreso.mutate(datos))} className="flex flex-col gap-5">
          <Field id="email" etiqueta="Correo electrónico" error={errors.email?.message}>
            <Input type="email" spellCheck={false} autoComplete="username" inputMode="email" {...register('email')} />
          </Field>
          <Field id="password" etiqueta="Contraseña" error={errors.password?.message}>
            <div className="relative">
              <Input
                type={mostrarContrasena ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-24"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((v) => !v)}
                aria-pressed={mostrarContrasena}
                className="absolute inset-y-0 right-0 min-w-20 rounded-r-campo px-3 text-sm font-semibold text-primario-700"
              >
                {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </Field>
          <div className="-mt-2 flex justify-end">
            <Link to="/recuperar" className="text-sm font-semibold text-primario-700 underline-offset-4 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Button type="submit" cargando={ingreso.isPending} className="w-full">
            Iniciar sesión
          </Button>
        </form>

        <div className="flex flex-col gap-3 border-t border-linea pt-6 text-sm">
          <p className="text-tinta-suave">
            ¿Aún no eres cliente?{' '}
            <Link to="/registro" className="font-semibold text-primario-700 underline-offset-4 hover:underline">
              Crear cuenta
            </Link>
          </p>
          <p className="text-tinta-suave">
            ¿Solo quieres saber cuánto pagarías?{' '}
            <Link to="/simular" className="font-semibold text-primario-700 underline-offset-4 hover:underline">
              Simula sin cuenta
            </Link>
          </p>
        </div>

        {API_SIMULADA ? (
          <details className="rounded-panel border border-advertencia-100 bg-advertencia-50 px-4 py-3 text-sm text-advertencia-800">
            <summary className="cursor-pointer font-semibold">Cuentas de demostración</summary>
            <p className="mt-2">
              Contraseña de todas: <code className="font-semibold">{CONTRASENA_DEMO}</code>. El código del segundo factor
              aparece en pantalla.
            </p>
            <ul className="mt-2 flex flex-col">
              {CUENTAS_DEMO.map((c) => (
                <li key={c.email}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full flex-col items-start justify-center rounded-campo px-2 text-left hover:bg-advertencia-100"
                    onClick={() => {
                      setValue('email', c.email)
                      setValue('password', CONTRASENA_DEMO)
                    }}
                  >
                    <span className="font-semibold">{c.rol}</span>
                    <span className="text-xs">{c.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </PantallaAcceso>
  )
}
