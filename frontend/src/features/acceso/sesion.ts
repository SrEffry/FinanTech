import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function esInterno(rol: Rol): boolean {
  return rol !== 'cliente'
}

export function useCerrarSesion() {
  const cliente = useQueryClient()
  const navegar = useNavigate()
  return useMutation({
    mutationFn: cerrarSesion,
    onSettled: () => {
      cliente.clear()
      cliente.setQueryData(CLAVE_SESION, null)
      navegar('/ingresar', { replace: true })
    },
  })
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
