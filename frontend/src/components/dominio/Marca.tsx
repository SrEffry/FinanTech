import { formatoMoneda, monedaParaLector } from '../../lib/formato'

export function Logo({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect width="32" height="32" rx="7" fill={claro ? '#ffffff' : '#1B4D8F'} />
        <path
          d="M9 23V9h13M9 16h9"
          fill="none"
          stroke={claro ? '#1B4D8F' : '#ffffff'}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22.5" cy="21.5" r="2.5" fill="#0E9F6E" />
      </svg>
      <span translate="no" className={`text-lg font-bold tracking-tight ${claro ? 'text-white' : 'text-tinta'}`}>FinanTech</span>
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
