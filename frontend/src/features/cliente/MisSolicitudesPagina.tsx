import { useQuery } from '@tanstack/react-query'
import { listarSolicitudes } from '../../lib/api/solicitudes'
import { estaActiva } from '../../lib/estados'
import { mensajeDe } from '../../lib/errores'
import { ButtonLink } from '../../components/ui/Button'
import { Alert, EmptyState } from '../../components/ui/Feedback'
import { Skeleton } from '../../components/ui/Spinner'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'
import { TarjetaSolicitud } from './PanelClientePagina'

/** Mis solicitudes (RF-07): radicado, producto, monto y estado de cada una. */
export default function MisSolicitudesPagina() {
  const usuario = useUsuario()
  const solicitudes = useQuery({ queryKey: ['solicitudes'], queryFn: listarSolicitudes, refetchInterval: 30_000 })
  const lista = solicitudes.data ?? []
  const activas = lista.filter((s) => estaActiva(s.estado))
  const cerradas = lista.filter((s) => !estaActiva(s.estado))

  return (
    <div>
      <EncabezadoPagina
        titulo="Mis solicitudes"
        acciones={
          usuario.estado_kyc === 'verificado' ? <ButtonLink to="/portal/solicitar">Solicitar crédito</ButtonLink> : undefined
        }
      />
      {solicitudes.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : solicitudes.isError ? (
        <Alert tono="error">{mensajeDe(solicitudes.error)}</Alert>
      ) : lista.length === 0 ? (
        <EmptyState titulo="Todavía no tienes solicitudes" accion={<ButtonLink to="/portal/simular">Simular un crédito</ButtonLink>}>
          Cuando radiques una solicitud la verás aquí con su etapa y lo que falta.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          <section aria-labelledby="titulo-activas" className="flex flex-col gap-3">
            <h2 id="titulo-activas" className="text-lg font-semibold">
              En curso
            </h2>
            {activas.length === 0 ? (
              <p className="text-sm text-tinta-suave">No tienes solicitudes en curso.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {activas.map((s) => (
                  <TarjetaSolicitud key={s.id} solicitud={s} />
                ))}
              </ul>
            )}
          </section>
          {cerradas.length > 0 ? (
            <section aria-labelledby="titulo-cerradas" className="flex flex-col gap-3">
              <h2 id="titulo-cerradas" className="text-lg font-semibold">
                Terminadas
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {cerradas.map((s) => (
                  <TarjetaSolicitud key={s.id} solicitud={s} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
