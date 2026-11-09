import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { SolicitudDetalle } from '../../lib/api/tipos'
import { monedaParaLector } from '../../lib/formato'
import { ToastProvider } from '../../components/ui/Toast'
import SeguimientoPagina from './SeguimientoPagina'

// Datos sintéticos; el endpoint se simula aquí para no depender de los handlers de originación (T11).
function solicitud(cambios: Partial<SolicitudDetalle> = {}): SolicitudDetalle {
  return {
    id: 's-1',
    radicado: 'FT-2026-000123',
    producto: { codigo: 'libre_inversion', nombre: 'Libre inversión' },
    monto: 5_000_000,
    plazo_meses: 24,
    estado: 'EN_EVALUACION',
    creada_en: '2026-11-01T10:00:00Z',
    actualizada_en: '2026-11-01T10:05:00Z',
    accion_pendiente: null,
    tasa_ea: 18.9,
    cuota_estimada: 262_345,
    datos_conocidos: {
      nombre_completo: 'Laura Prueba',
      documento_enmascarado: '•••• 4321',
      fecha_nacimiento: '1990-05-20',
      email: 'laura.prueba@demo.finantech.co',
      telefono_enmascarado: '•••• 9876',
    },
    laboral: { ocupacion: 'empleado', empleador: 'Empresa Sintética', antiguedad_laboral_meses: 24 },
    financiero: { ingreso_mensual: 3_000_000, egreso_mensual: 900_000 },
    referencia: { nombre: 'Persona Referencia', celular: '3001112233' },
    documentos: [],
    acepta_consulta_centrales: true,
    capacidad_pago: null,
    historial: [
      { estado: 'RADICADA', fecha: '2026-11-01T10:00:00Z' },
      { estado: 'EN_EVALUACION', fecha: '2026-11-01T10:05:00Z' },
    ],
    oferta_id: null,
    borrador_vence_en: null,
    ...cambios,
  }
}

let actual = solicitud()

const servidor = setupServer(http.get('/api/v1/originacion/solicitudes/s-1', () => HttpResponse.json(actual)))

beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  servidor.resetHandlers()
  actual = solicitud()
})
afterAll(() => servidor.close())

function montar() {
  const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/portal/solicitudes/:id', element: <SeguimientoPagina /> }], {
    initialEntries: ['/portal/solicitudes/s-1'],
  })
  render(
    <QueryClientProvider client={consultas}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('seguimiento de la solicitud (RF-07, RN-36)', () => {
  it('muestra el estado con la etiqueta para el cliente y avisa que se está evaluando', async () => {
    montar()
    const estado = await screen.findByRole('region', { name: 'Estado de tu solicitud' })
    expect(within(estado).getByText('En evaluación')).toBeInTheDocument()
    expect(within(estado).getByText(/Estamos evaluando tu solicitud/)).toBeInTheDocument()
    expect(within(estado).queryByRole('link')).toBeNull()
    // RNF-20: la cuota de lo que pidió va con su TEA.
    expect(screen.getByText(monedaParaLector(262_345))).toBeInTheDocument()
    expect(screen.getByText('18,90 %')).toBeInTheDocument()
  }, 15_000)

  it('con una oferta lista, el llamado a la acción lleva a la oferta', async () => {
    actual = solicitud({
      estado: 'APROBADA',
      accion_pendiente: { tipo: 'oferta', texto: 'Tienes una oferta lista para revisar.', oferta_id: 'o-9' },
    })
    montar()
    const estado = await screen.findByRole('region', { name: 'Estado de tu solicitud' })
    expect(within(estado).getByText('Aprobada')).toBeInTheDocument()
    expect(within(estado).getByText('Tienes una oferta lista para revisar.')).toBeInTheDocument()
    expect(within(estado).getByRole('link', { name: 'Revisar oferta' })).toHaveAttribute('href', '/portal/ofertas/o-9')
    expect(within(estado).queryByText(/Estamos evaluando/)).toBeNull()
  }, 15_000)
})
