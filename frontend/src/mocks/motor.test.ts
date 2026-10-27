import { beforeEach, describe, expect, it } from 'vitest'
import { obtenerDb, reiniciarDb } from './db'
import { calcularEvaluacion, consultarCentral, perfilCentral } from './motor'

describe('motor de reglas simulado (RF-08)', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('no usa variables prohibidas ni sus aproximaciones (RN-43)', () => {
    const prohibidas = /sexo|g[eé]nero|civil|c[oó]nyuge|parentesco|[eé]tni|raza|religi|pol[ií]tic|salud|discapacidad|embarazo/i
    const { evaluaciones } = obtenerDb()
    expect(evaluaciones.length).toBeGreaterThan(5)
    for (const evaluacion of evaluaciones) {
      for (const variable of evaluacion.variables) {
        expect(`${variable.codigo} ${variable.nombre}`).not.toMatch(prohibidas)
      }
    }
  })

  it('cada evaluación guarda su versión de reglas y sus variables determinantes', () => {
    for (const evaluacion of obtenerDb().evaluaciones) {
      expect(evaluacion.version_reglas).toMatch(/^R-\d{4}\.\d{2}-\d+$/)
      expect(evaluacion.variables.length).toBeGreaterThan(0)
    }
  })

  it('aplica los umbrales: ≥ 700 aprueba, 500 a 699 escala, < 500 niega', () => {
    for (const e of obtenerDb().evaluaciones) {
      const esperada = e.puntaje >= 700 ? 'aprobar' : e.puntaje < 500 ? 'negar' : 'escalar'
      if (esperada === 'aprobar' && e.capacidad_pago.supera_limite) expect(e.decision_sugerida).toBe('escalar')
      else expect(e.decision_sugerida).toBe(esperada)
    }
  })

  it('con la cuota por encima del 40 % del disponible nunca aprueba (RN-41)', () => {
    const db = obtenerDb()
    const solicitud = structuredClone(db.solicitudes.find((s) => s.id === 'sol-1003')!)
    const cliente = db.usuarios.find((u) => u.id === solicitud.cliente_id)!
    solicitud.financiero = { ingreso_mensual: 1_000_000, egreso_mensual: 600_000 }
    const parametros = db.parametros[db.parametros.length - 1]
    const central = consultarCentral(cliente, 1_000_000, new Date())
    const evaluacion = calcularEvaluacion('ev-prueba', solicitud, cliente, central, parametros, new Date())
    expect(evaluacion.capacidad_pago.supera_limite).toBe(true)
    expect(evaluacion.decision_sugerida).not.toBe('aprobar')
  })

  it('el perfil sintético es estable por documento', () => {
    expect(perfilCentral('1020456782')).toBe(perfilCentral('1020456782'))
    expect(perfilCentral('1020456782')).toBeGreaterThanOrEqual(0)
    expect(perfilCentral('1020456782')).toBeLessThan(1)
  })

  it('la semilla deja cada solicitud en un estado coherente con su evaluación', () => {
    const { solicitudes, evaluaciones } = obtenerDb()
    for (const s of solicitudes) {
      const e = evaluaciones.find((x) => x.id === s.evaluacion_id)
      if (!e) continue
      if (['EN_DECISION', 'EN_COMITE', 'APROBADA_CONDICIONADA'].includes(s.estado) || (s.estado === 'EN_ESTUDIO' && !s.reconsideracion)) {
        expect(e.decision_sugerida, `${s.id} en ${s.estado}`).toBe('escalar')
      }
      if (s.estado === 'NEGADA' || s.reconsideracion) expect(e.decision_sugerida, s.id).toBe('negar')
    }
  })
})
