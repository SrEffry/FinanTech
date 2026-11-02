export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf']
export const TAMANO_MAXIMO = 10 * 1024 * 1024
/** Fotos (el rostro de la prueba de vida): un PDF no sirve para comparar la cara. */
export const TIPOS_FOTO = ['image/jpeg', 'image/png']

/** RN-30: JPG, PNG o PDF de máximo 10 MB, revisado en el momento de la captura. */
export function validarArchivo(archivo: File, tipos: readonly string[] = TIPOS_PERMITIDOS): string | null {
  if (!tipos.includes(archivo.type)) {
    return tipos.includes('application/pdf') ? 'Sube el documento en JPG, PNG o PDF.' : 'Sube una foto en JPG o PNG.'
  }
  if (archivo.size > TAMANO_MAXIMO) return 'El archivo pesa más de 10 MB. Comprímelo o tómale una foto.'
  if (archivo.size === 0) return 'El archivo está vacío. Elige otro.'
  return null
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
}
