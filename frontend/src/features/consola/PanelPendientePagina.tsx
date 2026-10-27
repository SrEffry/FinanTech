import { Landmark, LineChart } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'

const CONTENIDO = {
  contabilidad: {
    icono: Landmark,
    titulo: 'Desembolsos y contabilidad',
    texto:
      'La autorización de desembolsos, los asientos contables y la conciliación (RF-12 y RF-13) llegan en la segunda entrega. Mientras tanto puedes consultar tu actividad.',
    enlace: { a: '/consola/auditoria', texto: 'Ver mi actividad' },
  },
  directivo: {
    icono: LineChart,
    titulo: 'Tableros e informes',
    texto:
      'Los tableros de originación y el panel de equidad (RF-14) llegan en la segunda entrega. Mientras tanto puedes consultar la auditoría completa.',
    enlace: { a: '/consola/auditoria', texto: 'Ver auditoría' },
  },
}

/** Panel de los roles sin módulo en la primera versión: deben poder entrar (CP0008). */
export default function PanelPendientePagina() {
  const usuario = useUsuario()
  const contenido = CONTENIDO[usuario.rol === 'directivo' ? 'directivo' : 'contabilidad']
  const Icono = contenido.icono
  return (
    <div className="max-w-3xl">
      <EncabezadoPagina titulo={`Hola, ${usuario.nombre_corto}`} descripcion={`${usuario.cargo ?? ''}, ${usuario.area ?? ''}.`} />
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-panel bg-primario-50 text-primario-600">
            <Icono aria-hidden="true" className="size-6" />
          </span>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{contenido.titulo}</h2>
            <p className="leading-relaxed text-tinta-suave">{contenido.texto}</p>
            <ButtonLink to={contenido.enlace.a} variante="secundario" className="self-start">
              {contenido.enlace.texto}
            </ButtonLink>
          </div>
        </div>
      </Panel>
    </div>
  )
}
