import type { ConceptoCosto, CuotaPlan, Producto } from '../lib/api/tipos'

/**
 * Cálculo financiero de la API simulada. En el sistema real lo hace el servidor; el portal
 * solo muestra lo que recibe. Valores de costos sintéticos (la ERS no los fija).
 */

/** Seguro de vida deudor: 0,09 % mensual sobre el monto desembolsado. */
export const TASA_SEGURO_MENSUAL = 0.0009
/** Estudio de crédito: 1,5 % del monto, entre $60.000 y $450.000. */
export const ESTUDIO_PORCENTAJE = 0.015
export const ESTUDIO_MINIMO = 60_000
export const ESTUDIO_MAXIMO = 450_000

/** TEA en porcentaje (18,9) → tasa mensual vencida en decimal (0,01455…). */
export function tasaMensual(teaPorcentaje: number): number {
  return Math.pow(1 + teaPorcentaje / 100, 1 / 12) - 1
}

/** Cuota fija de capital e intereses (sistema francés). */
export function cuotaFija(monto: number, tasaMes: number, plazoMeses: number): number {
  if (tasaMes === 0) return monto / plazoMeses
  return (monto * tasaMes) / (1 - Math.pow(1 + tasaMes, -plazoMeses))
}

export function valorEstudio(monto: number): number {
  return Math.round(Math.min(ESTUDIO_MAXIMO, Math.max(ESTUDIO_MINIMO, monto * ESTUDIO_PORCENTAJE)))
}

function sumarMeses(fecha: Date, meses: number): Date {
  const resultado = new Date(fecha)
  resultado.setMonth(resultado.getMonth() + meses)
  return resultado
}

export interface ResultadoCalculo {
  tasa_ea: number
  tasa_mensual: number
  cuota: number
  costo_total: number
  total_a_pagar: number
  desglose: ConceptoCosto[]
  plan: CuotaPlan[]
}

/**
 * Plan de pagos completo. La TEA nunca supera la tasa máxima legal (RN-23) y el desglose
 * suma exactamente el costo total (CP0011), porque el costo total se calcula como esa suma.
 */
export function calcularCredito(
  tasaProductoEa: number,
  monto: number,
  plazoMeses: number,
  tasaMaximaLegalEa: number,
  desde: Date = new Date(),
): ResultadoCalculo {
  const tea = Math.min(tasaProductoEa, tasaMaximaLegalEa)
  const i = tasaMensual(tea)
  const base = cuotaFija(monto, i, plazoMeses)
  const seguro = Math.round(monto * TASA_SEGURO_MENSUAL)

  const plan: CuotaPlan[] = []
  let saldo = monto
  let intereses = 0
  for (let numero = 1; numero <= plazoMeses; numero++) {
    const interes = Math.round(saldo * i)
    const capital = numero === plazoMeses ? saldo : Math.round(base) - interes
    saldo -= capital
    intereses += interes
    plan.push({
      numero,
      fecha: sumarMeses(desde, numero).toISOString(),
      cuota: capital + interes + seguro,
      capital,
      interes,
      seguro,
      saldo,
    })
  }

  const desglose: ConceptoCosto[] = [
    {
      concepto: 'Intereses',
      descripcion: `Lo que pagas por usar el dinero, a una tasa del ${tea.toLocaleString('es-CO')} % efectiva anual.`,
      valor: intereses,
    },
    {
      concepto: 'Seguro de vida deudor',
      descripcion: 'Cubre el saldo de la deuda si falleces o quedas con una incapacidad. Se cobra en cada cuota.',
      valor: seguro * plazoMeses,
    },
    {
      concepto: 'Estudio de crédito',
      descripcion: 'Pago único por analizar tu solicitud. Se descuenta del valor que recibes.',
      valor: valorEstudio(monto),
    },
  ]
  const costoTotal = desglose.reduce((suma, c) => suma + c.valor, 0)

  return {
    tasa_ea: tea,
    tasa_mensual: Number((i * 100).toFixed(4)),
    cuota: Math.round(base) + seguro,
    costo_total: costoTotal,
    total_a_pagar: monto + costoTotal,
    desglose,
    plan,
  }
}

/** Ajusta monto y plazo al rango del producto (RF-05 FA-01: el valor válido más cercano). */
export function ajustarAlRango(producto: Producto, monto: number, plazo: number) {
  const montoAjustado = Math.min(producto.monto_max, Math.max(producto.monto_min, monto))
  const plazoAjustado = Math.min(producto.plazo_max, Math.max(producto.plazo_min, Math.round(plazo)))
  return { monto: montoAjustado, plazo: plazoAjustado }
}
