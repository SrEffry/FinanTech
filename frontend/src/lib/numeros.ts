/** Lectura y escritura de números decimales con coma (UX-08). */

/** "25,62" o "25.62" → 25.62. Texto vacío o incompleto ("", ",") → null. */
export function leerDecimal(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '' || limpio === '.') return null
  const valor = Number(limpio)
  return Number.isFinite(valor) ? valor : null
}

/** 25.6 → "25,60" (coma decimal, como el resto del portal). */
export function escribirDecimal(valor: number | null | undefined, decimales: number): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return ''
  return valor.toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: false })
}
