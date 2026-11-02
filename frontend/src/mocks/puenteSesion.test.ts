import { beforeEach, describe, expect, it } from 'vitest'
import { obtenerDb, reiniciarDb } from './db'
import { enlazar } from './handlers/puenteSesion'
import { usuarioSesion } from './utilidades'

/** Modo mixto: la sesión real (Laravel) se enlaza por correo con la base simulada. */
describe('puente de la sesión real con la API simulada', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('enlaza una cuenta de demostración por su correo', () => {
    enlazar({ id: 99, nombre_completo: 'Laura Mejía', nombre_corto: 'Laura', email: 'LAURA.MEJIA@demo.finantech.co', rol: 'cliente' })
    expect(usuarioSesion()?.email).toBe('laura.mejia@demo.finantech.co')
  })

  it('crea en la simulación al cliente nuevo, sin contraseña y con el documento enmascarado', () => {
    enlazar({
      id: 500,
      nombre_completo: 'Ana Pérez Ruiz',
      nombre_corto: 'Ana',
      email: 'ana.perez@ejemplo.co',
      rol: 'cliente',
      estado_kyc: 'pendiente',
      documento_enmascarado: '•••• 4321',
    })
    const local = usuarioSesion()
    expect(local?.password).toBe('')
    expect(local?.num_documento).toBe('•••• 4321')
    expect(local?.apellidos).toBe('Pérez Ruiz')
  })

  it('sin usuario real, cierra la sesión simulada', () => {
    enlazar({ id: 99, nombre_completo: 'Laura Mejía', nombre_corto: 'Laura', email: 'laura.mejia@demo.finantech.co', rol: 'cliente' })
    enlazar(null)
    expect(obtenerDb().sesion_usuario_id).toBeNull()
    expect(usuarioSesion()).toBeNull()
  })
})
