import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { obtenerProductos, simular } from '../../lib/api/simulacion'
import type { Producto, Simulacion } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { useEstable } from '../../lib/useEstable'
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
  const refRecibo = useRef<HTMLElement>(null)

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
        <Panel titulo="Tu crédito" className="lg:sticky lg:top-24">
          {producto && valores ? (
            <div className="flex flex-col gap-7">
              <SelectorProducto productos={lista} elegido={producto} onElegir={(codigo) => cambiar({ producto: codigo })} />
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

        <div className="flex min-w-0 flex-col gap-6" aria-busy={actualizando}>
          {/* El resultado es un recibo sobre el lienzo de la marca, como en la página de inicio. */}
          <section
            ref={refRecibo}
            aria-label="Resultado de la simulación"
            className="sobre-oscuro trama-trenza -mx-4 bg-noche px-2 py-4 sm:mx-0 sm:rounded-lienzo sm:p-4 sm:shadow-elevada"
          >
            <div className="rounded-[1.25rem] bg-superficie px-4 pt-5 pb-6 sm:px-7 sm:pt-6 sm:pb-7">
              {resultado ? (
                <div className={`flex flex-col gap-5 transition-opacity duration-150 ${actualizando ? 'opacity-60' : ''}`}>
                  <p className="text-sm text-tinta-suave">
                    {resultado.producto.nombre}: <span className="cifras font-semibold text-tinta">{formatoMoneda(resultado.monto)}</span> a{' '}
                    <span className="cifras font-semibold text-tinta">{resultado.plazo_meses} meses</span>
                  </p>
                  <div aria-live="polite">
                    <CuotaConTea cuota={resultado.cuota} tea={resultado.tasa_ea} explicar />
                  </div>
                  <p className="border-t border-dashed border-linea pt-4 text-sm text-tinta-suave">
                    Tasa mensual equivalente {formatoPorcentaje(resultado.tasa_mensual, 4)}. No supera la tasa máxima legal de{' '}
                    {formatoPorcentaje(resultado.tasa_maxima_legal_ea)} E.A.
                  </p>
                  {/* RN-25, RN-27, CP0011: el aviso va antes del botón para seguir. */}
                  <AvisoNoAprobacion />
                  <div className="flex flex-col gap-2">
                    <Button tamano="lg" onClick={continuar} className="w-full sm:w-auto sm:self-start">
                      Continuar con la solicitud
                    </Button>
                    {!usuario ? (
                      <p className="text-sm text-tinta-tenue">Te pediremos iniciar sesión o crear tu cuenta. Guardamos estos valores.</p>
                    ) : null}
                  </div>
                </div>
              ) : simulacion.isError ? (
                <Alert tono="error">{mensajeDe(simulacion.error)}</Alert>
              ) : (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-13 w-60 rounded-full" />
                </div>
              )}
            </div>
          </section>

          {resultado ? (
            <>
              <Panel titulo="Qué pagas en total" descripcion="Todos los costos, sin letra pequeña.">
                <DesgloseCostos
                  monto={resultado.monto}
                  desglose={resultado.desglose}
                  costoTotal={resultado.costo_total}
                  totalAPagar={resultado.total_a_pagar}
                  valorARecibir={resultado.valor_a_recibir}
                />
              </Panel>
              <Panel titulo="Plan de pagos" descripcion="Así se reparte cada cuota entre capital, intereses y seguro.">
                <PlanPagos plan={resultado.plan} nombreArchivo={`plan-${resultado.producto.codigo}-${resultado.plazo_meses}m.csv`} />
              </Panel>
            </>
          ) : null}
        </div>
      </div>

      {resultado ? <ResumenFijo resultado={resultado} recibo={refRecibo} /> : null}
    </div>
  )
}

/**
 * Productos como píldoras (UX-07): en el celular ocupan dos o tres renglones en vez de seis
 * tarjetas, y la descripción va solo para el elegido. Son radios nativos: flechas del
 * teclado, lector de pantalla y foco visible funcionan sin código propio.
 */
function SelectorProducto({ productos, elegido, onElegir }: { productos: Producto[]; elegido: Producto; onElegir: (codigo: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium text-tinta">Producto</legend>
      <div className="flex flex-wrap gap-2">
        {productos.map((p) => (
          <label
            key={p.codigo}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-linea-control bg-superficie px-4 text-sm font-medium text-tinta transition-colors duration-150 select-none hover:border-primario-600 hover:bg-cielo has-checked:border-noche has-checked:bg-noche has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name="producto"
              value={p.codigo}
              checked={p.codigo === elegido.codigo}
              onChange={() => onElegir(p.codigo)}
              className="sr-only"
            />
            {p.nombre}
          </label>
        ))}
      </div>
      <p className="rounded-panel bg-cielo px-4 py-3 text-sm text-tinta-suave" aria-live="polite">
        <span className="font-semibold text-noche">{elegido.nombre}, desde {formatoPorcentaje(elegido.tasa_ea)} E.A.</span>{' '}
        {elegido.descripcion}
      </p>
    </fieldset>
  )
}

/**
 * Barra fija del celular (UX-07, RNF-18): cuando el recibo sale de la vista mientras se
 * mueven los deslizadores, la cuota y la TEA siguen a la vista, juntas y con el mismo peso
 * (RNF-20). Es un reflejo visual del recibo, que ya se anuncia con aria-live: por eso se
 * oculta del lector y no tiene nada enfocable.
 */
function ResumenFijo({ resultado, recibo }: { resultado: Simulacion; recibo: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false)
  const refBarra = useRef<HTMLDivElement>(null)
  const enPortal = useLocation().pathname.startsWith('/portal')

  useEffect(() => {
    const nodo = recibo.current
    if (!nodo || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(([entrada]) => setVisible(!entrada.isIntersecting), { threshold: 0.15 })
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [recibo])

  // WCAG 2.4.11: si el foco cae detrás de la barra (o de la barra inferior del portal), el
  // control se lleva al centro de la pantalla para que nunca quede tapado.
  useEffect(() => {
    if (!visible) return
    function alEnfocar(evento: FocusEvent) {
      const barra = refBarra.current?.getBoundingClientRect()
      const control = (evento.target as HTMLElement).getBoundingClientRect?.()
      if (barra && control && barra.height > 0 && control.bottom > barra.top - 8) {
        ;(evento.target as HTMLElement).scrollIntoView({ block: 'center' })
      }
    }
    document.addEventListener('focusin', alEnfocar)
    return () => document.removeEventListener('focusin', alEnfocar)
  }, [visible])

  const cifra = 'cifras text-lg leading-tight font-semibold tracking-tight text-white'
  return (
    <div
      aria-hidden="true"
      className={`no-imprimir fixed inset-x-0 z-20 px-3 transition-[translate,opacity] duration-200 ease-(--ease-salida) lg:hidden ${
        enPortal ? 'bottom-[calc(4.25rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'
      } ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
    >
      <div ref={refBarra} className="mx-auto grid max-w-md grid-cols-2 divide-x divide-white/20 rounded-panel bg-noche px-4 py-2.5 shadow-flotante">
        <div className="flex min-w-0 flex-col pr-3">
          <span className="text-xs text-niebla">Cuota mensual</span>
          <span className={cifra}>{formatoMoneda(resultado.cuota)}</span>
        </div>
        <div className="flex min-w-0 flex-col pl-3">
          <span className="text-xs text-niebla">TEA (efectiva anual)</span>
          <span className={cifra}>{formatoPorcentaje(resultado.tasa_ea)}</span>
        </div>
      </div>
    </div>
  )
}
