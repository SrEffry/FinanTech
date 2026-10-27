import { useState } from 'react'
import { FlaskConical, Info } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Alert } from '../ui/Feedback'

export const API_SIMULADA = import.meta.env.VITE_API_SIMULADA === 'true'

/**
 * Distintivo obligatorio cuando un resultado viene de un adaptador simulado (MR-003,
 * MR-004): nunca se presenta un resultado simulado como real.
 */
export function DistintivoSimulado({ que = 'Resultado simulado' }: { que?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-advertencia-500 bg-advertencia-50 px-2.5 py-1 text-xs font-semibold text-advertencia-800"
      title="Lo generó un servicio de prueba, no el proveedor real."
    >
      <FlaskConical aria-hidden="true" className="size-3.5" />
      {que}
      <span className="sr-only">: lo generó un servicio de prueba, no el proveedor real.</span>
    </span>
  )
}

/** Aviso obligatorio del simulador (RN-25, RN-27). */
export function AvisoNoAprobacion() {
  return (
    <Alert tono="info" titulo="Esta simulación no es una aprobación">
      Las condiciones definitivas pueden cambiar después del estudio de tu solicitud. Guardamos estos valores durante 30
      días.
    </Alert>
  )
}

/**
 * Marca fija de la demostración: mientras la API simulada esté activa, todo el portal
 * trabaja con datos sintéticos y se dice en pantalla.
 */
export function DistintivoDemo() {
  const [abierto, setAbierto] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  if (!API_SIMULADA) return null

  async function reiniciar() {
    setReiniciando(true)
    const { reiniciarDb } = await import('../../mocks/db')
    reiniciarDb()
    window.location.assign('/')
  }

  // Franja arriba de todo, sin flotar: así nunca tapa contenido en el celular.
  return (
    <>
      <div className="no-imprimir flex items-center justify-center gap-2 border-b border-advertencia-100 bg-advertencia-50 px-4 py-1 text-xs text-advertencia-800">
        <Info aria-hidden="true" className="size-3.5 shrink-0" />
        <span>Datos de demostración: personas y créditos inventados.</span>
        <button type="button" onClick={() => setAbierto(true)} className="min-h-8 font-semibold underline underline-offset-2">
          Qué significa
        </button>
      </div>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Estás viendo datos de demostración"
        cierreFuera
        descripcion={
          <>
            El registro de clientes usa el servidor real. El resto de pantallas usa una API simulada en tu navegador,
            con personas y créditos inventados, mientras el equipo construye el backend. Nada de lo que hagas aquí
            mueve dinero ni crea obligaciones reales.
          </>
        }
        acciones={
          <>
            <Button variante="secundario" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
            <Button variante="peligro" cargando={reiniciando} onClick={reiniciar}>
              Reiniciar datos de demostración
            </Button>
          </>
        }
      />
    </>
  )
}
