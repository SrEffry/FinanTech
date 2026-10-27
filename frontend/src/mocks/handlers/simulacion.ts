import { http, HttpResponse } from 'msw'
import type { Simulacion } from '../../lib/api/tipos'
import { formatoMoneda } from '../../lib/formato'
import { calcularCredito } from '../calculos'
import { parametrosVigentes } from '../db'
import { API, errorNegocio, leerJson, manejar } from '../utilidades'

const DIA = 86_400_000

export const handlersSimulacion = [
  // Públicos: el visitante también puede simular (RF-05 FA-02).
  http.get(
    `${API}/cliente/productos`,
    manejar(() => HttpResponse.json(parametrosVigentes().productos)),
  ),

  http.post(
    `${API}/cliente/simulaciones`,
    manejar(async ({ request }) => {
      const { producto: codigo, monto = 0, plazo_meses: plazo = 0 } = await leerJson<{
        producto: string
        monto: number
        plazo_meses: number
      }>(request)
      const parametros = parametrosVigentes()
      const producto = parametros.productos.find((p) => p.codigo === codigo)
      if (!producto) return errorNegocio('producto_invalido', 'Elige uno de los productos disponibles.')

      // RF-05 FA-01: fuera de rango se informa el rango para que el portal ajuste el valor.
      if (monto < producto.monto_min || monto > producto.monto_max) {
        return errorNegocio(
          'fuera_de_rango',
          `El monto debe estar entre ${formatoMoneda(producto.monto_min)} y ${formatoMoneda(producto.monto_max)}.`,
          422,
          { campo: 'monto', minimo: producto.monto_min, maximo: producto.monto_max },
        )
      }
      if (plazo < producto.plazo_min || plazo > producto.plazo_max) {
        return errorNegocio(
          'fuera_de_rango',
          `El plazo debe estar entre ${producto.plazo_min} y ${producto.plazo_max} meses.`,
          422,
          { campo: 'plazo_meses', minimo: producto.plazo_min, maximo: producto.plazo_max },
        )
      }

      const credito = calcularCredito(producto.tasa_ea, monto, plazo, parametros.tasa_maxima_legal_ea)
      const simulacion: Simulacion = {
        id: crypto.randomUUID(),
        producto: { codigo: producto.codigo, nombre: producto.nombre },
        monto,
        plazo_meses: plazo,
        ...credito,
        tasa_maxima_legal_ea: parametros.tasa_maxima_legal_ea,
        vigente_hasta: new Date(Date.now() + 30 * DIA).toISOString(),
      }
      return HttpResponse.json(simulacion)
    }),
  ),
]
