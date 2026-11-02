import { useState } from 'react'
import { Input } from './Field'
import { escribirDecimal, leerDecimal } from '../../lib/numeros'

/**
 * Mantiene el texto que la persona escribe y solo lo reemplaza si el valor cambia desde
 * fuera (por ejemplo, al reiniciar el formulario). Así "24," no pierde la coma (UX-08).
 */
function useTextoNumerico(valor: number | null | undefined, leer: (t: string) => number | null, escribir: (v: number | null | undefined) => string) {
  const [texto, setTexto] = useState(() => escribir(valor))
  const [anterior, setAnterior] = useState(valor)
  if (valor !== anterior) {
    setAnterior(valor)
    // Vacío equivale a 0: si quien usa el campo guarda 0 al borrarlo, el texto sigue vacío.
    if ((leer(texto) ?? 0) !== (valor ?? 0)) setTexto(escribir(valor))
  }
  return [texto, setTexto] as const
}

interface PropsDecimal {
  valor: number | null | undefined
  onCambiar: (valor: number | null) => void
  onBlur?: () => void
  decimales?: number
  name?: string
  disabled?: boolean
  className?: string
  /** Texto que acompaña al campo, por ejemplo "% E.A.". */
  sufijo?: string
}

/**
 * Tasa en porcentaje (UX-08, RI-04): acepta coma o punto, deja borrar el campo y al salir
 * lo escribe con coma y sus decimales. El sufijo se ve, pero el lector lo oye en la etiqueta.
 */
export function PercentInput({ valor, onCambiar, onBlur, decimales = 2, name, disabled, className = '', sufijo = '%' }: PropsDecimal) {
  const escribir = (v: number | null | undefined) => escribirDecimal(v, decimales)
  const [texto, setTexto] = useTextoNumerico(valor, leerDecimal, escribir)
  return (
    <div className={`relative ${className}`}>
      <Input
        name={name}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={texto}
        onChange={(e) => {
          // Solo dígitos y un separador decimal, con los decimales permitidos.
          const [entero = '', ...resto] = e.target.value.replace(/[^\d.,]/g, '').split(/[.,]/)
          const separador = e.target.value.match(/[.,]/)?.[0]
          const nuevo = separador !== undefined ? `${entero.slice(0, 3)}${separador}${resto.join('').slice(0, decimales)}` : entero.slice(0, 3)
          setTexto(nuevo)
          onCambiar(leerDecimal(nuevo))
        }}
        onBlur={() => {
          const leido = leerDecimal(texto)
          setTexto(escribir(leido))
          onBlur?.()
        }}
        className="cifras pr-10"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-tinta-tenue">
        {sufijo}
      </span>
    </div>
  )
}

interface PropsEntero {
  valor: number | null | undefined
  onCambiar: (valor: number | null) => void
  onBlur?: () => void
  name?: string
  disabled?: boolean
  className?: string
  maximoDigitos?: number
}

/** Número entero (plazos, meses) que se puede dejar vacío mientras se escribe (UX-08). */
export function EnteroInput({ valor, onCambiar, onBlur, name, disabled, className = '', maximoDigitos = 4 }: PropsEntero) {
  const leer = (t: string) => (t === '' ? null : Number(t))
  const escribir = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '' : String(v))
  const [texto, setTexto] = useTextoNumerico(valor, leer, escribir)
  return (
    <Input
      name={name}
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      value={texto}
      onChange={(e) => {
        const nuevo = e.target.value.replace(/\D/g, '').slice(0, maximoDigitos)
        setTexto(nuevo)
        onCambiar(leer(nuevo))
      }}
      onBlur={onBlur}
      className={`cifras ${className}`}
    />
  )
}
