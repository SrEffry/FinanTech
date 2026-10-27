import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ErrorApi } from './api/cliente'

const GENERICO = 'No pudimos completar la acción. Inténtalo de nuevo.'

/** Mensaje para mostrar al usuario: nunca un texto técnico (RNF-09). */
export function mensajeDe(error: unknown): string {
  if (error instanceof ErrorApi) return error.message
  return GENERICO
}

export function codigoDe(error: unknown): string | null {
  return error instanceof ErrorApi ? error.codigo : null
}

/**
 * Pasa los errores de validación del servidor a los campos del formulario. Devuelve los
 * campos que no estaban en el formulario, para mostrarlos en un aviso general.
 */
export function aplicarErroresCampos<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  campos: readonly string[],
): string[] {
  if (!(error instanceof ErrorApi)) return []
  const sueltos: string[] = []
  for (const [campo, mensaje] of Object.entries(error.campos)) {
    if (campos.includes(campo)) setError(campo as Path<T>, { type: 'server', message: mensaje })
    else sueltos.push(mensaje)
  }
  return sueltos
}
