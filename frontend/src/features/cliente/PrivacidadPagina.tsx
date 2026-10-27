import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { cambiarConsentimiento, obtenerConsentimientos } from '../../lib/api/identidad'
import type { FinalidadConEstado } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { formatoFecha, formatoFechaHora } from '../../lib/formato'
import { Button } from '../../components/ui/Button'
import { Switch } from '../../components/ui/Choice'
import { Alert, Badge, Panel } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { CargaPagina } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'

/**
 * Mis datos y privacidad (8.2.7, RF-04). Cada cambio queda como un registro nuevo: el
 * histórico no se edita (RN-22). Los derechos de acceso, rectificación y supresión son de
 * la segunda entrega (RF-15).
 */
export default function PrivacidadPagina() {
  const usuario = useUsuario()
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const [confirmar, setConfirmar] = useState<FinalidadConEstado | null>(null)
  const consentimientos = useQuery({ queryKey: ['consentimientos'], queryFn: obtenerConsentimientos })

  const cambio = useMutation({
    mutationFn: ({ finalidad, otorgar }: { finalidad: FinalidadConEstado; otorgar: boolean }) =>
      cambiarConsentimiento(finalidad.codigo, otorgar ? 'otorga' : 'revoca'),
    onSuccess: (datos, { finalidad, otorgar }) => {
      cliente.setQueryData(['consentimientos'], datos)
      setConfirmar(null)
      avisar(otorgar ? `Autorizaste: ${finalidad.nombre}.` : `Revocaste: ${finalidad.nombre}. Surte efecto en máximo 24 horas.`)
    },
    onError: (error) => avisar(mensajeDe(error), 'error'),
  })

  if (consentimientos.isPending) return <CargaPagina />
  if (consentimientos.isError) return <Alert tono="error">{mensajeDe(consentimientos.error)}</Alert>
  const { politica, finalidades, historial } = consentimientos.data

  function alternar(finalidad: FinalidadConEstado, otorgar: boolean) {
    // RF-04 FA-01: revocar una finalidad necesaria termina la relación; se confirma antes.
    if (finalidad.necesaria && !otorgar) setConfirmar(finalidad)
    else cambio.mutate({ finalidad, otorgar })
  }

  const grupos = [
    { titulo: 'Necesarias para darte el servicio', lista: finalidades.filter((f) => f.necesaria) },
    { titulo: 'Opcionales', lista: finalidades.filter((f) => !f.necesaria) },
  ]

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <EncabezadoPagina
        titulo="Mis datos y privacidad"
        descripcion={`Política de tratamiento de datos versión ${politica.version}, vigente desde el ${formatoFecha(`${politica.vigente_desde}T12:00:00`)}.`}
      />

      <Panel titulo="Tus datos">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-tinta-tenue">Nombre</dt>
            <dd className="font-medium">{usuario.nombre_completo}</dd>
          </div>
          <div>
            <dt className="text-tinta-tenue">Documento</dt>
            <dd className="font-medium">{usuario.documento_enmascarado}</dd>
          </div>
          <div>
            <dt className="text-tinta-tenue">Correo</dt>
            <dd className="font-medium">{usuario.email}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-tinta-tenue">
          Pedir una copia de tus datos, corregirlos o suprimirlos estará disponible aquí en la próxima versión.
        </p>
      </Panel>

      {grupos.map((grupo) => (
        <Panel key={grupo.titulo} titulo={grupo.titulo}>
          <ul className="flex flex-col divide-y divide-linea-suave">
            {grupo.lista.map((f) => (
              <li key={f.codigo} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1">
                  <span id={`nombre-${f.codigo}`} className="flex items-center gap-2 font-medium">
                    {f.necesaria ? <Lock aria-hidden="true" className="size-4 text-tinta-tenue" /> : null}
                    {f.nombre}
                  </span>
                  <span id={`descripcion-${f.codigo}`} className="text-sm text-tinta-suave">
                    {f.descripcion}
                  </span>
                  {f.actualizada_en ? (
                    <span className="text-xs text-tinta-tenue">
                      {f.otorgada ? 'Autorizada' : 'Revocada'} el {formatoFecha(f.actualizada_en)}
                    </span>
                  ) : null}
                </div>
                <Switch
                  id={`finalidad-${f.codigo}`}
                  etiqueta={f.nombre}
                  describedBy={`descripcion-${f.codigo}`}
                  activo={f.otorgada}
                  disabled={cambio.isPending}
                  onCambiar={(otorgar) => alternar(f, otorgar)}
                />
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <Panel titulo="Historial de autorizaciones" descripcion="Cada cambio queda registrado con su fecha. Este historial no se puede editar.">
        <div role="region" aria-label="Historial de autorizaciones" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-tinta-suave">
                <th scope="col" className="py-2 pr-3 font-semibold">Fecha</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Finalidad</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Acción</th>
                <th scope="col" className="py-2 font-semibold">Versión</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.id} className="border-b border-linea-suave last:border-b-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-tinta-suave">{formatoFechaHora(h.fecha_registro)}</td>
                  <td className="py-2.5 pr-3">{h.nombre_finalidad}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tono={h.accion === 'otorga' ? 'exito' : 'neutro'}>{h.accion === 'otorga' ? 'Autorizó' : 'Revocó'}</Badge>
                  </td>
                  <td className="py-2.5 text-tinta-suave">{h.version_politica}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        abierto={confirmar !== null}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Revocar una autorización necesaria?"
        descripcion={
          confirmar ? (
            <>
              Sin <span className="font-semibold text-tinta">{confirmar.nombre.toLowerCase()}</span> no podemos seguir prestándote el
              servicio: tu relación con FinanTech y tus productos terminan. La revocación surte efecto en máximo 24 horas.
            </>
          ) : null
        }
        acciones={
          <>
            <Button variante="secundario" onClick={() => setConfirmar(null)}>
              Mantener autorización
            </Button>
            <Button
              variante="peligro"
              cargando={cambio.isPending}
              onClick={() => confirmar && cambio.mutate({ finalidad: confirmar, otorgar: false })}
            >
              Revocar y terminar la relación
            </Button>
          </>
        }
      />
    </div>
  )
}
