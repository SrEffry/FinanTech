import { Check } from 'lucide-react'

/**
 * Indicador de progreso de un asistente (8.1.2, 8.2.3). Es una secuencia real, por eso
 * numerada. Con más de 4 pasos los nombres no caben en una línea: se muestra solo el actual.
 */
export function Stepper({ pasos, actual, etiqueta }: { pasos: string[]; actual: number; etiqueta: string }) {
  const nombresEnLinea = pasos.length <= 4
  return (
    <nav aria-label={etiqueta}>
      <p className={`mb-2 text-sm text-tinta-suave ${nombresEnLinea ? 'sm:hidden' : ''}`}>
        Paso {actual + 1} de {pasos.length}: <span className="font-semibold text-tinta">{pasos[actual]}</span>
      </p>
      <ol className="flex items-center gap-2">
        {pasos.map((paso, i) => {
          const completado = i < actual
          const esActual = i === actual
          return (
            <li key={paso} aria-current={esActual ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  completado
                    ? 'bg-primario-600 text-white'
                    : esActual
                      ? 'border-2 border-primario-600 bg-cielo text-primario-700 ring-4 ring-primario-100'
                      : 'border-[1.5px] border-linea-control bg-superficie text-tinta-suave'
                }`}
              >
                {completado ? <Check aria-hidden="true" className="size-4" /> : i + 1}
                <span className="sr-only">
                  {` ${paso}`}
                  {completado ? ' (completado)' : ''}
                </span>
              </span>
              {nombresEnLinea ? (
                <span aria-hidden="true" className={`hidden truncate text-sm sm:block ${esActual ? 'font-semibold text-tinta' : 'text-tinta-suave'}`}>
                  {paso}
                </span>
              ) : null}
              {i < pasos.length - 1 ? (
                <span aria-hidden="true" className={`h-0.5 flex-1 rounded-full ${completado ? 'bg-primario-600' : 'bg-linea'}`} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
