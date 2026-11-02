# Auditoría UX/UI del portal FinanTech (ronda 1, T06)

Autor: ux-ui-senior. Fecha: 01/11/2026. Rama `feature`, portal en http://localhost:5173 con API simulada (MSW).

## Alcance y método

- **Flujos revisados:** registro, verificación de identidad, inicio de sesión y segundo factor, simulación, radicación, seguimiento, explicación de la decisión, oferta y firma, privacidad, bandeja y expediente del analista, decisión del oficial y administración (usuarios, parámetros, auditoría).
- **Contra qué:** ERS 7.1.1 (RI-01 a RI-04), RI-06, RNF-18, RNF-19, RNF-20, RNF-26, reglas RN-05, RN-32, RN-33, RN-36; prototipo de la sección 8 (8.1.1 a 8.3.4); `CLAUDE.md` (TEA junto a la cuota, simulado marcado, 4 dígitos); WCAG 2.2 AA; buenas prácticas de crédito digital (lenguaje claro, sin sorpresas de costo, decisiones explicables).
- **Cómo:** lectura del código de `frontend/src/features/`, `components/` y `styles/`; recorrido en Chrome sin interfaz a 320, 375 y 1366 px con las cuentas demo; axe-core 4.14 (etiquetas `wcag2a/aa`, `wcag21aa`, `wcag22aa`, `best-practice`) en 18 pantallas; cálculo de contraste de todos los tokens (detalle en `docs/ux/sistema-visual.md`).
- **Ojo:** frontend-senior está editando el portal en paralelo (T05). Varios hallazgos ya tienen un arreglo en curso en su copia de trabajo; los marco como **"En curso (frontend)"** para no duplicar trabajo. Hay que verificarlos cuando entregue.

### Severidades

| Severidad | Criterio |
|---|---|
| **Bloqueante** | Rompe un flujo del camino crítico en móvil, o incumple una regla de `CLAUDE.md`, un MR o un criterio que verifica un CP. No debe salir así en la primera versión. |
| **Alta** | Incumple un requisito de la ERS o WCAG 2.2 AA en el camino del cliente, o puede llevar a una decisión financiera con información incompleta o desactualizada. |
| **Media** | Fricción, inconsistencia o falla de accesibilidad fuera del camino crítico. |
| **Baja** | Pulido. |

### Resumen

| Severidad | Cantidad | Pendientes | En curso (frontend) |
|---|---|---|---|
| Bloqueante | 2 | 1 | 1 (UX-02) |
| Alta | 13 | 12 | 1 (UX-12; UX-14 a medias) |
| Media | 29 | 29 | 0 |
| Baja | 12 | 12 | 0 |

### Lo que ya está bien (no tocar)

- **CuotaConTea** pone la cuota y la TEA con la misma clase, tamaño y peso en simulador, radicación, seguimiento, oferta y decisión (RNF-20, CP0011).
- Finalidades opcionales **sin marcar** al empezar el registro (RN-05, CP0006); necesarias diferenciadas con candado.
- Etiquetas de estado para el cliente sin nombres técnicos (`ETIQUETA_CLIENTE`, RN-36); `EN_COMITE` se muestra como "En decisión".
- Documento y celular enmascarados a 4 dígitos (`enmascarar`, RNF-06).
- Dinero y porcentajes con unidad para lector de pantalla ("252.762 pesos", "18,90 por ciento", RNF-19).
- Modal nativo `<dialog>` con trampa de foco y Escape; confirmación modal para decidir, rechazar la oferta, revocar consentimientos necesarios, bloquear usuarios y publicar parámetros (RI-04).
- Insignias, semáforo y etapas siempre con ícono o texto, nunca solo color (RI-02). Ninguna falla de contraste de texto en axe.
- Desglose de costos, plan de pagos y texto del pagaré **antes** del botón de firma (RNF-20, 8.2.5); condiciones cambiadas junto al valor original.
- Salto al contenido, áreas táctiles de 44 px, `prefers-reduced-motion`, `autocomplete` correctos y `one-time-code` en los códigos.
- Aviso de inactividad de la consola con un minuto para seguir conectado (RN-16, WCAG 2.2.1).

---

## Hallazgos bloqueantes

### UX-01. El simulador se desborda horizontalmente en el celular — **Bloqueante**

- **Pantalla:** Simulador, público (`/simular`) y del cliente (`/portal/simular`). `SimuladorPagina.tsx:87`.
- **Problema:** a 320 y 375 px el contenido mide **733 px** de ancho (medido con Chrome sin interfaz). Toda la columna de paneles se ensancha y la persona tiene que desplazarse de lado para ver la TEA, el aviso y el desglose; cabecera y pie sí miden 375 px. Causa: el contenedor `grid gap-6 lg:grid-cols-[…]` no define columnas por debajo de `lg`, así que la única columna toma el ancho mínimo de su contenido, y la tabla del plan de pagos (`min-w-[560px]`) lo empuja aunque esté dentro de su región con scroll.
- **Afecta:** RI-01 ("de 320 px a 4K sin desplazamiento horizontal"), WCAG 1.4.10 Reflow (AA), 8.2.2. Es la puerta de entrada del 80 % de los clientes (6.3.1).
- **Propuesta:** en `SimuladorPagina.tsx:87` usar `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]` (`grid-cols-1` en Tailwind 4 es `minmax(0,1fr)`), y agregar `min-w-0` al `div` de la columna derecha (línea 155). Revisar el mismo patrón en `RadicacionPagina`, `SeguimientoPagina` y `OfertaPagina` (hoy no desbordan porque no tienen el `grid` sin columnas, pero conviene una prueba de 320 px en Vitest o en la prueba visual de QA).

### UX-02. Resultado simulado sin distintivo en la explicación de la decisión y en su constancia — **Bloqueante · En curso (frontend)**

- **Pantalla:** Explicación de la decisión (`ExplicacionPagina.tsx`) y su constancia impresa.
- **Problema:** la decisión se apoya en la central de riesgo simulada, pero la pantalla del cliente no lo decía y la franja "Datos de demostración" lleva `no-imprimir`, así que la constancia impresa salía sin marca. frontend-senior ya agregó un `DistintivoSimulado` en el encabezado usando `useServiciosSimulados()` (bandera de la sesión).
- **Afecta:** MR-003/MR-004 y `CLAUDE.md` ("toda pantalla o documento que muestre su resultado lleva un distintivo visible").
- **Propuesta:** validar el arreglo y completarlo con una bandera **por decisión**, no por sesión: agregar `fuente_central: 'simulada' | 'real'` (o `simulado: boolean`) a `ExplicacionDecision` en el contrato, igual que ya tiene `Evaluacion`. Así la constancia dice la verdad aunque el modo cambie después. Requiere cambio de contrato (backend-senior, RF-09). El distintivo debe imprimirse (sin `no-imprimir`).

---

## Hallazgos altos

### UX-03. El motivo interno del oficial llega tal cual al cliente — **Alta**

- **Pantalla:** Decisión del oficial (`DecisionPagina.tsx:208`) → Explicación (`ExplicacionPagina.tsx:68`). En los mocks, `vistas.ts:108` copia `decision.motivo` en `motivo_principal`.
- **Problema:** el campo dice "El cliente verá una versión en lenguaje claro", pero nada produce esa versión: el texto libre del oficial ("Score 480, mora 90 días, posible documento adulterado") se muestra al cliente. Puede exponer jerga, códigos y hasta sospechas de fraude.
- **Afecta:** RF-09, RNF-20, 8.2.6 ("motivo en lenguaje comprensible, sin códigos internos ni terminología técnica"), RN-36 en espíritu.
- **Propuesta:** separar dos campos en la decisión: **"Motivo interno"** (obligatorio, RN-54, solo consola) y **"Motivo para el cliente"**, elegido de un catálogo de motivos en lenguaje claro con texto opcional revisado (por ejemplo "La cuota superaría el 40 % de lo que te queda disponible cada mes"). En la decisión automática el motor usa el mismo catálogo. Cambio de contrato: `NuevaDecision.motivo_cliente` / `codigo_motivo`. **Lo decide el gerente** con backend-senior antes de T15/T16.

### UX-04. "Leí y acepto la política" sin poder leer la política — **Alta**

- **Pantalla:** Registro, paso 2 (`RegistroPagina.tsx:281-337`) y Mis datos y privacidad.
- **Problema:** solo se muestra un resumen de dos líneas. No hay enlace ni desplegable con el texto completo, pero la casilla dice "Leí y acepto".
- **Afecta:** RF-04, régimen de protección de datos (RNF-24: consentimiento previo, expreso e informado), 8.1.2.
- **Propuesta:** agregar `texto` o `url` a `PoliticaVigente` (contrato) y mostrar un enlace "Leer la política completa (versión 1.0)" que abra un `Modal` con el texto desplazable, o un `<details>`. Mismo enlace en Privacidad, junto a la versión. Texto de la casilla: "Acepto la política de tratamiento de datos". Requiere cambio de contrato (backend-senior, T08).

### UX-05. La cuota de la radicación no se actualiza al cambiar monto o plazo — **Alta**

- **Pantalla:** Radicación, sección "Crédito" (`RadicacionPagina.tsx:328-335`).
- **Problema:** `CuotaConTea` muestra `solicitud.cuota_estimada` del borrador guardado. Si la persona cambia el monto de 5 a 8 millones, sigue viendo la cuota de 5 millones con la nota "se recalcula al guardar". Es una cifra financiera incorrecta en pantalla.
- **Afecta:** RNF-20 ("información cierta"), RNF-26.
- **Propuesta:** recalcular con el endpoint de simulación (como el simulador, con `useEstable` de 220 ms) mientras se edita; si no se quiere otra llamada, al cambiar monto o plazo atenuar la cifra y mostrar en su lugar "Calculando tu cuota…" y guardar el borrador de inmediato. Nunca mostrar una cuota que no corresponde al monto visible. Mostrar junto a la cifra "para $ 8.000.000 a 24 meses".

### UX-06. El aviso de capacidad de pago aparece cuando la persona ya salió de la sección — **Alta**

- **Pantalla:** Radicación, "Trabajo e ingresos" (`RadicacionPagina.tsx:398-413`).
- **Problema:** `capacidad_pago` viene del servidor al guardar, y se guarda al pulsar "Continuar", que también cambia de sección. El aviso solo se ve si la persona vuelve atrás. Además el aviso muestra la cuota **sin la TEA**.
- **Afecta:** RF-06 FA-04, RNF-26 ("verificación de que la cuota no supere el límite de capacidad de pago"), RNF-20 / CP0011 ("TEA visible en toda pantalla donde aparezca una cuota").
- **Propuesta:** (1) al pulsar "Continuar" en esa sección, guardar y, si `supera_limite`, quedarse en la sección con el aviso enfocado y dos botones: "Ajustar monto o plazo" y "Continuar de todas formas". (2) Repetir el aviso en "Revisión". (3) Escribir la cuota con su TEA: "La cuota estimada de $ 441.246 (TEA 18,90 %) es el 46 % de lo que te queda disponible…".

### UX-07. En el celular no se ve el resultado mientras se mueven los deslizadores — **Alta**

- **Pantalla:** Simulador a 375 px (después de arreglar UX-01).
- **Problema:** primero van 6 tarjetas de producto y los dos deslizadores (≈ 750 px) y debajo el resultado. Al mover el monto la cuota cambia fuera de la pantalla: la promesa "se recalculan al instante" no se percibe.
- **Afecta:** 8.2.2, RNF-18 (retroalimentación inmediata), RI-04.
- **Propuesta:** en móvil (`< lg`): (1) producto como `Select` o tarjetas compactas de una línea (la descripción solo del elegido, ya es así); (2) una **barra de resumen fija** bajo la cabecera o encima de la barra inferior con "Cuota $ 252.762 · TEA 18,90 %" (mismo peso, mismo tamaño), que aparece cuando el panel de resultado sale de la vista (IntersectionObserver). El botón "Continuar con la solicitud" sigue en el panel.

### UX-08. No se puede escribir una tasa con decimales — **Alta**

- **Pantalla:** Decisión del oficial, "TEA (%)" (`DecisionPagina.tsx:191-197`); Parámetros, tasa máxima legal y TEA por producto (`ParametrosPagina.tsx:23, 88, 121`).
- **Problema:** el campo guarda un `number` y lo vuelve a pintar en cada tecla. Al escribir "24," el valor queda `24` y la coma desaparece; con punto pasa lo mismo. Tampoco se puede borrar el campo (vuelve a "0"). Además el valor se muestra con punto (24.5) y el resto del portal usa coma (24,50 %).
- **Afecta:** RI-04, RNF-18 (prevención de errores). Sin esto el administrador no puede fijar una tasa máxima legal real (por ejemplo 25,62 %) escribiéndola.
- **Propuesta:** componente `PercentInput` análogo a `MoneyInput`: estado de texto propio, acepta coma o punto, valida en `onBlur`, muestra "%" como sufijo y formatea con coma. Usarlo en las 3 pantallas. Lo mismo para plazos enteros: estado de texto para poder dejar el campo vacío.

### UX-09. La aprobación condicionada no muestra la cuota resultante — **Alta**

- **Pantalla:** Decisión del oficial con "Aprobar con condiciones".
- **Problema:** el oficial ajusta monto, plazo y tasa sin ver la cuota nueva, su TEA ni si respeta el 40 % del ingreso disponible. El modal de confirmación tampoco la muestra.
- **Afecta:** RNF-20, RNF-26 (capacidad de pago), RN de capacidad (40 %), 8.3.4.
- **Propuesta:** debajo de los ajustes, un `CuotaConTea tamano="mediano"` recalculado con la simulación y una línea "Cuota frente al disponible: 37 % (límite 40 %)" con ícono de alerta si lo supera. Repetirlo en el modal de confirmación.

### UX-10. Controles con bordes y foco casi invisibles — **Alta**

- **Pantalla:** todas las de formularios.
- **Problema:** borde de campos 1,36:1, interruptor apagado 1,74:1, foco de campos con anillo de 1,29:1. Detalle y valores en `sistema-visual.md` (SV-01, SV-02, SV-03).
- **Afecta:** WCAG 1.4.11 y 2.4.7, RI-02, RNF-19 (inclusión de personas con baja visión).
- **Propuesta:** token `linea-control` #7A8AA2 (3,51:1) para bordes de control; foco único de 2 px `primario-600` con 2 px de separación (blanco sobre fondos azules); interruptor con pista bordeada y texto "Sí/No". Ver `sistema-visual.md` §3.1 a §3.3.

### UX-11. El plan de pagos sale incompleto en la constancia y el pagaré impresos — **Alta**

- **Pantalla:** Oferta → "Descargar pagaré y plan"; Explicación → "Descargar constancia". Ambos llaman `window.print()`.
- **Problema:** `PlanPagos` muestra 6 cuotas salvo que se pulse "Ver las N cuotas", así que el documento impreso trae 6 de 36 cuotas. Además el botón dice "Descargar" pero abre el diálogo de impresión, que en el celular es confuso.
- **Afecta:** RNF-20 ("el plan de pagos se presenta completo antes de firmar"), RNF-26 (constancia descargable), 8.2.5.
- **Propuesta:** (1) filas 7 en adelante con `hidden print:table-row` cuando el plan está contraído; (2) etiqueta "Descargar o imprimir (PDF)" y una ayuda "Elige *Guardar como PDF*"; (3) a mediano plazo, PDF generado por el servidor (lo decide el gerente con fullstack, RF-11).

### UX-12. Navegación de página sin título ni anuncio — **Alta · En curso (frontend)**

- **Pantalla:** todo el portal (SPA).
- **Problema:** todas las páginas se llamaban "FinanTech" y el foco no se movía al cambiar de ruta (WCAG 2.4.2, nivel A). frontend-senior ya agregó `<title>` en `EncabezadoPagina` y `useFocoAlNavegar`. En mi recorrido aún quedan sin título propio el **panel del cliente** (`/portal`, no usa `EncabezadoPagina`) y los cambios de paso de la **radicación** y de la **verificación de identidad**, que no cambian la URL ni se anuncian (el registro ya lo hace con `aria-live`).
- **Propuesta:** `<title>Inicio · FinanTech</title>` en `PanelClientePagina`; en `EditorBorrador` y `VerificacionIdentidad`, mismo patrón que el registro: título con el paso ("Solicitud: trabajo e ingresos · FinanTech"), anuncio "Paso 3 de 6: Trabajo e ingresos" y foco al `h2` de la sección (hoy las secciones son `section aria-label` sin encabezado visible: agregar un `h2`).

### UX-13. Verificación de identidad sin guía de encuadre — **Alta**

- **Pantalla:** Registro paso 4 y `/portal/identidad` (`VerificacionIdentidad.tsx`).
- **Problema:** solo hay campos de archivo con `capture`. No hay guía de encuadre, ni vista previa de la foto antes de enviar, ni botón de captura como pide el prototipo.
- **Afecta:** RI-06 (CRÍTICO: "captura del documento por ambas caras con guía de encuadre"), 8.1.2.
- **Propuesta (sin cámara en vivo, para no agrandar el alcance):** en cada tarjeta (frente, reverso, rostro) una ilustración SVG con el marco y las cuatro esquinas, tres reglas cortas con íconos (luz, sin reflejos, cuatro esquinas) y, después de elegir la foto, la **miniatura** con "Usar esta foto" / "Tomar otra". Botón principal de cada tarjeta: "Tomar foto del frente" (abre la cámara trasera) y enlace secundario "Subir un archivo". La miniatura vive en memoria (`URL.createObjectURL`) y se libera al enviar (RI-06: no se guarda en el dispositivo).

### UX-14. La TEA no acompaña a la cuota en dos textos — **Alta**

- **Pantalla:** Radicación, aviso de capacidad (`RadicacionPagina.tsx:409`, ver UX-06); Oferta, aviso de condición cambiada (**ya corregido por frontend**, ahora dice la TEA original).
- **Afecta:** RNF-20 ("TEA visible en toda pantalla donde aparezca una cuota"), CP0011, `CLAUDE.md`.
- **Propuesta:** regla para el equipo: cualquier texto que nombre una cuota lleva su TEA en la misma frase, con `<Porcentaje>`. Agregar a CP0011 una prueba que busque `<Dinero>` de cuota sin `<Porcentaje>` en el mismo bloque.

### UX-15. El simulador y la oferta no dicen cuánto dinero recibe la persona — **Alta**

- **Pantalla:** Simulador, Oferta.
- **Problema:** el desglose dice que el estudio de crédito "se descuenta del valor que recibes", pero en ninguna parte aparece "Recibes en tu cuenta: $ 4.925.000". La persona cree que recibe 5 millones.
- **Afecta:** RNF-20 ("ningún costo revelado después de la aceptación"), RNF-26 ("información cierta y suficiente").
- **Propuesta:** fila destacada al final del desglose: "Te consignamos $ 4.925.000 (préstamo menos estudio de crédito)". Si el dato no viene de la API, pedir el campo `valor_a_recibir` en `Simulacion` y `Oferta` (fullstack-senior, T03 y T17).

---

## Hallazgos medios

| ID | Pantalla | Problema | Requisito / heurística | Propuesta |
|---|---|---|---|---|
| UX-16 | Simulador | El aviso "no es una aprobación" queda **debajo** del botón "Continuar con la solicitud". | 8.2.2, RN-25/RN-27, CP0011 | Moverlo dentro del panel de resultado, entre la cuota y el botón, en una línea con ícono: "Esta simulación no es una aprobación: las condiciones pueden cambiar tras el estudio." |
| UX-17 | Simulador, radicación, decisión, parámetros | Tres nombres para lo mismo: "TEA (efectiva anual)", "E.A." y "Tasa efectiva anual". "Tasa mensual equivalente 1,4531 %" con 4 decimales y sin explicación. | RNF-20 (términos explicados en el mismo punto), RNF-18 | Usar siempre "TEA" con la ayuda "tasa efectiva anual" la primera vez en cada pantalla; nunca "E.A." al cliente. Tasa mensual con 2 decimales y un botón de ayuda (ⓘ) que explique "equivale a pagar 1,45 % al mes sobre el saldo". |
| UX-18 | Radicación, revisión | "Marca la autorización para poder radicar **(RN-33)**": código de requisito visible al cliente. | RI-04 ("sin terminología técnica") | Quitar "(RN-33)". Dejar el ID solo en el comentario del código. |
| UX-19 | Radicación, revisión | No hay "Cambiar" por bloque; si faltan documentos solo se descubre al pulsar "Radicar". | RNF-18 (prevención de errores), 8.2.3 (resumen previo) | Enlace "Cambiar" en cada fila del resumen que lleva a su sección. Si faltan documentos requeridos, aviso en la revisión con botón "Cargar documentos" y "Radicar" deshabilitado con la razón visible. |
| UX-20 | Radicación | "Guardar borrador" flota sobre el contenido en móvil (encima de la barra inferior y debajo de los toasts) y puede tapar el campo enfocado. | WCAG 2.4.11 (AA), RI-01 | En móvil, botón en la fila de acciones del formulario y en el encabezado; en escritorio puede seguir fijo. `scroll-padding-bottom` (ver SV-09). |
| UX-21 | Inicio de solicitud | El monto vacío muestra "$ 0" como placeholder y el botón "Empezar solicitud" está deshabilitado sin decir por qué. El nombre del producto se corta en el `select` a 375 px. | RNF-18, RI-04 | Sin placeholder "0"; botón siempre habilitado con validación al enviar ("Escribe el monto", "Escribe el plazo"). Opciones del select solo con el nombre; la tasa "desde" como ayuda debajo. |
| UX-22 | Seguimiento | Cuando el estado cambia por el sondeo (cada 3 s / 30 s) nada lo anuncia; solo cambia la insignia. | WCAG 4.1.3, RN-34 | Región `aria-live="polite"` que diga "Tu solicitud pasó a: En estudio" y un toast de éxito si cambia mientras la persona está en la página. |
| UX-23 | Seguimiento, Mis solicitudes | "Cerrada" agrupa oferta vencida, oferta rechazada y desistida sin explicar cuál. | RN-36 (sin nombre técnico, pero comprensible), 8.2.4 | Mantener la insignia "Cerrada" y agregar una línea: "La oferta venció el 12 de nov." / "Rechazaste la oferta." / "Cerramos la solicitud porque no recibimos los documentos en 15 días." |
| UX-24 | Seguimiento | No dice qué sigue ni cuánto tarda cada etapa. | RNF-18, 6.3.1 ("certeza del estado") | Bajo la etapa actual: "Qué sigue: un analista revisa tus documentos. Suele tardar 1 día hábil." Textos por estado en `lib/estados.ts`. |
| UX-25 | Seguimiento (documento pedido) | "Enviar documentos" está deshabilitado sin explicar qué falta. | RI-04 | Habilitado siempre; si falta un requerido, mensaje en línea "Falta cargar: certificado laboral". |
| UX-26 | Panel del cliente | Las solicitudes negadas no aparecen en "Solicitudes en curso", aunque la reconsideración tenga plazo vigente. | RF-09, RNF-26 | Tarjeta "Decisiones recientes" con las negadas en plazo de reconsideración y su fecha límite: "Puedes pedir reconsideración hasta el 20 de nov." |
| UX-27 | Verificación de identidad | Se muestra "Coincidencia 0,92 (mínimo 0,85)": dato técnico sin utilidad para el cliente. | RNF-18, RI-04 | Al cliente: "Tu foto coincide con la de tu documento." El valor numérico solo en la consola. |
| UX-28 | Verificación de identidad | "Foto de tu rostro" dice "JPG o PNG" pero acepta PDF. | RNF-18 (consistencia) | `FileDrop` con `tipos` por uso: rostro solo `image/jpeg,image/png`. |
| UX-29 | Identidad bloqueada, panel | "Comunícate con nuestros canales de atención" sin decir cuáles. | RI-04 (mensaje accionable), RNF-26 | Texto con línea, correo y horario sintéticos de demostración, desde una constante de configuración. Sin revelar la causa (RN-10). |
| UX-30 | Explicación | La reconsideración solo se ofrece si la solicitud fue negada; 8.2.6 la pide también para la aprobación condicionada. | 8.2.6, RF-09 | Decisión de negocio para el gerente. Si se acepta: mismo panel con el título "¿No estás de acuerdo con las condiciones?". |
| UX-31 | Explicación | "Ver la oferta en el seguimiento" lleva al seguimiento y hay que buscar la oferta. | RI-03 (máximo 3 clics) | Botón directo "Revisar la oferta" a `/portal/ofertas/:id` (la explicación necesita `oferta_id`). |
| UX-32 | Oferta | La condición cambiada solo se marca con el valor anterior tachado en gris. | 8.2.5 ("se señala de forma explícita") | Insignia "Cambió" (tono acción) al lado del valor nuevo y fondo `advertencia-50` en la celda. |
| UX-33 | Oferta firmada | "Huella del documento firmado (SHA-256)" es jerga. | RNF-18 | "Código de verificación del pagaré" con ayuda "Sirve para comprobar que el documento no cambió después de firmarlo". |
| UX-34 | Privacidad | En 375 px la tabla del historial esconde "Acción" y "Versión" tras el desplazamiento horizontal. Los errores al cambiar un consentimiento llegan solo por toast. | RI-01, WCAG 3.3.1 | En móvil, lista apilada ("29 oct 2026 · Revocó · Encuestas de satisfacción · v1.0"). Error en línea bajo el interruptor que falló. |
| UX-35 | Todas | Toasts: el de error se cierra solo a los 8 s y su botón de cerrar es de 32 px. | WCAG 2.2.1, RI-01 | Ver SV-08: el error no se cierra solo y siempre se repite en línea. |
| UX-36 | Decisión del oficial | En 1366×768 la columna "Tu decisión" es pegajosa y más alta que la ventana: con "Aprobar con condiciones" abierto, el botón "Revisar y registrar" queda fuera de vista hasta el final de la página. | RI-01 (consola a 1366 px), RNF-18 | `xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto` en el `aside`, o quitar el `sticky`. |
| UX-37 | Consola (varias) | Botones deshabilitados sin razón: "Guardar observación" (< 5 caracteres), "Pedir documentos" (motivo < 10), "Publicar" (sí la explica). | RI-04 | Habilitar y validar al enviar con mensaje en el campo; o contador "Faltan 4 caracteres". |
| UX-38 | Registro | Fecha de nacimiento con el selector nativo de fecha: en Android obliga a retroceder décadas. El celular con `maxLength=10` corta si se escribe con espacios. | RNF-18, 6.3.1 (18 a 70 años) | Tres campos (día, mes, año) o texto con máscara DD/MM/AAAA; celular sin `maxLength`, quitando espacios y guiones antes de validar. |
| UX-39 | Registro | La contraseña no tiene "Mostrar" (el inicio de sesión sí). | WCAG 3.3.7/3.3.8 (2.2, autenticación accesible), RNF-18 | Mismo botón "Mostrar" en los dos campos. |
| UX-40 | Desglose de costos (simulador, oferta) | axe (serio): el `dl` del desglose tiene `div > div > dt` y un `dd` dentro del bloque del `dt`; el lector no asocia concepto con valor. | WCAG 1.3.1 | En `Costos.tsx`: cada fila `<div><dt>Intereses</dt><dd>$ 958.283</dd><dd class="text-sm">explicación</dd></div>` sin el `div` intermedio; la explicación como segundo `dd`. |
| UX-41 | Cabecera pública a 375 px | "Iniciar sesión" y "Crear cuenta" se parten en dos líneas cada uno. | RI-01, consistencia | En `< sm`: solo "Ingresar" (fantasma) y "Crear cuenta"; o `whitespace-nowrap` y logo solo con el símbolo. |
| UX-42 | Franja de demostración | axe (moderado): queda fuera de toda región. | WCAG 1.3.1 (buena práctica) | Envolverla en `<aside aria-label="Aviso de demostración">`. |
| UX-43 | Panel del cliente | 8.2.1 pide accesos a certificados y PQRS; no existen. | 8.2.1, RNF-26 (canal de PQRS) | Decisión del gerente: si quedan fuera de la primera versión, no mostrar nada (no dejar enlaces muertos) y registrarlo como desviación del prototipo. |
| UX-44 | `/portal/solicitar` | En una de tres pasadas la página quedó en blanco (sin `main` ni `h1`, según axe). Coincidió con ediciones en caliente de frontend; puede ser solo HMR. | Robustez | frontend-senior: confirmar que no hay un error de render; si lo hay, que el `errorElement` de la ruta muestre la pantalla de error en vez de dejarla en blanco. |

---

## Hallazgos bajos

| ID | Pantalla | Problema | Propuesta |
|---|---|---|---|
| UX-45 | Inicio de sesión | El botón "Mostrar/Ocultar" cambia el texto **y** usa `aria-pressed`: el lector anuncia "Ocultar, presionado". | Texto fijo "Mostrar contraseña" con `aria-pressed`, o texto que cambia sin `aria-pressed`. |
| UX-46 | Verificación de identidad | Salto de `h1` a `h3`. | `h2` en "Tu documento de identidad" y "Prueba de vida". |
| UX-47 | Registro | Las finalidades necesarias van en un `fieldset` sin controles. | `section` con `h3` en vez de `fieldset/legend`. |
| UX-48 | Reconsideración, decisión | Mínimos de 20 y 10 caracteres sin contador. | Contador "12 de 20 caracteres mínimos" en `Field` como ayuda viva. |
| UX-49 | Consola de contabilidad y dirección | El texto cita "RF-12 y RF-13", "RF-14". | Lenguaje de negocio: "Desembolsos y contabilidad llegan en la segunda entrega". |
| UX-50 | Bandeja | Falta filtro por tiempo en cola (8.3.1). La tabla no indica su orden inicial (`aria-sort`). | Filtro "En cola más de…" y `ordenInicial` por vencimiento. |
| UX-51 | Radicación | "Meses en tu trabajo actual" obliga a hacer cuentas. | Dos campos: años y meses. |
| UX-52 | Códigos (registro, 2FA, firma) | Cuando el código vence no se anuncia. | El texto "El código venció" en `role="status"`. |
| UX-53 | Barra inferior del portal | Página activa solo por color y grosor del ícono. | Barra superior de 3 px y etiqueta en negrita (SV-10). |
| UX-54 | Botones fantasma deshabilitados | No se distinguen de los habilitados. | Ver SV-11. |
| UX-55 | Expediente | "Cuota frente al disponible" supera el límite y solo cambia a rojo. | Agregar ícono de alerta y "supera el límite". |
| UX-56 | Usuarios | Cerrar el modal con Escape descarta lo escrito sin avisar. | Confirmar "¿Descartar los cambios?" si el formulario está sucio. |

---

## Verificación de las reglas que vigilan los CP

| Regla | Dónde se verifica | Estado |
|---|---|---|
| CP0006 · Finalidades opcionales sin marcar (RN-05) | Registro paso 2 | Cumple. |
| CP0011 · TEA junto a la cuota con el mismo peso | `CuotaConTea` en 5 pantallas | Cumple en las cifras; **falla en el texto del aviso de capacidad** (UX-06, UX-14). |
| CP0011 · Desglose completo | Simulador, oferta | Cumple, pero falta "lo que recibes" (UX-15). |
| CP0011 · "No constituye aprobación" | Simulador, radicación | Presente; mal ubicado en el simulador (UX-16). |
| Distintivo de simulado (MR-003/004) | Verificación, expediente, firma, auditoría, explicación | Explicación en curso (UX-02); falta bandera por decisión en el contrato. |
| RN-36 · Sin nombres técnicos | `ETIQUETA_CLIENTE` | Cumple. "Cerrada" necesita la razón (UX-23). El motivo libre del oficial puede filtrar jerga (UX-03). |
| Últimos 4 dígitos (RNF-06) | Documento, celular, referencia | Cumple. |
| RI-01 · Sin desplazamiento horizontal en 320 px | Simulador | **Falla** (UX-01). |

---

## Cambios que necesitan decisión del gerente o cambio de contrato

| Hallazgo | Qué se necesita | Dueño probable |
|---|---|---|
| UX-02 | `fuente_central` o `simulado` en `ExplicacionDecision` | backend-senior (T15/T16) |
| UX-03 | Motivo interno y motivo para el cliente separados; catálogo de motivos | gerente + backend-senior |
| UX-04 | Texto o URL de la política en `PoliticaVigente` | backend-senior (T08) |
| UX-11 | ¿PDF generado por el servidor o impresión del navegador? | gerente + fullstack-senior (T17) |
| UX-15 | `valor_a_recibir` en simulación y oferta | fullstack-senior (T03, T17) |
| UX-30 | Reconsideración también en aprobada condicionada | gerente |
| UX-31 | `oferta_id` en `ExplicacionDecision` | backend-senior |
| UX-43 | Accesos a certificados y PQRS fuera de la primera versión | gerente |

## Orden de implementación sugerido para frontend-senior (semana 2)

1. UX-01 (una línea), UX-18, UX-16, UX-40: arreglos de minutos.
2. UX-10 con `sistema-visual.md` §3.1 a §3.3 (tokens, foco, interruptor): un solo cambio en `styles/` y `ui/`.
3. UX-08 (`PercentInput`), UX-05, UX-06, UX-14, UX-09.
4. UX-11, UX-12 (lo que falta), UX-07.
5. UX-13 (guía de encuadre y miniatura).
6. Medios por pantalla.
