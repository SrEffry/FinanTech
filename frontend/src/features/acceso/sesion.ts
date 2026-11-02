import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { cerrarSesion, obtenerEstadoSistema, obtenerSesion } from '../../lib/api/identidad'
import type { Rol, Usuario } from '../../lib/api/tipos'

export const CLAVE_SESION = ['sesion'] as const

/** Sesión actual. El servidor la lleva en una cookie httpOnly; aquí solo se consulta. */
export function useSesion() {
  return useQuery({
    queryKey: CLAVE_SESION,
    queryFn: obtenerSesion,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** Dentro de RutaProtegida la sesión ya existe. */
export function useUsuario(): Usuario {
  const { data } = useSesion()
  if (!data) throw new Error('useUsuario se usa fuera de una ruta protegida')
  return data
}

const INICIO: Record<Rol, string> = {
  cliente: '/portal',
  analista: '/consola/analista',
  oficial: '/consola/oficial',
  administrador: '/consola/admin/usuarios',
  contabilidad: '/consola/contabilidad',
  directivo: '/consola/directivo',
}

export function inicioDeRol(rol: Rol): string {
  return INICIO[rol]
}

/**
 * Destino de `?volver=` solo si es una ruta interna del portal. Evita que un enlace
 * manipulado lleve a otro sitio después de iniciar sesión (redirección abierta).
 */
export function rutaSegura(volver: string | null | undefined): string | null {
  if (!volver || !volver.startsWith('/') || volver.startsWith('//') || volver.includes('\\')) return null
  if (/^\/(ingresar|registro|recuperar)(\/|\?|$)/.test(volver)) return null
  return volver
}

export function esInterno(rol: Rol): boolean {
  return rol !== 'cliente'
}

export function useCerrarSesion() {
  const navegar = useNavigate()
  return useMutation({
    mutationFn: cerrarSesion,
    // Se sale de las rutas protegidas y la caché se limpia ya en el ingreso (`olvidarSesion`):
    // si se borrara aquí, con el portal todavía montado, las rutas protegidas mandarían a
    // `/ingresar?volver=…` como si la sesión hubiera vencido.
    onSettled: () => navegar('/ingresar', { replace: true, state: { salio: true } }),
  })
}

/** Olvida todo lo que quedó en caché de la sesión que se cerró (RNF-05: nada se muestra a otra persona). */
export function olvidarSesion(cliente: QueryClient) {
  cliente.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== CLAVE_SESION[0] })
  cliente.setQueryData(CLAVE_SESION, null)
}

/** Si los servicios externos están en modo simulado, sus resultados llevan distintivo (MR-003). */
export function useServiciosSimulados(): boolean {
  const { data } = useQuery({
    queryKey: ['sistema'],
    queryFn: obtenerEstadoSistema,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  // Sin respuesta se asume simulado: es peor ocultar el distintivo que mostrarlo de más.
  return data?.servicios_externos !== 'real'
}
