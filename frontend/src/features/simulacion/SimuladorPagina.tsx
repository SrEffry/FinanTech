import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { obtenerProductos, simular } from '../../lib/api/simulacion'
import type { Producto } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { formatoMoneda, formatoPorcentaje } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Choice'
import { Alert, Panel } from '../../components/ui/Feedback'
import { Skeleton } from '../../components/ui/Spinner'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { DesgloseCostos, PlanPagos } from '../../components/dominio/Costos'
import { AvisoNoAprobacion } from '../../components/dominio/Distintivos'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useSesion } from '../acceso/sesion'
import { guardarSimulacion, leerSimulacion, rutaSolicitar } from './simulacionGuardada'

/** Espera a que el valor deje de cambiar (al arrastrar el deslizador) antes de pedir el cálculo. */
function useEstable<T>(valor: T, ms = 220): T {
  const [estable, setEstable] = useState(valor)
  useEffect(() => {
    const espera = window.setTimeout(() => setEstable(valor), ms)
    return () => window.clearTimeout(espera)
  }, [valor, ms])
  return estable
}

function ajustar(producto: Producto, monto: number, plazo: number) {
  const pasos = Math.round((monto - producto.monto_min) / producto.paso_monto)
  return {
    monto: Math.min(producto.monto_max, Math.max(producto.monto_min, producto.monto_min + pasos * producto.paso_monto)),
    plazo: Math.min(producto.plazo_max, Math.max(producto.plazo_min, Math.round(plazo))),
  }
}

/** Simulador (8.2.2, RF-05): lo usa el visitante y el cliente con sesión. */
export default function SimuladorPagina() {
  const productos = useQuery({ queryKey: ['productos'], queryFn: obtenerProductos, staleTime: 10 * 60_000 })
  const { data: usuario } = useSesion()
  const navegar = useNavigate()
  const [eleccion, setEleccion] = useState(() => leerSimulacion())

  const lista = productos.data ?? []
  const producto = lista.find((p) => p.codigo === eleccion?.producto) ?? lista[0]
  // Estado derivado: si el producto cambia, monto y plazo se ajustan a su rango (RF-05 FA-01).
  const valores = producto
    ? ajustar(producto, eleccion?.monto ?? Math.min(producto.monto_max, 5_000_000), eleccion?.plazo ?? Math.min(producto.plazo_max, 24))
    : null
  // Clave primitiva: así el valor estable solo cambia cuando cambian los datos, no en cada render.
  const clave = useEstable(producto && valores ? `${producto.codigo}|${valores.monto}|${valores.plazo}` : '')
  const [codigoConsulta, montoConsulta, plazoConsulta] = clave.split('|')

  const simulacion = useQuery({
    queryKey: ['simulacion', clave],
    queryFn: ({ signal }) => simular(codigoConsulta, Number(montoConsulta), Number(plazoConsulta), signal),
    enabled: clave !== '',
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  function cambiar(cambios: Partial<{ producto: string; monto: number; plazo: number }>) {
    if (!producto || !valores) return
    setEleccion({ producto: producto.codigo, ...valores, ...cambios })
  }

  function continuar() {
    if (!producto || !valores) return
    const guardada = { producto: producto.codigo, ...valores }
    guardarSimulacion(guardada)
    if (usuario?.rol === 'cliente') navegar(rutaSolicitar(guardada))
    else navegar(`/ingresar?volver=${encodeURIComponent(rutaSolicitar(guardada))}`)
  }

  const resultado = simulacion.data
  const actualizando = simulacion.isFetching && simulacion.isPlaceholderData

  return (
    <div>
      <EncabezadoPagina
        titulo="Simula tu crédito"
        descripcion="Mueve el monto y el plazo: la cuota, la tasa y todos los costos se recalculan al instante."
      />

      {productos.isError ? <Alert tono="error">{mensajeDe(productos.error)}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Panel titulo="Tu crédito" className="lg:sticky lg:top-24">
          {producto && valores ? (
            <div className="flex flex-col gap-6">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Producto</legend>
                <div className="grid gap-2">
                  {lista.map((p) => (
                    <label
                      key={p.codigo}
                      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-campo border px-3 py-2.5 transition-colors ${
                        p.codigo === producto.codigo ? 'border-primario-600 bg-primario-50' : 'border-linea hover:border-primario-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="producto"
                        value={p.codigo}
                        checked={p.codigo === producto.codigo}
                        onChange={() => cambiar({ producto: p.codigo })}
                        className="mt-1 size-4 accent-primario-600"
                      />
                      <span className="flex flex-1 flex-col">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium">{p.nombre}</span>
                          <span className="text-sm text-tinta-suave">desde {formatoPorcentaje(p.tasa_ea)} E.A.</span>
                        </span>
                        {p.codigo === producto.codigo ? <span className="text-sm text-tinta-suave">{p.descripcion}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Slider
                id="monto"
                etiqueta="Monto"
                valor={valores.monto}
                min={producto.monto_min}
                max={producto.monto_max}
                paso={producto.paso_monto}
                onCambiar={(monto) => cambiar({ monto })}
                textoValor={formatoMoneda(valores.monto)}
                textoMin={formatoMoneda(producto.monto_min)}
                textoMax={formatoMoneda(producto.monto_max)}
              />
              <Slider
                id="plazo"
                etiqueta="Plazo"
                valor={valores.plazo}
                min={producto.plazo_min}
                max={producto.plazo_max}
                paso={1}
                onCambiar={(plazo) => cambiar({ plazo })}
                textoValor={`${valores.plazo} meses`}
                textoMin={`${producto.plazo_min} meses`}
                textoMax={`${producto.plazo_max} meses`}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-6" aria-busy={actualizando}>
          <Panel variante="destacado">
            {resultado ? (
              <div className={`flex flex-col gap-5 transition-opacity ${actualizando ? 'opacity-60' : ''}`}>
                <p className="text-sm text-tinta-suave">
                  {resultado.producto.nombre}: <span className="font-semibold text-tinta">{formatoMoneda(resultado.monto)}</span> a{' '}
                  <span className="font-semibold text-tinta">{resultado.plazo_meses} meses</span>
                </p>
                <div aria-live="polite">
                  <CuotaConTea cuota={resultado.cuota} tea={resultado.tasa_ea} explicar />
                </div>
                <p className="text-sm text-tinta-suave">
                  Tasa mensual equivalente {formatoPorcentaje(resultado.tasa_mensual, 4)}. No supera la tasa máxima legal de{' '}
                  {formatoPorcentaje(resultado.tasa_maxima_legal_ea)} E.A.
                </p>
                <Button onClick={continuar} className="w-full sm:w-auto sm:self-start">
                  Continuar con la solicitud
                </Button>
                {!usuario ? (
                  <p className="-mt-2 text-sm text-tinta-tenue">Te pediremos iniciar sesión o crear tu cuenta. Guardamos estos valores.</p>
                ) : null}
              </div>
            ) : simulacion.isError ? (
              <Alert tono="error">{mensajeDe(simulacion.error)}</Alert>
            ) : (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-16" />
                <Skeleton className="h-11 w-56" />
              </div>
            )}
          </Panel>

          <AvisoNoAprobacion />

          {resultado ? (
            <>
              <Panel titulo="Qué pagas en total" descripcion="Todos los costos, sin letra pequeña.">
                <DesgloseCostos
                  monto={resultado.monto}
                  desglose={resultado.desglose}
                  costoTotal={resultado.costo_total}
                  totalAPagar={resultado.total_a_pagar}
                />
              </Panel>
              <Panel titulo="Plan de pagos" descripcion="Así se reparte cada cuota entre capital, intereses y seguro.">
                <PlanPagos plan={resultado.plan} nombreArchivo={`plan-${resultado.producto.codigo}-${resultado.plazo_meses}m.csv`} />
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
