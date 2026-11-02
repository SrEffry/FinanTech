# Dirección visual de FinanTech

Autor: ux-ui-senior. Fecha: 02/11/2026. Tarea T28 (decisión P8 de las personas). Es la "identidad visual" del plan.

Parte de `docs/ux/sistema-visual.md` (inventario, contraste y hallazgos SV-01 a SV-12) y lo reemplaza como guía de diseño. Los tokens viven en `frontend/src/styles/index.css`. Si este documento y el código no coinciden, manda el código y se corrige el documento.

## 1. Personalidad

FinanTech es **la persona de confianza que te muestra las cuentas completas antes de que firmes**.

| Es | No es |
|---|---|
| Clara: dice la cifra y lo que significa | Técnica: "TEA", "E.A." o "originación" sin explicar |
| Cercana: tutea, frases cortas, verbos simples | Vendedora: urgencia falsa ("¡solo hoy!"), promesas de aprobación |
| Serena: azul profundo, mucho aire, poco movimiento | Fría ni de banco tradicional: grises, mayúsculas, sellos |
| Precisa: cifras tabulares, cada costo en su renglón | Decorativa: gradientes, adornos sin información |

Público de referencia (ERS 6.3.1): el 80 % entra desde el celular, con brillo bajo y en la calle, y hay clientes de 60 años. Por eso el contraste y el tamaño no se negocian.

## 2. Concepto: "el recibo abierto"

La pieza memorable de la marca es **un recibo**: la cuota y la TEA arriba, una al lado de la otra, y debajo cada costo en su renglón, hasta "Te consignamos". Tiene borde troquelado, una línea de corte punteada con muescas y sale "impreso" una sola vez al cargar.

- En la **página de inicio** el recibo es el simulador real (RF-05), con datos del API. Vende lo que diferencia al producto: ver las cuentas antes de pedir.
- En el **panel de acceso** hay un recibo estático, inclinado y rotulado **"Ejemplo"**, con la nota "Valores ilustrativos: no constituyen una aprobación" (D12).
- En el resto del portal, el lenguaje del recibo se usa en el desglose de costos y en la oferta (renglones, totales, cifra destacada). Frontend lo aplica en T29.

Gráfico secundario: la **trenza**, una textura de zigzag y rombos inspirada en el tejido de caña flecha de Córdoba, la región de la universidad. Va solo sobre superficies noche y casi transparente (7 % de opacidad). Es decoración y nunca lleva información.

Ilustración: solo SVG propio (logo, trenza, recibo) e íconos de `lucide-react` de trazo 2. **Sin fotos de bancos de imágenes, sin personas sonrientes, sin testimonios ni cifras de clientes** (D12).

## 3. Paleta

Base institucional de la ERS (RI-02): azul `#1B4D8F`, verde `#0E9F6E`, rojo y ámbar. Sobre esa base se agrega una superficie oscura propia y un acento.

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Noche | `noche` | `#0E2240` | Superficies de marca: hero, banda de seguridad, pie, panel de acceso, barra de la consola |
| Azul FinanTech | `primario-600` | `#1B4D8F` | Acción primaria, enlaces fuertes, datos, foco |
| Azul texto | `primario-700` | `#163F76` | Enlaces y texto azul |
| Menta (acento) | `menta-300` | `#7EE2B8` | Llamada principal sobre noche (botón `acento`), íconos, viñetas y foco sobre noche |
| Verde ERS | `secundario-600` | `#0E9F6E` | Punto del logo e indicadores (barra de la sección activa) |
| Verde texto | `secundario-700` | `#0A7A55` | Éxito, "Sí" del interruptor, aprobado |
| Cielo | `cielo` | `#E8F0FB` | Bloques destacados claros, insignias informativas, "Te consignamos" |
| Fondo | `fondo` | `#F4F7FB` | Fondo de página |
| Tinta | `tinta` / `tinta-suave` / `tinta-tenue` | `#14294A` / `#4A5B74` / `#5F6F86` | Texto principal, secundario y ayudas |
| Contorno de control | `linea-control` | `#7A8AA2` | Borde de campos, interruptor apagado, pasos pendientes |
| Divisor | `linea` / `linea-suave` | `#D5DEEA` / `#E6ECF4` | Bordes de panel y divisores (decorativos) |
| Texto sobre noche | `niebla` / `bruma` | `#C9D6EA` / `#A9BCD8` | Párrafos y notas sobre noche |

Rojo (`alerta`) solo para error, negación y acciones destructivas. Ámbar (`advertencia`) solo para "requiere tu acción" y para **simulado**: no se usa como decoración, así el distintivo de simulado sigue saltando a la vista (MR-004).

### Contraste medido (WCAG 2.x)

| Par | Contraste | Requisito |
|---|---|---|
| Blanco sobre noche | 15,89:1 | Texto 4,5:1 |
| Niebla sobre noche | 10,81:1 | Texto |
| Bruma sobre noche | 8,23:1 | Texto |
| Noche sobre menta-300 (botón `acento`) | 10,18:1 | Texto |
| Noche sobre menta-200 (`acento` en hover) | 11,78:1 | Texto |
| Menta-300 sobre noche (foco, íconos) | 10,18:1 | No texto 3:1 |
| Menta-300 sobre azul 600 (foco en el bloque azul) | 5,37:1 | No texto 3:1 |
| Blanco sobre azul 600 (botón primario) | 8,38:1 | Texto |
| Tinta sobre fondo | 13,52:1 | Texto |
| Tinta suave sobre fondo | 6,43:1 | Texto |
| Tinta tenue sobre fondo / blanco | 4,76:1 / 5,12:1 | Texto |
| **Tinta tenue sobre cielo** | **4,46:1** | **No cumple: no usar** |
| Azul 700 sobre cielo | 9,11:1 | Texto |
| `linea-control` sobre blanco / fondo | 3,51:1 / 3,27:1 | Borde de control 3:1 |
| Foco (azul 600) sobre blanco / fondo | 8,38:1 / 7,80:1 | Foco 3:1 |
| Verde 600 sobre blanco (indicadores) | 3,39:1 | No texto 3:1; nunca texto |
| Ámbar 700 (borde del distintivo) sobre ámbar 50 | 4,75:1 | No texto 3:1 |

## 4. Tipografía

- **Archivo Variable** (fundidora argentina Omnibus-Type), con eje de ancho, al **112 %** en títulos de marca (utilidad `titular`) y al 108 % en todo `h1`, `h2` y `h3` (regla base). Es una grotesca abierta y firme: seria sin ser de banco viejo. Paquete `@fontsource-variable/archivo`, solo el subconjunto latino que se usa.
- **Inter Variable** con eje óptico para texto, controles y **cifras** (`cifras`: números tabulares). Las cifras de dinero no van en Archivo: Inter tabular se lee mejor y alinea en columnas.
- Escala de la aplicación (ERS RI-02): 12, 14, 16, 20 y 24 px; títulos de página 24 px en el celular y 28 px desde 640 px; título de panel 20 px. Cuota y TEA: `text-cifra` (32) y `text-cifra-xl` (44), siempre la misma clase para las dos.
- Escala de la página pública: títulos de sección `clamp(28px, 5vw, 40px)` y el titular del hero `clamp(36px, 8vw, 60px)`, interlineado 1,04.
- Nada de mayúsculas sostenidas en etiquetas, nada de "antetítulos" sobre cada sección y nada de resaltar una sola palabra del titular.
- Líneas de texto de 65 caracteres como máximo.

## 5. Forma, profundidad y espacio

| Elemento | Radio |
|---|---|
| Campos, avisos pequeños | `campo`, 10 px |
| Paneles, avisos, tarjetas | `panel`, 16 px |
| Modales | 20 px |
| Bloques grandes de la página pública, recibo | `lienzo`, 28 px (recibo, 24 px) |
| Botones, insignias, navegación | píldora |

Los botones son píldoras y los campos rectángulos redondeados: se distinguen por la forma, no solo por el color.

Sombras teñidas de noche (nunca gris neutro), solo en lo que está **por encima** de la página:

- `shadow-reposo`: paneles normales y campos, casi imperceptible.
- `shadow-elevada`: el panel `destacado` (resultado, oferta), con un filo azul de 4 px arriba.
- `shadow-flotante`: modales, avisos emergentes y el botón de salto.
- `shadow-boton`: brillo interior y sombra mínima de los botones llenos.

Espacio: escala de 4 px. Secciones de la página pública con 64 px en el celular y 96 px en escritorio. Contenedor de 72 rem (1152 px).

## 6. Movimiento

Corto (150 a 260 ms) y con salida suave (`ease-salida`). Con `prefers-reduced-motion: reduce` se apaga todo (regla global en `index.css`).

- **Un solo momento orquestado:** el recibo de la página de inicio sube y aparece (700 ms) y sus renglones entran escalonados (60 ms entre cada uno).
- **Respuesta a la persona:** al recalcular, la cuota y la TEA entran juntas con `cifra-cambia` (260 ms); el pulgar del deslizador crece al arrastrarlo; los botones bajan 1 px al presionarlos; el interruptor desliza; la pregunta frecuente gira su "+".
- Nada de animaciones al hacer scroll ni de efectos al pasar el puntero por cada tarjeta.

## 7. Componentes base (lo que ya está en `components/ui/`)

| Componente | Cambio |
|---|---|
| `Button` | Píldora. Variantes nuevas `acento` (menta sobre noche), `claro` y `contorno-claro` (sobre noche); tamaño nuevo `lg` (52 px). Secundario con borde azul 600. Deshabilitado legible y con opacidad en el fantasma. |
| `Field`, `Input`, `Select`, `Textarea` | 48 px de alto, borde `linea-control`, el contorno de foco único del portal (UX-10), etiqueta en seminegrita. |
| `Switch` | Apagado con borde y pulgar oscuro, "Sí" o "No" visible al lado. |
| `Panel` | `normal` con sombra de reposo; `destacado` elevado con filo azul; título en Archivo de 20 px. |
| `Alert`, `Badge` | Info sobre cielo; insignias con anillo interior del mismo tono. |
| `EmptyState` | Ícono en un círculo cielo, título en Archivo. |
| `Stepper` | Paso actual con halo; pendientes con contorno de control. |
| `Modal`, `Toast` | Sombra flotante, fondo noche translúcido con desenfoque; cierre de 44 px en el celular. |
| `Logo` | F de dos trazos con el punto menta y la palabra en Archivo. |

Layouts: `CabeceraPublica` (clara u oscura) y `PiePublico` en noche; `PantallaAcceso` con panel noche, trenza, halo azul y el recibo de ejemplo; `PortalLayout` con navegación en píldoras, inicial del cliente y barra inferior con indicador verde y negrita (SV-10); `ConsolaLayout` en noche con indicador menta. Foco en menta sobre todo lo oscuro (clase `sobre-oscuro`).

## 8. Reglas que el rediseño no rompe

1. Cuota y TEA juntas, con el mismo componente (`CuotaConTea`) y la misma clase. Si un contenedor ajusta el tamaño, lo ajusta para las dos (como el recibo de la página de inicio).
2. Desglose completo y aviso de "no constituye aprobación" antes del botón que sigue (CP0011).
3. Distintivo de simulado en ámbar, con borde ámbar 700 y su forma de píldora con matraz.
4. Solo los últimos 4 dígitos de documento, celular y cuenta.
5. WCAG 2.2 AA: texto 4,5:1, controles y foco 3:1, áreas táctiles de 44 px, 320 px sin desplazamiento lateral.
6. Nada inventado presentado como real: los ejemplos se rotulan "Ejemplo".

## 9. Para frontend-senior (T29)

- Títulos de página: ya salen en Archivo por la regla base. Para un título de marca más expresivo, `titular`.
- Resultado protagonista de cada pantalla (cuota, oferta, decisión): `Panel variante="destacado"`.
- Bloques "lo que recibes" o totales: fondo `cielo` con texto `noche` (no `tinta-tenue` sobre cielo).
- Superficies oscuras nuevas: `bg-noche trama-trenza sobre-oscuro`, texto en blanco, `niebla` o `bruma`, y botones `acento`, `claro` o `contorno-claro`.
- Acciones de compromiso final (radicar, firmar): `exito`. Acción principal normal: `primario`.
