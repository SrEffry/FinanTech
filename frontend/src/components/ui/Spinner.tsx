export function Spinner({ tamano = 'md', etiqueta }: { tamano?: 'sm' | 'md' | 'lg'; etiqueta?: string }) {
  const medida = tamano === 'sm' ? 'size-4 border-2' : tamano === 'lg' ? 'size-10 border-[3px]' : 'size-6 border-2'
  return (
    <span className="inline-flex items-center gap-2" role={etiqueta ? 'status' : undefined}>
      <span
        aria-hidden="true"
        className={`${medida} animate-spin rounded-full border-current border-r-transparent opacity-80`}
      />
      {etiqueta ? <span className="text-sm text-tinta-suave">{etiqueta}</span> : null}
    </span>
  )
}

/** Carga de página completa: se usa en las rutas diferidas y mientras se consulta la sesión. */
export function CargaPagina({ etiqueta = 'Cargando…' }: { etiqueta?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-primario-600">
      <Spinner tamano="lg" etiqueta={etiqueta} />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-campo bg-linea-suave ${className}`} />
}
