import { Navigate } from 'react-router'
import {
  Check,
  Eye,
  GraduationCap,
  KeyRound,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  ReceiptText,
  Smartphone,
  ToggleRight,
} from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { CargaPagina } from '../../components/ui/Spinner'
import { BarraNavegacion, SaltarAlContenido } from '../../components/layouts/Comunes'
import { CabeceraPublica, PiePublico } from '../../components/layouts/PublicoLayout'
import { inicioDeRol, useSesion } from '../acceso/sesion'
import { ReciboSimulador } from './ReciboSimulador'

const PROMESAS = ['Sin filas ni papeles', 'Evaluación automática en minutos', 'Tasa nunca mayor a la máxima legal']

const BENEFICIOS = [
  {
    icono: Eye,
    titulo: 'La tasa al lado de la cuota',
    texto: 'Nunca ves una sin la otra, y con el mismo tamaño. Así comparas de verdad con otras entidades.',
  },
  {
    icono: ReceiptText,
    titulo: 'Cada costo en su renglón',
    texto: 'Intereses, seguro y estudio de crédito, con el total a pagar y lo que de verdad llega a tu cuenta.',
  },
  {
    icono: Smartphone,
    titulo: 'Todo desde el celular',
    texto: 'Te registras, verificas tu identidad con una foto y radicas tu solicitud sin ir a una oficina.',
  },
  {
    icono: ListChecks,
    titulo: 'Sabes en qué va',
    texto: 'Cada etapa de tu solicitud con su fecha y, si falta algo, qué es y cómo enviarlo.',
  },
]

const PASOS = [
  { titulo: 'Simula', texto: 'Elige producto, monto y plazo. Guardamos los valores 30 días.' },
  { titulo: 'Crea tu cuenta', texto: 'Tus datos, un código a tu correo y otro a tu celular, y una foto de tu documento y de tu rostro.' },
  { titulo: 'Radica', texto: 'Lo que ya nos diste no te lo volvemos a pedir. Subes tus soportes en JPG, PNG o PDF.' },
  { titulo: 'Recibe la respuesta', texto: 'Si te aprobamos, revisas la oferta y la firmas en línea con un código.' },
]

const SEGURIDAD = [
  {
    icono: LockKeyhole,
    titulo: 'Datos cifrados',
    texto: 'Tu documento y tus archivos se guardan cifrados. En pantalla solo ves los últimos 4 dígitos.',
  },
  { icono: KeyRound, titulo: 'Segundo factor', texto: 'Cada ingreso se confirma con un código que llega a tu correo.' },
  {
    icono: ToggleRight,
    titulo: 'Tú decides qué autorizas',
    texto: 'Los usos opcionales de tus datos empiezan sin marcar y los cambias cuando quieras.',
  },
  {
    icono: MessageSquareText,
    titulo: 'Decisiones explicadas',
    texto: 'Si la respuesta es no, te decimos por qué, en lenguaje claro y sin códigos internos.',
  },
]

const PREGUNTAS = [
  {
    p: '¿Qué es la TEA y por qué va tan grande?',
    r: 'Es la tasa efectiva anual: lo que cuesta el dinero en un año, con intereses sobre intereses. Es la cifra que te deja comparar créditos entre entidades, por eso siempre va junto a la cuota y con el mismo tamaño.',
  },
  {
    p: '¿La simulación ya es una aprobación?',
    r: 'No. La simulación te muestra valores de referencia con las tasas vigentes. Las condiciones definitivas salen del estudio de tu solicitud.',
  },
  {
    p: '¿Qué necesito para solicitar?',
    r: 'Ser mayor de 18 años, tu documento de identidad, un correo y un celular. Según el producto, te pediremos soportes de tus ingresos.',
  },
  {
    p: '¿Cuánto tarda la respuesta?',
    r: 'La evaluación automática toma minutos. Si tu caso necesita la revisión de una persona, en el seguimiento ves la etapa y la fecha.',
  },
]

/**
 * Página de inicio pública (P8, T28): vende el producto con su propio simulador. Quien ya
 * tiene sesión va directo a su inicio, como antes (8.1.1).
 */
export default function InicioPagina() {
  const { data: usuario, isPending } = useSesion()
  if (isPending) return <CargaPagina />
  if (usuario) return <Navigate to={inicioDeRol(usuario.rol)} replace />

  return (
    <div className="min-h-dvh bg-fondo">
      <title>FinanTech · Crédito de consumo con la cuota y la tasa claras</title>
      <SaltarAlContenido />
      <BarraNavegacion />

      <div className="relative">
        {/* La cabecera flota sobre el hero; así el hero y todo lo demás quedan dentro de main. */}
        <CabeceraPublica oscura />

        <main id="contenido" tabIndex={-1} className="outline-none">
          <section aria-labelledby="hero-titulo" className="sobre-oscuro trama-trenza relative overflow-hidden bg-noche text-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-48 -left-40 size-[36rem] rounded-full bg-primario-600/45 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-32 bottom-0 size-[24rem] rounded-full bg-secundario-600/15 blur-3xl"
            />
            <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-24 pb-16 sm:px-6 sm:pt-30 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-16 lg:pt-34 lg:pb-24">
              <div className="flex flex-col gap-7 lg:sticky lg:top-12 lg:pt-10">
                <h1
                  id="hero-titulo"
                  tabIndex={-1}
                  className="titular text-[length:clamp(2.25rem,8vw,3.75rem)] leading-[1.04] font-semibold outline-none"
                >
                  Sabes cuánto vas a pagar antes de pedir tu crédito.
                </h1>
                <p className="max-w-[34rem] text-lg leading-relaxed text-niebla">
                  Crédito de consumo en línea, desde tu celular. Mueve el monto y el plazo: la cuota, la tasa efectiva anual y cada costo
                  aparecen al instante, renglón por renglón.
                </p>
                <div className="flex flex-col gap-3 min-[420px]:flex-row">
                  <ButtonLink to="/registro" variante="acento" tamano="lg">
                    Crear mi cuenta
                  </ButtonLink>
                  <ButtonLink to="/ingresar" variante="contorno-claro" tamano="lg">
                    Ya tengo cuenta
                  </ButtonLink>
                </div>
                <ul className="flex flex-col gap-2.5 text-sm text-niebla">
                  {PROMESAS.map((promesa) => (
                    <li key={promesa} className="flex items-center gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-menta-300 text-noche">
                        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                      </span>
                      {promesa}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mx-auto w-full max-w-[30rem] lg:mx-0 lg:justify-self-end">
                <ReciboSimulador />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="beneficios-titulo"
            className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16"
          >
            <div className="flex max-w-md flex-col gap-4 lg:sticky lg:top-12 lg:self-start">
              <h2 id="beneficios-titulo" className="titular text-[length:clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold text-noche">
                Un crédito que se entiende a la primera
              </h2>
              <p className="text-lg leading-relaxed text-tinta-suave">
                Pedir plata prestada no debería sentirse como firmar a ciegas. Te mostramos las cuentas completas antes de que des un solo
                dato.
              </p>
            </div>
            <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
                <li key={titulo} className="flex flex-col gap-3">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-cielo text-primario-600 ring-1 ring-primario-100">
                    <Icono aria-hidden="true" className="size-6" />
                  </span>
                  <h3 className="titular text-xl font-semibold text-noche">{titulo}</h3>
                  <p className="leading-relaxed text-tinta-suave">{texto}</p>
                </li>
              ))}
            </ul>
          </section>

          <section id="como-funciona" aria-labelledby="pasos-titulo" className="border-y border-linea bg-superficie">
            <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
              <div className="flex max-w-2xl flex-col gap-4">
                <h2 id="pasos-titulo" className="titular text-[length:clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold text-noche">
                  Cuatro pasos, sin ir a una oficina
                </h2>
                <p className="text-lg leading-relaxed text-tinta-suave">De la simulación a la firma, todo pasa en el portal.</p>
              </div>
              <ol className="grid gap-0 md:grid-cols-4 md:gap-6">
                {PASOS.map(({ titulo, texto }, i) => (
                  <li key={titulo} className="relative flex gap-5 pb-10 last:pb-0 md:flex-col md:gap-5 md:pb-0">
                    {i < PASOS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-12 left-[23px] h-[calc(100%-3rem)] w-0.5 bg-primario-200 md:top-[23px] md:left-14 md:h-0.5 md:w-[calc(100%-2rem)]"
                      />
                    ) : null}
                    <span className="titular relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-noche text-lg font-bold text-white ring-8 ring-superficie">
                      {i + 1}
                    </span>
                    <span className="flex flex-col gap-2 pt-2.5 md:pt-0">
                      <h3 className="titular text-xl font-semibold text-noche">{titulo}</h3>
                      <span className="leading-relaxed text-tinta-suave">{texto}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section
            id="seguridad"
            aria-labelledby="seguridad-titulo"
            className="sobre-oscuro trama-trenza relative overflow-hidden bg-noche text-white"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-40 -bottom-40 size-[30rem] rounded-full bg-primario-600/40 blur-3xl"
            />
            <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
              <div className="flex max-w-2xl flex-col gap-4">
                <h2 id="seguridad-titulo" className="titular text-[length:clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold">
                  Tu información, bajo tu control
                </h2>
                <p className="text-lg leading-relaxed text-niebla">
                  La seguridad no es un sello en el pie de página: está en cada pantalla.
                </p>
              </div>
              <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {SEGURIDAD.map(({ icono: Icono, titulo, texto }) => (
                  <li key={titulo} className="flex flex-col gap-3 border-t border-white/15 pt-6">
                    <Icono aria-hidden="true" className="size-7 text-menta-300" />
                    <h3 className="titular text-lg font-semibold">{titulo}</h3>
                    <p className="text-sm leading-relaxed text-niebla">{texto}</p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-4 rounded-panel bg-white/6 p-5 ring-1 ring-white/12 sm:flex-row sm:items-center sm:p-6">
                <GraduationCap aria-hidden="true" className="size-8 shrink-0 text-menta-300" />
                <p className="text-sm leading-relaxed text-niebla">
                  <span className="font-semibold text-white">FinanTech es un proyecto académico</span> de Ingeniería de Sistemas de la
                  Universidad de Córdoba. No presta dinero real, y las personas y créditos de la demostración son inventados.
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="preguntas-titulo"
            className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16"
          >
            <h2 id="preguntas-titulo" className="titular text-[length:clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold text-noche">
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col divide-y divide-linea border-y border-linea">
              {PREGUNTAS.map(({ p, r }) => (
                <details key={p} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-campo py-4 text-lg font-semibold text-noche [&::-webkit-details-marker]:hidden">
                    {p}
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cielo text-xl leading-none text-primario-700 transition-transform duration-200 ease-salida group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-[60ch] pb-5 leading-relaxed text-tinta-suave">{r}</p>
                </details>
              ))}
            </div>
          </section>

          <section aria-labelledby="cierre-titulo" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
            <div className="sobre-oscuro relative overflow-hidden rounded-lienzo bg-primario-600 px-6 py-12 text-white sm:px-12 sm:py-16">
              <div aria-hidden="true" className="trama-trenza pointer-events-none absolute inset-0 opacity-70" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex max-w-xl flex-col gap-3">
                  <h2 id="cierre-titulo" className="titular text-[length:clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold">
                    Empieza por los números
                  </h2>
                  <p className="text-lg leading-relaxed text-primario-50">Simular no te compromete a nada y no te pide datos personales.</p>
                </div>
                <div className="flex flex-col gap-3 min-[420px]:flex-row md:shrink-0">
                  <ButtonLink to="/simular" variante="claro" tamano="lg">
                    Simular mi crédito
                  </ButtonLink>
                  <ButtonLink to="/registro" variante="contorno-claro" tamano="lg">
                    Crear mi cuenta
                  </ButtonLink>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <PiePublico />
    </div>
  )
}
