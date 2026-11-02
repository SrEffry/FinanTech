import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

/**
 * Al cambiar de página el foco pasa al título (o al contenido si la página aún carga), para
 * que el lector de pantalla anuncie la página nueva y el teclado no se quede en el menú
 * (WCAG 2.4.3). En la primera carga no se mueve.
 */
export function useFocoAlNavegar() {
  const { pathname } = useLocation()
  const anterior = useRef(pathname)
  useEffect(() => {
    if (anterior.current === pathname) return
    anterior.current = pathname
    const contenido = document.getElementById('contenido')
    const destino = contenido?.querySelector<HTMLElement>('h1[tabindex]') ?? contenido
    destino?.focus({ preventScroll: true })
  }, [pathname])
}
