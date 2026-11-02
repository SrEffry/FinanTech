import { describe, expect, it } from 'vitest'
import { rutaSegura } from './sesion'

describe('rutaSegura: el ?volver= solo lleva a rutas internas', () => {
  it('acepta rutas del portal con su consulta', () => {
    expect(rutaSegura('/portal/solicitudes/s-1')).toBe('/portal/solicitudes/s-1')
    expect(rutaSegura('/portal/solicitar?producto=libre&monto=5000000')).toBe('/portal/solicitar?producto=libre&monto=5000000')
  })

  it('rechaza destinos externos (redirección abierta)', () => {
    expect(rutaSegura('https://otro-sitio.co')).toBeNull()
    expect(rutaSegura('//otro-sitio.co/portal')).toBeNull()
    expect(rutaSegura('/\\otro-sitio.co')).toBeNull()
    expect(rutaSegura('javascript:alert(1)')).toBeNull()
  })

  it('no vuelve a las pantallas de acceso ni acepta valores vacíos', () => {
    expect(rutaSegura('/ingresar/verificacion')).toBeNull()
    expect(rutaSegura('/registro')).toBeNull()
    expect(rutaSegura('')).toBeNull()
    expect(rutaSegura(null)).toBeNull()
  })
})
