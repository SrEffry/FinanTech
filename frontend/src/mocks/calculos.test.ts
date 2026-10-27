import { describe, expect, it } from 'vitest'
import { calcularCredito, cuotaFija, tasaMensual } from './calculos'

describe('cálculo del crédito simulado (RF-05)', () => {
  it('convierte la TEA a tasa mensual equivalente', () => {
    expect(tasaMensual(12.682503)).toBeCloseTo(0.01, 6)
  })

  it('calcula la cuota fija del sistema francés', () => {
    expect(cuotaFija(1_000_000, 0.01, 12)).toBeCloseTo(88_848.79, 1)
  })

  it.each([
    [18.9, 12_000_000, 36],
    [21.4, 3_500_000, 18],
    [14.9, 80_000_000, 72],
    [22.6, 1_000_000, 6],
  ])('TEA %s, monto %s, %s meses: el desglose suma el costo total (CP0011)', (tea, monto, plazo) => {
    const r = calcularCredito(tea, monto, plazo, 25.8)
    expect(r.desglose.reduce((s, c) => s + c.valor, 0)).toBe(r.costo_total)
    expect(r.total_a_pagar).toBe(monto + r.costo_total)
    expect(r.desglose.map((c) => c.concepto)).toEqual(['Intereses', 'Seguro de vida deudor', 'Estudio de crédito'])
  })

  it('el plan paga exactamente el capital y termina en saldo cero', () => {
    const r = calcularCredito(18.9, 12_000_000, 36, 25.8)
    expect(r.plan).toHaveLength(36)
    expect(r.plan.reduce((s, c) => s + c.capital, 0)).toBe(12_000_000)
    expect(r.plan[r.plan.length - 1].saldo).toBe(0)
    expect(r.plan.reduce((s, c) => s + c.interes, 0)).toBe(r.desglose[0].valor)
  })

  it('la TEA nunca supera la tasa máxima legal (RN-23)', () => {
    const r = calcularCredito(31, 5_000_000, 24, 25.8)
    expect(r.tasa_ea).toBe(25.8)
  })
})
