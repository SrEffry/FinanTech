import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CuotaConTea } from './dominio/CuotaConTea'
import { validarArchivo } from './ui/FileDrop'

describe('CuotaConTea (RNF-20)', () => {
  it('muestra la cuota y la TEA juntas, con el mismo peso visual', () => {
    render(<CuotaConTea cuota={441_300} tea={18.9} />)
    const cuota = screen.getByText('Cuota mensual').nextElementSibling as HTMLElement
    const tea = screen.getByText(/efectiva anual/).nextElementSibling as HTMLElement
    expect(cuota).toHaveTextContent('441.300')
    expect(tea).toHaveTextContent('18,90 %')
    // Mismo tamaño, grosor y color: las mismas clases.
    expect(cuota.className).toBe(tea.className)
  })

  it('lee las cifras con su unidad', () => {
    render(<CuotaConTea cuota={441_300} tea={18.9} />)
    expect(screen.getByText('441.300 pesos')).toBeInTheDocument()
    expect(screen.getByText('18,90 por ciento')).toBeInTheDocument()
  })
})

describe('validarArchivo (RN-30)', () => {
  const archivo = (tipo: string, bytes: number) => new File([new Uint8Array(bytes)], 'documento', { type: tipo })

  it('acepta JPG, PNG y PDF de hasta 10 MB', () => {
    expect(validarArchivo(archivo('image/jpeg', 2048))).toBeNull()
    expect(validarArchivo(archivo('image/png', 2048))).toBeNull()
    expect(validarArchivo(archivo('application/pdf', 10 * 1024 * 1024))).toBeNull()
  })

  it('rechaza otros formatos y archivos de más de 10 MB', () => {
    expect(validarArchivo(archivo('image/gif', 2048))).toMatch(/JPG, PNG o PDF/)
    expect(validarArchivo(archivo('application/msword', 2048))).toMatch(/JPG, PNG o PDF/)
    expect(validarArchivo(archivo('application/pdf', 10 * 1024 * 1024 + 1))).toMatch(/10 MB/)
  })
})
