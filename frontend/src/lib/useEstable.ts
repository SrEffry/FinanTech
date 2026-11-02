import { useEffect, useState } from 'react'

/** Espera a que el valor deje de cambiar (al arrastrar un deslizador o escribir) antes de usarlo. */
export function useEstable<T>(valor: T, ms = 220): T {
  const [estable, setEstable] = useState(valor)
  useEffect(() => {
    const espera = window.setTimeout(() => setEstable(valor), ms)
    return () => window.clearTimeout(espera)
  }, [valor, ms])
  return estable
}
