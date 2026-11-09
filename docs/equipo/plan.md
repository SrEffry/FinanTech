# Plan hasta la primera versión (28/11/2026)

Lo mantiene **gerente-proyecto**. Fecha de corte: 01/11/2026. Estado de cada tarea: `docs/equipo/tablero.md`.

## Situación de partida

- **Hecho:** entorno, monolito modular con prueba de frontera (CP0002), auditoría inmutable, RF-01 (32 pruebas en verde, ~100 s) y el portal completo sobre una API simulada (MSW).
- **Atraso frente al cronograma de la ERS (punto 4):** H2 "inicio de sesión activo" (23/10) **no se cumplió** y H3 "motor de evaluación en pruebas" (06/11) **no se va a cumplir**. El plan los reprograma (ver "Hitos").
- **Quedan 4 semanas** para ~41 endpoints y 12 de los 14 casos de prueba. El camino crítico es: **sesión → identidad verificada → radicación → evaluación → decisión → oferta y pagaré.**
- **Criterio de entrega del plan de pruebas (punto 15.3 + F1):** al menos 13 de los 14 CP en verde, y **CP0006, CP0010, CP0011 y CP0014 sin excepción**.

## Avance al cierre de la ronda 1 (01/11, noche)

- **Aprobadas:** T01, T02 (backend), T03, T04 (fullstack), T06 (+T13 adelantada, ux), T07 (qa), y además **T08 y T09 adelantadas** (backend). H2 queda cumplido en la API **5 días antes** de la nueva fecha, pendiente de que el portal lo integre (T05).
- **Consecuencia:** backend-senior puede empezar T10 (motor) desde ya, con una semana de holgura para H3. fullstack-senior empieza T11.
- Suite: 198 pruebas en verde (~4 min con varios agentes a la vez; antes eran ~100 s).

## P9 · Primera versión funcional de punta a punta (desde el 07/11) — manda sobre el resto del plan

**Estado al 09/11:** camino vital V1…V6 terminado y verificado en el navegador, en revisión de las personas (ver el tablero: C1…C10 y D28 a D30). T29 parcial (D28).

Decisión de Efren (tablero, P9): **el portal tiene que funcionar de punta a punta contra Laravel, sin MSW**, solo con el camino vital y con el rediseño aplicado. Lo que no está en el camino se posterga (lista abajo). Estado de partida: T01–T05, T08, T09, T12 (partes 1 y 2), T28 y T31 en `feature` (hasta `2f5e1b2`). En la copia de trabajo, sin entregar: T30, T33, T10 (backend), T11 (fullstack) y UX-13 (frontend).

### Camino vital y dueño de cada tramo

| # | Tramo | Backend | Portal | Estado al 07/11 |
|---|---|---|---|---|
| 1 | Registro y verificación de identidad | hecho (T01, T09) + T30/T33 por entregar | hecho + UX-13 por entregar | casi |
| 2 | Ingreso con segundo factor | hecho (T01) | hecho | listo |
| 3 | Simulación | hecho (T03) | hecho (rediseñado) | listo |
| 4 | Radicación con documentos y seguimiento | **V1 · fullstack** (T11) | **V1 · fullstack** (capa de API) + frontend (pantallas) | en curso |
| 5 | Evaluación automática | **V2 · backend** (T10) | — (el cliente ve el estado en el seguimiento) | en curso |
| 6 | Bandeja y decisión del oficial | **V3 · backend**: `originacion/bandeja` y `originacion/expedientes/{id}` (archivos nuevos en Originacion, como en D15) + `evaluacion/decisiones/contexto/{id}` + `POST evaluacion/decisiones` (T15) | frontend: integra la bandeja, el expediente y la decisión reales | pendiente |
| 7 | Oferta, aceptación con segundo factor y firma simulada | **V4 · fullstack**: Desembolso escucha `DecisionRegistrada`, `GET/POST desembolso/ofertas/{id}*` con `FirmaElectronicaService` simulado (T18) | frontend: integra la oferta y el pagaré | pendiente |
| — | Sin MSW | — | **V5 · frontend**: `VITE_API_SIMULADA=false` en `.env.development`; las pantallas fuera del camino muestran "No disponible en esta versión" y se ocultan sus accesos (T26) | pendiente |
| — | Recorrido y aceptación | — | **V6 · qa**: recorrido automatizado en el navegador, del registro a la firma, contra Laravel; 401/403 de cada endpoint nuevo. **ux-ui**: visto bueno visual y axe de cada pantalla del camino | pendiente |

### Fechas objetivo (entregas pequeñas y en verde)

| Fecha | Qué |
|---|---|
| Dom 08/11 | T30 + T33 entregados (backend); T11 parte 1 (borrador, documentos, radicar) entregada (fullstack); UX-13 entregado (frontend) |
| Lun 09/11 | T10 motor entregado (radicar dispara la evaluación); T11 completa con seguimiento y `solicitudes.ts` retirado del camino |
| Mié 11/11 | V3: bandeja, expediente y decisión del oficial reales |
| Vie 13/11 | V4: oferta, aceptación con segundo factor y firma simulada; V5: portal sin MSW |
| Sáb 14/11 | V6: recorrido completo en el navegador, CI en verde e informe a las personas |

El H3 (motor, dom 15/11) queda absorbido por V2. Los hitos H4 y H5 se mantienen para lo postergado.

### Decisiones para que el camino cierre (D20–D22 del tablero)

- **D20 · Caso escalado sin concepto del analista:** en esta versión, cuando el motor deja la solicitud EN_ESTUDIO (puntaje 500–699 o tercero caído), el sistema la pasa enseguida a EN_DECISION, por la máquina E3 y con el motivo "Concepto del analista postergado en la primera versión (P9)" en el historial. El oficial decide con la evaluación a la vista. **Aprobada por Efren (P10, 08/11)**; va en la lista de correcciones de la ERS v1.1.
- **D21 · Escenario de la demo:** la central de riesgo simulada tiene que permitir que la cuenta demo de Laura caiga en la franja de escalamiento (500–699), para que el recorrido pase por el oficial. backend-senior documenta cómo forzarlo y el resultado lleva el distintivo de simulado. Si se deja en "aprobado automático", el flujo salta la decisión del oficial.
- **D22 · Pantallas fuera del camino:** no se borran. Se ocultan sus accesos y, si alguien entra por URL, ven "No disponible en esta versión". MSW queda solo para las pruebas del portal.

### Postergado (después del 14/11, por el orden de recorte)

Administración (usuarios, parámetros, exportación de auditoría), comité, reconsideración, concepto y observaciones del analista, solicitud de documentos por el analista (PENDIENTE_CLIENTE), rechazo de la oferta si no alcanza, vencimientos programados y los hallazgos UX medios y bajos.

## Ronda 2 (desde el 01/11, noche) · decisiones de las personas P1…P8

Las decisiones de Efren del 01/11 (tablero, "Decisiones de las personas") mandan sobre este plan. Cómo entran:

| Decisión | Efecto en el plan |
|---|---|
| P1 · Ronda 1 en commits (`2f85f55`), PCOV activo, Mailpit en :8025 | La cobertura ya se mide en cada revisión. La línea de base se toma al empezar la ronda 2. |
| P2 · RI-08: JWT propio en cookie httpOnly con rotación | Se queda T01 como está y va a la ERS v1.1. Sin tarea nueva. |
| P3 · O-01: el registro duplicado responde neutro (RN-17) y avisa por correo al titular | **T30** (backend) y ajuste de las pruebas de QA dentro de **T32**. |
| P4 · RN-18 confirmada | Sin cambios: lo que hay en el portal y en la API se queda. |
| P5 · Integración continua en GitHub Actions | **T31** (qa). Desde que entre, "listo" también exige el flujo en verde. |
| P6 · Orden de recorte aprobado | La lista de "Qué se recorta" ya es oficial; el gerente la aplica sin volver a preguntar, avisando en el informe. |
| P7 · MR-004 y lectura de E3 aprobadas | Sin cambios en T15 y T18. |
| P8 · **Rediseño visual (prioridad de la ronda 2)** | **T28** (ux-ui-senior: identidad visual, sistema de componentes y página de inicio pública) y **T29** (frontend-senior: aplicarlo en todas las pantallas). Reemplaza a T13 y absorbe UX-10. |

**El H3 (motor, dom 15/11) no se mueve.** El rediseño solo ocupa a ux-ui-senior y a frontend-senior; backend-senior sigue con T10 y lo único que se le suma son dos tareas chicas (T30 y T33) que van **antes** del motor y no pasan de un día.

### Carga de frontend en la semana 2

frontend-senior tenía T12 (hallazgos UX + integración de T08, T09 y T11). Con el rediseño encima no alcanza, así que se reparte:

- **La integración de T11 en el portal pasa a fullstack-senior** en lo que es capa de API: `lib/api/solicitudes.ts`, los tipos de solicitud de `lib/api/tipos.ts` y el retiro de `mocks/handlers/solicitudes.ts`. Si una pantalla tiene que cambiar por el contrato, fullstack-senior lo pide en el tablero y frontend-senior lo hace.
- **UX-10 (contraste de bordes, interruptor y foco) sale de T12 y entra en T28**, porque son tokens.
- **Rediseño por niveles.** Diseño propio en la página de inicio, acceso (ingresar, segundo factor, registro), simulador, panel del cliente, radicación, seguimiento y oferta. La consola interna y la administración solo heredan los tokens y los componentes nuevos, sin trabajo a medida.
- **UX-13** (guía de encuadre en la verificación de identidad) queda al final de T12. Si no entra el dom 15/11, pasa a la semana 3 detrás de T19.

### Partición de archivos del portal durante la ronda 2

Rige mientras dure el rediseño, para que ux-ui, frontend y fullstack no se pisen. Es la propuesta de frontend-senior del 01/11, aprobada por el gerente:

| Agente | Archivos |
|---|---|
| ux-ui-senior | `frontend/src/styles/**`, los `components/ui/**` que ya existen, `components/dominio/Marca.tsx`, `components/layouts/**` (Publico, Portal, Consola y Comunes), la página de inicio nueva en `frontend/src/features/inicio/**`, ilustraciones y recursos en `frontend/src/assets/**` o `frontend/public/` y `docs/ux/**` |
| frontend-senior | `frontend/src/features/**` (menos `inicio/`), los componentes **nuevos** de T12 (`ui/PercentInput.tsx`, guía de encuadre), `components/dominio/*` (menos `Marca.tsx`; ux-ui avisa antes de tocarlos porque tienen las pruebas de CP0011 y del distintivo), `app/**` (incluida la ruta `/` hacia la página de inicio), pruebas del portal y `package.json` |
| fullstack-senior | `lib/api/solicitudes.ts`, `mocks/handlers/solicitudes.ts`, su línea en `mocks/handlers/index.ts` |
| compartido | `lib/api/tipos.ts`: se vuelve a leer justo antes de editar, cambios pequeños y aviso en el tablero |

- **Dependencias nuevas** (fuente tipográfica, iconos, animación): solo con aprobación del gerente en el tablero; las instala frontend-senior. Se prefieren CSS y `@fontsource` (nada de CDN ni fuentes externas en tiempo de ejecución).
- Si ux-ui-senior cambia la API de un componente de `ui/`, avisa en el tablero antes, porque lo usan las pantallas de frontend.

## Hitos reprogramados

| Hito | ERS | Nueva fecha | Se verifica con |
|---|---|---|---|
| H2 · Inicio de sesión con MFA activo | 23/10 | **Vie 06/11** | CP0008 y CP0009 en verde; el portal entra con la sesión real |
| H3 · Motor de evaluación en pruebas | 06/11 | **Dom 15/11** | CP0013 y CP0014 en verde; 95 % de cobertura en el motor |
| H4 · Camino de originación integrado, del registro a la firma | 13/11 | **Sáb 21/11** | Recorrido manual completo en el portal contra Laravel, sin handlers simulados del camino crítico |
| Congelamiento | — | **Jue 26/11** | Solo se corrigen defectos; nada nuevo |
| H5 · Primera versión funcional | 28/11 | **Sáb 28/11** | 14 CP ejecutados y documentados; informe de pruebas |

## Contratos entre módulos (decisión de coordinación)

Para que backend-senior y fullstack-senior trabajen en paralelo sin importarse modelos (CP0002):

| Quién expone | Qué | Lo usa |
|---|---|---|
| Identidad | `Services\SesionActual` (`usuario()`, `id()`, `clienteId()`, `rol()`, `exigir(...$roles)` → 401 `sin_sesion` / 403, `exigirClienteId()`) y middleware de sesión y de rol | Todos |
| Identidad | `Services\PerfilCliente` (`identidadVerificada`, `exigirIdentidadVerificada` → 409 RN-07, `datosConocidos` ya enmascarado, `usuarioId`, `tieneConsentimiento`). **El cliente se referencia entre módulos por su `cliente_id`.** Originacion lo consume por su contrato `Originacion\Contracts\DirectorioClientes` | Originacion (RN-07, RN-32, RN-33) |
| Identidad | `Services\SegundoFactor` (`emitirDesafio(usuarioId, proposito, referencia)`, `reenviar`, `verificar`) | Desembolso (RN-61) |
| Identidad | `Services\Auditoria::registrar()` (ya existe) | Todos |
| Originacion | Evento `Events\SolicitudRadicada(solicitudId)` y `Services\ConsultaSolicitudes::datosParaEvaluacion(id)` (arreglo/DTO, sin modelos) | Evaluacion |
| Originacion | `Services\TransicionesSolicitud::aplicar(id, estadoDestino, actor, motivo)` (valida la máquina de estados E3) | Evaluacion, Desembolso |
| Evaluacion | Eventos `Events\EvaluacionCompletada(solicitudId, resultado)` y `Events\DecisionRegistrada(solicitudId, decisionId, tipo, condiciones)` | Originacion, Desembolso |
| Desembolso | Escucha `DecisionRegistrada` (aprobada o condicionada) y crea la oferta | — |

Regla: los eventos viven en `App\Modules\<Emisor>\Events`, llevan solo identificadores y datos primitivos, nunca modelos. Si una firma cambia, el dueño avisa por `SendMessage` antes de cambiarla.

## Semana 1 — 02 al 08/11 · Sesión y base de originación (H2)

| ID | Tarea | Requisitos | Dueño | Depende de | Criterio de aceptación | Fecha |
|---|---|---|---|---|---|---|
| T01 | Sesión: login + MFA, cookie httpOnly (15 min / 7 días con rotación), bloqueo 5 intentos/30 min, mismo mensaje y tiempo, `GET/DELETE identidad/sesion`, recuperación 202 constante, registro abre sesión, `GET sistema/estado`, RBAC por rol, usuarios sintéticos de los 6 roles en el seeder | RF-03, RN-12…RN-17, RI-08, RNF-05, CP0008, CP0009 | backend-senior | — | Pruebas de 401/403 por rol; CP0008 y CP0009 en verde; ningún token en el cuerpo ni en `localStorage`; handler `sesion.ts` retirado y el portal entra con la sesión real | Vie 06/11 |
| T02 | Servicios públicos de Identidad de la tabla de contratos (firmas propuestas por backend el 01/11, aunque `identidadVerificada` lea por ahora el `estado_kyc` existente) | MR-002 | backend-senior | — | Firmas publicadas en el tablero el **mar 03/11**; prueba de arquitectura en verde | Mar 03/11 |
| T03 | Parámetros vigentes mínimos en `Evaluacion/` (tabla de solo adición con trigger, seeder sintético, `ParametrosVigentes`) y productos y simulación de punta a punta | RF-05, RN-23, RN-24, RN-44, CP0011 | fullstack-senior | — | La suma del desglose es igual al costo total; TEA ≤ máxima legal; 422 `fuera_de_rango` con mínimo y máximo; handler `simulacion.ts` retirado; el simulador del portal funciona contra Laravel | Mié 04/11 |
| T04 | Base de Originacion: tablas (con las columnas de E4), máquina de estados E3 como tabla de transiciones con historial, radicado `FT-AAAA-NNNNNN` secuencial por año con bloqueo, una solicitud activa por producto | RF-06, RN-28, RN-29, E3, E4 | fullstack-senior | T02 (firmas) | Pruebas de cada transición válida e inválida; dos radicaciones simultáneas no repiten número | Dom 08/11 |
| T05 | Portal: lint sin advertencias; integración de la sesión real (cookie, 401 → login, renovación silenciosa, cierre); retiro de handlers a medida que lleguen endpoints | RI-08, RNF-05 | frontend-senior | T01 | `npm test`, `npm run build` y `npm run lint` limpios; flujo de login contra Laravel | Dom 08/11 |
| T06 | Auditoría UX/UI de todos los flujos; primero bloqueantes y altos | RNF de usabilidad, RN-36, RI-04 | ux-ui-senior | — | `docs/ux/auditoria.md` con pantalla, problema, requisito, severidad y propuesta; bloqueantes y altos enviados al gerente el **jue 05/11** | Jue 05/11 |
| T07 | Matriz de trazabilidad; propuesta de PCOV; pruebas de seguridad de RF-01; CP0008 y CP0009 escritos por adelantado | RNF-12, CP0002, CP0008, CP0009 | qa-senior | T01 para ponerlos en verde | `docs/qa/trazabilidad.md` con los 14 CP; propuesta del Dockerfile aprobada por el gerente | Vie 06/11 |

## Semana 2 — 09 al 15/11 · Identidad verificada, radicación y motor (H3)

| ID | Tarea | Requisitos | Dueño | Depende de | Criterio de aceptación | Fecha |
|---|---|---|---|---|---|---|
| T08 | Consentimientos "Mis datos y privacidad" (cada cambio es fila nueva) | RF-04, RN-21, RN-22, CP0006 | backend-senior | T01 | Solo adición con trait y triggers; handler retirado | Lun 09/11 |
| T09 | Verificación de identidad y listas restrictivas con adaptadores simulados (éxito, coincidencia < 0,85, documento ilegible, caída; lista positiva), distintivo `simulado`, auditoría de cada llamada | RF-02, RN-07, RN-08, RN-10, RN-11, MR-003, CP0003, CP0007 | backend-senior | T01 | CP0003 y CP0007 en verde; `SERVICIOS_EXTERNOS=simulado` visible en `sistema/estado`; handler retirado | Mié 11/11 |
| T10 | Motor de reglas: evaluación de solo adición con `version_reglas` (la versión de `evaluacion_parametros` aplicada; si backend-senior separa reglas y parámetros, guarda las dos) y `variables_determinantes`, umbrales 700/500, cuota ≤ 40 % del ingreso disponible, catálogo de variables sin las prohibidas, `CentralRiesgoService` simulado, tercero caído → EN_ESTUDIO (nunca negar), escucha `SolicitudRadicada` | RF-08, RN-40…RN-46, RN-43, MR-003, CP0013, CP0014 | backend-senior | T04 (evento) | CP0013 y CP0014 (sin el panel, F2) en verde; **95 % de cobertura** del motor; `GET evaluacion/solicitudes/{id}/evaluacion` | Dom 15/11 |
| T11 | Radicación completa: borrador con precarga, edición, documentos (ruta cifrada, ≤ 10 MB), radicar (RN-33), `enviar-documentos`, seguimiento del cliente (lista y detalle con historial) | RF-06, RF-07, RN-30…RN-35, CP0012 | fullstack-senior | T02, T04, T09 (en pruebas basta un doble del servicio) | CP0012 en verde; handler `solicitudes.ts` retirado (salvo decisión y reconsideración); el cliente radica desde el portal | Sáb 14/11 |
| T12 | Hallazgos UX bloqueantes y altos aprobados que quedan: UX-05, 06, 07, 08, 09 y, al final, 13 (UX-10 pasa a T28); ajustes de pantalla que pida fullstack por T11 | RN-36, RNF-06, RNF-20, RF-06 FA-04, CP0011 | frontend-senior | T06, T11 | Pruebas, build y lint limpios; distintivo de simulado visible; cada UX cerrado verificado por ux-ui-senior en `docs/ux/auditoria.md` | Dom 15/11 |
| ~~T13~~ | Absorbida por T28 | — | — | — | — | — |
| T14 | CP0003, CP0007, CP0011 y CP0012 automatizados de punta a punta; pruebas de 401/403 de todo endpoint nuevo; cobertura medida | CP0003, CP0007, CP0011, CP0012, RNF-12 | qa-senior | T03, T09, T11 | Informe de cobertura en `docs/qa/`; defectos reportados a su dueño con severidad | Dom 15/11 |
| T28 | **Rediseño (P8), dirección y sistema.** (a) Dirección visual en `docs/ux/identidad-visual.md`: marca, paleta con contraste medido, tipografía, ilustración, profundidad y movimiento. (b) Tokens en `styles/` (absorbe UX-10 y SV-01…SV-12) y componentes de `ui/` rediseñados. (c) **Página de inicio pública** en `/` que venda el producto, con el simulador o un ejemplo y llamadas a registrarse y a simular. | P8, RI-01…RI-04, RNF-18…RNF-20, RN-36, CP0011, MR-004 | ux-ui-senior (con frontend-senior) | T06 | (a) y (b) el **mié 04/11**; (c) el **vie 06/11**. WCAG 2.2 AA: axe sin violaciones graves, contraste ≥ 4,5:1 en texto y ≥ 3:1 en controles y foco; 320 px sin desplazamiento lateral; `prefers-reduced-motion` respetado. Si muestra una cuota, va con su TEA al mismo peso y con "no constituye aprobación". Sin cifras, clientes ni testimonios inventados presentados como reales. Sin recursos de CDN. Test, lint y build en verde. | Vie 06/11 |
| T29 | **Rediseño (P8), aplicación** en las pantallas del cliente con diseño propio (acceso, registro, simulador, panel, radicación, seguimiento, explicación y oferta) y, solo con tokens y componentes, en la consola y la administración | P8, RI-01…RI-04, CP0006, CP0011, MR-004 | frontend-senior (revisa ux-ui-senior) | T28 (a, b) | Por grupos de pantallas, cada uno en verde (test, lint y build); ux-ui-senior da el visto bueno visual en el tablero; `CuotaConTea`, el distintivo de simulado y el enmascarado se mantienen; las pruebas de CP0006 y CP0011 siguen sin cambios en lo que verifican | Vie 13/11 |
| T30 | **P3:** registro con documento o correo existente → respuesta neutra igual a la de un registro nuevo y aviso por correo al titular | RN-17, RF-01, CP0005 | backend-senior | — | Mismo código, cuerpo y tiempo mínimo en ambos casos; correo al titular en Mailpit; nada en el log que delate la existencia; contrato actualizado | Mar 03/11 |
| T31 | **P5:** integración continua en GitHub Actions: Pest sobre MySQL 8.4 (suite completa y `--group=arch`) y `npm test`, `lint` y `build` del portal, en cada push y en cada pull request | P5, RNF-12, CP0002 | qa-senior | — | `.github/workflows/` válido; verde sobre `feature` cuando las personas lo suban; sin secretos en el repositorio (`APP_KEY` de prueba generada en el flujo) | Mié 04/11 |
| T32 | Ajuste de las pruebas de QA a P3 (CP0005 neutro) | CP0005, RN-17 | qa-senior | T30 | Las pruebas de enumeración del registro verifican la respuesta neutra | Mié 04/11 |
| T33 | SMS simulado a Mailpit (además de `laravel.log`, enmascarado en el log) y prefijo propio del throttle del registro (D8) | RF-01, RNF-07 | backend-senior | — | El código del SMS se ve en http://localhost:8025; el celular sigue enmascarado en el log; la prueba de D-01 sigue en verde | Mar 03/11 |

## Semana 3 — 16 al 22/11 · Decisión, consola y oferta (H4)

| ID | Tarea | Requisitos | Dueño | Depende de | Criterio de aceptación | Fecha |
|---|---|---|---|---|---|---|
| T15 | Concepto del analista y decisión del oficial: contexto, atribución por monto, motivo obligatorio, conflicto de interés, segregación, tasa ≤ máxima, decisiones de solo adición; emite `DecisionRegistrada` | RF-10, RN-53…RN-58 | backend-senior | T10 | Cada regla con su prueba (403/422); handler de decisiones retirado | Mié 18/11 |
| T16 | Explicación de la decisión para el cliente (sin códigos ni pesos) | RF-09, RN-52 | backend-senior | T10 | `GET .../decision` contra el real | Jue 19/11 |
| T17 | Consola interna: bandeja por rol, expediente, observaciones, solicitud de documentos (PENDIENTE_CLIENTE, 15 días) | RF-07, UC8 | fullstack-senior | T11 | Handler `consola.ts` retirado salvo concepto y decisión; analista y oficial ven solo lo suyo | Mié 18/11 |
| T18 | Oferta y pagaré: oferta 15 días, desafío MFA, aceptación con declaración, firma con `FirmaElectronicaService` simulado (SHA-256 + sello local marcado simulado), FORMALIZADA, rechazo | RF-11, RN-59, RN-61, RN-62, MR-004 | fullstack-senior | T15, T02 (`SegundoFactor`) | Handler `ofertas.ts` retirado; el pagaré muestra el distintivo de simulado | Sáb 21/11 |
| T19 | Integración de consola y oferta; verificación responsive en móvil | RNF-16, C3 | frontend-senior | T15–T18 | Recorrido H4 completo en el portal | Sáb 21/11 |
| T20 | CP0010, CP0013 y CP0014 (pares sintéticos) de punta a punta; recorrido E2E del H4; pruebas de seguridad de decisión | CP0010, CP0013, CP0014 | qa-senior | T10, T15 | Defectos reportados; matriz al día | Dom 22/11 |
| T21 | Revisión UX del recorrido completo; textos finales | RN-36 | ux-ui-senior | T19 | Lista final de ajustes a frontend | Dom 22/11 |

## Semana 4 — 23 al 28/11 · Estabilización y entrega (H5)

| ID | Tarea | Requisitos | Dueño | Criterio de aceptación | Fecha |
|---|---|---|---|---|---|
| T22 | Administración (**recortable**, ver abajo): parámetros versionados `P-AAAA.MM-n`, usuarios internos, consulta de auditoría | F-ADM-01/02/04, RN-44, RN-56 | backend-senior | Handler `administracion.ts` retirado o la pantalla marcada "no disponible en esta versión" | Mié 25/11 |
| T23 | Reconsideración (**recortable**) | RF-09, RN-49, RN-50 | backend-senior / fullstack-senior | Handler retirado o funcionalidad oculta | Mié 25/11 |
| T24 | Corrección de defectos (todos) | — | todos | Ningún defecto crítico o alto abierto | Jue 26/11 (congelamiento) |
| T25 | Ejecución formal de los 14 CP con evidencias e informe de pruebas | punto 15 | qa-senior | ≥ 13 de 14 y los 4 críticos en verde; cobertura ≥ 75 % global y ≥ 95 % en el motor | Vie 27/11 |
| T26 | Retiro de MSW del arranque normal (queda solo para pruebas del portal); README y cuentas de demostración | — | frontend-senior | `npm run dev` usa solo la API real | Jue 26/11 |
| T27 | Informe final y lista de verificación de la entrega | — | gerente-proyecto | — | Vie 27/11 |

## Definición de "listo" (vale para toda tarea)

1. Cumple el criterio de aceptación y cita los IDs de la ERS en código y pruebas.
2. Suite completa y `--group=arch` en verde (el gerente la corre sobre `finantech_test`).
3. Build, pruebas y lint del frontend limpios si tocó el portal.
4. El endpoint coincide con el contrato y su handler simulado se retiró.
5. Reglas de `CLAUDE.md`: frontera, solo adición con trigger, cifrado + `*_hash`, mensajes en español, auditoría, distintivo de simulado, nada sensible en logs.
6. Fila del tablero con archivos, pruebas y mensaje de commit sugerido.

## Qué se recorta si no alcanza (en este orden)

Se recorta alcance antes que calidad. **Orden aprobado por las personas (P6, 01/11):** el gerente lo aplica cuando haga falta y lo informa.

1. Simulación de impacto de parámetros (`POST evaluacion/parametros/simulaciones`) y exportación CSV de la auditoría.
2. Gestión de usuarios internos desde la consola (los usuarios se crean por seeder; la segregación RN-56 se sigue verificando en la decisión).
3. Publicación de parámetros desde la consola (la versión de reglas se publica por seeder; RN-44 se sigue cumpliendo).
4. Reconsideración (RF-09, RN-49): el portal la muestra como no disponible.
5. Comité (EN_COMITE, RF-10 FA-01).
6. Recuperación de contraseña completa (se deja el 202 constante de RN-17).
7. Vencimientos por tarea programada (oferta y PENDIENTE_CLIENTE): se calculan al consultar.

**No se recorta nunca:** lo que verifican los 14 CP (en especial CP0006, CP0010, CP0011 y CP0014), MFA, RN-43, el distintivo de simulado, la frontera de módulos y la evaluación que no niega por caída de un tercero.

## Plan de contingencia

- **Si el motor (T10) no está aprobado el dom 15/11:** fullstack-senior toma T17 y T18 primero, y la decisión del oficial (T15) pasa a ser compartida: backend-senior termina el motor y fullstack-senior hace T15 en `Evaluacion/` con permiso de propiedad del gerente.
- **Si la sesión (T01) no está el vie 06/11:** fullstack-senior sigue con pruebas usando `actingAs` y un doble de `SesionActual`; la integración en el portal se corre al lunes.
- **Reconstrucción del contenedor para PCOV:** solo con el visto bueno del gerente, en un momento acordado por el tablero, porque interrumpe las pruebas de todos.
- **Si el rediseño (T28/T29) se atrasa:** se aplica primero a la página de inicio, acceso, simulador y oferta (lo que ve la persona al entrar y lo que verifica CP0011). La consola y la administración se quedan solo con los tokens. **El rediseño nunca frena T19 ni el H4**: desde el lun 16/11, frontend-senior pone T19 por delante y lo que falte de T29 pasa a T21.
- **Si el corte por límite de uso interrumpe a un agente:** vale lo último que dejó en "Lista para revisión" en el tablero. Por eso cada entrega es pequeña y queda en verde.
