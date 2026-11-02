/**
 * Estimación de la cuota cuando el oficial ajusta monto, plazo o tasa (UX-09, 8.3.4). La
 * cifra definitiva la calcula el servidor al emitir la oferta; esto solo sirve para que el
 * oficial vea a qué cuota y TEA lleva su ajuste y si respeta el límite de capacidad (RN-41).
 */

/** TEA en porcentaje (18,9) → tasa mensual vencida en decimal. */
export function tasaMensualDe(teaPorcentaje: number): number {
  return Math.pow(1 + teaPorcentaje / 100, 1 / 12) - 1
}

/** Cuota fija de capital e intereses (sistema francés). */
export function cuotaCapitalEIntereses(monto: number, teaPorcentaje: number, plazoMeses: number): number {
  if (monto <= 0 || plazoMeses <= 0) return 0
  const i = tasaMensualDe(teaPorcentaje)
  if (i === 0) return monto / plazoMeses
  return (monto * i) / (1 - Math.pow(1 + i, -plazoMeses))
}

export interface CondicionesCredito {
  monto: number
  plazo_meses: number
  tasa_ea: number
}

/**
 * Cuota estimada con las condiciones nuevas. El seguro no es un parámetro del portal: se
 * deduce de la cuota que el servidor calculó para las condiciones originales (cuota menos
 * capital e intereses) y se escala con el monto, porque se cobra sobre lo desembolsado.
 */
export function estimarCuota(nuevas: CondicionesCredito, originales: CondicionesCredito & { cuota: number }): number {
  const base = cuotaCapitalEIntereses(nuevas.monto, nuevas.tasa_ea, nuevas.plazo_meses)
  const seguroOriginal = Math.max(0, originales.cuota - cuotaCapitalEIntereses(originales.monto, originales.tasa_ea, originales.plazo_meses))
  const seguro = originales.monto > 0 ? (seguroOriginal * nuevas.monto) / originales.monto : 0
  return Math.round(base + seguro)
}

/** Porcentaje de la cuota frente al ingreso disponible, con un decimal. Sin disponible, null. */
export function porcentajeDelDisponible(cuota: number, disponible: number): number | null {
  if (!(disponible > 0)) return null
  return Math.round((cuota / disponible) * 1000) / 10
}
