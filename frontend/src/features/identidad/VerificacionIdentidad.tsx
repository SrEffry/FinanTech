import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enviarVerificacionIdentidad } from '../../lib/api/identidad'
import type { EscenarioSimulado, VerificacionIdentidad as Resultado } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { Button } from '../../components/ui/Button'
import { Field, Select } from '../../components/ui/Field'
import { FileDrop } from '../../components/ui/FileDrop'
import { Alert } from '../../components/ui/Feedback'
import { DistintivoSimulado } from '../../components/dominio/Distintivos'
import { CLAVE_SESION, useServiciosSimulados } from '../acceso/sesion'

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

  const final = resultado && resultado.resultado !== 'ilegible'

  if (final && resultado) {
    const tono =
      resultado.resultado === 'verificado' ? 'exito' : resultado.resultado === 'no_continua' ? 'error' : 'advertencia'
    return (
      <div className="flex flex-col gap-5">
        {resultado.simulado ? <DistintivoSimulado que="Verificación simulada" /> : null}
        <Alert
          tono={tono}
          titulo={
            resultado.resultado === 'verificado'
              ? 'Identidad verificada'
              : resultado.resultado === 'revision_manual'
                ? 'Revisaremos tus datos'
                : resultado.resultado === 'en_cola'
                  ? 'Lo intentaremos de nuevo'
                  : 'No podemos continuar'
          }
        >
          {resultado.mensaje}
          {resultado.coincidencia !== null && resultado.resultado !== 'no_continua' ? (
            <span className="mt-1 block">
              Coincidencia de tu foto con el documento:{' '}
              <span className="font-semibold">{resultado.coincidencia.toLocaleString('es-CO')}</span> (mínimo 0,85).
            </span>
          ) : null}
        </Alert>
        <Button onClick={() => onTerminar(resultado)}>
          {resultado.resultado === 'verificado' ? 'Ir a mi portal' : 'Entendido'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {resultado?.resultado === 'ilegible' ? (
        <Alert tono="advertencia" titulo="Toma las fotos del documento de nuevo">
          {resultado.mensaje} Te quedan {resultado.intentos_restantes}{' '}
          {resultado.intentos_restantes === 1 ? 'intento' : 'intentos'}.
        </Alert>
      ) : null}
      {envio.isError ? <Alert tono="error">{mensajeDe(envio.error)}</Alert> : null}

      <section aria-labelledby="titulo-documento" className="flex flex-col gap-3">
        <h3 id="titulo-documento" className="font-semibold">
          Tu documento de identidad
        </h3>
        <p className="text-sm text-tinta-suave">
          Ponlo sobre una superficie oscura, con buena luz y sin reflejos. Que se vean las cuatro esquinas.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FileDrop
            etiqueta="Frente del documento"
            captura="environment"
            onSeleccionar={setFrente}
            archivoActual={frente ? { nombre: frente.name, tamano: frente.size } : null}
            error={faltantes.frente}
          />
          <FileDrop
            etiqueta="Reverso del documento"
            captura="environment"
            onSeleccionar={setReverso}
            archivoActual={reverso ? { nombre: reverso.name, tamano: reverso.size } : null}
            error={faltantes.reverso}
          />
        </div>
      </section>

      <section aria-labelledby="titulo-rostro" className="flex flex-col gap-3">
        <h3 id="titulo-rostro" className="font-semibold">
          Prueba de vida
        </h3>
        <p className="text-sm text-tinta-suave">
          Tómate una foto de frente, sin gafas ni gorra, en un lugar iluminado. La comparamos con la foto de tu documento.
        </p>
        <FileDrop
          etiqueta="Foto de tu rostro"
          descripcion="Toca para abrir la cámara frontal o elige una foto (JPG o PNG)."
          captura="user"
          onSeleccionar={setRostro}
          archivoActual={rostro ? { nombre: rostro.name, tamano: rostro.size } : null}
          error={faltantes.rostro}
        />
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

      <Button onClick={enviar} cargando={envio.isPending}>
        Verificar mi identidad
      </Button>
    </div>
  )
}
