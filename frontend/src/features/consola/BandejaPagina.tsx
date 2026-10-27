import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CircleAlert, CircleCheck, Clock, RotateCcw } from 'lucide-react'
import { obtenerBandeja } from '../../lib/api/consola'
import { obtenerProductos } from '../../lib/api/simulacion'
import type { FiltrosBandeja, ItemBandeja, Semaforo } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { useFiltrosUrl } from '../../lib/useFiltrosUrl'
import { antiguedad, formatoFechaHora, formatoMoneda } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { DataTable, type Columna } from '../../components/ui/DataTable'
import { Field, Select } from '../../components/ui/Field'
import { Alert, Badge } from '../../components/ui/Feedback'
import { MoneyInput } from '../../components/ui/MoneyInput'
import { Skeleton } from '../../components/ui/Spinner'
import { EstadoBadge } from '../../components/dominio/Estado'
import { Indicador } from '../../components/dominio/Evaluacion'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'

const SEMAFORO: Record<Semaforo, { texto: string; clase: string; icono: React.ReactNode }> = {
  a_tiempo: { texto: 'A tiempo', clase: 'text-secundario-700', icono: <CircleCheck aria-hidden="true" className="size-4" /> },
  por_vencer: { texto: 'Por vencer', clase: 'text-advertencia-700', icono: <Clock aria-hidden="true" className="size-4" /> },
  vencida: { texto: 'Vencida', clase: 'text-alerta-700', icono: <CircleAlert aria-hidden="true" className="size-4" /> },
}

/** Semáforo del acuerdo de servicio: ícono y texto, nunca solo color. */
function SemaforoSla({ item }: { item: ItemBandeja }) {
  const s = SEMAFORO[item.semaforo]
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${s.clase}`} title={`Vence ${formatoFechaHora(item.sla_vence_en)}`}>
      {s.icono}
      {s.texto}
    </span>
  )
}

/** Bandeja del analista (8.3.1) y del oficial: indicadores del día, filtros y la cola. */
export default function BandejaPagina() {
  const usuario = useUsuario()
  const esOficial = usuario.rol === 'oficial'
  const url = useFiltrosUrl()
  const filtros: FiltrosBandeja = {
    estado: url.texto('estado'),
    producto: url.texto('producto'),
    monto_min: url.numero('monto_min'),
    monto_max: url.numero('monto_max'),
  }
  const bandeja = useQuery({
    queryKey: ['bandeja', usuario.rol, filtros],
    queryFn: () => obtenerBandeja(filtros),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })
  const productos = useQuery({ queryKey: ['productos'], queryFn: obtenerProductos, staleTime: 10 * 60_000 })

  const destino = (item: ItemBandeja) =>
    esOficial && item.estado === 'EN_DECISION' ? `/consola/decisiones/${item.id}` : `/consola/expedientes/${item.id}`

  const columnas: Columna<ItemBandeja>[] = [
    {
      clave: 'radicado',
      titulo: 'Radicado',
      ordenar: (i) => i.radicado,
      celda: (i) => (
        <span className="flex flex-col gap-0.5">
          <Link to={destino(i)} className="font-semibold text-primario-700 hover:underline">
            {i.radicado}
          </Link>
          {i.reconsideracion ? (
            <span className="inline-flex items-center gap-1 text-xs text-tinta-suave">
              <RotateCcw aria-hidden="true" className="size-3" />
              Reconsideración
            </span>
          ) : null}
        </span>
      ),
    },
    {
      clave: 'cliente',
      titulo: 'Cliente',
      ordenar: (i) => i.cliente,
      celda: (i) => (
        <span className="flex flex-col">
          <span className="font-medium">{i.cliente}</span>
          <span className="text-xs text-tinta-tenue">{i.documento_enmascarado}</span>
        </span>
      ),
    },
    { clave: 'producto', titulo: 'Producto', ordenar: (i) => i.producto, celda: (i) => i.producto },
    { clave: 'monto', titulo: 'Monto', alinear: 'derecha', ordenar: (i) => i.monto, className: 'cifras', celda: (i) => formatoMoneda(i.monto) },
    { clave: 'estado', titulo: 'Estado', ordenar: (i) => i.estado, celda: (i) => <EstadoBadge estado={i.estado} interno /> },
    {
      clave: 'cola',
      titulo: 'En cola',
      ordenar: (i) => -new Date(i.en_cola_desde).getTime(),
      celda: (i) => <span className="cifras text-tinta-suave">{antiguedad(i.en_cola_desde)}</span>,
    },
    { clave: 'sla', titulo: 'Acuerdo de servicio', ordenar: (i) => i.sla_vence_en, celda: (i) => <SemaforoSla item={i} /> },
  ]

  const indicadores = bandeja.data?.indicadores
  const hayFiltros = url.hayFiltros

  return (
    <div>
      <EncabezadoPagina
        titulo={esOficial ? 'Bandeja de decisiones' : 'Bandeja de estudio'}
        descripcion={
          esOficial
            ? `Solicitudes con concepto del analista, esperando decisión. Tu atribución: ${formatoMoneda(usuario.atribucion_monto ?? 0)}.`
            : 'Solicitudes asignadas a ti. Las más próximas a vencer van primero.'
        }
      />

      {indicadores ? (
        <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Asignadas" valor={indicadores.asignadas} />
          <Indicador etiqueta="Atendidas hoy" valor={indicadores.atendidas_hoy} />
          <Indicador etiqueta={esOficial ? 'Esperando decisión' : 'Pendientes de estudio'} valor={indicadores.pendientes} />
          <Indicador etiqueta="Próximas a vencer o vencidas" valor={indicadores.proximas_a_vencer} />
        </dl>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-20" />
          ))}
        </div>
      )}

      {/* Una sola fila de filtros sobre la tabla. */}
      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end" onSubmit={(e) => e.preventDefault()}>
        <Field id="filtro-estado" etiqueta="Estado">
          <Select value={filtros.estado ?? ''} onChange={(e) => url.cambiar({ estado: e.target.value })}>
            <option value="">Todos</option>
            {esOficial ? (
              <>
                <option value="EN_DECISION">En decisión</option>
                <option value="EN_COMITE">En comité</option>
              </>
            ) : (
              <>
                <option value="EN_ESTUDIO">En estudio</option>
                <option value="PENDIENTE_CLIENTE">Pendiente del cliente</option>
              </>
            )}
          </Select>
        </Field>
        <Field id="filtro-producto" etiqueta="Producto">
          <Select value={filtros.producto ?? ''} onChange={(e) => url.cambiar({ producto: e.target.value })}>
            <option value="">Todos</option>
            {productos.data?.map((p) => (
              <option key={p.codigo} value={p.nombre}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="filtro-monto-min" etiqueta="Monto desde">
          <MoneyInput valor={filtros.monto_min} onCambiar={(v) => url.cambiar({ monto_min: v ?? undefined })} />
        </Field>
        <Field id="filtro-monto-max" etiqueta="Monto hasta">
          <MoneyInput valor={filtros.monto_max} onCambiar={(v) => url.cambiar({ monto_max: v ?? undefined })} />
        </Field>
        <Button variante="fantasma" onClick={url.limpiar} disabled={!hayFiltros}>
          Quitar filtros
        </Button>
      </form>

      {bandeja.isError ? <Alert tono="error">{mensajeDe(bandeja.error)}</Alert> : null}
      {bandeja.data ? (
        <div className={bandeja.isFetching && bandeja.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <DataTable
            etiqueta={esOficial ? 'Solicitudes esperando decisión' : 'Solicitudes en estudio'}
            columnas={columnas}
            filas={bandeja.data.solicitudes}
            clave={(i) => i.id}
            vacio={hayFiltros ? 'Ninguna solicitud cumple los filtros.' : 'No tienes solicitudes en la bandeja. Buen trabajo.'}
          />
        </div>
      ) : bandeja.isPending ? (
        <Skeleton className="h-64" />
      ) : null}
      {esOficial ? (
        <p className="mt-3 text-sm text-tinta-tenue">
          <Badge tono="progreso">En comité</Badge> Las solicitudes en comité son solo de consulta: las decide el comité de crédito.
        </p>
      ) : null}
    </div>
  )
}
