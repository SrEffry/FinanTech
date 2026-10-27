import { describe, expect, it } from 'vitest'
import { ErrorApi, interpretarError } from './cliente'

describe('interpretarError: decide por la forma del cuerpo, no por el estado', () => {
  it('toma el código y el mensaje de un error de negocio (ErrorNegocio)', () => {
    const error = interpretarError(422, {
      codigo: 'codigo_incorrecto',
      mensaje: 'Alguno de los códigos no es correcto.',
      datos: { intentos_restantes: 4 },
    })
    expect(error).toBeInstanceOf(ErrorApi)
    expect(error.codigo).toBe('codigo_incorrecto')
    expect(error.message).toBe('Alguno de los códigos no es correcto.')
    expect(error.datos).toEqual({ intentos_restantes: 4 })
  })

  it('reparte los errores de validación de Laravel por campo', () => {
    const error = interpretarError(422, {
      message: 'El celular no es válido. (y 1 error más)',
      errors: { telefono: ['Ingresa un celular colombiano de 10 dígitos que empiece por 3.'], email: ['El correo es obligatorio.'] },
    })
    expect(error.codigo).toBe('validacion')
    expect(error.campos).toEqual({
      telefono: 'Ingresa un celular colombiano de 10 dígitos que empiece por 3.',
      email: 'El correo es obligatorio.',
    })
    expect(error.message).toBe('Ingresa un celular colombiano de 10 dígitos que empiece por 3.')
  })

  it('distingue el 429 del throttle del 429 de negocio', () => {
    expect(interpretarError(429, { message: 'Too Many Attempts.' }).codigo).toBe('demasiados_intentos')
    expect(interpretarError(429, { codigo: 'reenvio_muy_pronto', mensaje: 'Espera 60 segundos.' }).codigo).toBe('reenvio_muy_pronto')
  })

  it('nunca muestra el mensaje técnico del framework (RNF-09)', () => {
    const error = interpretarError(500, { message: 'SQLSTATE[HY000] Connection refused', exception: 'PDOException', trace: [] })
    expect(error.codigo).toBe('error_servidor')
    expect(error.message).not.toContain('SQLSTATE')
    expect(error.message).toMatch(/de nuestro lado/)
  })

  it('traduce los estados conocidos a mensajes en español', () => {
    expect(interpretarError(0, undefined).codigo).toBe('sin_conexion')
    expect(interpretarError(401, undefined).codigo).toBe('sin_sesion')
    expect(interpretarError(403, {}).codigo).toBe('sin_permiso')
    expect(interpretarError(404, { message: 'No query results for model' }).message).toBe(
      'No encontramos lo que buscas. Puede que ya no exista.',
    )
  })
})
