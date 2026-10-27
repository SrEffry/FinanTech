import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import './styles/index.css'
import { ErrorApi } from './lib/api/cliente'
import { CLAVE_SESION } from './features/acceso/sesion'
import { ToastProvider } from './components/ui/Toast'
import { router } from './app/router'

/** Si el servidor dice que la sesión terminó, se olvida y las rutas protegidas llevan al ingreso. */
function alFallar(error: unknown) {
  if (error instanceof ErrorApi && error.codigo === 'sin_sesion') clienteConsultas.setQueryData(CLAVE_SESION, null)
}

const clienteConsultas = new QueryClient({
  queryCache: new QueryCache({ onError: alFallar }),
  mutationCache: new MutationCache({ onError: alFallar }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // No se reintenta lo que el servidor rechazó con intención (4xx).
      retry: (intentos, error) => !(error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) && intentos < 2,
    },
  },
})

async function iniciar() {
  // La API simulada solo existe con VITE_API_SIMULADA=true: el import dinámico la deja fuera
  // del build de producción.
  if (import.meta.env.VITE_API_SIMULADA === 'true') {
    const { iniciarApiSimulada } = await import('./mocks/browser')
    await iniciarApiSimulada()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={clienteConsultas}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void iniciar()
