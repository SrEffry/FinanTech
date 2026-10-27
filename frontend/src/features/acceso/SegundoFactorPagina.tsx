import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { reenviarSegundoFactor, verificarSegundoFactor } from '../../lib/api/identidad'
import type { DesafioMfa } from '../../lib/api/tipos'
import { ErrorApi } from '../../lib/api/cliente'
import { codigoDe, mensajeDe } from '../../lib/errores'
import { Button } from '../../components/ui/Button'
import { CodeInput, TemporizadorCodigo } from '../../components/ui/CodeInput'
import { Alert } from '../../components/ui/Feedback'
import { PantallaAcceso } from '../../components/layouts/PublicoLayout'
import { CLAVE_SESION, inicioDeRol } from './sesion'

interface Estado {
  desafio: DesafioMfa
  email: string
  volver: string | null
}

/** Segundo factor (8.1.3): código, temporizador de vigencia y reenvío a los 60 s. */
export default function SegundoFactorPagina() {
  const ubicacion = useLocation()
  const estado = ubicacion.state as Estado | null
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const [desafio, setDesafio] = useState(estado?.desafio)
  const [codigo, setCodigo] = useState('')
  const [errorCampo, setErrorCampo] = useState<string>()

  const verificacion = useMutation({
    mutationFn: () => verificarSegundoFactor(desafio!.desafio_id, codigo),
    onSuccess: ({ usuario }) => {
      cliente.setQueryData(CLAVE_SESION, usuario)
      navegar(estado?.volver ?? inicioDeRol(usuario.rol), { replace: true })
    },
    onError: (error) => {
      if (error instanceof ErrorApi && error.codigo === 'codigo_incorrecto') {
        const restantes = Number(error.datos?.intentos_restantes ?? 0)
        setErrorCampo(`${error.message} Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`)
      }
    },
  })

  const reenvio = useMutation({
    mutationFn: () => reenviarSegundoFactor(desafio!.desafio_id),
    onSuccess: (nuevo) => {
      setDesafio(nuevo)
      setCodigo('')
      setErrorCampo(undefined)
    },
  })

  if (!desafio) return <Navigate to="/ingresar" replace />

  const terminal = ['intentos_agotados', 'codigo_vencido'].includes(codigoDe(verificacion.error) ?? '')

  function enviar(e: FormEvent) {
    e.preventDefault()
    setErrorCampo(undefined)
    if (codigo.length !== 6) {
      setErrorCampo('Escribe los 6 dígitos del código.')
      return
    }
    verificacion.mutate()
  }

  return (
    <PantallaAcceso>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Confirma que eres tú</h1>
          <p className="text-tinta-suave">
            Te enviamos un código de 6 dígitos a <span className="font-semibold text-tinta">{desafio.enviado_a}</span>.
          </p>
        </div>

        {desafio.codigo_demo ? (
          <Alert tono="advertencia" titulo="Código de demostración">
            Como esta es una demostración no enviamos correos: usa el código{' '}
            <span className="cifras font-semibold">{desafio.codigo_demo}</span>.
          </Alert>
        ) : null}

        {verificacion.isError && !errorCampo ? (
          <Alert
            tono="error"
            accion={
              terminal ? (
                <Link to="/ingresar" className="font-semibold underline underline-offset-4">
                  Volver a iniciar sesión
                </Link>
              ) : undefined
            }
          >
            {mensajeDe(verificacion.error)}
          </Alert>
        ) : null}
        {reenvio.isError ? <Alert tono="error">{mensajeDe(reenvio.error)}</Alert> : null}

        <form noValidate onSubmit={enviar} className="flex flex-col gap-5">
          <CodeInput id="codigo" etiqueta="Código de verificación" valor={codigo} onCambiar={setCodigo} error={errorCampo} enfocar />
          <TemporizadorCodigo
            expiraEn={desafio.expira_en}
            reenvioEn={desafio.reenvio_disponible_en}
            onReenviar={() => reenvio.mutate()}
            reenviando={reenvio.isPending}
          />
          <Button type="submit" cargando={verificacion.isPending} disabled={terminal} className="w-full">
            Confirmar e ingresar
          </Button>
        </form>

        <Link to="/ingresar" className="text-sm font-semibold text-primario-700 underline-offset-4 hover:underline">
          Usar otra cuenta
        </Link>
      </div>
    </PantallaAcceso>
  )
}
