import { createContext, use } from 'react'

export type TipoToast = 'exito' | 'error'

interface ContextoToast {
  avisar: (mensaje: string, tipo?: TipoToast) => void
}

export const Contexto = createContext<ContextoToast>({ avisar: () => {} })

/** Confirmaciones breves (RI-04). El proveedor está en Toast.tsx. */
export function useToast() {
  return use(Contexto)
}
