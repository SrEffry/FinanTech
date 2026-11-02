# Sistema visual del portal FinanTech

> **02/11/2026:** la guía de diseño vigente es `docs/ux/direccion-visual.md` (T28, P8). Este documento queda como inventario y registro de los hallazgos SV-01 a SV-12; la propuesta de la sección 3 ya está aplicada en `frontend/src/styles/index.css` y `components/ui/` (UX-10).

Autor: ux-ui-senior. Fecha: 01/11/2026. Fuente de los tokens: `frontend/src/styles/index.css` (bloque `@theme` de Tailwind 4) y las clases de `frontend/src/components/ui/`.

Base normativa: RI-02 (paleta, tipografía 12/14/16/20/24, espaciado en múltiplos de 4, rojo reservado), RI-01 (44×44 px en móvil, sin desplazamiento horizontal de 320 px a 4K), RI-04 (estados de botón), RNF-19 (WCAG AA, contraste 4,5:1, nada comunicado solo por color) y WCAG 2.2 AA (1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.5.8).

Los contrastes se calcularon con la fórmula de luminancia relativa de WCAG 2.x.

---

## 1. Inventario de tokens actuales

### 1.1 Color

| Token | Valor | Uso actual | Contraste sobre blanco | Sobre `fondo` (#F7F9FC) | ¿Apto para texto? |
|---|---|---|---|---|---|
| `primario-50` | #EEF3FA | Fondo de aviso info, fila activa | — | — | No (fondo) |
| `primario-100` | #D9E4F3 | Anillo de foco de campos, fondo de barra de progreso | 1,29 | — | No |
| `primario-200` | #B4C9E6 | Borde de aviso info; texto tenue sobre azul oscuro | 1,69 | — | Solo sobre `primario-700/800` (6,20 / 7,47) |
| `primario-300` | #84A6D3 | Borde del botón secundario, hover de campos | 2,51 | — | No |
| `primario-400` | #4F7DBB | **Anillo de foco global**, ícono de estado vacío | 4,21 | 4,00 | Solo texto grande |
| `primario-500` | #2B5FA3 | Borde de campo enfocado, dato favorable | 6,43 | — | Sí |
| `primario-600` | #1B4D8F | **Primario de la ERS**. Botón primario, completado | 8,38 | 7,95 | Sí |
| `primario-700` | #163F76 | Texto de enlace, hover del primario | 10,46 | 9,92 | Sí |
| `primario-800` | #12335F | Barra lateral de la consola | — | — | Fondo oscuro |
| `secundario-600` | #0E9F6E | **Verde de la ERS**. Solo en el logo | 3,39 | 3,21 | No (falla 4,5:1) |
| `secundario-700` | #0A7A55 | Botón de éxito, interruptor encendido, texto "cumple" | 5,35 | — | Sí |
| `secundario-800` | #08664A | Texto de insignia de éxito | 6,30 sobre `secundario-50` | — | Sí |
| `alerta-600` | #D92D20 | **Rojo de la ERS**. Botón peligro, borde de campo inválido | 4,83 | — | Sí (justo) |
| `alerta-700` | #B42318 | Texto de error | 6,57 | — | Sí |
| `advertencia-500` | #F59E0B | **Ámbar de la ERS**. Círculo de etapa con acción, borde del distintivo simulado | 2,15 | — | No |
| `advertencia-700` | #B45309 | Ícono de advertencia, semáforo "por vencer" | 5,02 | — | Sí |
| `advertencia-800` | #92400E | Texto sobre fondos ámbar | 6,71 sobre `advertencia-50` | — | Sí |
| `tinta` | #14294A | Texto principal | 14,52 | 13,77 | Sí |
| `tinta-suave` | #4A5B74 | Texto secundario | 6,91 | 6,55 | Sí |
| `tinta-tenue` | #5F6F86 | Ayudas, metadatos, placeholder | 5,12 | 4,85 | Sí (4,30 sobre `linea-suave`) |
| `fondo` | #F7F9FC | Fondo de página | — | — | — |
| `superficie` | #FFFFFF | Paneles | — | — | — |
| `linea` | #D5DEEA | **Bordes de campos**, divisores, círculos pendientes | 1,36 | 1,29 | No |
| `linea-suave` | #E6ECF4 | Divisores de tabla, fondo de insignia neutra | 1,19 | — | No |
| `dato-favorable` | #2B5FA3 | Barra "suma al puntaje" | 6,43 | — | Sí |
| `dato-desfavorable` | #C2410C | Barra "resta al puntaje" | 5,18 | — | Sí |
| `dato-capital` | #84A6D3 | Segmento "préstamo" de la barra de costos | 2,51 | — | No (tiene leyenda en texto) |
| `dato-costo` | #1B4D8F | Segmento "costo" | 8,38 | — | Sí |

Lo bueno: el equipo ya separó los tonos "de marca" de la ERS (600) de los tonos "de texto" (700/800) y documentó por qué. Insignias, avisos y textos de error cumplen 4,5:1 (insignias entre 5,8 y 9,4).

### 1.2 Tipografía

- Familia: Inter Variable con eje óptico (`@fontsource-variable/inter/opsz.css`). Cumple RI-02 ("Inter o equivalente").
- Escala usada: `text-xs` 12, `text-sm` 14, `text-base` 16, `text-lg` 18, `text-xl` 20, `text-2xl` 24, `text-cifra` 32 (2rem) y `text-cifra-xl` 44 (2,75rem).
- Cifras tabulares con la utilidad `cifras` (`tnum`, `cv11`).
- Títulos de página `text-2xl font-semibold tracking-tight`; títulos de panel `text-lg font-semibold`.

### 1.3 Espaciado, radios y tamaños

- Espaciado: escala de Tailwind (múltiplos de 4 px). Cumple RI-02. Hay valores sueltos que se salen de la regla: `py-2.5` (10 px), `gap-0.5` (2 px), `gap-1.5` (6 px), `-mt-3`, `h-4.5`, `size-4.5`, `size-3.5`. Son aceptables para ajustes ópticos, pero conviene limitarlos.
- Radios: `--radius-campo` 8 px (campos, botones), `--radius-panel` 12 px (paneles, modales), `rounded-full` (insignias).
- Áreas táctiles: botones `min-h-11` (44 px), en `sm` baja a 36 px desde 640 px (`sm:min-h-9`). Casillas con fila de 44 px. Barra inferior del portal de 64 px.

### 1.4 Foco

- Global: `:focus-visible { outline: 3px solid primario-400; outline-offset: 2px }`.
- Campos (`Field.tsx`): **anulan el contorno global** (`focus:outline-none focus-visible:outline-none`) y lo cambian por `border-primario-500` + `ring-3 ring-primario-100`.
- Deslizador: contorno sobre el pulgar.
- `FileDrop`: `focus-within:outline-3 outline-primario-400` sobre la etiqueta.
- `main` con `tabIndex=-1` y `outline-none` (destino del salto al contenido).

### 1.5 Componentes y estados (RI-04)

| Componente | Normal | Hover | Activo | Deshabilitado | En proceso |
|---|---|---|---|---|---|
| Botón primario | `primario-600` | `primario-700` | `primario-800` | fondo `linea`, texto `tinta-tenue` (3,77) | Spinner + `aria-busy` |
| Botón secundario | borde `primario-300` | borde `primario-500` + fondo `primario-50` | `primario-100` | borde `linea` | Igual |
| Botón fantasma | texto `primario-700` | fondo `primario-50` | `primario-100` | texto `tinta-tenue` | Igual |
| Peligro | `alerta-600` | `alerta-700` | `alerta-700` | Igual que primario | Igual |
| Éxito | `secundario-700` | `secundario-800` | `secundario-800` | Igual | Igual |

Los cinco estados de RI-04 existen en todas las variantes.

---

## 2. Problemas encontrados

Ordenados por severidad. Los IDs (SV-xx) se citan en `docs/ux/auditoria.md`.

### SV-01 (alta). Los bordes de los campos no se distinguen del fondo — WCAG 1.4.11, RI-02

`border-linea` (#D5DEEA) da **1,36:1** sobre blanco y 1,29:1 sobre `fondo`. WCAG 1.4.11 pide 3:1 para el contorno que identifica un control. Afecta a `Input`, `Select`, `Textarea`, `MoneyInput`, `FileDrop` (borde punteado), las tarjetas de opción del simulador y de la decisión, y las casillas (la clase `border-linea` en el `checkbox` no tiene efecto, el navegador dibuja el suyo). Para una persona de 60 años con el brillo del celular bajo y en la calle (perfil 6.3.1), los campos del registro son casi invisibles.

### SV-02 (alta). El interruptor apagado no se ve — WCAG 1.4.11

La pista apagada es `bg-tinta-tenue/40` ≈ #BFC5CF: **1,74:1** contra el panel blanco, y el pulgar blanco tiene el mismo 1,74:1 contra la pista. Además el estado se lee solo por la posición del pulgar y el color: no hay texto "Sí/No". Pantalla afectada: Mis datos y privacidad (las finalidades opcionales, que por RN-05 suelen estar apagadas).

### SV-03 (alta). El foco de los campos es casi invisible — WCAG 2.4.7 y 1.4.11

Los campos quitan el contorno global y dejan un anillo `primario-100` (**1,29:1**) más el cambio de un borde de 1 px a `primario-500`. Con teclado, el campo enfocado se distingue de los demás solo por un borde de 1 px que cambia de gris claro a azul. El resto del portal usa un contorno de 3 px: el comportamiento es inconsistente.

### SV-04 (media). El anillo de foco global no alcanza 3:1 sobre los fondos azules

`primario-400` da 4,21:1 sobre blanco (bien), pero **2,99:1 sobre `primario-800`** (barra lateral de la consola, menú móvil de la consola) y **2,48:1 sobre `primario-700`** (panel de identidad de las pantallas de acceso). Ahí el foco de "Bandeja de decisiones", "Cerrar sesión" o el logo no se ve bien.

### SV-05 (media). El borde del botón secundario y otros contornos de control no llegan a 3:1

`primario-300` (2,51:1) delimita el botón secundario. Como el texto del botón ya es legible, no es una falla estricta de 1.4.11, pero en el par "Volver / Continuar" del registro y la radicación el secundario parece deshabilitado frente al primario. Lo mismo pasa con los círculos de etapa pendientes (`border-linea`, 1,36:1) del seguimiento y del `Stepper`, que además usan `tinta-tenue` para el número.

### SV-06 (media). Verde y ámbar de la ERS usados donde no cumplen

- `secundario-600` (#0E9F6E, 3,39:1) es el verde de la ERS, pero no se puede usar para texto ni para íconos con significado. Hoy solo está en el logo, lo cual es correcto: hay que dejarlo documentado para que nadie lo use en texto.
- `advertencia-500` (#F59E0B, 2,15:1) es el borde del `DistintivoSimulado` y el relleno del círculo de etapa con acción pendiente. El círculo se salva porque el ícono va en `tinta` (6,76:1). El borde del distintivo no alcanza 3:1 sobre `advertencia-50` (2,03:1); el distintivo se reconoce por el texto, así que no es grave, pero es el elemento que **debe** saltar a la vista (MR-004).

### SV-07 (media). Escala tipográfica fuera de la ERS

RI-02 fija 12/14/16/20/24. El código usa además 18 (`text-lg`, títulos de panel y el motivo de la decisión), 32 y 44 (cifras). Las cifras grandes tienen justificación (cuota y TEA, RNF-20) y ya están como tokens propios. El 18 no tiene justificación: crea un nivel intermedio entre 16 y 20 que no está en la ERS.

### SV-08 (media). Toasts con cierre automático y botón pequeño — WCAG 2.2.1, RI-01

Los avisos emergentes se cierran solos a los 5 s (éxito) y 8 s (error). Los errores que solo llegan por toast (Privacidad, Guardar borrador) se pierden si la persona no está mirando. El botón de cerrar es de 32×32 px (`size-8`): cumple 2.5.8 (24 px) pero no los 44 px de RI-01 en móvil.

### SV-09 (media). Elementos fijos que tapan el foco en móvil — WCAG 2.4.11

En el celular conviven la cabecera fija (64 px), la barra inferior (64 px), el botón flotante "Guardar borrador" (44 px + margen, en la radicación) y los toasts (`bottom-20`). Al recorrer con teclado o con un teclado Bluetooth, el campo enfocado puede quedar debajo de la barra inferior o del botón flotante. No hay `scroll-padding` que lo compense.

### SV-10 (baja). Indicador de página activa en la barra inferior solo por color y grosor

En la barra inferior del portal la sección activa cambia el color (de `tinta-tenue` a `primario-700`) y el grosor del trazo del ícono. RI-02 pide que ningún estado se comunique solo por color. `aria-current` sí está (lo pone `NavLink`).

### SV-11 (baja). Disabled poco distinguible de normal en los botones fantasma

El fantasma deshabilitado cambia de `primario-700` a `tinta-tenue`: ambos son texto oscuro sin fondo. En "Quitar filtros" o "Anterior/Siguiente" de la auditoría no se nota que está deshabilitado. Los deshabilitados están exentos de contraste, pero el problema es de comprensión, no de contraste.

### SV-12 (baja). Valores sueltos fuera de la escala de 4 px

`py-2.5`, `gap-1.5`, `size-4.5`, `h-4.5`, `-mt-3`, `top-[-4px]`. No rompen nada; conviene que los nuevos componentes no sigan agregando.

---

## 3. Propuesta

Los cambios de esta sección son de `frontend/src/styles/index.css` y de las clases de `components/ui/`. Los implementa frontend-senior con mi revisión; ninguno cambia lógica.

### 3.1 Tokens nuevos o cambiados

```css
@theme {
  /* Contorno de controles: 3,51:1 sobre blanco y 3,33:1 sobre fondo (WCAG 1.4.11). */
  --color-linea-control: #7a8aa2;

  /* Foco: un solo token para todo el portal. Sobre blanco 8,38:1. */
  --color-foco: #1b4d8f;            /* primario-600 */
  --color-foco-sobre-oscuro: #ffffff; /* 12,62:1 sobre primario-800 */
}
```

- `linea` y `linea-suave` se quedan para divisores y bordes de panel (decorativos, no necesitan 3:1).
- `linea-control` pasa a ser el borde de `Input`, `Select`, `Textarea`, `MoneyInput`, `FileDrop`, tarjetas de opción (radio), círculos de etapa pendientes y la pista apagada del interruptor.
- `primario-400` deja de usarse para foco.

### 3.2 Foco único (resuelve SV-03 y SV-04)

```css
:focus-visible {
  outline: 2px solid var(--color-foco);
  outline-offset: 2px;
}
/* Sobre fondos azules (barra lateral, panel de acceso, botón de salto). */
.sobre-oscuro :focus-visible {
  outline-color: var(--color-foco-sobre-oscuro);
}
```

- En `Field.tsx` quitar `focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-primario-100` y dejar el contorno global; mantener `focus:border-primario-600` como refuerzo.
- Agregar `sobre-oscuro` al `aside` de `ConsolaLayout`, al menú móvil de la consola y al `aside` de `PantallaAcceso`.
- 2 px con 2 px de separación cumple 2.4.7 y deja margen para 2.4.13 (AAA) sin verse pesado.

### 3.3 Interruptor (resuelve SV-02)

- Pista apagada: fondo `superficie` con borde de 2 px `linea-control`; pulgar `tinta-tenue`. Encendida: `secundario-700` con pulgar blanco (5,35:1).
- Texto visible al lado: "Sí" / "No" (o "Autorizada" / "No autorizada") en `text-sm text-tinta-suave`. El `aria-checked` ya lo anuncia; el texto es para quien no distingue la posición.

### 3.4 Botones

- Secundario: borde `primario-600` (8,38:1) en vez de `primario-300`. Hover: fondo `primario-50`.
- Fantasma deshabilitado: además del color, `opacity-60` y sin subrayado; o mejor, en paginación ocultar "Anterior" en la primera página en vez de deshabilitarlo.
- Mantener `min-h-11` también en escritorio para `tamano="sm"` dentro del portal del cliente; el `sm:min-h-9` solo en la consola (tablas densas, RI-01 lo permite en 1366 px).

### 3.5 Tipografía

| Nivel | Tamaño | Uso |
|---|---|---|
| Cifra principal | 32 → 44 px (`text-cifra`, `text-cifra-xl`, con `clamp` en 320 px) | Cuota y TEA, siempre juntas y en la misma clase |
| Título de página | 24 px semibold | `h1` |
| Título de panel | **20 px** semibold (antes 18) | `h2` de `Panel`, título de modal |
| Cuerpo | 16 px | Texto, campos |
| Secundario | 14 px | Etiquetas, ayudas, tablas |
| Mínimo | 12 px | Metadatos, insignias. Nunca para información que el cliente necesita para decidir |

`text-lg` queda fuera del sistema. El motivo de la decisión en la explicación pasa a 20 px.

### 3.6 Avisos emergentes (resuelve SV-08)

- Éxito: se cierra a los 6 s, pero se pausa mientras el puntero o el foco están sobre él.
- Error: **no se cierra solo**. Además, todo error de una acción se repite en línea junto a la acción (`Alert tono="error"`), el toast es solo refuerzo.
- Botón de cerrar `size-11` en móvil, `sm:size-8` en escritorio.

### 3.7 Elementos fijos (resuelve SV-09)

```css
html { scroll-padding-top: 5rem; scroll-padding-bottom: 9rem; } /* móvil */
@media (min-width: 768px) { html { scroll-padding-bottom: 2rem; } }
```

Y en la radicación, el botón "Guardar borrador" deja de flotar en móvil: pasa a la fila de acciones del formulario (junto a "Volver" y "Continuar") y a la cabecera de la página. RI-03/8.2.3 piden que esté "siempre a mano", no que flote.

### 3.8 Distintivo de resultado simulado (SV-06)

- Borde `advertencia-700` (5,02:1) en vez de `advertencia-500`, fondo `advertencia-50`, texto `advertencia-800`.
- Tamaño mínimo `text-sm` cuando acompaña un resultado para el cliente (verificación, decisión, pagaré); `text-xs` solo en tablas de la consola.
- Se imprime: no lleva `no-imprimir`.

### 3.9 Barra inferior (SV-10)

Sección activa: además del color, una barra de 3 px `primario-600` arriba del ícono y la etiqueta en `font-semibold`.

### 3.10 Reglas de uso del color (para la guía de estilos que pide RI-02)

1. **Rojo** (`alerta`) solo para negación, error, rechazo y acciones destructivas. Nunca para cifras de costo.
2. **Verde** (`secundario-700`) para éxito y para el compromiso final (radicar, firmar). `secundario-600` solo en el logo.
3. **Ámbar** (`advertencia`) para "requiere tu acción" y para **simulado**. El texto siempre en 800.
4. **Azul** para navegación, acción primaria y datos.
5. Ningún estado solo por color: siempre con ícono o texto (ya se cumple en insignias, semáforo y etapas).

---

## 4. Verificación propuesta

- Prueba automatizada con axe-core (ya está en `node_modules` por Testing Library) sobre las pantallas principales, con las etiquetas `wcag2aa`, `wcag21aa` y `wcag22aa`. Lo coordino con qa-senior.
- Revisión manual de foco con teclado en registro, radicación, oferta y decisión.
- Captura en 320, 375, 768, 1366 y 1440 px de simulador, seguimiento y oferta (RI-01).
