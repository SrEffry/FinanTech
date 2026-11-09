/**
 * Reduce una foto del celular antes de enviarla (D9): las cámaras dan fotos de 4 a 12 MB y
 * la verificación de identidad envía tres en una sola petición. Con 2000 px en el lado
 * mayor el documento sigue legible para el proveedor. Todo pasa en memoria: la foto no se
 * guarda en el dispositivo (RI-06).
 */
export const LADO_MAXIMO = 2000
const CALIDAD = 0.85
/** Por debajo de este peso no vale la pena recomprimir. */
const PESO_SUFICIENTE = 1024 * 1024

/** Medidas finales que respetan la proporción y no pasan de `maximo` en el lado mayor. */
export function medidasReducidas(ancho: number, alto: number, maximo = LADO_MAXIMO): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto)
  if (mayor <= maximo) return { ancho, alto }
  const escala = maximo / mayor
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

function nombreJpg(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, '') || 'foto'
  return `${base}.jpg`
}

/**
 * Devuelve la foto reducida en JPEG, o la original si ya es liviana, si no es una imagen o
 * si el navegador no puede reducirla (nunca falla por eso: el servidor valida igual).
 */
export async function reducirFoto(archivo: File): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(archivo.type) || archivo.size <= PESO_SUFICIENTE) return archivo
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return archivo
  try {
    // La orientación EXIF se aplica al decodificar, así la foto no queda acostada.
    const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    const { ancho, alto } = medidasReducidas(imagen.width, imagen.height)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const contexto = lienzo.getContext('2d')
    if (!contexto) return archivo
    contexto.drawImage(imagen, 0, 0, ancho, alto)
    imagen.close()
    const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, 'image/jpeg', CALIDAD))
    if (!blob || blob.size >= archivo.size) return archivo
    return new File([blob], nombreJpg(archivo.name), { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return archivo
  }
}
