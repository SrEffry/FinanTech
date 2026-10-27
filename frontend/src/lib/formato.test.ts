import { describe, expect, it } from 'vitest'
import { enmascarar, enmascararCorreo, formatoMoneda, formatoPorcentaje, monedaParaLector } from './formato'

describe('enmascarar (RNF-06: solo los últimos 4 dígitos)', () => {
  it('deja visibles solo los últimos 4 caracteres', () => {
    expect(enmascarar('1020456782')).toBe('•••• 6782')
    expect(enmascarar('3104567821')).toBe('•••• 7821')
  })

  it('no revela nada si el dato tiene 4 caracteres o menos', () => {
    expect(enmascarar('1234')).toBe('••••')
    expect(enmascarar('12')).toBe('••••')
  })

  it('no vuelve a enmascarar un dato que ya viene enmascarado', () => {
    expect(enmascarar('•••• 6782')).toBe('•••• 6782')
  })

  it('devuelve vacío sin dato', () => {
    expect(enmascarar(null)).toBe('')
    expect(enmascarar(undefined)).toBe('')
  })

  it('recorta el usuario del correo', () => {
    expect(enmascararCorreo('laura.mejia@demo.finantech.co')).toBe('l•••@demo.finantech.co')
  })
})

describe('formato de cifras', () => {
  it('formatea pesos sin decimales y con su unidad para lectores de pantalla', () => {
    expect(formatoMoneda(1250000.4).replace(/\s/g, ' ')).toBe('$ 1.250.000')
    expect(monedaParaLector(1250000)).toBe('1.250.000 pesos')
  })

  it('formatea porcentajes con coma decimal', () => {
    expect(formatoPorcentaje(18.9)).toBe('18,90 %')
  })
})
