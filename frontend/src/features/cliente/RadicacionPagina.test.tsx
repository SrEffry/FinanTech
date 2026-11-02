import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Producto, SolicitudDetalle, Usuario } from '../../lib/api/tipos'
import { calcularCredito } from '../../mocks/calculos'
import { monedaParaLector } from '../../lib/formato'
import { ToastProvider } from '../../components/ui/Toast'
import { CLAVE_SESION } from '../acceso/sesion'
import RadicacionPagina from './RadicacionPagina'

// Datos sintéticos. Los endpoints se simulan aquí mismo para no depender de los handlers
// de originación, que se retiran a medida que Laravel los implementa (T11).
const PRODUCTO: Producto = {
  codigo: 'libre_inversion',
  nombre: 'Libre inversión',
  descripcion: 'Para lo que necesites.',
  tasa_ea: 18.9,
  monto_min: 1_000_000,
  monto_max: 50_000_000,
  plazo_min: 6,
  plazo_max: 60,
  paso_monto: 100_000,
}

const USUARIO: Usuario = {
  id: 1,
  nombre_completo: 'Laura Prueba',
  nombre_corto: 'Laura',
  email: 'laura.prueba@demo.finantech.co',
  rol: 'cliente',
  estado_kyc: 'verificado',
}

function borrador(cambios: Partial<SolicitudDetalle> = {}): SolicitudDetalle {
  const calculo = calcularCredito(PRODUCTO.tasa_ea, 5_000_000, 24, 25.62)
  return {
    id: 's-1',
    radicado: null,
    producto: { codigo: PRODUCTO.codigo, nombre: PRODUCTO.nombre },
    monto: 5_000_000,
    plazo_meses: 24,
    estado: 'BORRADOR',
    creada_en: '2026-11-01T10:00:00Z',
    actualizada_en: '2026-11-01T10:00:00Z',
    accion_pendiente: null,
    tasa_ea: PRODUCTO.tasa_ea,
    cuota_estimada: calculo.cuota,
    datos_conocidos: {
      nombre_completo: 'Laura Prueba',
      documento_enmascarado: '•••• 4321',
      fecha_nacimiento: '1990-05-20',
      email: USUARIO.email,
      telefono_enmascarado: '•••• 9876',
    },
    laboral: { ocupacion: 'empleado', empleador: 'Empresa Sintética', antiguedad_laboral_meses: 24 },
    financiero: { ingreso_mensual: 1_500_000, egreso_mensual: 900_000 },
    referencia: { nombre: 'Persona Referencia', celular: '3001112233' },
    documentos: [],
    acepta_consulta_centrales: false,
    capacidad_pago: null,
    historial: [],
    oferta_id: null,
    borrador_vence_en: '2026-12-01T10:00:00Z',
    ...cambios,
  }
}

let actual = borrador()

const servidor = setupServer(
  http.get('/api/v1/identidad/sesion', () => HttpResponse.json({ usuario: USUARIO })),
  http.get('/api/v1/cliente/productos', () => HttpResponse.json([PRODUCTO])),
  http.get('/api/v1/originacion/solicitudes/s-1', () => HttpResponse.json(actual)),
  http.post('/api/v1/cliente/simulaciones', async ({ request }) => {
    const { monto, plazo_meses } = (await request.json()) as { monto: number; plazo_meses: number }
    const calculo = calcularCredito(PRODUCTO.tasa_ea, monto, plazo_meses, 25.62)
    return HttpResponse.json({ id: 'sim', producto: actual.producto, monto, plazo_meses, valor_a_recibir: monto, ...calculo })
  }),
)

beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  servidor.resetHandlers()
  actual = borrador()
})
afterAll(() => servidor.close())

function montar() {
  const consultas = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  consultas.setQueryData(CLAVE_SESION, USUARIO)
  const router = createMemoryRouter([{ path: '/portal/solicitar/:id', element: <RadicacionPagina /> }], {
    initialEntries: ['/portal/solicitar/s-1'],
  })
  render(
    <QueryClientProvider client={consultas}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('radicación: cuota mientras se edita (UX-05, RNF-20)', () => {
  it('nunca muestra la cuota del monto anterior: la recalcula para el monto visible, con su TEA', async () => {
    const usuario = userEvent.setup()
    montar()
    const anterior = monedaParaLector(actual.cuota_estimada)
    expect(await screen.findByText(anterior)).toBeInTheDocument()

    const monto = screen.getByLabelText('Monto')
    await usuario.clear(monto)
    await usuario.type(monto, '8000000')
    expect(screen.queryByText(anterior)).toBeNull()

    const nueva = calcularCredito(PRODUCTO.tasa_ea, 8_000_000, 24, 25.62).cuota
    expect(await screen.findByText(monedaParaLector(nueva))).toBeInTheDocument()
    expect(screen.getByText(/8.000.000/)).toBeInTheDocument()
    // CP0011: la TEA acompaña a la cuota y se dice que no es una aprobación.
    expect(screen.getByText('18,90 %')).toBeInTheDocument()
    expect(screen.getByText(/no constituye aprobación/i)).toBeInTheDocument()
  }, 20_000)
})

describe('radicación: capacidad de pago (UX-06, RF-06 FA-04)', () => {
  it('si la cuota supera el límite, se queda en la sección con el aviso y la TEA, y deja continuar', async () => {
    const usuario = userEvent.setup()
    servidor.use(
      http.patch('/api/v1/originacion/solicitudes/s-1', () => {
        actual = borrador({
          capacidad_pago: { cuota_estimada: actual.cuota_estimada, ingreso_disponible: 600_000, porcentaje: 46.4, limite: 40, supera_limite: true },
        })
        return HttpResponse.json(actual)
      }),
    )
    montar()
    await screen.findByLabelText('Monto')
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { name: /Tus datos/ })
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('heading', { name: /Trabajo e ingresos/ })
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))

    const aviso = await screen.findByText('La cuota ocuparía una parte muy alta de tus ingresos')
    expect(screen.getByRole('heading', { name: /Trabajo e ingresos/ })).toBeInTheDocument()
    const caja = aviso.closest('[role="status"]') as HTMLElement
    expect(within(caja).getByText('18,90 %')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Continuar de todas formas' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Referencia/ })).toBeInTheDocument())
  }, 20_000)
})
