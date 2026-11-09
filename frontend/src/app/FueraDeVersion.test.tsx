import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Rol, Usuario } from '../lib/api/tipos'
import { CLAVE_SESION } from '../features/acceso/sesion'
import { FueraDeVersion } from './Paginas'

// Datos sintéticos.
function montar(rol: Rol, ruta: string) {
  const usuario: Usuario = {
    id: 1,
    nombre_completo: 'Persona Prueba',
    nombre_corto: 'Persona',
    email: 'persona.prueba@demo.finantech.co',
    rol,
    estado_kyc: 'verificado',
  }
  const consultas = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  consultas.setQueryData(CLAVE_SESION, usuario)
  const router = createMemoryRouter([{ path: '*', element: <FueraDeVersion que="La consulta de actividad" /> }], {
    initialEntries: [ruta],
  })
  render(
    <QueryClientProvider client={consultas}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('rutas fuera de la primera versión (P9, D22)', () => {
  it('avisa qué no está disponible y lleva al oficial a su bandeja', () => {
    montar('oficial', '/consola/auditoria')
    expect(screen.getByRole('heading', { name: 'No disponible en esta versión' })).toBeInTheDocument()
    expect(screen.getByText(/La consulta de actividad llega en una próxima versión/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/consola/oficial')
  })

  it('si la ruta es el inicio del rol, no enlaza a sí misma', () => {
    montar('administrador', '/consola/admin/usuarios')
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
  })
})
