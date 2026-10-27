const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

const fecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
const fechaCorta = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fechaHora = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** $ 1.250.000 (pesos colombianos, sin decimales). */
export function formatoMoneda(valor: number): string {
  return moneda.format(Math.round(valor))
}

/** Texto para lectores de pantalla: "1.250.000 pesos" (RNF-19: cifras con su unidad). */
export function monedaParaLector(valor: number): string {
  return `${numero.format(Math.round(valor))} pesos`
}

export function formatoNumero(valor: number): string {
  return numero.format(valor)
}

/** Recibe el porcentaje en unidades (18.9 → "18,90 %"). */
export function formatoPorcentaje(valor: number, decimales = 2): string {
  return `${valor.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} %`
}

export function formatoFecha(iso: string): string {
  return fecha.format(new Date(iso))
}

export function formatoFechaCorta(iso: string): string {
  return fechaCorta.format(new Date(iso))
}

export function formatoFechaHora(iso: string): string {
  return fechaHora.format(new Date(iso))
}

/**
 * Deja visibles solo los últimos 4 caracteres (RNF-06). Nunca devuelve el dato completo,
 * aunque sea corto: con 4 caracteres o menos no muestra ninguno.
 */
export function enmascarar(valor: string | null | undefined): string {
  if (!valor) return ''
  const limpio = valor.replace(/\s+/g, '')
  if (limpio.startsWith('•')) return limpio.replace(/^•+/, '•••• ')
  if (limpio.length <= 4) return '••••'
  return `•••• ${limpio.slice(-4)}`
}

/** Correo con el usuario recortado: l•••@dominio.co */
export function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split('@')
  if (!dominio) return '••••'
  return `${usuario.slice(0, 1)}•••@${dominio}`
}

/** Segundos que faltan hasta `iso`, nunca negativos. */
export function segundosHasta(iso: string, ahora = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - ahora) / 1000))
}

export function formatoCuentaRegresiva(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** "hace 3 h", "hace 2 días": antigüedad en cola para la bandeja. */
export function antiguedad(iso: string, ahora = Date.now()): string {
  const minutos = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? '1 día' : `${dias} días`
}
