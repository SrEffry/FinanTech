import { CalendarClock } from 'lucide-react'
import { ButtonLink } from '../ui/Button'

interface Props {
  /** Qué no está disponible, en lenguaje de la persona: "La gestión de usuarios". */
  que?: string
  /** A dónde vuelve la persona (el inicio de su rol). */
  volverA: string
  volverEtiqueta?: string
  /** Lo que sí puede hacer ahora. Para la consola: "Por ahora puedes revisar y decidir solicitudes." */
  ahora?: string
}

const AHORA_CLIENTE = 'Por ahora puedes simular, solicitar tu crédito, seguir su estado y firmar tu oferta.'

/**
 * Pantalla para lo que queda fuera de la primera versión (P9, D22): no se borra, se avisa.
 * Va dentro del layout del rol (portal o consola), así no se pierde la navegación. Dice qué
 * pasa y qué hacer, sin disculparse ni prometer fechas.
 */
export function NoDisponible({ que, volverA, volverEtiqueta = 'Volver al inicio', ahora = AHORA_CLIENTE }: Props) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-6 py-10 sm:items-center sm:py-16 sm:text-center">
      <title>No disponible en esta versión · FinanTech</title>
      <span className="flex size-16 items-center justify-center rounded-full bg-cielo text-primario-600 ring-8 ring-cielo/50">
        <CalendarClock aria-hidden="true" className="size-8" />
      </span>
      <div className="flex flex-col gap-3">
        <h1 tabIndex={-1} className="titular text-2xl leading-tight font-semibold text-noche outline-none sm:text-[1.75rem]">
          No disponible en esta versión
        </h1>
        <p className="text-base leading-relaxed text-tinta-suave">
          {que ? `${que} llega en una próxima versión de FinanTech.` : 'Esta sección llega en una próxima versión de FinanTech.'}{' '}
          {ahora}
        </p>
      </div>
      <ButtonLink to={volverA}>{volverEtiqueta}</ButtonLink>
    </div>
  )
}
