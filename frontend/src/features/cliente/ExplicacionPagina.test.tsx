import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ExplicacionDecision } from '../../lib/api/tipos'
import { ToastProvider } from '../../components/ui/Toast'
import ExplicacionPagina from './ExplicacionPagina'

// Datos sintéticos.
function explicacion(cambios: Partial<ExplicacionDecision> = {}): ExplicacionDecision {
  return {
    resultado: 'negada',
    automatizada: true,
    motivo_principal: 'Tus obligaciones actuales no dejan espacio para esta cuota.',
    variables: [{ nombre: 'Capacidad de pago', efecto: 'desfavorable', explicacion: 'La cuota pesa mucho frente a tu ingreso.' }],
    decidida_en: '2026-11-01T10:00:00Z',
    condicion: null,
    reconsideracion: null,
    puede_reconsiderar: false,
    reconsideracion_vence_en: null,
    radicado: 'FT-2026-000123',
    producto: 'Libre inversión',
    simulado: true,
    oferta_id: null,
    ...cambios,
  }
}

let actual = explicacion()

const servidor = setupServer(
  http.get('/api/v1/originacion/solicitudes/s-1/decision', () => HttpResponse.json(actual)),
  http.get('/api/v1/sistema/estado', () => HttpResponse.json({ servicios_externos: 'simulado' })),
)

beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  servidor.resetHandlers()
  actual = explicacion()
})
afterAll(() => servidor.close())

function montar() {
  const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/portal/solicitudes/:id/decision', element: <ExplicacionPagina /> }], {
    initialEntries: ['/portal/solicitudes/s-1/decision'],
  })
  render(
    <QueryClientProvider client={consultas}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('explicación de la decisión (RF-09, D26)', () => {
  it('explica la negación con distintivo de simulado y sin ofrecer la reconsideración postergada (MR-004, D22)', async () => {
    montar()
    expect(await screen.findByText(actual.motivo_principal)).toBeInTheDocument()
    expect(screen.getByText('Capacidad de pago')).toBeInTheDocument()
    expect(screen.getByText(/Decisión con consulta simulada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reconsideración/i })).toBeNull()
    expect(screen.queryByText(/reconsideración/i)).toBeNull()
    expect(screen.queryByText(/una persona la revise/i)).toBeNull()
  })

  it('sin consulta simulada no lleva distintivo, aunque el servicio esté en modo simulado', async () => {
    actual = explicacion({ simulado: false, variables: [] })
    montar()
    expect(await screen.findByText(actual.motivo_principal)).toBeInTheDocument()
    expect(screen.queryByText(/Decisión con consulta simulada/)).toBeNull()
  })
})
