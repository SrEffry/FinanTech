import { useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Clock, ShieldX } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enviarVerificacionIdentidad } from '../../lib/api/identidad'
import type { EscenarioSimulado, ResultadoVerificacion, VerificacionIdentidad as Resultado } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { Button } from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { DistintivoSimulado } from '../../components/dominio/Distintivos'
import { CLAVE_SESION, useServiciosSimulados } from '../acceso/sesion'
import { CapturaFoto } from './CapturaFoto'

const ESCENARIOS: { valor: EscenarioSimulado; texto: string }[] = [
  { valor: 'exito', texto: 'Identidad verificada' },
  { valor: 'coincidencia_baja', texto: 'Coincidencia menor a 0,85' },
  { valor: 'documento_ilegible', texto: 'Documento ilegible' },
  { valor: 'servicio_caido', texto: 'Servicio no disponible' },
  { valor: 'lista_restrictiva', texto: 'Coincidencia en listas restrictivas' },
]

interface Props {
  onTerminar: (resultado: Resultado) => void
}

/**
 * Verificación de identidad (RF-02): documento por ambas caras y una foto del rostro como
 * prueba de vida. La cámara se pide solo al tocar cada campo y siempre se puede subir un
 * archivo en su lugar (RI-06, alternativa accesible a la captura biométrica). Las fotos no
 * se guardan en el dispositivo: viven en memoria hasta enviarlas.
 */
export function VerificacionIdentidad({ onTerminar }: Props) {
  const simulado = useServiciosSimulados()
  const cliente = useQueryClient()
  const [frente, setFrente] = useState<File | null>(null)
  const [reverso, setReverso] = useState<File | null>(null)
  const [rostro, setRostro] = useState<File | null>(null)
  const [escenario, setEscenario] = useState<EscenarioSimulado>('exito')
  const [faltantes, setFaltantes] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const envio = useMutation({
    mutationFn: () =>
      enviarVerificacionIdentidad({
        frente: frente as File,
        reverso: reverso as File,
        rostro: rostro as File,
        escenario: simulado ? escenario : undefined,
      }),
    onSuccess: (respuesta) => {
      setResultado(respuesta)
      cliente.invalidateQueries({ queryKey: CLAVE_SESION })
      if (respuesta.resultado === 'ilegible') {
        setFrente(null)
        setReverso(null)
      }
    },
  })

  function enviar() {
    const errores: Record<string, string> = {}
    if (!frente) errores.frente = 'Falta la foto del frente del documento.'
    if (!reverso) errores.reverso = 'Falta la foto del reverso del documento.'
    if (!rostro) errores.rostro = 'Falta la foto de tu rostro.'
    setFaltantes(errores)
    if (Object.keys(errores).length === 0) envio.mutate()
  }

  const final = resultado?.resultado && resultado.resultado !== 'ilegible'

  if (final && resultado) {
    const vista = RESULTADOS[resultado.resultado as Exclude<ResultadoVerificacion, 'ilegible'>]
    return (
      <div className="flex flex-col items-start gap-5">
        {resultado.simulado ? <DistintivoSimulado que="Verificación simulada" /> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ring-8 ${vista.circulo}`}>{vista.icono}</span>
          <div className="flex flex-col gap-2" role={resultado.resultado === 'no_continua' ? 'alert' : 'status'}>
            <h2 className="titular text-2xl font-semibold text-noche">{vista.titulo}</h2>
            <p className="text-tinta-suave">{resultado.mensaje}</p>
            {resultado.coincidencia !== null && resultado.resultado !== 'no_continua' ? (
              <p className="text-sm text-tinta-suave">
                Coincidencia de tu foto con el documento:{' '}
                <span className="cifras font-semibold text-tinta">{resultado.coincidencia.toLocaleString('es-CO')}</span> (mínimo 0,85).
              </p>
            ) : null}
          </div>
        </div>
        <Button tamano="lg" onClick={() => onTerminar(resultado)}>
          {resultado.resultado === 'verificado' ? 'Ir a mi portal' : 'Entendido'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      {resultado?.resultado === 'ilegible' ? (
        <Alert tono="advertencia" titulo="Toma las fotos del documento de nuevo">
          {resultado.mensaje} Te quedan {resultado.intentos_restantes}{' '}
          {resultado.intentos_restantes === 1 ? 'intento' : 'intentos'}.
        </Alert>
      ) : null}
      {envio.isError ? <Alert tono="error">{mensajeDe(envio.error)}</Alert> : null}

      <section aria-labelledby="titulo-documento" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="titulo-documento" className="titular text-xl font-semibold text-noche">
            Tu documento de identidad
          </h2>
          <p className="text-sm text-tinta-suave">Ponlo sobre una superficie oscura y encuádralo dentro de las esquinas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CapturaFoto tipo="frente" archivo={frente} onCambiar={setFrente} error={faltantes.frente} deshabilitado={envio.isPending} />
          <CapturaFoto tipo="reverso" archivo={reverso} onCambiar={setReverso} error={faltantes.reverso} deshabilitado={envio.isPending} />
        </div>
      </section>

      <section aria-labelledby="titulo-rostro" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="titulo-rostro" className="titular text-xl font-semibold text-noche">
            Prueba de vida
          </h2>
          <p className="text-sm text-tinta-suave">La comparamos con la foto de tu documento. Las fotos no se guardan en tu celular.</p>
        </div>
        <div className="sm:max-w-[calc(50%-0.5rem)]">
          <CapturaFoto tipo="rostro" archivo={rostro} onCambiar={setRostro} error={faltantes.rostro} deshabilitado={envio.isPending} />
        </div>
      </section>

      {simulado ? (
        <div className="flex flex-col gap-3 rounded-panel border border-advertencia-100 bg-advertencia-50 p-4">
          <DistintivoSimulado que="Servicio de verificación simulado" />
          <Field
            id="escenario"
            etiqueta="Escenario de prueba"
            ayuda="El proveedor simulado responde lo que elijas aquí. En producción este campo no existe."
          >
            <Select value={escenario} onChange={(e) => setEscenario(e.target.value as EscenarioSimulado)}>
              {ESCENARIOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.texto}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      <Button tamano="lg" onClick={enviar} cargando={envio.isPending} className="w-full sm:w-auto sm:self-start">
        Verificar mi identidad
      </Button>
    </div>
  )
}

const RESULTADOS: Record<Exclude<ResultadoVerificacion, 'ilegible'>, { titulo: string; icono: ReactNode; circulo: string }> = {
  verificado: {
    titulo: 'Identidad verificada',
    icono: <CircleCheck aria-hidden="true" className="size-7 text-secundario-700" />,
    circulo: 'bg-secundario-50 ring-secundario-50/50',
  },
  revision_manual: {
    titulo: 'Revisaremos tus datos',
    icono: <Clock aria-hidden="true" className="size-7 text-advertencia-700" />,
    circulo: 'bg-advertencia-50 ring-advertencia-50/50',
  },
  en_cola: {
    titulo: 'Lo intentaremos de nuevo',
    icono: <CircleAlert aria-hidden="true" className="size-7 text-advertencia-700" />,
    circulo: 'bg-advertencia-50 ring-advertencia-50/50',
  },
  no_continua: {
    titulo: 'No podemos continuar',
    icono: <ShieldX aria-hidden="true" className="size-7 text-alerta-700" />,
    circulo: 'bg-alerta-50 ring-alerta-50/50',
  },
}
