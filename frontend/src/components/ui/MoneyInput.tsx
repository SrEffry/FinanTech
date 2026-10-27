import { Input } from './Field'

interface Props {
  valor: number | null | undefined
  onCambiar: (valor: number | null) => void
  onBlur?: () => void
  name?: string
  disabled?: boolean
  placeholder?: string
}

/** Campo de dinero con separador de miles mientras se escribe ("1.250.000"). */
export function MoneyInput({ valor, onCambiar, onBlur, name, disabled, placeholder = '0' }: Props) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-tinta-tenue">
        $
      </span>
      <Input
        name={name}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={valor === null || valor === undefined ? '' : valor.toLocaleString('es-CO')}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').slice(0, 12)
          onCambiar(digitos === '' ? null : Number(digitos))
        }}
        onBlur={onBlur}
        className="cifras pl-7"
      />
    </div>
  )
}
