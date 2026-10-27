import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ErrorApi } from '../lib/api/cliente'
import { iniciarSesion } from '../lib/api/identidad'
import { reiniciarDb } from '../mocks/db'
import { handlersSesion } from '../mocks/handlers/sesion'
import { CONTRASENA_DEMO, FINALIDADES } from '../mocks/semilla'
import { ToastProvider } from '../components/ui/Toast'
import RegistroPagina from './registro/RegistroPagina'

const servidor = setupServer(
  ...handlersSesion,
  http.get('/api/v1/identidad/politica-vigente', () =>
    HttpResponse.json({ version: '1.0', vigente_desde: '2026-10-01', resumen: 'Resumen de la política.', finalidades: FINALIDADES }),
  ),
)

beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }))
afterEach(() => servidor.resetHandlers())
afterAll(() => servidor.close())
beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

async function errorDe(promesa: Promise<unknown>): Promise<ErrorApi> {
  try {
    await promesa
  } catch (error) {
    if (error instanceof ErrorApi) return error
    throw error
  }
  throw new Error('Se esperaba un error')
}

describe('inicio de sesión (RN-17, CP0009)', () => {
  it('responde lo mismo si el correo no existe o si la contraseña está mal', async () => {
    const inexistente = await errorDe(iniciarSesion('nadie@demo.finantech.co', 'Cualquiera#2026'))
    const contrasenaMala = await errorDe(iniciarSesion('laura.mejia@demo.finantech.co', 'Equivocada#2026'))
    expect(inexistente.codigo).toBe(contrasenaMala.codigo)
    expect(inexistente.message).toBe(contrasenaMala.message)
    expect(inexistente.estado).toBe(contrasenaMala.estado)
  })

  it('bloquea a los 5 intentos fallidos, exista o no la cuenta (RN-12)', async () => {
    for (let i = 0; i < 4; i++) await errorDe(iniciarSesion('nadie@demo.finantech.co', 'Mala#2026xx'))
    const quinto = await errorDe(iniciarSesion('nadie@demo.finantech.co', 'Mala#2026xx'))
    expect(quinto.codigo).toBe('cuenta_bloqueada')
    expect(quinto.estado).toBe(423)
  }, 15_000)

  it('con credenciales correctas pide el segundo factor', async () => {
    const desafio = await iniciarSesion('laura.mejia@demo.finantech.co', CONTRASENA_DEMO)
    expect(desafio.desafio_id).toBeTruthy()
    expect(desafio.enviado_a).toBe('l•••@demo.finantech.co')
  })
})

describe('registro (RF-01)', () => {
  it('las finalidades opcionales empiezan sin marcar y las necesarias no se pueden quitar (RN-05)', async () => {
    const usuario = userEvent.setup()
    const router = createMemoryRouter([{ path: '/registro', element: <RegistroPagina /> }], { initialEntries: ['/registro'] })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>,
    )

    await usuario.type(screen.getByLabelText('Número de documento'), '1020456782')
    await usuario.type(screen.getByLabelText('Nombres'), 'Ana María')
    await usuario.type(screen.getByLabelText('Apellidos'), 'Prueba Sintética')
    await usuario.type(screen.getByLabelText('Fecha de nacimiento'), '1990-05-20')
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'ana.prueba@demo.finantech.co')
    await usuario.type(screen.getByLabelText('Celular'), '3001234567')
    await usuario.type(screen.getByLabelText('Contraseña'), 'Segura#2026ok')
    await usuario.type(screen.getByLabelText('Repite la contraseña'), 'Segura#2026ok')
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(screen.getByText('Opcionales')).toBeInTheDocument())
    for (const finalidad of FINALIDADES.filter((f) => !f.necesaria)) {
      expect(screen.getByRole('checkbox', { name: finalidad.nombre })).not.toBeChecked()
    }
    // Las necesarias se informan, pero no son casillas que se puedan desmarcar.
    for (const finalidad of FINALIDADES.filter((f) => f.necesaria)) {
      expect(screen.getByText(finalidad.nombre)).toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: finalidad.nombre })).toBeNull()
    }
    expect(screen.getByRole('checkbox', { name: /acepto la política/ })).not.toBeChecked()
  }, 20_000)

  it('rechaza a menores de 18 años en el formulario (RN-03)', async () => {
    const usuario = userEvent.setup()
    const router = createMemoryRouter([{ path: '/registro', element: <RegistroPagina /> }], { initialEntries: ['/registro'] })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )
    const hoy = new Date()
    const menor = `${hoy.getFullYear() - 17}-01-15`
    await usuario.type(screen.getByLabelText('Fecha de nacimiento'), menor)
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Debes ser mayor de 18 años para registrarte.')).toBeInTheDocument()
  }, 15_000)
})
