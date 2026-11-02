import { describe, expect, it } from 'vitest'
import { calcularCredito } from '../mocks/calculos'
import { estimarCuota, porcentajeDelDisponible } from './cuota'

describe('estimación de la cuota en la aprobación condicionada (UX-09)', () => {
  it('coincide con el cálculo de referencia al cambiar monto, plazo y tasa', () => {
    const original = calcularCredito(18.9, 8_000_000, 36, 25.62)
    const ajustado = calcularCredito(21.5, 6_000_000, 24, 25.62)
    const estimada = estimarCuota(
      { monto: 6_000_000, plazo_meses: 24, tasa_ea: 21.5 },
      { monto: 8_000_000, plazo_meses: 36, tasa_ea: 18.9, cuota: original.cuota },
    )
    // El seguro se deduce de la cuota original: la diferencia es solo de redondeo.
    expect(Math.abs(estimada - ajustado.cuota)).toBeLessThanOrEqual(2)
  })

  it('sin cambios devuelve la misma cuota', () => {
    const original = calcularCredito(18.9, 5_000_000, 24, 25.62)
    const condiciones = { monto: 5_000_000, plazo_meses: 24, tasa_ea: 18.9 }
    expect(estimarCuota(condiciones, { ...condiciones, cuota: original.cuota })).toBe(original.cuota)
  })

  it('calcula la cuota frente al disponible (RN-41) y no divide por cero', () => {
    expect(porcentajeDelDisponible(400_000, 1_000_000)).toBe(40)
    expect(porcentajeDelDisponible(441_246, 950_000)).toBe(46.4)
    expect(porcentajeDelDisponible(400_000, 0)).toBeNull()
  })
})
