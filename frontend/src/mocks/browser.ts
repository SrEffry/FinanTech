import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export async function iniciarApiSimulada(): Promise<void> {
  const worker = setupWorker(...handlers)
  await worker.start({
    // Lo que no está simulado (el registro, RF-01) sigue hacia Laravel por el proxy de Vite.
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
