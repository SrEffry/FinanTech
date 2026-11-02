import { formatoMoneda, monedaParaLector } from '../../lib/formato'

/**
 * Marca FinanTech: la F de dos trazos y el punto menta, "el punto final" de unas cuentas
 * claras. Palabra en Archivo semiexpandida (direccion-visual §4).
 */
export function Logo({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill={claro ? '#ffffff' : '#1B4D8F'} />
        <path
          d="M10 23.5V8.5h12.5M10 16h8.5"
          fill="none"
          stroke={claro ? '#0E2240' : '#ffffff'}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22.5" cy="22" r="2.75" fill="#0E9F6E" />
      </svg>
      <span
        translate="no"
        className={`titular text-[1.1875rem] leading-none font-bold tracking-[-0.02em] ${claro ? 'text-white' : 'text-noche'}`}
      >
        FinanTech
      </span>
    </span>
  )
}

/**
 * Dinero con su unidad para lectores de pantalla (RNF-19): se ve "$ 1.250.000" y se lee
 * "1.250.000 pesos".
 */
export function Dinero({ valor, className = '' }: { valor: number; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden="true">{formatoMoneda(valor)}</span>
      <span className="sr-only">{monedaParaLector(valor)}</span>
    </span>
  )
}

export function Porcentaje({ valor, sufijo = '', className = '' }: { valor: number; sufijo?: string; className?: string }) {
  const texto = valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className={className}>
      <span aria-hidden="true">
        {texto} %{sufijo}
      </span>
      <span className="sr-only">
        {texto} por ciento{sufijo ? ` ${sufijo.trim()}` : ''}
      </span>
    </span>
  )
}
