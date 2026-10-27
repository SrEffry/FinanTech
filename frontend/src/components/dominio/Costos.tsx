import { useState } from 'react'
import { Download } from 'lucide-react'
import type { ConceptoCosto, CuotaPlan } from '../../lib/api/tipos'
import { guardarArchivo } from '../../lib/api/cliente'
import { formatoFechaCorta, formatoMoneda } from '../../lib/formato'
import { Button } from '../ui/Button'
import { Dinero } from './Marca'

interface PropsDesglose {
  monto: number
  desglose: ConceptoCosto[]
  costoTotal: number
  totalAPagar: number
}

/**
 * Desglose completo de costos (RN-24) con la composición de lo que se paga: lo que te
 * prestan frente a lo que cuesta el crédito. La lista es la vista en texto de la barra.
 */
export function DesgloseCostos({ monto, desglose, costoTotal, totalAPagar }: PropsDesglose) {
  const proporcionCapital = totalAPagar > 0 ? (monto / totalAPagar) * 100 : 0
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex h-3 w-full gap-0.5" role="img" aria-label={`De ${formatoMoneda(totalAPagar)} en total, ${formatoMoneda(monto)} son el préstamo y ${formatoMoneda(costoTotal)} son el costo del crédito.`}>
          <span className="h-full rounded-l-sm bg-dato-capital" style={{ width: `${proporcionCapital}%` }} title={`Préstamo: ${formatoMoneda(monto)}`} />
          <span className="h-full flex-1 rounded-r-sm bg-dato-costo" title={`Costo del crédito: ${formatoMoneda(costoTotal)}`} />
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-tinta-suave" aria-hidden="true">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-dato-capital" />
            Préstamo <span className="font-semibold text-tinta">{formatoMoneda(monto)}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-dato-costo" />
            Costo del crédito <span className="font-semibold text-tinta">{formatoMoneda(costoTotal)}</span>
          </li>
        </ul>
      </div>

      <dl className="divide-y divide-linea-suave">
        {desglose.map((c) => (
          <div key={c.concepto} className="flex items-start justify-between gap-4 py-3">
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium text-tinta">{c.concepto}</dt>
              <dd className="text-sm text-tinta-tenue">{c.descripcion}</dd>
            </div>
            <dd className="cifras shrink-0 font-semibold text-tinta">
              <Dinero valor={c.valor} />
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="font-semibold text-tinta">Costo total del crédito</dt>
          <dd className="cifras font-semibold text-tinta">
            <Dinero valor={costoTotal} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-tinta-suave">Total a pagar (préstamo más costos)</dt>
          <dd className="cifras font-semibold text-tinta">
            <Dinero valor={totalAPagar} />
          </dd>
        </div>
      </dl>
    </div>
  )
}

function planCsv(plan: CuotaPlan[]): Blob {
  const filas = [
    ['Cuota', 'Fecha', 'Valor cuota', 'Capital', 'Intereses', 'Seguro', 'Saldo'],
    ...plan.map((c) => [c.numero, c.fecha.slice(0, 10), c.cuota, c.capital, c.interes, c.seguro, c.saldo]),
  ]
  // BOM para que Excel abra el CSV con tildes correctas.
  return new Blob([String.fromCharCode(0xfeff), `${filas.map((f) => f.join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' })
}

/** Plan de pagos completo, descargable (RF-05, criterio de aceptación). */
export function PlanPagos({ plan, nombreArchivo = 'plan-de-pagos.csv' }: { plan: CuotaPlan[]; nombreArchivo?: string }) {
  const [completo, setCompleto] = useState(false)
  const visibles = completo ? plan : plan.slice(0, 6)
  return (
    <div className="flex flex-col gap-3">
      <div role="region" aria-label="Plan de pagos" tabIndex={0} className="overflow-x-auto rounded-campo border border-linea">
        <table className="cifras w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">Plan de pagos con {plan.length} cuotas</caption>
          <thead>
            <tr className="border-b border-linea bg-fondo text-right text-tinta-suave">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Cuota</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th scope="col" className="px-3 py-2 font-semibold">Valor</th>
              <th scope="col" className="px-3 py-2 font-semibold">Capital</th>
              <th scope="col" className="px-3 py-2 font-semibold">Intereses</th>
              <th scope="col" className="px-3 py-2 font-semibold">Seguro</th>
              <th scope="col" className="px-3 py-2 font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.numero} className="border-b border-linea-suave text-right last:border-b-0">
                <td className="px-3 py-2 text-left">{c.numero}</td>
                <td className="px-3 py-2 text-left whitespace-nowrap text-tinta-suave">{formatoFechaCorta(c.fecha)}</td>
                <td className="px-3 py-2 font-medium">{formatoMoneda(c.cuota)}</td>
                <td className="px-3 py-2">{formatoMoneda(c.capital)}</td>
                <td className="px-3 py-2">{formatoMoneda(c.interes)}</td>
                <td className="px-3 py-2">{formatoMoneda(c.seguro)}</td>
                <td className="px-3 py-2 text-tinta-suave">{formatoMoneda(c.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {plan.length > 6 ? (
          <Button variante="fantasma" tamano="sm" onClick={() => setCompleto((v) => !v)} aria-expanded={completo}>
            {completo ? 'Ver menos cuotas' : `Ver las ${plan.length} cuotas`}
          </Button>
        ) : null}
        <Button
          variante="fantasma"
          tamano="sm"
          icono={<Download aria-hidden="true" className="size-4" />}
          onClick={() => guardarArchivo(planCsv(plan), nombreArchivo)}
        >
          Descargar plan (CSV)
        </Button>
      </div>
    </div>
  )
}
