# Matriz de trazabilidad — primera versión

Mantiene: **qa-senior**. Corte: 01/11/2026. Fuentes: ERS (punto 7 requisitos, puntos 11 a 15 plan de pruebas), `docs/correcciones-ers-v1.1.md` y `docs/contrato-api-v1-frontend.md`.

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
| VIT | `frontend/src/**/*.test.ts(x)` (Vitest) | frontend-senior |

> Las pruebas de Vitest sobre `frontend/src/mocks/` (motor, cálculos) verifican la **lógica de referencia** del portal, no el backend. No cuentan como cobertura de un requisito hasta que la regla viva en Laravel.

## 1. Los 14 casos del camino crítico

Criterio de aprobación (12.3 con la corrección F1): **13 de 14 exitosos y CP0006, CP0010, CP0011 y CP0014 sin excepción**.

| CP | Requisitos | Prueba automatizada | Estado | Qué falta |
|---|---|---|---|---|
| CP0001 Conexión MySQL | MR-001, RI-09 | ESQ "CP0001" (MySQL 8 y no SQLite, InnoDB y utf8mb4 en todas las tablas, seis roles, usuarios sintéticos de los seis roles) | **Cubierto** | Paso 5 (tipos contra el diccionario de datos): revisión manual con la evidencia del esquema. |
| CP0002 Frontera de módulos | MR-002, RNF-21 | ARCH (un caso por módulo, `Shared` sin módulos, sin funciones de depuración); ESQ (prefijo por módulo, sin llaves foráneas entre módulos) | **Parcial** | Paso 5: **no hay canalización de integración continua** en el repositorio. Pasos 2-4 (violación deliberada en rama desechable) se ejecutan a mano en T25. "Interfaz pública documentada" por módulo. |
| CP0003 Adaptador simulado | MR-003, RF-02, RI-10 | CYV "CP0003 y CP0007" (éxito, < 0,85, ilegible con 5 intentos, caída, lista positiva, auditoría marcada como simulada, proveedor real sin contratar) | **En desarrollo** (T09) | Distintivo visible en cada pantalla (portal, T12) y selección por `SERVICIOS_EXTERNOS` sin cambio de código: validar en T14. |
| CP0004 Registro del cliente | RF-01, RN-04, RN-06 | REG "CP0004" (4 pruebas); SREG "RNF-06" (cifrado, respuestas) | **Cubierto** (API) | Pasos 1-3 de interfaz (asistente de 4 pasos con progreso): verificación manual en T25. |
| CP0005 Validaciones de registro | RN-01, RN-02, RN-03 | REG "CP0005" (6); SREG "CP0005 / RN-17" (4) | **Cubierto** | Ver observación O-01: el mensaje confirma que la cuenta existe; la ERS se contradice. |
| CP0006 Consentimiento sin preselección (crítico) | RN-04, RN-05, RN-18, RN-21 | REG "CP0006" (3); INM "CP0006 paso 7" (2); CYV "CP0006" (7: estado por finalidad, otorga y revoca como filas nuevas, RN-18, solo el titular); VIT `integracion.test.tsx` | **En desarrollo** (T08) | Paso 4 en pantalla con la API real (T12). Paso 6 pide "explicar y solicitar confirmación": hoy la API solo rechaza; confirmar con el gerente si basta. |
| CP0007 Verificación de identidad | RF-02, RN-07, RN-08, RN-09, RN-10 | CYV "CP0003 y CP0007" (11); SOL "no se crea sin identidad verificada" y "vuelve a exigir la identidad al radicar" (RN-07) | **En desarrollo** (T09, T11) | Pasos 1 y 7 de punta a punta por HTTP cuando existan los endpoints de originación (T11). Paso 8 (las imágenes no quedan en el dispositivo): verificación manual. |
| CP0008 Inicio de sesión con MFA | RF-03, RN-13, RN-14, RN-15, RN-16 | SES "CP0008" (13), "segundo factor" (4), "RBAC" (3); SPI | **Cubierto** (pasa; falta la revisión de T01 por el gerente) | La app móvil (paso 7) está fuera de la primera versión. |
| CP0009 Bloqueo y mensaje genérico | RN-12, RN-17 | SES "CP0009" (7: mismo cuerpo y misma latencia, bloqueo 30 min, contador para correos inexistentes, auditoría), recuperación (3); SSES (límite por origen) | **Cubierto** | D-02 corregido: la contraseña probada ya no llega al log (SSES). |
| CP0010 Auditoría inmutable (crítico) | RNF-08 | INM "CP0010" (4); ESQ (triggers en **toda** tabla con `SoloAdicion`: hoy 6 tablas); SES (inicios y fallos); CYV (llamadas a proveedores); SOL (transición rechazada auditada, historial de estados de solo adición) | **Parcial** | Eventos que faltan: decisiones (T15), parametrización (T22), exportaciones (T22), accesos a datos de terceros (consola, T17). Consulta filtrable por usuario, fecha y entidad (T22). |
| CP0011 Simulación transparente (crítico) | RF-05, RN-23, RN-24, RN-25, RNF-20 | SIM "CP0011" (7) y rangos (5); PAR (7); VIT `componentes.test.tsx` (TEA junto a la cuota con el mismo peso) | **En desarrollo** (T03) | Validar con la entrega de T03: contraste con hoja de cálculo independiente, aviso "no constituye aprobación" en pantalla, plan descargable, recálculo < 1 s. |
| CP0012 Radicación | RF-06, RN-28, RN-29, RN-30, RN-32, RN-33 | SOL (27: borrador, RN-28 también en la base, radicado `FT-AAAA-NNNNNN` sin repetir en concurrencia, RN-32, RN-33, evento `SolicitudRadicada`); MAQ (5); DIR (4); VIT `validarArchivo` | **Parcial** (T04 en servicio) | Endpoints HTTP, documentos JPG/PNG/PDF de hasta 10 MB validados en el servidor (RN-30), borrador y reanudación: T11. |
| CP0013 Evaluación trazable | RF-08, RN-40, RN-41, RN-44, RN-46 | — (VIT `mocks/motor.test.ts`, solo referencia) | **Sin prueba** | T10 (motor, 95 % de cobertura) y T20. |
| CP0014 Equidad del modelo (crítico) | RN-43, RNF-25 | — (VIT `mocks/motor.test.ts`, solo referencia) | **Sin prueba** | T10, T15 y T20 (pares sintéticos, reversión humana). Panel de equidad fuera (F2). |

**Resumen hoy (01/11, noche):** 5 cubiertos (CP0001, CP0004, CP0005, CP0008, CP0009), 3 parciales (CP0002, CP0010, CP0012), 4 en desarrollo (CP0003, CP0006, CP0007, CP0011), 2 sin prueba (CP0013, CP0014). De los 4 críticos (CP0006, CP0010, CP0011, CP0014) ninguno está cerrado todavía; CP0014 no tiene nada.

Última ejecución sobre `finantech_test_qa` (01/11, después de las correcciones de backend): **suite completa con 198 pruebas, todas en verde, incluida la de arquitectura**. Portal: **62 pruebas de Vitest en verde**.

Las pruebas de los defectos D-01 a D-04 llevan `->group('defectos')` y quedan como regresión. Una prueba que falle por un defecto nuevo se queda en rojo hasta que se corrija; no se salta (D7).

## 2. Requisitos funcionales de la primera versión

### Identidad (RF-01 a RF-04)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-01 flujo principal | CP0004 | REG CP0004; SREG | Cubierto | |
| RF-01 FA-01 documento existente | CP0005 | REG; SREG (mismo cuerpo para documento o correo) | Cubierto | O-01 |
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
| RN-17 mensaje genérico | CP0009 | SES (cuerpo y latencia, recuperación); SREG (registro) | Cubierto | O-01 para el registro. |
| RF-04, RN-18, RN-21 | CP0006 | CYV; INM | En desarrollo (T08) | |
| RN-19 consulta a centrales exige autorización | CP0012 | SOL (RN-33 toma el consentimiento del directorio) | Parcial | Se verifica de nuevo en el motor (T10). |
| RN-20 revocación en 24 h, RN-22 anonimizar datos revocados | — | — | Sin prueba | Confirmar alcance con el gerente (RF-15 está recortado). |

### Portal del cliente (RF-05 a RF-07)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-05, RN-23, RN-24, RN-26 | CP0011 | SIM; PAR | En desarrollo (T03) | |
| RN-25 aviso "no constituye aprobación" | CP0011 | — | Sin prueba | Es de interfaz: prueba de Vitest o verificación manual. |
| RNF-20 TEA junto a la cuota, mismo peso | CP0011 | VIT `CuotaConTea` | Cubierto (componente) | Verificar en todas las pantallas que muestran cuota (simulación, oferta). |
| RF-06, RN-28, RN-29, RN-32, RN-33 | CP0012 | SOL; MAQ; DIR | Parcial (servicio) | Endpoints HTTP en T11. |
| RN-30 formatos y 10 MB | CP0012 | VIT `validarArchivo` (solo portal); CYV (capturas JPG/PNG) | Parcial | Falta validar los documentos de la solicitud en el servidor (T11). |
| RN-31 borrador se elimina a los 30 días | — | — | Sin prueba (T11) | |
| RF-07, RN-34 a RN-37 | — | MAQ y SOL "cambios de estado" (máquina E3, motivo y actor); VIT `estados.test.ts` (RN-36) | Parcial | Seguimiento del cliente por HTTP (T11). RN-35 "solo ve sus solicitudes": prueba de 403/404 cruzado en T14. |

### Evaluación y decisión (RF-08 a RF-10)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-08, RN-39 a RN-46 | CP0013, CP0014 | PAR (versión de parámetros, solo adición) | Sin prueba (T10) | Cobertura exigida: 95 % (RNF-12). |
| RF-09, RN-47 a RN-52 | — | — | Sin prueba (T16, T23) | |
| RF-10, RN-53 a RN-58 | CP0014 (reversión) | — | Sin prueba (T15) | Segregación (RN-56) y conflicto de interés (RN-55) en T20. |

### Formalización (RF-11)

| Requisito | CP | Prueba | Estado | Nota |
|---|---|---|---|---|
| RF-11, RN-59 a RN-62 | PRU-MR004-01 | — | Sin prueba (T18) | Firma con adaptador simulado y distintivo (MR-004). |

### Fuera de la primera versión

RF-12 y RF-13 (RN-63 a RN-76), RF-14 (RN-77 a RN-82), RF-15 salvo consentimiento (RN-83 a RN-88), app móvil nativa, carga con 5.000 usuarios: **Fuera**.

## 3. Requisitos no funcionales y de interfaz

| Requisito | Prueba | Estado | Nota |
|---|---|---|---|
| RNF-05 autenticación y autorización | SES "RBAC" (401, 403, CSRF); CYV (solo el titular); REG (longitud y mezcla); SREG (contraseña filtrada) | Parcial | Falta: no reutilizar las últimas 5 contraseñas; 401/403 de cada endpoint nuevo (T14). |
| RNF-06 datos sensibles | REG (documento cifrado); SREG (registro pendiente cifrado, índice ciego con clave, respuestas sin documento); CYV (imágenes y rutas cifradas); SOL (referencia cifrada) | Parcial | D-01 y D-02 corregidos (regresión en SREG y SSES). Enmascarado a 4 dígitos: VIT `formato.test.ts` y SES (`documento_enmascarado`). |
| RNF-07 vulnerabilidades | SREG (límite 10/min en registro, inyección y marcado rechazados, asignación masiva); SSES (límite por origen en sesión) | Parcial | D-03 corregido. Faltan análisis estático y de dependencias en integración continua, CSP. |
| RNF-08 auditoría | INM; ESQ (triggers); SES | Parcial | Ver CP0010. |
| RNF-09 tolerancia a fallos | VIT `cliente.test.ts` (mensajes sin detalle técnico) | Parcial | Caída de terceros → evaluación manual: T09, T10. |
| RNF-12 calidad y cobertura | — | **Sin medir** | No hay driver de cobertura (ver sección 5). |
| RNF-20 claridad financiera | VIT `CuotaConTea` | Parcial | |
| RNF-25 equidad | — | Sin prueba (T10, T20) | |
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
| O-01 | Decisión | gerente-proyecto | CP0005 pone como criterio de falla "el mensaje revela la existencia confirmada de la cuenta", pero RF-01 FA-01 pide informar "que ya hay una cuenta". Hoy el 409 `cuenta_existente` confirma que el documento o el correo existen (es indistinguible cuál, eso sí). Hay que decidir qué manda y corregir la ERS (v1.1). | — | Abierta: se escala a las personas (D7) |
| O-02 | Media | gerente-proyecto | No hay canalización de integración continua: CP0002 paso 5 y RNF-07/RNF-12 ("en cada integración") no se pueden cumplir. | — | Abierta: se escala a las personas (D7) |
| O-03 | Baja | qa-senior | Las pruebas escribían en `storage/logs/laravel.log` de desarrollo (`testing.ERROR`). **Corregido (D7):** `<env name="LOG_CHANNEL" value="null"/>` en `phpunit.xml`. Las pruebas de logs siguen funcionando porque escuchan el evento `MessageLogged`. | — | Corregida (D7) |

## 5. Cobertura (RNF-12)

**Hoy no se puede medir:** la imagen en uso no trae driver de cobertura (ni PCOV ni Xdebug). **D7:** el cambio quedó aprobado y aplicado en los archivos, pero **sin reconstruir**. El gerente anuncia la reconstrucción (`docker compose up -d --build app`) al cerrar la ronda 1. Cambio aplicado:

```diff
--- a/docker/php/Dockerfile
+++ b/docker/php/Dockerfile
@@
 RUN apt-get update \
     && apt-get install -y --no-install-recommends git unzip libzip-dev libicu-dev \
     && docker-php-ext-install pdo_mysql bcmath intl zip opcache pcntl \
+    && pecl install pcov \
+    && docker-php-ext-enable pcov \
     && rm -rf /var/lib/apt/lists/*
```

```diff
--- a/docker/php/php.ini
+++ b/docker/php/php.ini
@@
 expose_php = Off
 date.timezone = America/Bogota
+; RNF-12: PCOV instalado pero apagado; se enciende solo al medir cobertura.
+pcov.enabled = 0
+pcov.directory = /var/www/html/app
+; RNF-06 (D-02): las trazas de excepción no guardan argumentos (contraseñas, códigos).
+zend.exception_ignore_args = On
```

Comandos (después de `docker compose up -d --build app`):

```bash
# Global ≥ 75 %
docker compose exec -T -e DB_DATABASE=finantech_test_qa app php -d pcov.enabled=1 ./vendor/bin/pest --coverage --min=75
# Motor de reglas ≥ 95 % (cuando exista T10): un phpunit.motor.xml con <source> solo del motor
docker compose exec -T -e DB_DATABASE=finantech_test_qa app php -d pcov.enabled=1 ./vendor/bin/pest -c phpunit.motor.xml --coverage --min=95
```

- Excluir de la medición lo que no es lógica (`*/Database/Migrations`, `*/Database/Seeders`, `*/Routes`) en el `<source>` de `phpunit.xml`.
- Portal: `@vitest/coverage-v8` y `vitest run --coverage` (decisión de frontend-senior). La lógica que hoy vive en `src/mocks/` no cuenta.
