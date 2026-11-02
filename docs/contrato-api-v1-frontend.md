# Contrato de `/api/v1` que usa el portal

Este documento es para quien implemente estos endpoints en Laravel. Es lo que el frontend espera hoy y lo que simula con MSW mientras el backend no los tenga.

- **Los cuerpos exactos** están en `frontend/src/lib/api/tipos.ts`, que es la fuente de verdad.
- **La implementación de referencia** está en `frontend/src/mocks/handlers/`. Ahí se ve cada validación y cada error con su mensaje.
- **Al implementar un endpoint en Laravel**, se borra su handler y el portal empieza a usar el real sin otro cambio.

## Convenciones

- **Sesión:** cookie httpOnly del mismo origen (RI-08). El portal nunca guarda tokens. Todo endpoint protegido responde 401 sin sesión y 403 con otro rol (RNF-05).
- **Errores de negocio:** `ErrorNegocio` → `{codigo, mensaje, datos?}`. El portal muestra `mensaje` tal cual, así que debe estar en español claro y sin jerga.
- **Validación:** el 422 estándar de Laravel `{message, errors}`. Las claves de `errors` se mapean a campos, por ejemplo `laboral.ocupacion`.
- **Otros errores** (500, 404 de binding, throttle): el portal **no** muestra su `message`. Muestra un texto propio (RNF-09).
- **Formatos:** fechas en ISO 8601 y dinero en pesos enteros. Las tasas van en porcentaje: `18.9` significa 18,9 % E.A.
- **Datos sensibles:** el documento y el celular salen **ya enmascarados** del servidor (`•••• 1234`, RNF-06).
- **Distintivo de simulación:** todo resultado que venga de un tercero simulado lleva `simulado`/`simulada: true` o `fuente: 'simulada'`, y el portal muestra el distintivo (MR-003, MR-004). `GET sistema/estado` dice el modo global.

## Endpoints

### Sistema e identidad

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET sistema/estado` | — | `EstadoSistema` | — |
| `POST identidad/sesiones` | `{email, password}` | `DesafioMfa` | 401 `credenciales_invalidas`, 423 `cuenta_bloqueada`. **El mismo mensaje y el mismo tiempo de respuesta exista o no el correo** (RN-17, CP0009). El contador de intentos también corre para correos que no existen. |
| `POST identidad/sesiones/{desafio}/verificar` | `{codigo}` | `{usuario: Usuario}` y la cookie de sesión | 422 `codigo_incorrecto` (`datos.intentos_restantes`), `codigo_vencido`, `intentos_agotados` |
| `POST identidad/sesiones/{desafio}/reenviar` | — | `DesafioMfa` | 429 `reenvio_muy_pronto` |
| `GET identidad/sesion` | — | `{usuario: Usuario \| null}` (200 también sin sesión) | 401 si el acceso venció pero llega la cookie de renovación (ver "Sesión") |
| `POST identidad/sesion/renovar` | — | 200 `{usuario}` con cookies nuevas | 401 `sin_sesion` si la renovación no es válida (y borra las cookies) |
| `DELETE identidad/sesion` | — | 204, también sin sesión. Cierra **todas** las sesiones del usuario (RF-03: el cierre se propaga a todos los canales) | — |
| `POST identidad/recuperacion` | `{email}` | 202 `{mensaje}`, siempre el mismo (RN-17) | — |
| `POST identidad/recuperacion/confirmar` (nuevo, falta la pantalla) | `{email, token, password, password_confirmation}` (vienen del enlace `/recuperar/nueva?token&email` del correo) | 200 `{mensaje}`. Cierra todas las sesiones y levanta el bloqueo por intentos | 422 `enlace_invalido` (vencido a los 60 min, ya usado o falso), 422 de validación de `password` |
| `GET/POST clientes/verificacion-identidad` (rol cliente; **en Laravel desde el 01/11**) | POST multipart: `documento_frente`, `documento_reverso`, `rostro` (JPG o PNG de hasta 10 MB) y `escenario` (este último solo en modo simulado; con `real` se ignora) | `VerificacionIdentidad` | 409 `identidad_ya_verificada`, 422 de validación |
| `GET identidad/consentimientos` (rol cliente; **en Laravel desde el 01/11**) | — | `Consentimientos` | — |
| `POST identidad/consentimientos` (rol cliente; **en Laravel desde el 01/11**) | `{finalidad, accion: 'otorga' \| 'revoca', canal}` | `Consentimientos`. **Cada cambio es un registro nuevo** (RN-21); si ya estaba así, no se registra nada. | 422 `finalidad_invalida`; 422 `finalidad_necesaria` al revocar una necesaria (RN-18, nuevo) |
| `GET identidad/politica-vigente` | — | `PoliticaVigente`, ahora con `texto` (política completa, D6/UX-04) | — |

#### Sesión (propuesta de frontend-senior, 01/11/2026; **implementada en Laravel por backend-senior el 01/11**)

Lo que el portal ya implementa en `frontend/src/lib/api/cliente.ts`, y cómo lo resuelve Laravel:

- **Cookies:** `ft_acceso` (JWT HS256 firmado, 15 min, RI-08/RN-13) y `ft_renovacion` (aleatoria, 7 días, RN-14), las dos httpOnly, con las rutas y SameSite de abajo. `Secure` lo activa `SESSION_SECURE_COOKIE=true`.
- **Rotación:** cada `renovar` entrega una `ft_renovacion` nueva. Si una ya rotada se vuelve a presentar **dentro de 30 s** (otra pestaña renovó primero), se responde 200 con solo un `ft_acceso` nuevo; después de 30 s se toma como robo y se cierra la sesión.
- **CSRF:** no se usa `XSRF-TOKEN`. Una petición que no es GET solo se autentica si trae `X-Requested-With: XMLHttpRequest` (además de SameSite=Lax/Strict).
- **Inactividad (RN-16):** el servidor cierra la sesión de un rol interno con más de 15 min sin actividad; su `renovar` responde 401.
- **Sin código en la respuesta:** `DesafioMfa` no trae `codigo_demo`; el código va al correo (en desarrollo, a `backend/storage/logs/laravel.log`).
- **Registro:** `POST clientes/registro/{id}/verificar` ya abre la sesión (pone las dos cookies) y además devuelve `usuario`.
- **Cuentas demo:** `CuentasDemoSeeder` siembra las de `frontend/README.md` (contraseña `Demo#2026!`); Laura queda con identidad verificada.

1. **Cookies httpOnly** (nombres a elección del backend; el portal no las lee): acceso con `SameSite=Lax`, `Path=/api`, 15 min; renovación con `SameSite=Strict`, `Path=/api/v1/identidad/sesion`, 7 días y **rotación en cada uso** (reusar una ya rotada revoca toda la familia). `Secure` en producción. Ningún token en el cuerpo de ninguna respuesta (RI-08).
2. **CSRF:** el portal manda siempre `X-Requested-With: XMLHttpRequest`, que Laravel exige para autenticar lo que no es GET. (Si algún día se usa la cookie `XSRF-TOKEN` de Sanctum, el portal ya la devuelve como `X-XSRF-TOKEN`.) Un 419 se muestra como "la página estuvo abierta mucho tiempo".
3. **401 en un endpoint protegido:** el portal hace **un solo** `POST identidad/sesion/renovar` (compartido si varias peticiones fallan a la vez) y, si responde 2xx, repite la petición original una vez. Si la renovación falla, borra la sesión de su caché y lleva a `/ingresar?volver=<ruta>`; tras el ingreso vuelve ahí (solo rutas internas).
4. **No se intenta renovar** ante el 401 de `identidad/sesiones*`, `identidad/sesion/renovar`, `identidad/recuperacion` ni `clientes/registro*`: ahí el 401 es de credenciales o códigos.
5. **Inactividad de la consola (RN-16):** el portal cierra la sesión de los internos a los 15 min sin actividad, y el servidor rechaza su renovación pasado ese tiempo (ver arriba).
6. **Verificado contra Laravel el 01/11 (frontend-senior):** registro → sesión abierta → panel → salir → ruta protegida → ingreso con segundo factor → regreso a la ruta pedida → acceso vencido y renovación transparente → sin cookies, al ingreso con `volver`. Ninguna cookie es legible desde JavaScript y nada de la sesión queda en `localStorage`.

**Registro (RF-01):** `POST clientes/registro/{id}/verificar` crea el cliente **y abre la sesión** (desde el 01/11), porque el paso 4 del asistente (verificar la identidad) la necesita.

### Simulación

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET cliente/productos` (pública) | — | `Producto[]` | — |
| `POST cliente/simulaciones` (pública) | `{producto, monto, plazo_meses}` | `Simulacion`. **La suma de `desglose` es igual a `costo_total`** (CP0011) y `tasa_ea` es menor o igual a `tasa_maxima_legal_ea` (RN-23). `valor_a_recibir` = monto − estudio de crédito (UX-15). Los productos y tasas salen de los parámetros vigentes de Evaluacion (D2). | 422 `producto_invalido`, `fuera_de_rango` (`datos.minimo` y `datos.maximo`) |

### Originación (cliente)

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET originacion/solicitudes` | — | `SolicitudResumen[]`, solo las propias (RN-35) | — |
| `POST originacion/solicitudes` | `{producto, monto, plazo_meses}` | `SolicitudDetalle` en BORRADOR, con datos laborales y financieros precargados de la última solicitud (RN-32) | 409 `identidad_no_verificada` (RN-07), 409 `solicitud_activa` (`datos.solicitud_id`, RN-28) |
| `GET originacion/solicitudes/{id}` | — | `SolicitudDetalle`, con `capacidad_pago` y `historial` | 404 `no_encontrada` |
| `PATCH originacion/solicitudes/{id}` | `CambiosBorrador` | `SolicitudDetalle`. Si cambia la ocupación, se recalculan los documentos requeridos. | 409 `no_editable`, 422 de validación |
| `POST .../{id}/documentos` | multipart `tipo`, `archivo` (JPG, PNG o PDF de hasta 10 MB, RN-30) | `DocumentoSolicitud` | 422 `archivo_no_permitido`, `documento_invalido` |
| `POST .../{id}/radicar` | — | `SolicitudDetalle` en RADICADA, con radicado `FT-AAAA-NNNNNN` (RN-29) | 422 de validación (`laboral.*`, `financiero.*`, `referencia.*`), `documentos_incompletos`, `consulta_centrales_requerida` (RN-33) |
| `POST .../{id}/enviar-documentos` | — | `SolicitudDetalle`: de PENDIENTE_CLIENTE pasa a RADICADA | 422 `documentos_incompletos` |
| `GET .../{id}/decision` | — | `ExplicacionDecision`: sin códigos ni pesos del modelo (RN-52) | 404 `sin_decision` |
| `POST .../{id}/reconsideraciones` | multipart `argumentos` (mínimo 20 caracteres) y `adjuntos[]` | `ExplicacionDecision`: de NEGADA pasa a EN_ESTUDIO (RN-49) | 409 `reconsideracion_existente`, `reconsideracion_no_disponible` |

Referencias personales: solo `nombre` y `celular`. **No se pide el parentesco**, porque aproxima el estado civil (RN-43).

### Oferta y pagaré

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET desembolso/ofertas/{id}` | — | `Oferta`. Vence a los 15 días (RN-59). Si fue condicionada, `condiciones_originales` trae lo que pidió el cliente. | 404 |
| `POST .../{id}/desafio-mfa` | — | `DesafioMfa` (RN-61) | 409 `oferta_vencida`, `oferta_no_vigente` |
| `POST .../{id}/aceptar` | `{declaracion: true, desafio_id, codigo}` | `Oferta` firmada, con `firma {huella_sha256, sellado_en, simulada}`. La solicitud pasa por OFERTA_ACEPTADA → FORMALIZADA. | 422 `declaracion_requerida`, errores del código |
| `POST .../{id}/rechazar` | `{motivo?}` | `Oferta` rechazada | 409 |

### Consola interna

| Método y ruta | Rol | Cuerpo y filtros | Respuesta | Errores |
|---|---|---|---|---|
| `GET originacion/bandeja` | analista, oficial | `?estado&producto&monto_min&monto_max` | `Bandeja`. El analista ve lo asignado en EN_ESTUDIO o PENDIENTE_CLIENTE; el oficial, EN_DECISION o EN_COMITE. | — |
| `GET originacion/expedientes/{id}` | analista, oficial | — | `Expediente` | 404 |
| `POST .../{id}/observaciones` | analista, oficial | `{texto}` | `Observacion` | 422 |
| `POST .../{id}/documentos-requeridos` | analista | `{documentos: [{tipo, motivo}]}` | `Expediente`: pasa a PENDIENTE_CLIENTE y el cliente tiene 15 días | 409 `estado_invalido` |
| `GET evaluacion/solicitudes/{id}/evaluacion` | analista, oficial | — | `Evaluacion`, **siempre con `version_reglas`** (RN-44) | 404 `sin_evaluacion` (la central no respondió) |
| `POST evaluacion/solicitudes/{id}/concepto` | analista | `{recomendacion, texto}` | `Expediente`: pasa a EN_DECISION | 409, 422 |
| `GET evaluacion/decisiones/contexto/{id}` | oficial | — | `ContextoDecision`: atribución, tasa máxima y `bloqueo` por conflicto o por haber parametrizado | — |
| `POST evaluacion/decisiones` | oficial | `NuevaDecision` | `Expediente`. Las aprobaciones emiten la oferta. **Las decisiones son de solo adición** (RN-58). | 403 `fuera_de_atribucion` (RN-53), `conflicto_interes` (RN-55), `segregacion` (RN-56); 422 `motivo_requerido` (RN-54), `tasa_supera_maxima` (RN-57), `ajuste_fuera_de_rango`; 409 `en_comite` |

### Administración

| Método y ruta | Rol | Cuerpo | Respuesta | Errores |
|---|---|---|---|---|
| `GET/POST identidad/usuarios` | administrador | `DatosUsuarioInterno` | `UsuarioInterno` (un solo rol, como `rol_id` hoy) | 422 de validación |
| `PATCH identidad/usuarios/{id}` | administrador | campos de `DatosUsuarioInterno` y `estado` | `UsuarioInterno` | 422 `segregacion_funciones` (la persona ya ejerció otra función entre parametrizar, aprobar y desembolsar); 409 `propia_cuenta` |
| `GET evaluacion/parametros` | administrador | — | `Parametros` (vigente e historial) | — |
| `POST evaluacion/parametros/simulaciones` | administrador | `PropuestaParametros` | `ImpactoParametros` contra las evaluaciones históricas | — |
| `POST evaluacion/parametros` | administrador | `PropuestaParametros` | `Parametros`: versión nueva `P-AAAA.MM-n` | 422 (por ejemplo, `productos.0.tasa_ea` por encima de la máxima legal) |
| `GET identidad/auditoria` | administrador y directivo (todo); oficial y contabilidad (solo lo propio) | `?actor&entidad&accion&desde&hasta&pagina` | `PaginaAuditoria` | — |
| `GET identidad/auditoria/exportar` | los mismos | los mismos filtros, sin `pagina` | `text/csv`. La exportación también queda auditada. | — |

## Estados de la solicitud

El portal usa la máquina de estados de `docs/correcciones-ers-v1.1.md` (BORRADOR … FORMALIZADA) con los nombres técnicos en mayúscula. La traducción a etiquetas para el cliente (RN-36) la hace el portal en `frontend/src/lib/estados.ts`. El backend solo devuelve el estado técnico.
