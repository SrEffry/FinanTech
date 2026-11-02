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
| T12 | Integración en el portal de T08, T09 y T11; implementación de los hallazgos UX bloqueantes y altos aprobados | RN-36, RNF-06 | frontend-senior | T06, T08, T09, T11 | Pruebas, build y lint limpios; distintivo de simulado visible | Dom 15/11 |
| T13 | Sistema visual (`docs/ux/sistema-visual.md`) y revisión de lo que integre frontend | RI-04 | ux-ui-senior | T06 | Tokens y contraste AA documentados | Vie 13/11 |
| T14 | CP0003, CP0007, CP0011 y CP0012 automatizados de punta a punta; pruebas de 401/403 de todo endpoint nuevo; cobertura medida | CP0003, CP0007, CP0011, CP0012, RNF-12 | qa-senior | T03, T09, T11 | Informe de cobertura en `docs/qa/`; defectos reportados a su dueño con severidad | Dom 15/11 |

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

Se recorta alcance antes que calidad. **Requiere aprobación de las personas** (ver informe).

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
