import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CuotaConTea } from './dominio/CuotaConTea'
import { TIPOS_FOTO, validarArchivo } from '../lib/archivos'
import { PlanPagos } from './dominio/Costos'
import { Checkbox } from './ui/Choice'

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

  it('las dos cifras pueden encogerse sin desbordar en celulares de 320 px', () => {
    render(<CuotaConTea cuota={12_345_678} tea={24.5} />)
    const cuota = screen.getByText('Cuota mensual').parentElement as HTMLElement
    const tea = screen.getByText(/efectiva anual/).parentElement as HTMLElement
    expect(cuota).toHaveClass('min-w-0')
    expect(tea).toHaveClass('min-w-0')
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

  it('la foto del rostro solo acepta imágenes (UX-28)', () => {
    expect(validarArchivo(archivo('image/png', 2048), TIPOS_FOTO)).toBeNull()
    expect(validarArchivo(archivo('application/pdf', 2048), TIPOS_FOTO)).toMatch(/JPG o PNG/)
  })
})

describe('PlanPagos (RNF-20)', () => {
  const plan = Array.from({ length: 12 }, (_, i) => ({
    numero: i + 1,
    fecha: `2027-${String(i + 1).padStart(2, '0')}-15T12:00:00`,
    cuota: 441_300,
    capital: 400_000,
    interes: 36_300,
    seguro: 5_000,
    saldo: 4_800_000 - i * 400_000,
  }))

  it('muestra 6 cuotas en pantalla pero imprime el plan completo (UX-11)', () => {
    render(<PlanPagos plan={plan} />)
    const filas = screen.getAllByRole('row', { hidden: true }).slice(1)
    expect(filas).toHaveLength(12)
    const soloImpresion = filas.filter((f) => f.classList.contains('print:table-row'))
    expect(soloImpresion).toHaveLength(6)
    soloImpresion.forEach((f) => expect(f).toHaveClass('hidden'))
  })
})

describe('Checkbox (RNF-19)', () => {
  it('asocia el error a la casilla para que el lector de pantalla lo lea', () => {
    render(<Checkbox id="acepta" etiqueta="Acepto" descripcion="Detalle" error="Debes aceptar." />)
    const casilla = screen.getByRole('checkbox', { name: 'Acepto' })
    expect(casilla).toHaveAttribute('aria-invalid', 'true')
    expect(casilla).toHaveAccessibleDescription('Detalle Debes aceptar.')
  })

  it('sin error no marca la casilla como inválida', () => {
    render(<Checkbox id="acepta" etiqueta="Acepto" />)
    expect(screen.getByRole('checkbox', { name: 'Acepto' })).not.toHaveAttribute('aria-invalid')
  })
})
