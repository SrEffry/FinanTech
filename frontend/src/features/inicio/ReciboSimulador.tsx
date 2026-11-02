import { useState, type CSSProperties } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { obtenerProductos, simular } from '../../lib/api/simulacion'
import type { Producto } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { useEstable } from '../../lib/useEstable'
import { formatoMoneda, formatoPorcentaje } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Choice'
import { Field, Select } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { Skeleton } from '../../components/ui/Spinner'
import { CuotaConTea } from '../../components/dominio/CuotaConTea'
import { AvisoNoAprobacion } from '../../components/dominio/Distintivos'
import { Dinero } from '../../components/dominio/Marca'
import { guardarSimulacion, leerSimulacion, rutaSolicitar } from '../simulacion/simulacionGuardada'

function ajustar(producto: Producto, monto: number, plazo: number) {
  const pasos = Math.round((monto - producto.monto_min) / producto.paso_monto)
  return {
    monto: Math.min(producto.monto_max, Math.max(producto.monto_min, producto.monto_min + pasos * producto.paso_monto)),
    plazo: Math.min(producto.plazo_max, Math.max(producto.plazo_min, Math.round(plazo))),
  }
}

/** Retraso escalonado de cada renglón: el recibo "se imprime" una sola vez al cargar. */
const renglon = (i: number): CSSProperties => ({ animationDelay: `${320 + i * 60}ms` })
const ANIMA_RENGLON = 'animate-[renglon-aparece_420ms_var(--ease-salida)_both]'

/**
 * El recibo abierto (direccion-visual §2): el simulador real (RF-05) con forma de recibo.
 * Usa los mismos endpoints que /simular. Cumple CP0011: la TEA va junto a la cuota con el
 * mismo componente y peso, el desglose completo de costos (RN-24) y el aviso de que no
 * constituye aprobación (RN-25, RN-27) antes del botón para seguir.
 */
export function ReciboSimulador() {
  const productos = useQuery({ queryKey: ['productos'], queryFn: obtenerProductos, staleTime: 10 * 60_000 })
  const navegar = useNavigate()
  const [eleccion, setEleccion] = useState(() => leerSimulacion())

  const lista = productos.data ?? []
  const producto = lista.find((p) => p.codigo === eleccion?.producto) ?? lista[0]
  const valores = producto
    ? ajustar(producto, eleccion?.monto ?? Math.min(producto.monto_max, 5_000_000), eleccion?.plazo ?? Math.min(producto.plazo_max, 24))
    : null
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

  /** Igual que el simulador (RF-05 FA-02): se guardan los valores y se pide la sesión. */
  function solicitar() {
    if (!producto || !valores) return
    const guardada = { producto: producto.codigo, ...valores }
    guardarSimulacion(guardada)
    navegar(`/ingresar?volver=${encodeURIComponent(rutaSolicitar(guardada))}`)
  }

  function verDetalle() {
    if (producto && valores) guardarSimulacion({ producto: producto.codigo, ...valores })
  }

  const resultado = simulacion.data
  const actualizando = simulacion.isFetching && simulacion.isPlaceholderData

  return (
    <section
      aria-labelledby="recibo-titulo"
      className="relative animate-[recibo-sale_700ms_var(--ease-salida)_both] text-tinta [filter:drop-shadow(0_32px_48px_rgb(14_34_64/0.35))]"
    >
      <div className="rounded-t-[1.5rem] bg-superficie px-5 pt-6 pb-5 sm:px-7 sm:pt-7">
        <div className="flex flex-col gap-1">
          <h2 id="recibo-titulo" className="titular text-xl font-semibold text-noche">
            Tu crédito, renglón por renglón
          </h2>
          <p className="text-sm text-tinta-suave">Calculado al instante con las tasas vigentes.</p>
        </div>

        {productos.isError ? (
          <Alert tono="error" className="mt-5">
            {mensajeDe(productos.error)}
          </Alert>
        ) : producto && valores ? (
          <div className="mt-5 flex flex-col gap-5">
            <Field
              id="recibo-producto"
              etiqueta="Producto"
              ayuda={`Tasa desde ${formatoPorcentaje(producto.tasa_ea)} E.A. ${producto.descripcion}`}
            >
              <Select value={producto.codigo} onChange={(e) => cambiar({ producto: e.target.value })}>
                {lista.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Slider
              id="recibo-monto"
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
              id="recibo-plazo"
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
          <div className="mt-5 flex flex-col gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
      </div>

      {/* Línea de corte del recibo: decorativa. */}
      <div aria-hidden="true" className="relative h-6 bg-superficie">
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-noche" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-noche" />
        <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-linea" />
      </div>

      <div
        className="recibo-borde bg-superficie px-5 pt-4 pb-9 sm:px-7"
        aria-busy={actualizando}
      >
        {resultado ? (
          <div className={`flex flex-col gap-5 transition-opacity duration-150 ${actualizando ? 'opacity-60' : ''}`}>
            {/* En el recibo la cifra grande se acota a 32 px para que la cuota no se parta; la misma
                regla aplica a la cuota y a la TEA, así conservan el mismo peso (CP0011). */}
            <div aria-live="polite" className={`sm:[&_dd.cifras]:text-[2rem] ${ANIMA_RENGLON}`} style={renglon(0)}>
              <div key={`${resultado.cuota}-${resultado.tasa_ea}`} className="animate-[cifra-cambia_260ms_var(--ease-salida)_both]">
                <CuotaConTea cuota={resultado.cuota} tea={resultado.tasa_ea} />
              </div>
            </div>

            <dl className="cifras flex flex-col text-sm">
              {resultado.desglose.map((c, i) => (
                <div key={c.concepto} className={`flex items-baseline justify-between gap-4 py-1.5 ${ANIMA_RENGLON}`} style={renglon(i + 1)}>
                  <dt className="text-tinta-suave">{c.concepto}</dt>
                  <dd className="font-medium text-tinta">
                    <Dinero valor={c.valor} />
                  </dd>
                </div>
              ))}
              <div
                className={`mt-1 flex items-baseline justify-between gap-4 border-t border-dashed border-linea pt-2.5 pb-1.5 ${ANIMA_RENGLON}`}
                style={renglon(resultado.desglose.length + 1)}
              >
                <dt className="font-semibold text-tinta">Total a pagar</dt>
                <dd className="font-semibold text-tinta">
                  <Dinero valor={resultado.total_a_pagar} />
                </dd>
              </div>
              <div
                className={`-mx-2 mt-1 flex items-baseline justify-between gap-4 rounded-campo bg-cielo px-2 py-2 ${ANIMA_RENGLON}`}
                style={renglon(resultado.desglose.length + 2)}
              >
                <dt className="font-semibold text-noche">Te consignamos</dt>
                <dd className="font-semibold text-noche">
                  <Dinero valor={resultado.valor_a_recibir} />
                </dd>
              </div>
            </dl>

            <p className="text-xs leading-relaxed text-tinta-suave">
              No supera la tasa máxima legal de {formatoPorcentaje(resultado.tasa_maxima_legal_ea)} E.A.
            </p>

            {/* RN-25, RN-27, CP0011: el aviso va antes del botón para seguir. */}
            <AvisoNoAprobacion />

            <div className="flex flex-col gap-2">
              <Button tamano="lg" onClick={solicitar} className="w-full">
                Solicitar con estos valores
              </Button>
              <Link
                to="/simular"
                onClick={verDetalle}
                className="inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-primario-700 underline-offset-4 hover:underline"
              >
                Ver el plan de pagos completo
              </Link>
            </div>
          </div>
        ) : simulacion.isError ? (
          <Alert tono="error">{mensajeDe(simulacion.error)}</Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-13 rounded-full" />
          </div>
        )}
      </div>
    </section>
  )
}
