import { useEffect, useState } from 'react'
import { formatoCuentaRegresiva, segundosHasta } from '../../lib/formato'
import { Field, Input } from './Field'

interface Props {
  id: string
  etiqueta: string
  valor: string
  onCambiar: (valor: string) => void
  error?: string
  ayuda?: string
  /** Lleva el foco al campo: en las pantallas de código es lo único que la persona va a escribir. */
  enfocar?: boolean
}

/**
 * Código de 6 dígitos en un solo campo: el teclado numérico aparece en el celular y el
 * navegador puede autocompletarlo desde el SMS (autocomplete="one-time-code").
 */
export function CodeInput({ id, etiqueta, valor, onCambiar, error, ayuda, enfocar }: Props) {
  return (
    <Field id={id} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <Input
        inputMode="numeric"
        spellCheck={false}
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={valor}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={enfocar}
        onChange={(e) => onCambiar(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="cifras max-w-48 text-center text-2xl font-semibold tracking-[0.5em]"
      />
    </Field>
  )
}

/** Segundos que faltan hasta `iso`, actualizados cada segundo. */
export function useCuentaRegresiva(iso: string | null | undefined): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [iso])
  return iso ? segundosHasta(iso, ahora) : 0
}

/** Temporizador de vigencia y botón de reenvío habilitado a los 60 s (8.1.3). */
export function TemporizadorCodigo({
  expiraEn,
  reenvioEn,
  onReenviar,
  reenviando,
}: {
  expiraEn: string
  reenvioEn: string
  onReenviar: () => void
  reenviando: boolean
}) {
  const vigencia = useCuentaRegresiva(expiraEn)
  const espera = useCuentaRegresiva(reenvioEn)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <p className="text-tinta-suave" aria-live="off">
        {vigencia > 0 ? (
          <>
            El código vence en <span className="cifras font-semibold text-tinta">{formatoCuentaRegresiva(vigencia)}</span>
          </>
        ) : (
          <span className="font-semibold text-alerta-700">El código venció. Pide uno nuevo.</span>
        )}
      </p>
      <button
        type="button"
        onClick={onReenviar}
        disabled={espera > 0 || reenviando}
        className="min-h-11 rounded-campo font-semibold text-primario-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-tinta-tenue disabled:no-underline"
      >
        {espera > 0 ? `Reenviar código en ${espera} s` : reenviando ? 'Reenviando…' : 'Reenviar código'}
      </button>
    </div>
  )
}
