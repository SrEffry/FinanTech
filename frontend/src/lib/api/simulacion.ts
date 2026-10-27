import { solicitar } from './cliente'
import type { Producto, Simulacion } from './tipos'

export function obtenerProductos() {
  return solicitar<Producto[]>('/cliente/productos')
}

export function simular(producto: string, monto: number, plazoMeses: number, senal?: AbortSignal) {
  return solicitar<Simulacion>('/cliente/simulaciones', {
    metodo: 'POST',
    cuerpo: { producto, monto, plazo_meses: plazoMeses },
    senal,
  })
}
