import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerParametros, publicarParametros, simularParametros } from '../../lib/api/administracion'
import type { ImpactoParametros, Parametros, PropuestaParametros } from '../../lib/api/tipos'
import { ErrorApi } from '../../lib/api/cliente'
import { mensajeDe } from '../../lib/errores'
import { formatoFecha } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Alert, Badge, Panel } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { EncabezadoPagina } from '../../components/layouts/Comunes'

function hoy(): string {
  const fecha = new Date()
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset())
  return fecha.toISOString().slice(0, 10)
}

function numero(texto: string): number {
  return Number(texto.replace(',', '.')) || 0
}

/** Parametrización (8.6.2, UC16): producto, umbrales y vigencia, con simulación previa. */
export default function ParametrosPagina() {
  const parametros = useQuery({ queryKey: ['parametros'], queryFn: obtenerParametros })
  if (parametros.isPending) return <CargaPagina />
  if (parametros.isError) return <Alert tono="error">{mensajeDe(parametros.error)}</Alert>
  return <Editor key={parametros.data.vigente.version} parametros={parametros.data} />
}

function Editor({ parametros }: { parametros: Parametros }) {
  const { vigente } = parametros
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const [propuesta, setPropuesta] = useState<PropuestaParametros>({
    vigente_desde: hoy(),
    tasa_maxima_legal_ea: vigente.tasa_maxima_legal_ea,
    umbral_aprobar: vigente.umbral_aprobar,
    umbral_negar: vigente.umbral_negar,
    limite_cuota_ingreso: vigente.limite_cuota_ingreso,
    productos: vigente.productos.map((p) => ({ ...p })),
  })
  const [impacto, setImpacto] = useState<ImpactoParametros | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const cambiar = (cambios: Partial<PropuestaParametros>) => {
    setPropuesta((p) => ({ ...p, ...cambios }))
    setImpacto(null)
  }
  const cambiarProducto = (indice: number, cambios: Partial<PropuestaParametros['productos'][number]>) => {
    setPropuesta((p) => ({ ...p, productos: p.productos.map((prod, i) => (i === indice ? { ...prod, ...cambios } : prod)) }))
    setImpacto(null)
  }

  const simulacion = useMutation({ mutationFn: () => simularParametros(propuesta), onSuccess: setImpacto })
  const publicacion = useMutation({
    mutationFn: () => publicarParametros({ ...propuesta, vigente_desde: new Date(`${propuesta.vigente_desde}T00:00:00`).toISOString() }),
    onSuccess: (nuevos) => {
      cliente.setQueryData(['parametros'], nuevos)
      cliente.invalidateQueries({ queryKey: ['productos'] })
      setConfirmando(false)
      avisar('Publicamos los parámetros nuevos.')
    },
    onError: () => setConfirmando(false),
  })

  const campos = publicacion.error instanceof ErrorApi ? publicacion.error.campos : {}
  const tasaExcedida = propuesta.productos.some((p) => p.tasa_ea > propuesta.tasa_maxima_legal_ea)

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Parámetros de crédito"
        descripcion={`Versión vigente ${vigente.version}, desde el ${formatoFecha(vigente.vigente_desde)}, publicada por ${vigente.publicado_por}.`}
      />
      <Alert tono="info">
        Quien publica parámetros no puede decidir solicitudes de crédito (segregación de funciones). Cada publicación crea una versión nueva; las
        evaluaciones guardan la versión con la que se hicieron.
      </Alert>

      <Panel titulo="Reglas de decisión">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="tasa-maxima" etiqueta="Tasa máxima legal (% E.A.)" error={campos.tasa_maxima_legal_ea}>
            <Input inputMode="decimal" className="cifras" value={propuesta.tasa_maxima_legal_ea} onChange={(e) => cambiar({ tasa_maxima_legal_ea: numero(e.target.value) })} />
          </Field>
          <Field id="umbral-aprobar" etiqueta="Aprobar desde (puntaje)" error={campos.umbral_aprobar}>
            <Input inputMode="numeric" className="cifras" value={propuesta.umbral_aprobar} onChange={(e) => cambiar({ umbral_aprobar: numero(e.target.value) })} />
          </Field>
          <Field id="umbral-negar" etiqueta="Negar por debajo de" error={campos.umbral_negar}>
            <Input inputMode="numeric" className="cifras" value={propuesta.umbral_negar} onChange={(e) => cambiar({ umbral_negar: numero(e.target.value) })} />
          </Field>
          <Field id="limite-cuota" etiqueta="Cuota máxima / ingreso (%)" error={campos.limite_cuota_ingreso}>
            <Input inputMode="numeric" className="cifras" value={propuesta.limite_cuota_ingreso} onChange={(e) => cambiar({ limite_cuota_ingreso: numero(e.target.value) })} />
          </Field>
        </div>
      </Panel>

      <Panel titulo="Productos">
        <div role="region" aria-label="Parámetros por producto" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-tinta-suave">
                <th scope="col" className="py-2 pr-3 font-semibold">Producto</th>
                <th scope="col" className="py-2 pr-3 font-semibold">TEA (%)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Monto mínimo</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Monto máximo</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Plazo mín.</th>
                <th scope="col" className="py-2 font-semibold">Plazo máx.</th>
              </tr>
            </thead>
            <tbody>
              {propuesta.productos.map((p, i) => (
                <tr key={p.codigo} className="border-b border-linea-suave last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">{p.nombre}</th>
                  <td className="py-2 pr-3">
                    <Field id={`tasa-${p.codigo}`} etiqueta={<span className="sr-only">TEA de {p.nombre}</span>} error={campos[`productos.${i}.tasa_ea`] ?? (p.tasa_ea > propuesta.tasa_maxima_legal_ea ? 'Supera la máxima legal.' : undefined)}>
                      <Input inputMode="decimal" className="cifras w-24" value={p.tasa_ea} onChange={(e) => cambiarProducto(i, { tasa_ea: numero(e.target.value) })} />
                    </Field>
                  </td>
                  <td className="py-2 pr-3">
                    <Field id={`min-${p.codigo}`} etiqueta={<span className="sr-only">Monto mínimo de {p.nombre}</span>}>
                      <MoneyInput valor={p.monto_min} onCambiar={(v) => cambiarProducto(i, { monto_min: v ?? 0 })} />
                    </Field>
                  </td>
                  <td className="py-2 pr-3">
                    <Field id={`max-${p.codigo}`} etiqueta={<span className="sr-only">Monto máximo de {p.nombre}</span>} error={campos[`productos.${i}.monto_max`]}>
                      <MoneyInput valor={p.monto_max} onCambiar={(v) => cambiarProducto(i, { monto_max: v ?? 0 })} />
                    </Field>
                  </td>
                  <td className="py-2 pr-3">
                    <Field id={`pmin-${p.codigo}`} etiqueta={<span className="sr-only">Plazo mínimo de {p.nombre}</span>}>
                      <Input inputMode="numeric" className="cifras w-20" value={p.plazo_min} onChange={(e) => cambiarProducto(i, { plazo_min: numero(e.target.value) })} />
                    </Field>
                  </td>
                  <td className="py-2">
                    <Field id={`pmax-${p.codigo}`} etiqueta={<span className="sr-only">Plazo máximo de {p.nombre}</span>} error={campos[`productos.${i}.plazo_max`]}>
                      <Input inputMode="numeric" className="cifras w-20" value={p.plazo_max} onChange={(e) => cambiarProducto(i, { plazo_max: numero(e.target.value) })} />
                    </Field>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel titulo="Simular y publicar">
        <div className="flex flex-col gap-5">
          <Field id="vigente-desde" etiqueta="Vigente desde" error={campos.vigente_desde}>
            <Input type="date" min={hoy()} className="sm:max-w-52" value={propuesta.vigente_desde} onChange={(e) => cambiar({ vigente_desde: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variante="secundario" cargando={simulacion.isPending} onClick={() => simulacion.mutate()}>
              Simular contra solicitudes históricas
            </Button>
            <Button disabled={!impacto || tasaExcedida} onClick={() => setConfirmando(true)}>
              Publicar
            </Button>
          </div>
          {!impacto ? <p className="text-sm text-tinta-tenue">Simula el cambio antes de publicarlo.</p> : null}
          {simulacion.isError ? <Alert tono="error">{mensajeDe(simulacion.error)}</Alert> : null}
          {publicacion.isError && Object.keys(campos).length === 0 ? <Alert tono="error">{mensajeDe(publicacion.error)}</Alert> : null}
          {impacto ? <TablaImpacto impacto={impacto} /> : null}
        </div>
      </Panel>

      <Panel titulo="Versiones publicadas">
        <ul className="flex flex-col gap-2 text-sm">
          {parametros.historial.map((h) => (
            <li key={h.version} className="flex flex-wrap items-center gap-2">
              <Badge tono={h.version === vigente.version ? 'exito' : 'neutro'}>{h.version}</Badge>
              <span>
                desde el {formatoFecha(h.vigente_desde)}, por {h.publicado_por}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Modal
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        titulo="¿Publicar los parámetros?"
        descripcion={`Rigen desde el ${formatoFecha(`${propuesta.vigente_desde}T12:00:00`)} para todas las evaluaciones nuevas. Al publicarlos, ya no podrás decidir solicitudes.`}
        acciones={
          <>
            <Button variante="secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button cargando={publicacion.isPending} onClick={() => publicacion.mutate()}>
              Publicar
            </Button>
          </>
        }
      />
    </div>
  )
}

/** Antes y después por clase de resultado: una tabla basta para tres números (dataviz). */
function TablaImpacto({ impacto }: { impacto: ImpactoParametros }) {
  const filas = [
    { clave: 'aprobadas' as const, texto: 'Aprobadas automáticamente' },
    { clave: 'escaladas' as const, texto: 'A estudio y decisión humana' },
    { clave: 'negadas' as const, texto: 'Negadas automáticamente' },
  ]
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-tinta-suave">Con estas reglas, las {impacto.evaluaciones} evaluaciones históricas habrían terminado así:</p>
      <table className="w-full max-w-xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-linea text-tinta-suave">
            <th scope="col" className="py-2 text-left font-semibold">Resultado</th>
            <th scope="col" className="py-2 text-right font-semibold">Hoy</th>
            <th scope="col" className="py-2 text-right font-semibold">Con el cambio</th>
            <th scope="col" className="py-2 text-right font-semibold">Diferencia</th>
          </tr>
        </thead>
        <tbody className="cifras">
          {filas.map((f) => {
            const diferencia = impacto.despues[f.clave] - impacto.antes[f.clave]
            return (
              <tr key={f.clave} className="border-b border-linea-suave last:border-b-0">
                <th scope="row" className="py-2 text-left font-medium">{f.texto}</th>
                <td className="py-2 text-right">{impacto.antes[f.clave]}</td>
                <td className="py-2 text-right font-semibold">{impacto.despues[f.clave]}</td>
                <td className="py-2 text-right text-tinta-suave">{diferencia > 0 ? `+${diferencia}` : diferencia === 0 ? 'Igual' : `−${Math.abs(diferencia)}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
