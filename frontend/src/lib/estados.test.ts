import { describe, expect, it } from 'vitest'
import type { EstadoSolicitud, HitoEstado } from './api/tipos'
import { construirEtapas, ETIQUETA_CLIENTE, estaActiva } from './estados'

const hito = (estado: EstadoSolicitud, dia: number): HitoEstado => ({ estado, fecha: `2026-10-${String(dia).padStart(2, '0')}T15:00:00.000Z` })

describe('etiquetas para el cliente (RN-36)', () => {
  it('ninguna muestra el nombre técnico del estado', () => {
    for (const [estado, etiqueta] of Object.entries(ETIQUETA_CLIENTE)) {
      expect(etiqueta).not.toBe(estado)
      expect(etiqueta).not.toMatch(/_/)
    }
  })

  it('el comité se ve como "En decisión" y las aprobaciones como "Aprobada"', () => {
    expect(ETIQUETA_CLIENTE.EN_COMITE).toBe('En decisión')
    expect(ETIQUETA_CLIENTE.APROBADA_CONDICIONADA).toBe('Aprobada')
  })

  it('una sola solicitud activa por producto: la negada y la desistida ya no lo están (RN-28)', () => {
    expect(estaActiva('EN_ESTUDIO')).toBe(true)
    expect(estaActiva('NEGADA')).toBe(false)
    expect(estaActiva('DESISTIDA')).toBe(false)
  })
})

describe('construirEtapas (8.2.4)', () => {
  it('aprobación directa: no muestra estudio ni decisión', () => {
    const etapas = construirEtapas([hito('BORRADOR', 1), hito('RADICADA', 1), hito('EN_EVALUACION', 1), hito('APROBADA', 1)], 'APROBADA')
    expect(etapas.map((e) => e.etiqueta)).toEqual(['Radicada', 'En evaluación', 'Aprobada', 'Pagaré firmado'])
    expect(etapas.map((e) => e.estado)).toEqual(['completada', 'completada', 'actual', 'pendiente'])
    expect(etapas[0].fecha).toBe('2026-10-01T15:00:00.000Z')
  })

  it('en estudio: completadas, actual destacada y pendientes', () => {
    const etapas = construirEtapas([hito('RADICADA', 2), hito('EN_EVALUACION', 2), hito('EN_ESTUDIO', 3)], 'EN_ESTUDIO')
    expect(etapas.map((e) => [e.etiqueta, e.estado])).toEqual([
      ['Radicada', 'completada'],
      ['En evaluación', 'completada'],
      ['En estudio', 'actual'],
      ['En decisión', 'pendiente'],
      ['Aprobada', 'pendiente'],
      ['Pagaré firmado', 'pendiente'],
    ])
  })

  it('negada: termina en "No aprobada" sin etapas pendientes', () => {
    const etapas = construirEtapas([hito('RADICADA', 2), hito('EN_EVALUACION', 2), hito('NEGADA', 2)], 'NEGADA')
    expect(etapas.map((e) => e.etiqueta)).toEqual(['Radicada', 'En evaluación', 'No aprobada'])
    expect(etapas[etapas.length - 1]).toMatchObject({ estado: 'actual', tono: 'negado' })
  })

  it('documento pendiente: la etapa alcanzada queda como actual con tono de acción', () => {
    const etapas = construirEtapas([hito('RADICADA', 4), hito('PENDIENTE_CLIENTE', 4)], 'PENDIENTE_CLIENTE')
    expect(etapas[0]).toMatchObject({ etiqueta: 'Radicada', estado: 'actual', tono: 'accion' })
  })
})
