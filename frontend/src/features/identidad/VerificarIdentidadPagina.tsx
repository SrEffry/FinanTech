import { useNavigate } from 'react-router'
import { ButtonLink } from '../../components/ui/Button'
import { Alert, Panel } from '../../components/ui/Feedback'
import { EncabezadoPagina } from '../../components/layouts/Comunes'
import { useUsuario } from '../acceso/sesion'
import { VerificacionIdentidad } from './VerificacionIdentidad'

/** Verificación de identidad desde el portal, para quien la dejó para después (RF-02). */
export default function VerificarIdentidadPagina() {
  const usuario = useUsuario()
  const navegar = useNavigate()

  return (
    <div className="mx-auto max-w-2xl">
      <EncabezadoPagina
        titulo="Verifica tu identidad"
        descripcion="Es obligatorio antes de solicitar un crédito: así evitamos que alguien pida un préstamo a tu nombre."
        migas={[{ etiqueta: 'Inicio', a: '/portal' }, { etiqueta: 'Verificar identidad' }]}
      />
      {usuario.estado_kyc === 'verificado' ? (
        <Alert tono="exito" titulo="Tu identidad ya está verificada" accion={<ButtonLink to="/portal/solicitar">Solicitar crédito</ButtonLink>} />
      ) : usuario.estado_kyc === 'revision_manual' ? (
        <Alert tono="info" titulo="Estamos revisando tu identidad">
          Una persona de nuestro equipo revisa tus datos. Te avisaremos por correo en máximo un día hábil.
        </Alert>
      ) : usuario.estado_kyc === 'bloqueado' ? (
        <Alert tono="error" titulo="No podemos continuar con tu vinculación">
          Si necesitas más información, comunícate con nuestros canales de atención.
        </Alert>
      ) : (
        <Panel>
          <VerificacionIdentidad onTerminar={() => navegar('/portal')} />
        </Panel>
      )}
    </div>
  )
}
