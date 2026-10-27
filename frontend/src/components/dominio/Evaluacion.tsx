import type { ReactNode } from 'react'
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import type { Evaluacion, VariableEvaluacion } from '../../lib/api/tipos'
import { formatoNumero } from '../../lib/formato'
import { Badge } from '../ui/Feedback'

const RIESGO = {
  bajo: { etiqueta: 'Riesgo bajo', tono: 'exito' as const, icono: <ShieldCheck aria-hidden="true" className="size-3.5" /> },
  medio: { etiqueta: 'Riesgo medio', tono: 'accion' as const, icono: <ShieldQuestion aria-hidden="true" className="size-3.5" /> },
  alto: { etiqueta: 'Riesgo alto', tono: 'negado' as const, icono: <ShieldAlert aria-hidden="true" className="size-3.5" /> },
}

const SUGERENCIA = { aprobar: 'Aprobar', escalar: 'Estudio y decisión humana', negar: 'Negar' }

/**
 * Puntaje como medidor sobre su escala, con los umbrales de decisión marcados (8.3.3).
 * El riesgo va con ícono y etiqueta: el color nunca dice nada solo.
 */
export function MedidorPuntaje({ evaluacion }: { evaluacion: Evaluacion }) {
  const { puntaje, escala_min: min, escala_max: max, umbrales } = evaluacion
  const posicion = (valor: number) => `${((valor - min) / (max - min)) * 100}%`
  const riesgo = RIESGO[evaluacion.nivel_riesgo]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="text-cifra-xl font-semibold tracking-tight text-tinta">{formatoNumero(puntaje)}</span>
          <span className="text-sm text-tinta-suave">de {formatoNumero(max)}</span>
        </p>
        <Badge tono={riesgo.tono} icono={riesgo.icono}>
          {riesgo.etiqueta}
        </Badge>
      </div>

      <div
        role="meter"
        aria-label="Puntaje de la evaluación"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={puntaje}
        aria-valuetext={`${puntaje} de ${max}. Se aprueba desde ${umbrales.aprobar} y se niega por debajo de ${umbrales.negar}.`}
        className="relative pt-1 pb-7"
      >
        <div className="h-2.5 w-full rounded-full bg-primario-100">
          <div className="h-full rounded-full bg-primario-600" style={{ width: posicion(puntaje) }} />
        </div>
        {/* La etiqueta de negar crece hacia la izquierda y la de aprobar hacia la derecha: no se pisan. */}
        <span aria-hidden="true" className="absolute top-0 flex -translate-x-full flex-col items-end" style={{ left: `calc(${posicion(umbrales.negar)} + 1px)` }}>
          <span className="h-4.5 w-0.5 bg-tinta" />
          <span className="mt-1 pr-1 text-xs whitespace-nowrap text-tinta-suave">Niega bajo {umbrales.negar}</span>
        </span>
        <span aria-hidden="true" className="absolute top-0 flex flex-col items-start" style={{ left: `calc(${posicion(umbrales.aprobar)} - 1px)` }}>
          <span className="h-4.5 w-0.5 bg-tinta" />
          <span className="mt-1 pl-1 text-xs whitespace-nowrap text-tinta-suave">Aprueba desde {umbrales.aprobar}</span>
        </span>
      </div>

      <p className="text-sm text-tinta-suave">
        Decisión sugerida: <span className="font-semibold text-tinta">{SUGERENCIA[evaluacion.decision_sugerida]}</span>
      </p>
    </div>
  )
}

/**
 * Variables ordenadas por contribución (8.3.3): barra divergente en una tabla, que a la
 * vez es su vista en texto. Azul suma, naranja resta; el número va siempre al lado.
 */
export function ContribucionVariables({ variables }: { variables: VariableEvaluacion[] }) {
  const mayor = Math.max(1, ...variables.map((v) => Math.abs(v.contribucion)))
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex gap-5 text-sm text-tinta-suave" aria-label="Convenciones">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-dato-favorable" />
          Suma al puntaje
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-dato-desfavorable" />
          Resta al puntaje
        </li>
      </ul>
      <div role="region" aria-label="Variables de la evaluación" tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">Variables determinantes ordenadas por su efecto en el puntaje</caption>
          <thead>
            <tr className="border-b border-linea text-tinta-suave">
              <th scope="col" className="py-2 pr-3 text-left font-semibold">Variable</th>
              <th scope="col" className="py-2 pr-3 text-left font-semibold">Valor</th>
              <th scope="col" className="w-2/5 py-2 text-center font-semibold">Efecto</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => {
              const ancho = (Math.abs(v.contribucion) / mayor) * 50
              const positiva = v.contribucion >= 0
              return (
                <tr key={v.codigo} className="border-b border-linea-suave last:border-b-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-tinta">{v.nombre}</th>
                  <td className="py-2.5 pr-3 text-tinta-suave">{v.valor}</td>
                  <td className="py-2.5" aria-hidden="true">
                    <div className="relative h-3">
                      <span className="absolute top-[-4px] bottom-[-4px] left-1/2 w-px bg-linea" />
                      {v.contribucion !== 0 ? (
                        <span
                          className={`absolute top-0 h-3 ${positiva ? 'rounded-r-[4px] bg-dato-favorable' : 'rounded-l-[4px] bg-dato-desfavorable'}`}
                          style={positiva ? { left: '50%', width: `${ancho}%` } : { right: '50%', width: `${ancho}%` }}
                          title={`${v.nombre}: ${positiva ? '+' : ''}${v.contribucion} puntos`}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="cifras py-2.5 pl-3 text-right font-semibold text-tinta">
                    {v.contribucion > 0 ? '+' : v.contribucion < 0 ? '−' : ''}
                    {Math.abs(v.contribucion)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Indicador de la bandeja: etiqueta, valor y una nota opcional (KPI row). */
export function Indicador({ etiqueta, valor, nota }: { etiqueta: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-panel border border-linea bg-superficie px-4 py-3">
      <dt className="text-sm text-tinta-suave">{etiqueta}</dt>
      <dd className="text-2xl font-semibold text-tinta">{valor}</dd>
      {nota ? <dd className="text-xs text-tinta-tenue">{nota}</dd> : null}
    </div>
  )
}
