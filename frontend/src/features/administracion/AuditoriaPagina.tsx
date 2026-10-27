import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, Download } from 'lucide-react'
import { consultarAuditoria, exportarAuditoria } from '../../lib/api/administracion'
import type { FiltrosAuditoria, RegistroAuditoria } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { useFiltrosUrl } from '../../lib/useFiltrosUrl'
import { formatoFechaHora } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { DataTable, type Columna } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'
import { Skeleton } from '../../components/ui/Spinner'
import { DistintivoSimulado } from '../../components/dominio/Distintivos'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'

const ROL: Record<RegistroAuditoria['rol'], string> = {
  cliente: 'Cliente',
  analista: 'Analista',
  oficial: 'Oficial',
  contabilidad: 'Contabilidad',
  directivo: 'Directivo',
  administrador: 'Administrador',
  sistema: 'Sistema',
}

/**
 * Auditoría (8.6.3, UC17): solo lectura, sin edición ni borrado. Administrador y directivo
 * ven todo; oficial y contabilidad, solo su propia actividad.
 */
export default function AuditoriaPagina() {
  const usuario = useUsuario()
  const completa = usuario.rol === 'administrador' || usuario.rol === 'directivo'
  const url = useFiltrosUrl()
  const filtros: FiltrosAuditoria = {
    actor: url.texto('actor'),
    entidad: url.texto('entidad'),
    accion: url.texto('accion'),
    desde: url.texto('desde'),
    hasta: url.texto('hasta'),
    pagina: url.numero('pagina') ?? 1,
  }
  const auditoria = useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: () => consultarAuditoria(filtros),
    placeholderData: keepPreviousData,
  })
  const exportacion = useMutation({ mutationFn: () => exportarAuditoria(filtros) })

  // Cambiar un filtro vuelve a la primera página.
  const filtrar = (cambios: Partial<FiltrosAuditoria>) => url.cambiar({ ...cambios, pagina: undefined })

  const columnas: Columna<RegistroAuditoria>[] = [
    { clave: 'momento', titulo: 'Momento', celda: (r) => <span className="whitespace-nowrap text-tinta-suave">{formatoFechaHora(r.momento)}</span> },
    {
      clave: 'actor',
      titulo: 'Actor',
      celda: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.actor}</span>
          <span className="text-xs text-tinta-tenue">{ROL[r.rol]}</span>
        </span>
      ),
    },
    {
      clave: 'accion',
      titulo: 'Acción',
      celda: (r) => (
        <span className="flex flex-col items-start gap-1">
          {r.accion}
          {r.simulado ? <DistintivoSimulado que="Simulado" /> : null}
        </span>
      ),
    },
    {
      clave: 'entidad',
      titulo: 'Entidad',
      celda: (r) => (
        <span className="flex flex-col">
          <span className="capitalize">{r.entidad}</span>
          <span className="text-xs text-tinta-tenue">{r.entidad_id}</span>
        </span>
      ),
    },
    { clave: 'origen', titulo: 'Origen', celda: (r) => <span className="text-tinta-suave">{r.origen}</span> },
    {
      clave: 'resultado',
      titulo: 'Resultado',
      celda: (r) =>
        r.resultado === 'exito' ? (
          <span className="inline-flex items-center gap-1.5 text-secundario-700">
            <CircleCheck aria-hidden="true" className="size-4" />
            Éxito
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-alerta-700">
            <CircleX aria-hidden="true" className="size-4" />
            Rechazado
          </span>
        ),
    },
  ]

  const datos = auditoria.data
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1

  return (
    <div>
      <EncabezadoPagina
        titulo={completa ? 'Auditoría' : 'Mi actividad'}
        descripcion="Registro de solo adición: nada se edita ni se borra. Las correcciones quedan como registros nuevos."
        acciones={
          <Button variante="secundario" icono={<Download aria-hidden="true" className="size-4" />} cargando={exportacion.isPending} onClick={() => exportacion.mutate()}>
            Exportar evidencias
          </Button>
        }
      />

      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" onSubmit={(e) => e.preventDefault()}>
        {completa ? (
          <Field id="filtro-actor" etiqueta="Usuario">
            <Input type="search" placeholder="Nombre" value={filtros.actor ?? ''} onChange={(e) => filtrar({ actor: e.target.value || undefined })} />
          </Field>
        ) : null}
        <Field id="filtro-entidad" etiqueta="Entidad">
          <Select value={filtros.entidad ?? ''} onChange={(e) => filtrar({ entidad: e.target.value || undefined })}>
            <option value="">Todas</option>
            {datos?.entidades.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="filtro-accion" etiqueta="Acción">
          <Select value={filtros.accion ?? ''} onChange={(e) => filtrar({ accion: e.target.value || undefined })}>
            <option value="">Todas</option>
            {datos?.acciones.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="filtro-desde" etiqueta="Desde">
          <Input type="date" value={filtros.desde ?? ''} onChange={(e) => filtrar({ desde: e.target.value || undefined })} />
        </Field>
        <Field id="filtro-hasta" etiqueta="Hasta">
          <Input type="date" value={filtros.hasta ?? ''} onChange={(e) => filtrar({ hasta: e.target.value || undefined })} />
        </Field>
      </form>

      {exportacion.isError ? <Alert tono="error" className="mb-4">{mensajeDe(exportacion.error)}</Alert> : null}
      {auditoria.isError ? <Alert tono="error">{mensajeDe(auditoria.error)}</Alert> : null}
      {datos ? (
        <div className={auditoria.isFetching && auditoria.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <DataTable etiqueta="Registros de auditoría" columnas={columnas} filas={datos.registros} clave={(r) => r.id} vacio="Ningún registro cumple los filtros." />
          <nav aria-label="Páginas de la auditoría" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-tinta-suave">
              {datos.total} registros, página {datos.pagina} de {paginas}
            </p>
            <div className="flex gap-2">
              <Button variante="secundario" tamano="sm" disabled={datos.pagina <= 1} onClick={() => url.cambiar({ pagina: datos.pagina - 1 })}>
                Anterior
              </Button>
              <Button variante="secundario" tamano="sm" disabled={datos.pagina >= paginas} onClick={() => url.cambiar({ pagina: datos.pagina + 1 })}>
                Siguiente
              </Button>
            </div>
          </nav>
        </div>
      ) : auditoria.isPending ? (
        <Skeleton className="h-96" />
      ) : null}
    </div>
  )
}
