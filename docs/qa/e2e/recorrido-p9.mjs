// V6 · Recorrido de aceptación de P9 en el navegador, contra Laravel y sin MSW (qa-senior).
//
// Requisitos:
//   - docker compose up -d (API en :8000, Mailpit en :8025) con la base `finantech` sembrada
//     (cuentas demo: Camila, oficial; contraseña Demo#2026!).
//   - Portal sin MSW:  cd frontend && VITE_API_SIMULADA=false npx vite --port 5174 --strictPort
//   - Playwright (o patchright) disponible: PW_MODULE=<ruta a playwright/index.mjs>; si no se da,
//     se intenta `import('playwright')`.
// Uso: node docs/qa/e2e/recorrido-p9.mjs <carpeta de salida> [url del portal]
//
// Cada corrida registra a una persona sintética nueva (correo y documento únicos; el documento cae
// en el perfil medio de la central simulada para que pase por el oficial, D21). Los códigos de
// verificación y de segundo factor se leen de Mailpit (el SMS, de Mailpit o de laravel.log).
// Termina con un resumen por paso: OK, FALLA (con captura y árbol de accesibilidad) o PENDIENTE
// (el endpoint todavía no existe). Sale con código 1 si algún paso falla.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SALIDA = process.argv[2] ?? 'recorrido-p9'
const BASE = process.argv[3] ?? 'http://localhost:5174'
const MAILPIT = 'http://localhost:8025'
const LOG = new URL('../../../backend/storage/logs/laravel.log', import.meta.url)
const CAMILA = { email: 'camila.ortiz@demo.finantech.co', clave: 'Demo#2026!' }
mkdirSync(SALIDA, { recursive: true })

const { chromium } = process.env.PW_MODULE
  ? await import(pathToFileURL(process.env.PW_MODULE).href)
  : await import('playwright')

// Persona sintética única. Documento de 10 dígitos cuya suma termina en 5 (perfil medio, D21).
// No puede terminar en 0: la central simulada lo trata como caída (RF-08 FA-02) y no habría evaluación.
const sello = Date.now().toString().slice(-7)
function documentoMedio() {
  for (let n = Number(sello); ; n++) {
    const base = `10${String(n % 10000000).padStart(7, '0')}`
    const digito = (15 - ([...base].reduce((s, d) => s + Number(d), 0) % 10)) % 10
    if (digito !== 0) return base + digito
  }
}
const persona = {
  nombres: 'Laura QA', apellidos: 'Sintética Recorrido', documento: documentoMedio(),
  email: `laura.qa.${sello}@example.com`, celular: `300${sello}`, clave: 'Recorrido-QA-2026!',
  nacimiento: '1990-05-17',
}

const pasos = []
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Códigos de Mailpit y del log ------------------------------------------------------------
async function codigoDeCorreo(destino, despuesDe, patron = /\b(\d{6})\b/) {
  for (let i = 0; i < 40; i++) {
    const lista = await (await fetch(`${MAILPIT}/api/v1/messages?limit=20`)).json()
    for (const m of lista.messages ?? []) {
      if (new Date(m.Created) < despuesDe) continue
      if (!m.To?.some((t) => t.Address.toLowerCase() === destino.toLowerCase())) continue
      const detalle = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()
      const hallado = (detalle.Text ?? '').match(patron)
      if (hallado) return hallado[1]
    }
    await esperar(500)
  }
  throw new Error(`No llegó a Mailpit un código para ${destino}`)
}
async function codigoSms(celular, despuesDe) {
  const final = celular.slice(-4)
  for (let i = 0; i < 40; i++) {
    // T33: el SMS simulado también puede llegar a Mailpit.
    const lista = await (await fetch(`${MAILPIT}/api/v1/messages?limit=20`)).json()
    for (const m of lista.messages ?? []) {
      if (new Date(m.Created) < despuesDe || !/sms/i.test(m.Subject ?? '')) continue
      const detalle = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()
      const texto = detalle.Text ?? ''
      if (texto.includes(final)) { const c = texto.match(/\b(\d{6})\b/); if (c) return c[1] }
    }
    if (existsSync(LOG)) {
      const lineas = readFileSync(LOG, 'utf8').split('\n').filter((l) => /SMS SIMULADO/.test(l) && l.includes(final))
      const c = lineas.at(-1)?.match(/\b(\d{6})\b/)
      if (c) return c[1]
    }
    await esperar(500)
  }
  throw new Error('No se encontró el código del SMS simulado')
}

// ---- Navegador -------------------------------------------------------------------------------
const navegador = await chromium.launch({ headless: true, channel: process.env.PW_CANAL ?? 'chrome' })
const red = []
async function contexto(nombre) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-CO' })
  const page = await ctx.newPage()
  // Vite compila en frío la primera vez (lento sobre el disco de Windows).
  page.setDefaultNavigationTimeout(120000)
  page.setDefaultTimeout(Number(process.env.PW_ESPERA ?? 120000)) // O-05: la API puede tardar decenas de segundos
  page.on('response', (r) => { if (r.url().includes('/api/v1/')) red.push(`${nombre} ${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`) })
  page.on('console', (m) => { if (m.type() === 'error') red.push(`${nombre} consola: ${m.text().slice(0, 200)}`) })
  return page
}
async function paso(nombre, fn, { pendienteSi } = {}) {
  const page = fn.page
  const inicio = Date.now()
  try {
    await fn()
    pasos.push({ nombre, estado: 'OK', ms: Date.now() - inicio })
    console.log(`OK        ${nombre}`)
    return true
  } catch (e) {
    const archivo = nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const pg = fn.pagina?.()
    if (pg) {
      await pg.screenshot({ path: join(SALIDA, `${archivo}.png`), fullPage: true }).catch(() => {})
      const arbol = await pg.locator('body').ariaSnapshot().catch(() => '')
      writeFileSync(join(SALIDA, `${archivo}.txt`), `${pg.url()}\n${e.stack}\n\n${arbol}`)
    }
    const pendiente = pendienteSi?.(e)
    pasos.push({ nombre, estado: pendiente ? 'PENDIENTE' : 'FALLA', detalle: pendiente || e.message.split('\n')[0] })
    console.log(`${pendiente ? 'PENDIENTE' : 'FALLA    '} ${nombre}: ${pendiente || e.message.split('\n')[0]}`)
    return false
  }
}
function conPagina(page, fn) { fn.pagina = () => page; return fn }
/** Cada goto recarga la SPA: espera a que termine de verificar la sesión y de pedir sus datos. */
async function listo(pagina) {
  await esperar(300)
  await pagina.getByText('Verificando tu sesión…').first().waitFor({ state: 'hidden', timeout: 120000 }).catch(() => {})
  await pagina.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {})
}
const boton = (page, nombre) => page.getByRole('button', { name: nombre })

// ---- Recorrido -------------------------------------------------------------------------------
const cliente = await contexto('cliente')
let solicitudId = null

const okRegistro = await paso('1. Registro con códigos de correo y SMS (RF-01)', conPagina(cliente, async () => {
  await cliente.goto(`${BASE}/registro`, { waitUntil: 'domcontentloaded' })
  const desde = new Date(Date.now() - 2000)
  await cliente.getByLabel('Tipo de documento').selectOption('CC')
  await cliente.getByLabel('Número de documento').fill(persona.documento)
  await cliente.getByLabel('Nombres').fill(persona.nombres)
  await cliente.getByLabel('Apellidos').fill(persona.apellidos)
  await cliente.getByLabel('Fecha de nacimiento').fill(persona.nacimiento)
  await boton(cliente, /continuar/i).click()
  await cliente.getByLabel('Correo electrónico').fill(persona.email)
  await cliente.getByLabel('Celular').fill(persona.celular)
  await cliente.getByLabel('Contraseña', { exact: true }).fill(persona.clave)
  await cliente.getByLabel('Repite la contraseña').fill(persona.clave)
  await boton(cliente, /continuar/i).click()
  // RN-05: las finalidades opcionales empiezan sin marcar.
  for (const casilla of await cliente.getByRole('checkbox').all()) {
    const nombre = await casilla.getAttribute('aria-label') ?? ''
    if (!/acepto la política/i.test(nombre) && await casilla.isChecked()) throw new Error(`RN-05: finalidad marcada por defecto (${nombre})`)
  }
  await cliente.getByLabel('Acepto la política de tratamiento de datos').check()
  await boton(cliente, /enviar códigos de verificación/i).click()
  await cliente.getByLabel('Código del correo').fill(await codigoDeCorreo(persona.email, desde))
  await cliente.getByLabel('Código del SMS').fill(await codigoSms(persona.celular, desde))
  await boton(cliente, /verificar y crear mi cuenta/i).click()
  // El registro abre sesión y sigue en el paso 4 (identidad), en la misma página.
  await boton(cliente, /verificar mi identidad/i).waitFor()
}))

await paso('2. Verificación de identidad simulada, con distintivo (RF-02, MR-003)', conPagina(cliente, async () => {
  if (!okRegistro) throw new Error('depende del paso 1')
  const escenario = cliente.getByLabel('Escenario de prueba')
  if (await escenario.count()) await escenario.selectOption({ index: 0 })
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
  const entradas = cliente.locator('input[type=file]:not([capture])')
  const total = await entradas.count()
  if (total === 0) throw new Error('no hay campos de archivo para las capturas')
  for (let i = 0; i < total; i++) await entradas.nth(i).setInputFiles({ name: `captura-${i}.png`, mimeType: 'image/png', buffer: png })
  await boton(cliente, /verificar mi identidad/i).click()
  await boton(cliente, /ir a mi portal/i).waitFor({ timeout: 120000 })
  await cliente.getByText(/simulad/i).first().waitFor({ timeout: 5000 })
  await boton(cliente, /ir a mi portal/i).click()
  await cliente.waitForURL(/\/portal/, { timeout: 120000 })
}))

await paso('3. Salir e ingresar con contraseña y segundo factor de Mailpit (RF-03)', conPagina(cliente, async () => {
  if (!okRegistro) throw new Error('depende del paso 1')
  await cliente.context().clearCookies()
  await cliente.goto(`${BASE}/ingresar`, { waitUntil: 'domcontentloaded' })
  const desde = new Date(Date.now() - 2000)
  await cliente.getByLabel('Correo electrónico').fill(persona.email)
  await cliente.getByLabel('Contraseña').fill(persona.clave)
  await boton(cliente, /iniciar sesión/i).click()
  await cliente.waitForURL(/verificacion/, { timeout: 120000 })
  await cliente.getByLabel('Código de verificación').fill(await codigoDeCorreo(persona.email, desde))
  await boton(cliente, /confirmar e ingresar/i).click()
  await cliente.waitForURL(/\/portal/, { timeout: 120000 })
}))

await paso('4. Simulación con la TEA junto a la cuota y "no constituye aprobación" (RF-05, CP0011)', conPagina(cliente, async () => {
  await cliente.goto(`${BASE}/portal/simular`, { waitUntil: 'domcontentloaded' })
  await cliente.getByLabel('Monto').first().fill('5000000')
  const resultado = cliente.getByRole('region', { name: 'Resultado de la simulación' })
  await resultado.getByText(/TEA/).first().waitFor({ timeout: 120000 })
  await resultado.getByText(/cuota/i).first().waitFor({ timeout: 5000 })
  await cliente.getByText(/no (constituye|es) (una )?aprobación/i).first().waitFor({ timeout: 120000 })
}))

let radicado = null
await paso('5. Radicación con documentos y radicado FT-AAAA-NNNNNN (RF-06, CP0012)', conPagina(cliente, async () => {
  await cliente.goto(`${BASE}/portal/solicitar`, { waitUntil: 'domcontentloaded' })
  await cliente.getByRole('button', { name: /empezar solicitud/i }).waitFor({ timeout: 120000 })
  await listo(cliente)
  const respuestaCreacion = cliente.waitForResponse((r) => /\/originacion\/solicitudes$/.test(r.url()) && r.request().method() === 'POST', { timeout: 120000 }).catch(() => null)
  // El asistente: producto y condiciones → datos laborales y financieros → documentos → revisión.
  let documentosCargados = false
  for (let vuelta = 0; vuelta < 12; vuelta++) {
    for (const [etiqueta, valor] of [['Monto', '5000000'], ['Plazo en meses', '24']]) {
      const campo = cliente.getByLabel(etiqueta, { exact: true })
      if (await campo.isVisible().catch(() => false) && await campo.isEditable().catch(() => false) && !(await campo.inputValue().catch(() => ''))) await campo.fill(valor)
    }
    const ocupacion = cliente.getByLabel('Ocupación')
    if (await ocupacion.isVisible().catch(() => false)) await ocupacion.selectOption({ index: 1 }).catch(() => {})
    for (const [etiqueta, valor] of [['Empresa o actividad', 'Empresa Sintética S.A.S.'], ['Meses en tu trabajo o actividad actual', '6'],
      ['Ingreso mensual', '1100000'], ['Gastos mensuales', '0'], ['Nombre completo', 'Pedro Referencia Sintética'], ['Celular', '3109876543']]) {
      const campo = cliente.getByLabel(etiqueta, { exact: true })
      if (await campo.isVisible().catch(() => false) && await campo.isEditable().catch(() => false) && !(await campo.inputValue().catch(() => ''))) await campo.fill(valor)
    }
    const autoriza = cliente.getByLabel(/Autorizo a FinanTech a consultar/i)
    if (await autoriza.isVisible().catch(() => false) && !(await autoriza.isChecked())) await autoriza.check()
    const seccionDocumentos = cliente.getByRole('heading', { name: /Paso \d de \d: Documentos/ })
    if (!documentosCargados && await seccionDocumentos.isVisible().catch(() => false)) {
      const pendientes = cliente.locator('main li').filter({ hasText: 'Pendiente' }).filter({ has: cliente.locator('input[type=file]') })
      for (let i = 0; i < 6 && await pendientes.count(); i++) {
        const antes = await pendientes.count()
        const subida = cliente.waitForResponse((x) => /\/documentos$/.test(x.url()), { timeout: 120000 })
        await pendientes.first().locator('input[type=file]:not([capture])').setInputFiles({ name: `soporte-${i}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%QA sintético\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') })
        const respuesta = await subida
        if (respuesta.status() >= 400) throw new Error(`${respuesta.status()} al subir el documento ${i}`)
        for (let e = 0; e < 120 && await pendientes.count() >= antes; e++) await esperar(500)
        if (await pendientes.count() >= antes) throw new Error('el documento cargado sigue como Pendiente')
      }
      documentosCargados = true
    }
    const radicar = boton(cliente, /^radicar/i)
    if (await radicar.isVisible().catch(() => false) && await radicar.isEnabled()) {
      await radicar.click()
      await cliente.getByText(/FT-\d{4}-\d{6}/).first().waitFor({ timeout: 120000 })
      break
    }
    const siguiente = boton(cliente, /continuar|siguiente|empezar|crear solicitud|solicitar/i).last()
    if (!(await siguiente.isVisible().catch(() => false))) throw new Error('el asistente no ofrece cómo seguir')
    const progreso = cliente.getByRole('navigation', { name: 'Progreso de la solicitud' }).getByRole('paragraph')
    const antes = await progreso.textContent({ timeout: 1000 }).catch(() => null)
    await siguiente.click()
    // Esperar a que la sección cambie de verdad: un clic adelantado caería en la sección siguiente.
    for (let e = 0; e < 240; e++) {
      const ahora = await progreso.textContent({ timeout: 500 }).catch(() => null)
      if (ahora && ahora !== antes) break
      if (await cliente.locator('main [aria-invalid="true"]').count()) throw new Error(`validación en "${antes}": ${await cliente.locator('main').innerText()}`.slice(0, 400))
      await esperar(500)
    }
  }
  const creada = await respuestaCreacion
  if (creada) solicitudId = (await creada.json().catch(() => ({}))).id ?? null
  const textoRadicado = await cliente.getByText(/FT-\d{4}-\d{6}/).first().textContent().catch(() => null)
  radicado = textoRadicado?.match(/FT-\d{4}-\d{6}/)?.[0] ?? null
  if (!radicado) throw new Error('no se vio el número de radicado')
}))

await paso('6. Evaluación automática y seguimiento con el estado nuevo (RF-07, RF-08)', conPagina(cliente, async () => {
  if (!solicitudId) throw new Error('sin solicitud radicada')
  await cliente.goto(`${BASE}/portal/solicitudes/${solicitudId}`, { waitUntil: 'domcontentloaded' })
  await listo(cliente)
  await cliente.getByText(/en estudio|en decisión|aprobada|negada|en revisión/i).first().waitFor({ timeout: 120000 })
}))

// ---- Consola del oficial (V3) y oferta (V4) --------------------------------------------------
const oficial = await contexto('oficial')
const noExiste = (e) => (/404|405|no está disponible|No disponible en esta versión/i.test(e.message) ? 'el endpoint o la pantalla todavía no existe (V3/V4)' : null)

const okOficial = await paso('7. Camila ingresa con segundo factor y ve la solicitud en su bandeja (V3)', conPagina(oficial, async () => {
  await oficial.goto(`${BASE}/ingresar`, { waitUntil: 'domcontentloaded' })
  const desde = new Date(Date.now() - 2000)
  await oficial.getByLabel('Correo electrónico').fill(CAMILA.email)
  await oficial.getByLabel('Contraseña').fill(CAMILA.clave)
  await boton(oficial, /iniciar sesión/i).click()
  await oficial.waitForURL(/verificacion/, { timeout: 120000 })
  await oficial.getByLabel('Código de verificación').fill(await codigoDeCorreo(CAMILA.email, desde))
  await boton(oficial, /confirmar e ingresar/i).click()
  await oficial.waitForURL(/\/consola/, { timeout: 120000 })
  const respuestaBandeja = oficial.waitForResponse((r) => /\/originacion\/bandeja/.test(r.url()), { timeout: 120000 }).catch(() => null)
  await oficial.goto(`${BASE}/consola/oficial`, { waitUntil: 'domcontentloaded' })
  const bandeja = await respuestaBandeja
  if (!bandeja) throw new Error('404: la bandeja no llamó a GET originacion/bandeja')
  if (bandeja.status() >= 400) throw new Error(`${bandeja.status()} en GET originacion/bandeja`)
  if (!radicado) throw new Error('sin radicado del paso 5')
  await oficial.getByText(radicado).first().waitFor({ timeout: 120000 })
}), { pendienteSi: noExiste })

await paso('8. Camila aprueba con motivo (RF-10, RN-54)', conPagina(oficial, async () => {
  if (!okOficial || !solicitudId) throw new Error('404: depende del paso 7')
  const respuestaEvaluacion = oficial.waitForResponse((x) => /\/evaluacion\/solicitudes\/[^/]+\/evaluacion$/.test(x.url()), { timeout: 120000 })
  await oficial.goto(`${BASE}/consola/decisiones/${solicitudId}`, { waitUntil: 'domcontentloaded' })
  // D20 y D21: el oficial decide con la evaluación a la vista, con su versión de reglas (RN-44) y el distintivo (MR-003).
  const evaluacion = await respuestaEvaluacion
  if (evaluacion.status() !== 200) throw new Error(`${evaluacion.status()} en GET evaluacion: el escenario D21 debe traer evaluación`)
  const { puntaje } = await evaluacion.json()
  if (puntaje !== 660) throw new Error(`puntaje ${puntaje}: el escenario D21 da 660`)
  await listo(oficial)
  await oficial.getByText(/^Reglas /).first().waitFor({ timeout: 30000 })
  await oficial.getByText(/central simulada/i).first().waitFor({ timeout: 30000 })
  await oficial.getByRole('radio', { name: /^Aprobar(?! con)/ }).check()
  await oficial.getByLabel(/^motivo/i).first().fill('Capacidad de pago suficiente; recorrido de aceptación P9 (QA).')
  await boton(oficial, /revisar y registrar/i).click()
  const respuestaDecision = oficial.waitForResponse((x) => /\/evaluacion\/decisiones$/.test(x.url()) && x.request().method() === 'POST', { timeout: 120000 })
  await boton(oficial, /registrar decisión/i).click()
  const r = await respuestaDecision
  if (r.status() >= 400) throw new Error(`${r.status()} en POST evaluacion/decisiones`)
}), { pendienteSi: noExiste })

await paso('9. Laura acepta la oferta con segundo factor y ve el pagaré con el distintivo de simulado (RF-11, MR-004)', conPagina(cliente, async () => {
  if (!solicitudId) throw new Error('404: sin solicitud')
  await cliente.goto(`${BASE}/portal/solicitudes/${solicitudId}`, { waitUntil: 'domcontentloaded' })
  await listo(cliente)
  const verOferta = cliente.getByRole('link', { name: /revisar oferta/i }).first()
  await verOferta.waitFor({ timeout: 120000 })
  await verOferta.click()
  await cliente.getByText(/TEA/).first().waitFor()
  await listo(cliente)
  const desde = new Date(Date.now() - 2000)
  await cliente.getByLabel(/Leí las condiciones/i).check()
  await boton(cliente, /firmar pagaré/i).click()
  await cliente.getByLabel(/^código/i).first().waitFor({ timeout: 120000 })
  await cliente.getByLabel(/^código/i).first().fill(await codigoDeCorreo(persona.email, desde))
  await boton(cliente, /^firmar$/i).click()
  await cliente.getByText(/firmaste el pagaré/i).first().waitFor({ timeout: 120000 })
  await cliente.getByText(/simulad/i).first().waitFor({ timeout: 5000 })
}), { pendienteSi: noExiste })

await navegador.close()
writeFileSync(join(SALIDA, 'resumen.json'), JSON.stringify({ base: BASE, persona: { ...persona, clave: '(oculta)' }, solicitudId, pasos, red }, null, 2))
const fallas = pasos.filter((p) => p.estado === 'FALLA').length
console.log(`\n${pasos.filter((p) => p.estado === 'OK').length} OK, ${fallas} con falla, ${pasos.filter((p) => p.estado === 'PENDIENTE').length} pendientes. Detalle en ${join(SALIDA, 'resumen.json')}`)
process.exit(fallas ? 1 : 0)
