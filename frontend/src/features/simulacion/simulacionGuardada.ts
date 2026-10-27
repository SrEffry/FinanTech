/**
 * RF-05 FA-02: el visitante que simula y decide continuar debe registrarse o iniciar
 * sesión sin perder los valores. Se guardan solo producto, monto y plazo (nada personal)
 * y solo durante la pestaña.
 */
const CLAVE = 'finantech-simulacion-v1'

export interface SimulacionGuardada {
  producto: string
  monto: number
  plazo: number
}

export function guardarSimulacion(simulacion: SimulacionGuardada): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(simulacion))
  } catch {
    // Sin almacenamiento el cliente vuelve a elegir los valores.
  }
}

export function leerSimulacion(): SimulacionGuardada | null {
  try {
    const texto = sessionStorage.getItem(CLAVE)
    if (!texto) return null
    const datos = JSON.parse(texto) as Partial<SimulacionGuardada>
    if (typeof datos.producto !== 'string' || typeof datos.monto !== 'number' || typeof datos.plazo !== 'number') return null
    return { producto: datos.producto, monto: datos.monto, plazo: datos.plazo }
  } catch {
    return null
  }
}

export function olvidarSimulacion(): void {
  try {
    sessionStorage.removeItem(CLAVE)
  } catch {
    // Nada que limpiar.
  }
}

export function rutaSolicitar({ producto, monto, plazo }: SimulacionGuardada): string {
  return `/portal/solicitar?producto=${encodeURIComponent(producto)}&monto=${monto}&plazo=${plazo}`
}
