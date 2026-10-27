import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { cargarDocumento } from '../../lib/api/solicitudes'
import type { DocumentoSolicitud } from '../../lib/api/tipos'
import { mensajeDe } from '../../lib/errores'
import { FileDrop } from '../../components/ui/FileDrop'
import { Badge } from '../../components/ui/Feedback'
import { useToast } from '../../components/ui/Toast'

const ESTADO = {
  pendiente: { texto: 'Pendiente', tono: 'neutro' as const, icono: <Clock aria-hidden="true" className="size-3.5" /> },
  cargado: { texto: 'Cargado', tono: 'progreso' as const, icono: <CircleCheck aria-hidden="true" className="size-3.5" /> },
  aprobado: { texto: 'Aprobado', tono: 'exito' as const, icono: <CircleCheck aria-hidden="true" className="size-3.5" /> },
  rechazado: { texto: 'Rechazado', tono: 'negado' as const, icono: <CircleAlert aria-hidden="true" className="size-3.5" /> },
}

/**
 * Documentos de la solicitud con su estado y el motivo concreto del rechazo (8.2.3,
 * RF-06 FA-02): se reemplaza solo el rechazado, sin perder el resto.
 */
export function DocumentosSolicitud({
  solicitudId,
  documentos,
  editable,
}: {
  solicitudId: string
  documentos: DocumentoSolicitud[]
  editable: boolean
}) {
  const cliente = useQueryClient()
  const { avisar } = useToast()
  const [cargando, setCargando] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const carga = useMutation({
    mutationFn: ({ tipo, archivo }: { tipo: string; archivo: File }) => cargarDocumento(solicitudId, tipo, archivo),
    onMutate: ({ tipo }) => {
      setCargando(tipo)
      setErrores((e) => ({ ...e, [tipo]: '' }))
    },
    onSuccess: (documento) => {
      avisar(`${documento.nombre}: cargado.`)
      cliente.invalidateQueries({ queryKey: ['solicitud', solicitudId] })
    },
    onError: (error, { tipo }) => setErrores((e) => ({ ...e, [tipo]: mensajeDe(error) })),
    onSettled: () => setCargando(null),
  })

  if (documentos.length === 0) {
    return <p className="text-sm text-tinta-suave">Elige tu ocupación para ver qué documentos necesitamos.</p>
  }

  return (
    <ul className="flex flex-col gap-4">
      {documentos.map((d) => {
        const estado = ESTADO[d.estado]
        return (
          <li key={d.tipo} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-medium">
                  {d.nombre}
                  {d.requerido ? null : <span className="font-normal text-tinta-tenue"> (opcional)</span>}
                </span>
                <span className="text-sm text-tinta-tenue">{d.descripcion}</span>
              </div>
              <Badge tono={estado.tono} icono={estado.icono}>
                {estado.texto}
              </Badge>
            </div>
            {d.estado === 'rechazado' && d.motivo_rechazo ? (
              <p className="rounded-campo bg-alerta-50 px-3 py-2 text-sm text-alerta-700">
                <span className="font-semibold">Por qué lo rechazamos: </span>
                {d.motivo_rechazo}
              </p>
            ) : null}
            {editable ? (
              <FileDrop
                etiqueta={d.archivo ? 'Reemplazar archivo' : `Subir ${d.nombre.toLowerCase()}`}
                captura="environment"
                archivoActual={d.archivo && d.estado !== 'rechazado' ? { nombre: d.archivo.nombre, tamano: d.archivo.tamano } : null}
                onSeleccionar={(archivo) => carga.mutate({ tipo: d.tipo, archivo })}
                cargando={cargando === d.tipo}
                error={errores[d.tipo] || null}
              />
            ) : d.archivo ? (
              <p className="text-sm text-tinta-suave">{d.archivo.nombre}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
