import { useEffect, useState } from 'react'
import { segundosHasta } from './formato'

/** Segundos que faltan hasta `iso`, actualizados cada segundo. */
export function useCuentaRegresiva(iso: string | null | undefined): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [iso])
  return iso ? segundosHasta(iso, ahora) : 0
}
