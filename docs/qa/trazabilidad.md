# Matriz de trazabilidad — primera versión

Mantiene: **qa-senior**. Corte: 07/11/2026 (P9). Fuentes: ERS (punto 7 requisitos, puntos 11 a 15 plan de pruebas), `docs/correcciones-ers-v1.1.md` y `docs/contrato-api-v1-frontend.md`.

Cadena: **requisito → caso CP del plan (14.x) → prueba automatizada → estado**. Los 48 casos que no son del camino crítico (11.3) se cubren con las pruebas Pest de cada requisito.

## Cómo leer los estados

| Estado | Significa |
|---|---|
| **Cubierto** | Hay prueba automatizada y pasa. |
| **Parcial** | Hay pruebas, pero falta parte del caso o del requisito (se indica qué). |
| **Falla** | La prueba existe y está en rojo por un defecto abierto (ver "Defectos"). |
| **En desarrollo** | El dueño está implementando el endpoint y sus pruebas; QA lo valida en la entrega. |
| **Sin prueba** | Todavía no hay implementación (se indica la tarea del plan). |
| **Fuera** | Fuera de la primera versión (11.2, CLAUDE.md). |

Pruebas que cita la matriz (todas en `backend/tests/` salvo las de Vitest):

| Abreviatura | Archivo | Dueño |
|---|---|---|
| ARCH | `Arch/FronteraModulosTest.php` | backend-senior |
| REG | `Feature/Identidad/RegistroClienteTest.php` | backend-senior |
| INM | `Feature/Identidad/InmutabilidadTest.php` | backend-senior |
| SES | `Feature/Identidad/SesionTest.php` | backend-senior |
| CYV | `Feature/Identidad/ConsentimientoYVerificacionTest.php` | backend-senior |
| SPI | `Feature/Identidad/ServiciosPublicosIdentidadTest.php` | backend-senior |
| SOL | `Feature/Originacion/SolicitudesTest.php` (pruebas de servicio, aún sin endpoints HTTP) | fullstack-senior |
| MAQ | `Feature/Originacion/MaquinaEstadosTest.php` | fullstack-senior |
| DIR | `Feature/Originacion/DirectorioClientesTest.php` | fullstack-senior |
| SIM | `Feature/Cliente/SimulacionTest.php` | fullstack-senior |
| PAR | `Feature/Evaluacion/ParametrosVigentesTest.php` | fullstack-senior → backend-senior |
| ESQ | `Feature/Infraestructura/EsquemaTest.php` | qa-senior |
| SREG | `Feature/Seguridad/RegistroSeguridadTest.php` | qa-senior |
| SSES | `Feature/Seguridad/SesionSeguridadTest.php` | qa-senior |
| CCM | `Feature/Evaluacion/CasosCriticosMotorTest.php` (RN-43 activas; revisión del catálogo; 3 `todo()` de CP0014: pasos 4-6 por HTTP, reversión y panel) | qa-senior |
| NEU | `Feature/Identidad/RegistroNeutroTest.php` (P3, T30) | backend-senior |
| SNEU | `Feature/Seguridad/RegistroNeutroSeguridadTest.php` (T32: log, cabeceras y señuelo frente a código equivocado) | qa-senior |
| CI | `.github/workflows/ci.yml` (GitHub Actions: Pest con cobertura, `--group=arch`, motor ≥ 95 %; lint, Vitest y build del portal). **Primera corrida en GitHub: verde** (`2f5e1b2`, rama `feature`, 08/11: backend 72 s, portal 77 s) | qa-senior |
| REC | `Feature/Recorrido/FlujoVitalP9Test.php` (P9: flujo vital por HTTP con cookies reales y segundo factor; 2 pruebas, 77 aserciones: hasta la evaluación automática, y D21 → bandeja → decisión → oferta → pagaré firmado) | qa-senior |
| V6 | `docs/qa/e2e/recorrido-p9.mjs` (recorrido en el navegador contra Laravel sin MSW; 9 pasos con OK, FALLA o PENDIENTE y evidencias. **9/9 el 09/11** contra :5173 por el escenario D21, puntaje 660) | qa-senior |
| VIT | `frontend/src/**/*.test.ts(x)` (Vitest) | frontend-senior |

> Las pruebas de Vitest sobre `frontend/src/mocks/` (motor, cálculos) verifican la **lógica de referencia** del portal, no el backend. No cuentan como cobertura de un requisito hasta que la regla viva en Laravel.

## 1. Los 14 casos del camino crítico

Criterio de aprobación (12.3 con la corrección F1): **13 de 14 exitosos y CP0006, CP0010, CP0011 y CP0014 sin excepción**.

| CP | Requisitos | Prueba automatizada | Estado | Qué falta |
|---|---|---|---|---|
| CP0001 Conexión MySQL | MR-001, RI-09 | ESQ "CP0001" (MySQL 8 y no SQLite, InnoDB y utf8mb4 en todas las tablas, seis roles, usuarios sintéticos de los seis roles) | **Cubierto** | Paso 5 (tipos contra el diccionario de datos): revisión manual con la evidencia del esquema. |
| CP0002 Frontera de módulos | MR-002, RNF-21 | ARCH (un caso por módulo, `Shared` sin módulos, sin funciones de depuración); ESQ (prefijo por módulo, sin llaves foráneas entre módulos); CI (paso propio `--group=arch` en cada push y pull request) | **Parcial** | Paso 5: la canalización existe (T31) y sus pasos se reprodujeron en local; falta verla en verde en GitHub cuando las personas suban `feature`. Pasos 2-4 (violación deliberada en rama desechable, la CI debe ponerse en rojo) se ejecutan a mano en T25. "Interfaz pública documentada" por módulo. |
| CP0003 Adaptador simulado | MR-003, RF-02, RI-10 | CYV "CP0003 y CP0007" (éxito, < 0,85, ilegible con 5 intentos, caída, lista positiva, auditoría marcada como simulada, proveedor real sin contratar) | **En desarrollo** (T09) | Distintivo visible en cada pantalla (portal, T12) y selección por `SERVICIOS_EXTERNOS` sin cambio de código: validar en T14. |
| CP0004 Registro del cliente | RF-01, RN-04, RN-06 | REG "CP0004" (4 pruebas); SREG "RNF-06" (cifrado, respuestas) | **Cubierto** (API) | Pasos 1-3 de interfaz (asistente de 4 pasos con progreso): verificación manual en T25. |
| CP0005 Validaciones de registro | RN-01, RN-02, RN-03, RN-17 | REG "CP0005" (6); SREG "CP0005 / RN-17" (4, ajustadas por backend a P3); NEU (P3: misma forma y código, latencia mínima, aviso al titular, señuelo, auditoría sin datos); SNEU (3) | **Cubierto** (copia de trabajo; T30 sin entregar) | P3: el duplicado responde 201 neutro, igual que un registro nuevo. Las 57 pruebas de registro pasan (02/11) sobre la copia de trabajo con T30 en curso; se confirma cuando backend entregue T30. Ver O-04 (canal residual). |
| CP0006 Consentimiento sin preselección (crítico) | RN-04, RN-05, RN-18, RN-21 | REG "CP0006" (3); INM "CP0006 paso 7" (2); CYV "CP0006" (7: estado por finalidad, otorga y revoca como filas nuevas, RN-18, solo el titular); VIT `integracion.test.tsx` | **En desarrollo** (T08) | Paso 4 en pantalla con la API real (T12). Paso 6 pide "explicar y solicitar confirmación": hoy la API solo rechaza; confirmar con el gerente si basta. |
| CP0007 Verificación de identidad | RF-02, RN-07, RN-08, RN-09, RN-10 | CYV "CP0003 y CP0007" (11); SOL "no se crea sin identidad verificada" y "vuelve a exigir la identidad al radicar" (RN-07) | **En desarrollo** (T09, T11) | Pasos 1 y 7 de punta a punta por HTTP cuando existan los endpoints de originación (T11). Paso 8 (las imágenes no quedan en el dispositivo): verificación manual. |
| CP0008 Inicio de sesión con MFA | RF-03, RN-13, RN-14, RN-15, RN-16 | SES "CP0008" (13), "segundo factor" (4), "RBAC" (3); SPI | **Cubierto** (pasa; falta la revisión de T01 por el gerente) | La app móvil (paso 7) está fuera de la primera versión. |
| CP0009 Bloqueo y mensaje genérico | RN-12, RN-17 | SES "CP0009" (7: mismo cuerpo y misma latencia, bloqueo 30 min, contador para correos inexistentes, auditoría), recuperación (3); SSES (límite por origen) | **Cubierto** | D-02 corregido: la contraseña probada ya no llega al log (SSES). |
| CP0010 Auditoría inmutable (crítico) | RNF-08 | INM "CP0010" (4); ESQ (triggers en **toda** tabla con `SoloAdicion`: hoy 6 tablas); SES (inicios y fallos); CYV (llamadas a proveedores); SOL (transición rechazada auditada, historial de estados de solo adición) | **Parcial** | Eventos que faltan: decisiones (T15), parametrización (T22), exportaciones (T22), accesos a datos de terceros (consola, T17). Consulta filtrable por usuario, fecha y entidad (T22). |
| CP0011 Simulación transparente (crítico) | RF-05, RN-23, RN-24, RN-25, RNF-20 | SIM "CP0011" (7) y rangos (5); PAR (7); VIT `componentes.test.tsx` (TEA junto a la cuota con el mismo peso) | **En desarrollo** (T03) | Validar con la entrega de T03: contraste con hoja de cálculo independiente, aviso "no constituye aprobación" en pantalla, plan descargable, recálculo < 1 s. |
| CP0012 Radicación | RF-06, RN-28, RN-29, RN-30, RN-32, RN-33 | SOL; MAQ; DIR; HTTP de T11 (`SolicitudesClienteHttpTest`: 401/403, RN-35, borrador, documentos RN-30, radicación); REC (de punta a punta: RN-07, borrador, documentos, radicado `FT-AAAA-NNNNNN`); VIT `validarArchivo`; V6 pasos 5-6 | **Cubierto** (API y navegador) | V6 radica en el navegador con PDF sintéticos mínimos y radicado `FT-AAAA-NNNNNN`. |
| CP0013 Evaluación trazable | RF-08, RN-40, RN-41, RN-44, RN-46 | Pruebas de T10 de backend (`Unit/Evaluacion/MotorReglasTest`, `Feature/Evaluacion/EvaluacionAutomaticaTest`: pasos 1 a 8, límites 700/699/500/499, RN-41, solo adición, central caída → manual, RN-19, modo real, 401/403/404); REC (radicar → evaluación → estado coherente con RN-40 y `version_reglas`); CCM (2 `todo()` de punta a punta por HTTP); REC (de punta a punta por HTTP: el cliente radica, el motor evalúa y el analista consulta la evaluación con `version_reglas`); V6 paso 8 | **Cubierto** (API y navegador) | V6 exige en la pantalla del oficial la versión de reglas y el distintivo de central simulada, y puntaje 660 en la respuesta (D21). |
| CP0014 Equidad del modelo (crítico) | RN-43, RNF-25 | CCM "RN-43" (3: esquema, identificadores de Evaluacion, detector) y "catálogo" (3: revisión independiente del catálogo de T10, prohibidas completas, ninguna prohibida admitida); T10 de backend (catálogo con justificación, reglas solo del catálogo, entrada sin atributos prohibidos, tres pares: nombre, edad, apellidos) | **En desarrollo (T10)** | Paso 9 (reversión humana de una decisión automatizada) en `todo()`: falta confirmar con backend si T15 permite decidir sobre una solicitud que ya decidió el motor. Pasos 4-6 por HTTP en `todo()` (cubiertos por servicio en T10). Pasos 7 y 8 (panel) fuera (F2). |

**Resumen al 09/11:** suite completa en `finantech_test_qa`: 368 pruebas en verde y 3 `todo()` (2516 aserciones). Flujo vital P9 de punta a punta en verde por la API (REC) y en el navegador sin MSW (V6, 9/9). CP0014 sigue parcial por los `todo()` de arriba. Quedan fuera de esta medición las pantallas sin recorrido automatizado (por ejemplo, expediente completo y negación).

**Resumen del 02/11 (histórico):** 5 cubiertos (CP0001, CP0004, CP0005, CP0008, CP0009), 4 parciales (CP0002, CP0010, CP0012, CP0014), 4 en desarrollo (CP0003, CP0006, CP0007, CP0011) y 1 sin prueba (CP0013, con los pasos preparados en `todo()`). De los 4 críticos (CP0006, CP0010, CP0011, CP0014) ninguno está cerrado todavía. CP0014 ya tiene las guardas de RN-43; le faltan el catálogo, los pares y la reversión (T10, T15). CP0005 se vuelve a validar con la respuesta neutra de P3 (T30 y T32).

Última ejecución (02/11), clon limpio de `HEAD` más los archivos de QA de esta ronda, sobre `finantech_test_qa`: **201 pruebas en verde y 21 `todo`, arquitectura 9/9, cobertura 96,2 % global y 100 % en el motor** (secciones 5 y 6). Portal en Node 22: **lint, 59 pruebas de Vitest y build en verde** sobre `HEAD`. La copia de trabajo de los demás agentes (T11, T28 y T30 en curso) no se midió.

Las pruebas de los defectos D-01 a D-04 llevan `->group('defectos')` y quedan como regresión. Una prueba que falle por un defecto nuevo se queda en rojo hasta que se corrija; no se salta (D7).

## 2. Requisitos funcionales de la primera versión

### Identidad (RF-01 a RF-04)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-01 flujo principal | CP0004 | REG CP0004; SREG | Cubierto | |
| RF-01 FA-01 documento existente | CP0005 | REG; SREG; NEU; SNEU | Cubierto (T30 en curso) | P3: respuesta neutra y aviso por correo al titular (manda RN-17). |
| RF-01 FA-02 reenvío 60 s, 3 por hora | — | REG "códigos de verificación" | Cubierto | |
| RF-01 FA-03 cliente migrado | — | — | Sin prueba | No hay migración de sistemas anteriores en la primera versión; confirmar alcance con el gerente. |
| RF-01 códigos vencidos (10 min) y registro vencido (30 min) | — | SREG "RF-01 — flujos sin prueba" | Cubierto | |
| RF-01 carrera por el documento | CP0005 | SREG "si otra cuenta tomó el documento" | Cubierto | Regresión de D-04. |
| RF-01 registro abre sesión (contrato, D4) | — | según la entrega de T01 | En desarrollo (T01) | Validar en la revisión de T01. |
| RN-01 documento único | CP0005 | REG; SREG (normalización) | Cubierto | |
| RN-02 correo único y verificado | CP0004, CP0005 | REG; SREG (sin distinguir mayúsculas) | Cubierto | |
| RN-03 mayor de 18 | CP0005 | REG (límite exacto); VIT | Cubierto | |
| RN-04 consentimiento con 4 campos | CP0004, CP0006 | REG | Cubierto | |
| RN-05 opcionales sin marcar | CP0006 | REG; CYV; VIT | Cubierto (API) | Pantalla de privacidad con la API real: T12. |
| RN-06 derivación de clave | CP0004 | REG | Cubierto | |
| RF-02, RN-07 a RN-11 | CP0003, CP0007 | CYV; SOL (RN-07) | En desarrollo (T09) | |
| RF-03 flujo principal, FA-01, FA-04 | CP0008, CP0009 | SES | Cubierto | |
| RF-03 FA-02 contraseña expirada, FA-03 dispositivo no reconocido | — | — | Sin prueba | No están en T01; confirmar si se recortan. |
| RN-12 bloqueo 5 intentos / 30 min | CP0009 | SES | Cubierto | |
| RN-13 acceso 15 min, RN-14 renovación 7 días con rotación | CP0008 | SES | Cubierto | |
| RN-15 MFA para internos | CP0008 | SES | Cubierto | |
| RN-16 inactividad de consola 15 min | CP0008 | SES | Cubierto | |
| RN-17 mensaje genérico | CP0005, CP0009 | SES (cuerpo y latencia, recuperación); SREG, NEU y SNEU (registro neutro, P3) | Cubierto | O-04 para el canal residual del registro. |
| RF-04, RN-18, RN-21 | CP0006 | CYV; INM | En desarrollo (T08) | |
| RN-19 consulta a centrales exige autorización | CP0012 | SOL (RN-33 toma el consentimiento del directorio) | Parcial | Se verifica de nuevo en el motor (T10). |
| RN-20 revocación en 24 h, RN-22 anonimizar datos revocados | — | — | Sin prueba | Confirmar alcance con el gerente (RF-15 está recortado). |

### Portal del cliente (RF-05 a RF-07)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-05, RN-23, RN-24, RN-26 | CP0011 | SIM; PAR | En desarrollo (T03) | |
| RN-25 aviso "no constituye aprobación" | CP0011 | — | Sin prueba | Es de interfaz: prueba de Vitest o verificación manual. |
| RNF-20 TEA junto a la cuota, mismo peso | CP0011 | VIT `CuotaConTea` | Cubierto (componente) | Verificar en todas las pantallas que muestran cuota (simulación, oferta). |
| RF-06, RN-28, RN-29, RN-32, RN-33 | CP0012 | SOL; MAQ; DIR; HTTP de T11; REC; V6 | **Cubierto** (API y navegador) | T11 entregado. |
| RN-30 formatos y 10 MB | CP0012 | VIT `validarArchivo` (solo portal); CYV (capturas JPG/PNG) | Parcial | Falta validar los documentos de la solicitud en el servidor (T11). |
| RN-31 borrador se elimina a los 30 días | — | — | Sin prueba (T11) | |
| RF-07, RN-34 a RN-37 | — | MAQ y SOL "cambios de estado" (máquina E3, motivo y actor); VIT `estados.test.ts` (RN-36); `SolicitudesClienteHttpTest`; REC; V6 | **Cubierto** (API y navegador) | Seguimiento y enlace a la oferta por HTTP y en el navegador. |

### Evaluación y decisión (RF-08 a RF-10)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-08, RN-39 a RN-46 | CP0013, CP0014 | PAR (versión de parámetros, solo adición); CCM (RN-43 y catálogo); pruebas de T10; REC; V6 | **Cubierto** (API y navegador) | Motor al 99,6 % en la medición del gerente (08/11; exigido 95 %, RNF-12). |
| RF-09, RN-47 a RN-52 | — | — | Sin prueba (T16, T23) | |
| RF-10, RN-53 a RN-58 | CP0014 (reversión) | `Feature/Evaluacion/DecisionOficialTest` (backend: RN-53 a RN-58, 401/403); REC; V6 paso 8 | **Cubierto** (API y navegador) | Atribución, conflicto, segregación, motivo, tasa máxima y solo adición en las pruebas de backend. CP0014 paso 9 sigue en `todo()`. |

### Formalización (RF-11)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-11, RN-59 a RN-62 | PRU-MR004-01 | `Feature/Desembolso/OfertasTest` (fullstack: emisión, 401/403/404, segundo factor, firma, vencimiento, rechazo); REC; V6 paso 9 | **Cubierto** (API y navegador) | Firma con adaptador simulado y distintivo visible en el pagaré (MR-004). |

### Fuera de la primera versión

RF-12 y RF-13 (RN-63 a RN-76), RF-14 (RN-77 a RN-82), RF-15 salvo consentimiento (RN-83 a RN-88), app móvil nativa, carga con 5.000 usuarios: **Fuera**.

## 3. Requisitos no funcionales y de interfaz

| Requisito | Prueba | Estado | Nota |
|---|---|---|---|
| RNF-05 autenticación y autorización | SES "RBAC" (401, 403, CSRF); CYV (solo el titular); REG (longitud y mezcla); SREG (contraseña filtrada) | Parcial | Falta: no reutilizar las últimas 5 contraseñas; 401/403 de cada endpoint nuevo (T14). |
| RNF-06 datos sensibles | REG (documento cifrado); SREG (registro pendiente cifrado, índice ciego con clave, respuestas sin documento); CYV (imágenes y rutas cifradas); SOL (referencia cifrada) | Parcial | D-01 y D-02 corregidos (regresión en SREG y SSES). Enmascarado a 4 dígitos: VIT `formato.test.ts` y SES (`documento_enmascarado`). |
| RNF-07 vulnerabilidades | SREG (límite 10/min en registro, inyección y marcado rechazados, asignación masiva); SSES (límite por origen en sesión) | Parcial | D-03 corregido. La CI ya existe (T31), pero aún sin análisis estático ni de dependencias (`composer audit`, `npm audit`): propuesta para la ronda 3. Falta CSP. |
| RNF-08 auditoría | INM; ESQ (triggers); SES | Parcial | Ver CP0010. |
| RNF-09 tolerancia a fallos | VIT `cliente.test.ts` (mensajes sin detalle técnico) | Parcial | Caída de terceros → evaluación manual: T09, T10. |
| RNF-12 calidad y cobertura | CI (`--coverage --min=75` y `phpunit.motor.xml --min=95` en cada push y pull request) | **Cubierto (cobertura)** | Línea de base del 02/11: **96,2 % global** y **100 % en Evaluacion** (sección 5). Faltan los estándares de código de RNF-12: analizador estático y formateador obligatorios en la CI (Pint ya está en `require-dev`) y complejidad ≤ 10: propuesta para la ronda 3. |
| RNF-20 claridad financiera | VIT `CuotaConTea` | Parcial | |
| RNF-25 equidad | CCM "RN-43" (esquema y código de Evaluacion) | Parcial | Pares sintéticos y reversión humana con T10, T15 y T20. |
| RNF-01, RNF-02 rendimiento | — | Sin prueba | Medir en T25: simulación < 1 s, p95 < 500 ms. |
| RNF-16, RNF-19 responsive y accesibilidad | lint `jsx-a11y` del portal | Parcial | Auditoría de ux-ui-senior (T06); verificación en 320, 375, 768 y 1440 px. |
| RI-07 API REST `/api/v1` | todas las pruebas de API | Cubierto | |
| RI-08 sesión por cookie httpOnly | SES | Cubierto | |

## 4. Defectos y observaciones

Los cuatro defectos de la ronda 1 fueron **corregidos por backend-senior y verificados por QA el 01/11**. Sus pruebas quedan como regresión en el grupo `defectos`. Correcciones: `dontReport(ErrorNegocio::class)` e `ini_set('zend.exception_ignore_args', '1')` en `bootstrap/app.php`; `#[\SensitiveParameter]` en contraseñas y códigos; `SmsSimulado` con `Enmascarar::ultimosCuatro`; 404 sin nombres internos; borrado del pendiente fuera de la transacción.

| ID | Severidad | Dueño | Resumen | Prueba | Estado |
|---|---|---|---|---|---|
| D-02 | **Alta** (condición de T01, D7) | backend-senior (y qa-senior para `docker/php/php.ini`, con aprobación) | Cada `ErrorNegocio` se escribe en `laravel.log` como ERROR con la traza completa, y la traza incluye los argumentos: **la contraseña probada en el inicio de sesión** (primeros 15 caracteres) y el correo, y los códigos de verificación digitados. Corrección propuesta: (1) `ErrorNegocio` no se reporta (`report(): bool { return false; }` o `dontReport` en `bootstrap/app.php`); (2) `#[\SensitiveParameter]` en todo parámetro de contraseña o código (`InicioSesion::iniciar`, `validarCredenciales`, recuperación, `SegundoFactor::verificar`, registro); (3) `zend.exception_ignore_args = On` (se puede fijar ya con `ini_set` al arrancar la aplicación y luego en `docker/php/php.ini`). | SSES "la contraseña probada…"; SREG "un error de negocio…", "las trazas de excepción…" | Corregido y verificado (01/11) |
| D-01 | Media (condición de T01, D7) | backend-senior | El adaptador `SmsSimulado` escribe el celular completo en el log. | SREG "el SMS simulado no deja el celular completo" | Corregido y verificado (01/11) |
| D-03 | Baja (semana 2) | backend-senior | Un 404 de binding responde `No query results for model [App\Modules\Identidad\Models\RegistroPendiente] …` aun con `APP_DEBUG=false`: expone nombres internos. | SREG "un registro inexistente responde 404…" | Corregido y verificado (01/11) |
| D-04 | Baja (semana 2) | backend-senior | Si el documento se registra por otra vía mientras se verifica, `crearCliente` borra el pendiente y lanza el 409 dentro de la misma transacción: el borrado se revierte y el pendiente queda vivo hasta vencer. | SREG "si otra cuenta tomó el documento…" | Corregido y verificado (01/11) |
| O-01 | Decisión | gerente-proyecto | CP0005 pone como criterio de falla "el mensaje revela la existencia confirmada de la cuenta", pero RF-01 FA-01 pide informar "que ya hay una cuenta". | NEU; SREG "CP0005 / RN-17" | **Resuelta por P3** (manda RN-17: respuesta neutra y aviso por correo al titular). La implementa backend-senior en T30; QA valida sus pruebas en T32 cuando la entregue. |
| O-02 | Media | gerente-proyecto | No hay canalización de integración continua: CP0002 paso 5 y RNF-07/RNF-12 ("en cada integración") no se pueden cumplir. | CI | **Resuelta por P5** con T31 (`.github/workflows/ci.yml`). Queda verla en verde en GitHub. |
| D-05 | **Alta** (bloqueaba la CI) | qa-senior | `phpunit.xml` declara la suite `tests/Unit`, pero la carpeta está vacía y git no la guarda. En un clon limpio (CI), Pest se detiene con `Test directory "tests/Unit" not found` y **no corre ninguna prueba**. En las copias locales no se ve porque la carpeta existe. Encontrado al reproducir el workflow con `git archive HEAD`. | Reproducción de CI | **Corregido (02/11):** `backend/tests/Unit/.gitkeep`. Las personas deben incluirlo en el commit de T31. |
| O-04 | Baja (riesgo residual, para decidir) | gerente-proyecto | Con P3 queda un canal inevitable. Quien escribe **un documento ajeno con su propio correo** recibe en su bandeja `RegistroNoDisponibleMail` en lugar de un código, y con eso sabe que esa cédula ya tiene cuenta. El cuerpo de la API es neutro, pero el correo no puede serlo: mandar un código falso lo delataría al verificar. Mitigaciones que ya existen: límite de 10 registros por minuto por origen (SREG) y 3 avisos por hora al titular (NEU). Hoy la enumeración masiva de cédulas cuesta como mínimo un correo por intento y queda en la auditoría. | NEU "con un documento repetido…" | Abierta: aceptar el riesgo residual y anotarlo en la ERS v1.1 (CP0005), o pedir un límite por documento. |
| O-03 | Baja | qa-senior | Las pruebas escribían en `storage/logs/laravel.log` de desarrollo (`testing.ERROR`). **Corregido (D7):** `<env name="LOG_CHANNEL" value="null"/>` en `phpunit.xml`. Las pruebas de logs siguen funcionando porque escuchan el evento `MessageLogged`. | — | Corregida (D7) |
| O-05 | Alta (ya no bloquea) | gerente-proyecto (entorno) | El 07/11 la API de desarrollo tarda entre 35 y 70 s por petición, incluso `GET sistema/estado`, y nginx corta a los 60 s con **504** (`upstream timed out`). Los estáticos responden en 0,1 s. Dentro del contenedor, `php -r 'echo 1;'` por `docker exec` tarda 12 s y cargar `vendor/autoload.php` tarda 16 s. **El equipo anfitrión está al 100 % de CPU**, con 2,6 GB libres de 16 GB. El proceso que más consume se llama `7dsgc.exe` (PID 7724, 9321 s de CPU, 1,7 GB, iniciado el 07/11 a las 21:55); Windows no deja ver su ruta. No es de PagaMas y QA no lo tocó. | **Cerrada para P9 (09/11):** `7dsgc.exe` ya no corre según el gerente (08/11) y la API responde en 0,5 a 3 s. V6 completó 9/9. D24 (`vendor` en volumen con nombre) está aplicada en el entorno: existe el volumen `pagamas_vendor-data`; la ventana la manejó otra persona o agente, no QA. | Abierta y escalada a Efren: `7dsgc.exe` sigue arriba y **reapareció con otro PID (13208) el 08/11**. El 08/11 la API responde en 12 a 46 s, sin 504. **D24 (mejora de entorno): escrita y SIN aplicar:** volumen `vendor-data` en `docker-compose.yml`, `opcache.revalidate_freq = 10` en `docker/php/php.ini` y el `composer install` posterior en el `README.md`. Rige cuando el gerente anuncie la ventana para recrear contenedores (con T30, T33, T10 y T11 aprobadas). |
| O-06 | Baja (texto, para decidir) | ux-ui-senior | El simulador del portal dice "Esta simulación no es una aprobación"; la radicación dice "no constituye aprobación", que es la fórmula de CLAUDE.md y CP0011. El sentido es el mismo. | V6 paso 4 (acepta ambas redacciones) | Abierta: decidir si se unifica el texto. |
| O-07 | Baja (entorno) | gerente-proyecto | En la raíz del repositorio hay un `node_modules/` sin ignorar, solo con cachés `.vite` y `.vitest-cache` (67 archivos) del 02/11 a las 12:30. No salió de V6 ni de QA: no hay corrida de vitest de QA a esa hora. | `git status` | Abierta: no se borró porque la instrucción era borrarlo solo si venía del recorrido. Lo decide el gerente. |

## 5. Cobertura (RNF-12)

PCOV está activo en la imagen desde el 01/11 (apagado por defecto, `pcov.enabled = 0` en `docker/php/php.ini`; se enciende solo al medir).

**Línea de base (02/11), sobre `HEAD` (`2f85f55`) + las pruebas de QA de esta ronda, en un clon limpio, sobre `finantech_test_qa`: 201 pruebas en verde y 21 `todo`.**

| Medida | Resultado | Exigido | Estado |
|---|---|---|---|
| Global, como mide `phpunit.xml` (todo `app/`) | **96,2 %** (1712/1780 sentencias; el texto de Pest dice 96,1 %) | ≥ 75 % | Cumple |
| Global sin migraciones, seeders ni rutas | **96,6 %** (1313/1359) | — | Referencia: la diferencia es mínima, así que `phpunit.xml` no se cambia. |
| Motor de reglas (`phpunit.motor.xml`: módulo Evaluacion sin `Database` ni `Routes`) | **100 %** (51/51; hoy solo `ParametrosVigentes`, `VersionParametros` y el proveedor) | ≥ 95 % | Cumple; la cifra que cuenta es la de T10. |
| Lógica contable | — | ≥ 95 % | Fuera de la primera versión (RF-12, RF-13). |

Por módulo (sin migraciones, seeders ni rutas): Identidad 95,8 %, Originacion 97,5 %, Cliente 99,2 %, Evaluacion 100 %, Shared 100 %.

Archivos de lógica por debajo del 80 % (huecos conocidos, ninguno del camino crítico):

| Archivo | Cobertura | Por qué | Acción |
|---|---|---|---|
| `Identidad/Adapters/ListasRestrictivasNoContratadas` | 0 % (0/2) | Ninguna prueba usa `SERVICIOS_EXTERNOS=real` con listas | backend-senior: una prueba como la de `VerificacionIdentidadNoContratada`. |
| `Identidad/Mail/CodigoSegundoFactorMail`, `CodigoVerificacionMail`, `RecuperacionContrasenaMail` | 11 % a 25 % | Las pruebas usan `Mail::fake()` y nunca renderizan el correo | Renderizar cada correo una vez y verificar que no lleve datos sensibles (RNF-06). Lo agrega QA en T14. |
| `Identidad/Adapters/SmsSimulado`, `Identidad/Models/Empleado` | 50 % | Las pruebas usan `SmsFalso`; `Empleado` no tiene uso todavía | Sin acción por ahora. |

**Cómo se exige (propuesto a backend-senior en el tablero, 02/11):**

```bash
# Global ≥ 75 % (CI: paso "Pest completo con cobertura")
docker compose exec -T -e DB_DATABASE=finantech_test_qa app php -d pcov.enabled=1 ./vendor/bin/pest --coverage --min=75
# Motor ≥ 95 % (CI: paso "Motor de reglas"): solo el módulo Evaluacion, con tests/Feature/Evaluacion y tests/Unit
docker compose exec -T -e DB_DATABASE=finantech_test_qa app php -d pcov.enabled=1 ./vendor/bin/pest -c phpunit.motor.xml --coverage --min=95
```

- `phpunit.motor.xml` mide **todo** el módulo Evaluacion salvo `Database` y `Routes`. Si backend separa el motor en una carpeta propia (por ejemplo `Evaluacion/Motor`), se ajusta el `<include>` entre los dos. Con T15 la decisión del oficial también vive en Evaluacion y queda dentro del 95 %, lo cual es más estricto que RNF-12. Si eso estorba, se acota el `<include>` al motor.
- Solo cuentan las pruebas de `tests/Feature/Evaluacion` y `tests/Unit`: el motor debe llegar al 95 % con sus propias pruebas, no de rebote por las de otros módulos.
- Medir con el código montado desde Windows es lento: la suite con cobertura tarda unos 17 minutos en `docker compose exec`, contra unos 3 minutos copiando el código dentro del contenedor. La CI corre en Linux y no tiene ese problema.
- Portal: `@vitest/coverage-v8` y `vitest run --coverage` siguen pendientes (dependencia nueva: se pide por D13). La lógica que vive en `src/mocks/` no cuenta.

## 6. Integración continua (P5, T31)

`.github/workflows/ci.yml`, en cada `push` y cada `pull_request`, con permisos de solo lectura y cancelación de corridas viejas de la misma rama. Las acciones están fijadas por SHA de commit, con la versión en un comentario: `actions/checkout` v7.0.1, `shivammathur/setup-php` 2.40.0, `actions/cache` v6.1.0 y `actions/setup-node` v7.1.0.

| Job | Pasos |
|---|---|
| **Backend** (ubuntu-24.04) | Servicio MySQL 8.4. PHP 8.4 con `pdo_mysql, bcmath, intl, zip, pcntl, opcache`, PCOV y los ini de `docker/php/php.ini` (`zend.exception_ignore_args`, zona horaria). `log_bin_trust_function_creators = 1` y utf8mb4 se fijan con `SET GLOBAL`, porque los contenedores de servicio de Actions no aceptan argumentos de arranque. Luego `docker/mysql/init.sql` (crea `finantech_test` y da los permisos), caché de Composer, `composer install`, `.env` desde `.env.example` con `key:generate` (sin secretos en el repositorio), Pest completo con `--coverage --min=75`, `--group=arch` (CP0002) en un paso propio y el motor con `--min=95`. |
| **Portal** (ubuntu-24.04) | Node 22 con caché de npm, `npm ci`, `npm run lint`, `npm test` y `npm run build` en `frontend/`. |

**Validación (02/11):**
- actionlint 1.7.7 (con shellcheck): 0 errores.
- Job del portal reproducido en `node:22` sobre `git archive HEAD`: `npm ci`, lint, Vitest 59/59 y build, todo correcto.
- Job de backend reproducido en la imagen del proyecto sobre `git archive HEAD` más los archivos de esta ronda, con base limpia: `composer install` correcto, `key:generate` correcto, Pest con cobertura 201 en verde (salida 0), arch 9/9 (salida 0) y motor 100 % (salida 0).
- La reproducción encontró D-05 (sección 4).
- Falta ver la primera corrida en GitHub cuando las personas suban `feature`.
