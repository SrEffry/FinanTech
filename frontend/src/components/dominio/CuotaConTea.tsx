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
  const cifra = tamano === 'grande' ? 'text-cifra sm:text-cifra-xl' : 'text-2xl'
  return (
    <dl className={`grid grid-cols-2 divide-x divide-linea ${className}`}>
      <div className="flex flex-col gap-1 pr-4">
        <dt className="text-sm font-medium text-tinta-suave">{etiquetaCuota}</dt>
        <dd className={`${cifra} font-semibold tracking-tight text-tinta`}>
          <Dinero valor={cuota} />
        </dd>
        {explicar ? <dd className="text-xs text-tinta-tenue">Incluye capital, intereses y seguro.</dd> : null}
      </div>
      <div className="flex flex-col gap-1 pl-4">
        <dt className="text-sm font-medium text-tinta-suave">
          <abbr title="Tasa efectiva anual" className="no-underline">
            TEA
          </abbr>{' '}
          (efectiva anual)
        </dt>
        <dd className={`${cifra} font-semibold tracking-tight text-tinta`}>
          <Porcentaje valor={tea} />
        </dd>
        {explicar ? <dd className="text-xs text-tinta-tenue">Lo que cuesta el dinero en un año, con intereses sobre intereses.</dd> : null}
      </div>
    </dl>
  )
}
