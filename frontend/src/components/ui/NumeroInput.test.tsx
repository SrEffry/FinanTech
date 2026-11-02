import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Field } from './Field'
import { EnteroInput, PercentInput } from './NumeroInput'
import { escribirDecimal, leerDecimal } from '../../lib/numeros'

function Tasa({ inicial = 24 as number | null }) {
  const [valor, setValor] = useState<number | null>(inicial)
  return (
    <>
      <Field id="tasa" etiqueta="TEA">
        <PercentInput valor={valor} onCambiar={setValor} />
      </Field>
      <output data-testid="valor">{String(valor)}</output>
    </>
  )
}

describe('PercentInput (UX-08)', () => {
  it('deja escribir decimales con coma sin perder el separador', async () => {
    render(<Tasa />)
    const campo = screen.getByLabelText('TEA')
    await userEvent.clear(campo)
    await userEvent.type(campo, '25,')
    expect(campo).toHaveValue('25,')
    await userEvent.type(campo, '62')
    expect(screen.getByTestId('valor')).toHaveTextContent('25.62')
  })

  it('acepta punto, se puede vaciar y al salir escribe con coma', async () => {
    render(<Tasa />)
    const campo = screen.getByLabelText('TEA')
    await userEvent.clear(campo)
    expect(screen.getByTestId('valor')).toHaveTextContent('null')
    await userEvent.type(campo, '18.9')
    await userEvent.tab()
    expect(campo).toHaveValue('18,90')
    expect(screen.getByTestId('valor')).toHaveTextContent('18.9')
  })

  it('ignora letras y limita los decimales', async () => {
    render(<Tasa inicial={null} />)
    const campo = screen.getByLabelText('TEA')
    await userEvent.type(campo, '2a4,567')
    expect(campo).toHaveValue('24,56')
  })
})

describe('EnteroInput (UX-08)', () => {
  it('se puede borrar del todo mientras se escribe el plazo', async () => {
    function Plazo() {
      const [valor, setValor] = useState<number | null>(36)
      return (
        <Field id="plazo" etiqueta="Plazo">
          <EnteroInput valor={valor} onCambiar={setValor} />
        </Field>
      )
    }
    render(<Plazo />)
    const campo = screen.getByLabelText('Plazo')
    await userEvent.clear(campo)
    expect(campo).toHaveValue('')
    await userEvent.type(campo, '48')
    expect(campo).toHaveValue('48')
  })
})

describe('lectura de decimales', () => {
  it('lee coma o punto y escribe con coma', () => {
    expect(leerDecimal('25,62')).toBe(25.62)
    expect(leerDecimal('25.62')).toBe(25.62)
    expect(leerDecimal(',')).toBeNull()
    expect(leerDecimal('')).toBeNull()
    expect(escribirDecimal(25.6, 2)).toBe('25,60')
    expect(escribirDecimal(null, 2)).toBe('')
  })
})
