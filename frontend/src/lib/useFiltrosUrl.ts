import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

type Valor = string | number | undefined

/**
 * Filtros guardados en la URL: sobreviven a recargar la página y se pueden compartir con
 * un compañero (deep link). Los vacíos no se escriben.
 */
export function useFiltrosUrl() {
  const [parametros, setParametros] = useSearchParams()

  const texto = useCallback((clave: string) => parametros.get(clave) || undefined, [parametros])
  const numero = useCallback(
    (clave: string) => {
      const valor = Number(parametros.get(clave))
      return parametros.has(clave) && Number.isFinite(valor) ? valor : undefined
    },
    [parametros],
  )

  const cambiar = useCallback(
    (cambios: Record<string, Valor>) => {
      setParametros(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === undefined || valor === '') nuevos.delete(clave)
            else nuevos.set(clave, String(valor))
          }
          return nuevos
        },
        { replace: true },
      )
    },
    [setParametros],
  )

  const limpiar = useCallback(() => setParametros(new URLSearchParams(), { replace: true }), [setParametros])

  return { texto, numero, cambiar, limpiar, hayFiltros: [...parametros.keys()].some((k) => k !== 'pagina') }
}
