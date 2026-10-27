import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export interface Columna<T> {
  clave: string
  titulo: string
  celda: (fila: T) => ReactNode
  /** Si existe, la columna se puede ordenar con este valor. */
  ordenar?: (fila: T) => string | number
  alinear?: 'izquierda' | 'derecha'
  className?: string
}

interface Props<T> {
  etiqueta: string
  columnas: Columna<T>[]
  filas: T[]
  clave: (fila: T) => string | number
  vacio?: ReactNode
  ordenInicial?: { clave: string; direccion: 'asc' | 'desc' }
}

/**
 * Tabla de la consola interna. Tiene su propio scroll horizontal (RI-01) y el contenedor
 * recibe foco para poder desplazarlo con teclado.
 */
export function DataTable<T>({ etiqueta, columnas, filas, clave, vacio, ordenInicial }: Props<T>) {
  const [orden, setOrden] = useState(ordenInicial ?? null)
  const columnaOrden = columnas.find((c) => c.clave === orden?.clave)
  const ordenadas =
    columnaOrden?.ordenar && orden
      ? [...filas].sort((a, b) => {
          const va = columnaOrden.ordenar!(a)
          const vb = columnaOrden.ordenar!(b)
          const comparacion = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')
          return orden.direccion === 'asc' ? comparacion : -comparacion
        })
      : filas

  function alternar(claveColumna: string) {
    setOrden((actual) =>
      actual?.clave === claveColumna
        ? { clave: claveColumna, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' }
        : { clave: claveColumna, direccion: 'asc' },
    )
  }

  return (
    <div
      role="region"
      aria-label={etiqueta}
      tabIndex={0}
      className="overflow-x-auto rounded-panel border border-linea bg-superficie"
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{etiqueta}</caption>
        <thead>
          <tr className="border-b border-linea bg-fondo">
            {columnas.map((c) => {
              const activa = orden?.clave === c.clave
              const alineacion = c.alinear === 'derecha' ? 'text-right' : 'text-left'
              return (
                <th
                  key={c.clave}
                  scope="col"
                  aria-sort={activa ? (orden?.direccion === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`px-4 py-3 font-semibold text-tinta-suave ${alineacion}`}
                >
                  {c.ordenar ? (
                    <button
                      type="button"
                      onClick={() => alternar(c.clave)}
                      className={`inline-flex items-center gap-1 rounded-sm hover:text-tinta ${c.alinear === 'derecha' ? 'flex-row-reverse' : ''}`}
                    >
                      {c.titulo}
                      {activa ? (
                        orden?.direccion === 'asc' ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-tinta-suave">
                {vacio ?? 'No hay registros.'}
              </td>
            </tr>
          ) : (
            ordenadas.map((fila) => (
              <tr key={clave(fila)} className="border-b border-linea-suave last:border-b-0 hover:bg-fondo/60">
                {columnas.map((c) => (
                  <td key={c.clave} className={`px-4 py-3 align-middle ${c.alinear === 'derecha' ? 'text-right' : ''} ${c.className ?? ''}`}>
                    {c.celda(fila)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
