import { Dinero, Porcentaje } from './Marca'

interface Props {
  cuota: number
  tea: number
  tamano?: 'grande' | 'mediano'
  etiquetaCuota?: string
  /** Muestra la explicación corta de cada término (RNF-20). */
  explicar?: boolean
  className?: string
}

/**
 * La cuota y la TEA siempre juntas y con el mismo peso visual (RNF-20, CLAUDE.md):
 * mismo tamaño, mismo grosor, mismo color. Ninguna de las dos domina a la otra.
 */
export function CuotaConTea({ cuota, tea, tamano = 'grande', etiquetaCuota = 'Cuota mensual', explicar = false, className = '' }: Props) {
  // En celulares de 320 px las dos cifras siguen lado a lado: el tamaño se ajusta al ancho
  // y ninguna se desborda ni se corta. Las dos usan siempre la misma clase.
  const cifra =
    tamano === 'grande'
      ? 'text-[length:clamp(1.375rem,7.5vw,2rem)] leading-tight sm:text-cifra-xl'
      : 'text-[length:clamp(1.25rem,6vw,1.5rem)] leading-tight'
  return (
    <dl className={`grid grid-cols-2 divide-x divide-linea ${className}`}>
      <div className="flex min-w-0 flex-col gap-1 pr-3 sm:pr-4">
        <dt className="text-sm font-medium text-tinta-suave">{etiquetaCuota}</dt>
        <dd className={`${cifra} cifras font-semibold tracking-tight break-words text-tinta`}>
          <Dinero valor={cuota} />
        </dd>
        {explicar ? <dd className="text-xs text-tinta-tenue">Incluye capital, intereses y seguro.</dd> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1 pl-3 sm:pl-4">
        <dt className="text-sm font-medium text-tinta-suave">
          <abbr title="Tasa efectiva anual" className="no-underline">
            TEA
          </abbr>{' '}
          (efectiva anual)
        </dt>
        <dd className={`${cifra} cifras font-semibold tracking-tight break-words text-tinta`}>
          <Porcentaje valor={tea} />
        </dd>
        {explicar ? <dd className="text-xs text-tinta-tenue">Lo que cuesta el dinero en un año, con intereses sobre intereses.</dd> : null}
      </div>
    </dl>
  )
}
