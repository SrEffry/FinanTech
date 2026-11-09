import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Producto } from '../../lib/api/tipos'
import { calcularCredito } from '../../mocks/calculos'
import SimuladorPagina from './SimuladorPagina'

const PRODUCTOS: Producto[] = [
  { codigo: 'libre', nombre: 'Libre inversión', descripcion: 'Para lo que necesites.', tasa_ea: 18.9, monto_min: 1_000_000, monto_max: 50_000_000, plazo_min: 12, plazo_max: 60, paso_monto: 100_000 },
  { codigo: 'libranza', nombre: 'Libranza', descripcion: 'Descuento por nómina.', tasa_ea: 14.9, monto_min: 1_000_000, monto_max: 80_000_000, plazo_min: 12, plazo_max: 84, paso_monto: 100_000 },
]

const servidor = setupServer(
  http.get('/api/v1/identidad/sesion', () => HttpResponse.json({ usuario: null })),
  http.get('/api/v1/cliente/productos', () => HttpResponse.json(PRODUCTOS)),
  http.post('/api/v1/cliente/simulaciones', async ({ request }) => {
    const { producto, monto, plazo_meses } = (await request.json()) as { producto: string; monto: number; plazo_meses: number }
    const p = PRODUCTOS.find((x) => x.codigo === producto) ?? PRODUCTOS[0]
    const calculo = calcularCredito(p.tasa_ea, monto, plazo_meses, 25.8)
    return HttpResponse.json({ id: 'sim', producto: { codigo: p.codigo, nombre: p.nombre }, monto, plazo_meses, valor_a_recibir: monto, tasa_maxima_legal_ea: 25.8, ...calculo })
  }),
)

// jsdom no tiene IntersectionObserver: este doble deja decir si el recibo está a la vista.
let avisar: ((visible: boolean) => void) | null = null
class ObservadorDoble {
  constructor(alCambiar: (entradas: { isIntersecting: boolean }[]) => void) {
    avisar = (visible) => alCambiar([{ isIntersecting: visible }])
  }
  observe() {}
  disconnect() {}
}

beforeAll(() => {
  servidor.listen({ onUnhandledRequest: 'error' })
  vi.stubGlobal('IntersectionObserver', ObservadorDoble)
})
afterEach(() => {
  servidor.resetHandlers()
  localStorage.clear()
})
afterAll(() => {
  servidor.close()
  vi.unstubAllGlobals()
})

function montar() {
  const router = createMemoryRouter([{ path: '/simular', element: <SimuladorPagina /> }], { initialEntries: ['/simular'] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('simulador en el celular (UX-07, RF-05)', () => {
  it('los productos son radios compactos y se elige con un toque', async () => {
    const usuario = userEvent.setup()
    montar()
    const libranza = await screen.findByRole('radio', { name: 'Libranza' })
    expect(screen.getByRole('radio', { name: 'Libre inversión' })).toBeChecked()
    await usuario.click(libranza)
    expect(libranza).toBeChecked()
    expect(screen.getByText(/Libranza, desde 14,90 % E.A./)).toBeInTheDocument()
    // La primera prueba del archivo paga la carga del simulador; con el equipo ocupado pasa de 5 s.
  }, 15_000)

  it('cuando el recibo sale de la vista, la barra fija muestra cuota y TEA juntas y con el mismo peso (RNF-20)', async () => {
    montar()
    await screen.findByText('Esta simulación no es una aprobación')
    const cuota = calcularCredito(18.9, 5_000_000, 24, 25.8).cuota.toLocaleString('es-CO')
    act(() => avisar?.(false))

    const barra = document.querySelector('[aria-hidden="true"].fixed') as HTMLElement
    expect(barra).toHaveClass('opacity-100')
    const [valorCuota, valorTea] = [...barra.querySelectorAll('.cifras')] as HTMLElement[]
    expect(valorCuota).toHaveTextContent(cuota)
    expect(valorTea).toHaveTextContent('18,90 %')
    expect(valorCuota.className).toBe(valorTea.className)

    act(() => avisar?.(true))
    expect(barra).toHaveClass('opacity-0')
  })
})
