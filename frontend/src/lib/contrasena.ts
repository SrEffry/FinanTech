import { z } from 'zod'

/**
 * Reglas de la contraseña, las mismas de Laravel (`Password::min(10)->mixedCase()->numbers()
 * ->symbols()->uncompromised()`), con los mismos mensajes. Lo de contraseñas filtradas solo
 * lo puede revisar el servidor.
 */
export const esquemaContrasena = z
  .string()
  .min(10, 'Usa al menos 10 caracteres.')
  .regex(/[a-z]/, 'Incluye al menos una letra minúscula.')
  .regex(/[A-Z]/, 'Incluye al menos una letra mayúscula.')
  .regex(/\d/, 'Incluye al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Incluye al menos un símbolo, como # o !.')

/** Lista que se marca mientras la persona escribe. */
export const REGLAS_CONTRASENA = [
  { texto: 'Al menos 10 caracteres', cumple: (v: string) => v.length >= 10 },
  { texto: 'Mayúsculas y minúsculas', cumple: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { texto: 'Al menos un número', cumple: (v: string) => /\d/.test(v) },
  { texto: 'Al menos un símbolo', cumple: (v: string) => /[^A-Za-z0-9]/.test(v) },
]
