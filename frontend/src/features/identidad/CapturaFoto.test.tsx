import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { medidasReducidas, reducirFoto } from '../../lib/imagenes'
import { CapturaFoto } from './CapturaFoto'

beforeAll(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:vista'), revokeObjectURL: vi.fn() }))
})
afterAll(() => vi.unstubAllGlobals())

function Frente() {
  const [archivo, setArchivo] = useState<File | null>(null)
  return <CapturaFoto tipo="frente" archivo={archivo} onCambiar={setArchivo} />
}

describe('captura de la verificación de identidad (UX-13, RI-06)', () => {
  it('guía el encuadre, abre la cámara y ofrece subir un archivo', () => {
    render(<Frente />)
    expect(screen.getByRole('heading', { name: 'Frente del documento' })).toBeInTheDocument()
    expect(screen.getByText('Que se vean las cuatro esquinas')).toBeInTheDocument()
    const camara = screen.getByLabelText('Tomar foto del frente')
    expect(camara).toHaveAttribute('capture', 'environment')
    expect(screen.getByLabelText(/Subir un archivo/)).not.toHaveAttribute('capture')
  })

  it('después de elegir la foto muestra la miniatura y deja tomar otra', async () => {
    const usuario = userEvent.setup()
    render(<Frente />)
    const foto = new File([new Uint8Array(2048)], 'frente.jpg', { type: 'image/jpeg' })
    await usuario.upload(screen.getByLabelText(/Subir un archivo/), foto)
    expect(await screen.findByRole('img', { name: 'Vista previa: frente del documento' })).toHaveAttribute('src', 'blob:vista')
    expect(screen.getByText('Lista')).toBeInTheDocument()
    expect(screen.getByLabelText(/Tomar otra/)).toBeInTheDocument()
  })

  it('rechaza un PDF: la verificación necesita una foto', async () => {
    const usuario = userEvent.setup({ applyAccept: false })
    render(<Frente />)
    const pdf = new File(['%PDF'], 'frente.pdf', { type: 'application/pdf' })
    await usuario.upload(screen.getByLabelText(/Subir un archivo/), pdf)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sube una foto en JPG o PNG.')
  })
})

describe('reducción de fotos antes de enviarlas (D9)', () => {
  it('lleva el lado mayor a 2000 px sin deformar la foto', () => {
    expect(medidasReducidas(4000, 3000)).toEqual({ ancho: 2000, alto: 1500 })
    expect(medidasReducidas(3024, 4032)).toEqual({ ancho: 1500, alto: 2000 })
    expect(medidasReducidas(1200, 900)).toEqual({ ancho: 1200, alto: 900 })
  })

  it('deja igual lo que ya es liviano o no es una imagen', async () => {
    const liviana = new File([new Uint8Array(500)], 'a.jpg', { type: 'image/jpeg' })
    expect(await reducirFoto(liviana)).toBe(liviana)
    const pdf = new File([new Uint8Array(2 * 1024 * 1024)], 'a.pdf', { type: 'application/pdf' })
    expect(await reducirFoto(pdf)).toBe(pdf)
  })
})
