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
  // del bloque que las contiene (cqi), no al de la ventana, así no se parten dentro de un
  // recibo o un panel angosto. Las dos usan siempre la misma clase.
  const cifra =
    tamano === 'grande'
      ? 'text-[length:clamp(1.25rem,8cqi,2.75rem)] leading-tight'
      : 'text-[length:clamp(1.125rem,6.5cqi,1.5rem)] leading-tight'
  return (
    // Subgrid: etiqueta, cifra y explicación comparten filas entre las dos columnas, así la
    // cuota y la TEA quedan a la misma altura aunque una etiqueta ocupe dos líneas (320 px).
    <dl className={`@container grid grid-cols-2 gap-y-1 divide-x divide-linea ${explicar ? 'grid-rows-[auto_auto_auto]' : 'grid-rows-[auto_auto]'} ${className}`}>
      <div className={`grid min-w-0 grid-rows-subgrid pr-3 sm:pr-4 ${explicar ? 'row-span-3' : 'row-span-2'}`}>
        <dt className="self-end text-sm font-medium text-tinta-suave">{etiquetaCuota}</dt>
        <dd className={`${cifra} cifras font-semibold tracking-tight break-words text-tinta`}>
          <Dinero valor={cuota} />
        </dd>
        {explicar ? <dd className="text-xs text-tinta-tenue">Incluye capital, intereses y seguro.</dd> : null}
      </div>
      <div className={`grid min-w-0 grid-rows-subgrid pl-3 sm:pl-4 ${explicar ? 'row-span-3' : 'row-span-2'}`}>
        <dt className="self-end text-sm font-medium text-tinta-suave">
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
