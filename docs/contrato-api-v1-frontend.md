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

**Registro neutro (P3, RN-17 sobre RF-01 FA-01, CP0005; backend-senior, 02/11):** `POST clientes/registro` **ya no responde 409 `cuenta_existente`**. Si el documento o el correo ya tienen cuenta, responde **201 con la misma forma** (`registro_id`, `codigos_expiran_en`, `reenvio_disponible_en`) y al menos el mismo tiempo (500 ms) que un registro nuevo. Por dentro:
- el titular de la cuenta recibe por correo el aviso "Alguien intentó crear una cuenta con tus datos" (máximo 3 por hora);
- si solo el documento existía y el correo es nuevo, ese correo recibe "No pudimos continuar con tu registro", que no confirma la cuenta y remite a recuperar el acceso o a atención;
- el celular recibe su SMS como siempre, y `reenviar` se comporta igual (mismos límites);
- `verificar` sobre ese registro responde siempre como un código equivocado (`codigo_incorrecto` con `intentos_restantes`, luego `intentos_agotados`).
- `409 cuenta_existente` **solo** puede salir ya en `verificar`, si otra vía creó la cuenta mientras se verificaba (carrera rara, D-04).
- El portal no necesita cambiar nada para que funcione: la pantalla de códigos queda a la espera. Sugerencia de texto en esa pantalla: "Si ya tienes una cuenta, revisa tu correo: te contamos cómo entrar".

**SMS simulado (T33):** además de `laravel.log`, cada SMS llega a Mailpit (http://localhost:8025) con el asunto `[SMS SIMULADO] para •••• 1234` (celular enmascarado). Nunca en producción; se apaga con `SMS_SIMULADO_BUZON=` vacío.

### Simulación

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET cliente/productos` (pública) | — | `Producto[]` | — |
| `POST cliente/simulaciones` (pública) | `{producto, monto, plazo_meses}` | `Simulacion`. **La suma de `desglose` es igual a `costo_total`** (CP0011) y `tasa_ea` es menor o igual a `tasa_maxima_legal_ea` (RN-23). `valor_a_recibir` = monto − estudio de crédito (UX-15). Los productos y tasas salen de los parámetros vigentes de Evaluacion (D2). | 422 `producto_invalido`, `fuera_de_rango` (`datos.minimo` y `datos.maximo`) |

### Originación (cliente)

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET originacion/solicitudes` (rol cliente; **en Laravel desde el 02/11**) | — | `SolicitudResumen[]`, solo las propias (RN-35), la más reciente primero | — |
| `POST originacion/solicitudes` (**en Laravel**) | `{producto, monto, plazo_meses}` | 201 `SolicitudDetalle` en BORRADOR, con datos laborales, financieros y la referencia precargados de la última solicitud (RN-32) y los documentos de esa ocupación en `pendiente`. Monto y plazo se llevan al rango del producto (RF-05 FA-01). | 409 `identidad_no_verificada` (RN-07), 409 `solicitud_activa` (`datos.solicitud_id`, `datos.estado` técnico, RN-28), 422 `producto_invalido` |
| `GET originacion/solicitudes/{id}` (**en Laravel**) | — | `SolicitudDetalle`, con `capacidad_pago` (`limite` sale de los parámetros vigentes) y `historial`. `oferta_id` es `null` hasta T18. | 404 `no_encontrada`, también si la solicitud es de otro cliente (RN-35) |
| `PATCH originacion/solicitudes/{id}` (**en Laravel**) | `CambiosBorrador` (se puede guardar a medias; claves de más, como un parentesco, dan 422) | `SolicitudDetalle`. Si cambia monto o plazo, se recalculan tasa y cuota con los parámetros vigentes; si cambia la ocupación, los documentos requeridos (los que ya no aplican se borran con su archivo). | 409 `no_editable`, 422 de validación (`monto`/`plazo_meses`: "…fuera del rango del producto.") |
| `POST .../{id}/documentos` (**en Laravel**) | multipart `tipo`, `archivo` (JPG, PNG o PDF de hasta 10 MB, RN-30; el tipo se toma del contenido) | `DocumentoSolicitud`. Solo en BORRADOR o PENDIENTE_CLIENTE. El archivo se guarda cifrado y la ruta va cifrada en la base. | 409 `no_editable`, 422 `archivo_no_permitido`, `documento_invalido` |
| `POST .../{id}/radicar` (**en Laravel**) | — | `SolicitudDetalle` en RADICADA, con radicado `FT-AAAA-NNNNNN` (RN-29). La casilla de consulta a centrales queda como otorgamiento en `identidad/consentimientos` (RN-33, canal `web`). Publica `Originacion\Events\SolicitudRadicada` (CP0012). | 409 `no_editable`, `identidad_no_verificada`; 422 de validación (`laboral.*`, `financiero.*`, `referencia.*`), `documentos_incompletos` (`datos.documentos`: tipos que faltan), `consulta_centrales_requerida` (RN-33) |
| `POST .../{id}/enviar-documentos` (**en Laravel**) | — | `SolicitudDetalle`: de PENDIENTE_CLIENTE pasa a RADICADA con el mismo radicado y publica `Originacion\Events\DocumentosEnviados` (el paso siguiente lo dan T10/T17) | 409 `no_editable`, 422 `documentos_incompletos` |
| `GET .../{id}/decision` (**en Laravel desde el 09/11**, D26, T16 mínimo) | — | `ExplicacionDecision`, solo para el titular (RN-35). Textos de un catálogo en lenguaje claro: sin códigos, pesos, puntaje ni versión de reglas (RN-52), y nunca el motivo interno del oficial (D6/UX-03). Hasta 3 `variables` (en una negada, solo las que restaron); vacío si no hubo evaluación automática. Campos nuevos: `simulado` (MR-004, tomado de la evaluación) y `oferta_id` (UX-31). Reconsideración postergada (T23): `puede_reconsiderar` en `false`, `reconsideracion` y `reconsideracion_vence_en` en `null`. El envío a comité no cuenta como decisión. | 404 `sin_decision`; 404 `no_encontrada` si es de otro cliente |
| `POST .../{id}/reconsideraciones` (simulado hasta T23) | multipart `argumentos` (mínimo 20 caracteres) y `adjuntos[]` | `ExplicacionDecision`: de NEGADA pasa a EN_ESTUDIO (RN-49) | 409 `reconsideracion_existente`, `reconsideracion_no_disponible` |

Referencias personales: solo `nombre` y `celular`. **No se pide el parentesco**, porque aproxima el estado civil (RN-43).

### Oferta y pagaré

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET desembolso/ofertas/{id}` (rol cliente; **en Laravel desde el 07/11**) | — | `Oferta`, con `valor_a_recibir` (UX-15). Vence a los 15 días (RN-59): al consultarla vencida pasa a `vencida` y la solicitud a OFERTA_VENCIDA. Si fue condicionada, `condiciones_originales` trae lo que pidió el cliente. El pagaré solo muestra los 4 últimos dígitos del documento. | 404 `no_encontrada`, también si es de otro cliente |
| `POST .../{id}/desafio-mfa` (**en Laravel**) | — | `DesafioMfa` (RN-61); el código llega al correo (Mailpit en desarrollo), con propósito `aceptar_oferta` y atado a esta oferta | 409 `oferta_vencida`, `oferta_no_vigente`; 429 por exceso |
| `POST .../{id}/aceptar` (**en Laravel**) | `{declaracion: true, desafio_id, codigo}` | `Oferta` firmada, con `firma {huella_sha256, sellado_en, simulada}` (`FirmaElectronicaService`; en modo simulado `simulada: true` y auditoría con `modo_simulado`, MR-004). La solicitud pasa por OFERTA_ACEPTADA → FORMALIZADA. | 409 `oferta_vencida`, `oferta_no_vigente`; 422 `declaracion_requerida`, `codigo_incorrecto` (`datos.intentos_restantes`), `codigo_vencido`, `intentos_agotados`; 503 `firma_no_disponible` (RF-11 FA-03: la oferta sigue vigente) |
| `POST .../{id}/rechazar` (**en Laravel**) | `{motivo?}` | `Oferta` rechazada; la solicitud pasa a OFERTA_RECHAZADA | 409 `oferta_vencida`, `oferta_no_vigente` |

**Emisión:** Desembolso escucha `Evaluacion\Events\DecisionRegistrada` (aprobada o aprobada condicionada, automática o del oficial) y crea la oferta con las condiciones finales, una sola por decisión. La solicitud muestra `oferta_id` y, mientras la oferta está vigente, `accion_pendiente: {tipo: 'oferta', oferta_id}`.

### Consola interna

| Método y ruta | Rol | Cuerpo y filtros | Respuesta | Errores |
|---|---|---|---|---|
| `GET originacion/bandeja` (**en Laravel desde el 07/11**, V3) | analista, oficial | `?estado&producto&monto_min&monto_max` (`producto` acepta el nombre o el código) | `Bandeja`, ordenada por `sla_vence_en`. El oficial ve EN_DECISION y EN_COMITE. En la primera versión no hay asignación ni concepto del analista (P9, D20): su cola (EN_ESTUDIO, PENDIENTE_CLIENTE) sale casi siempre vacía. Semáforo: EN_DECISION 24 h, EN_COMITE 48 h; `por_vencer` con el 25 % o menos del plazo. `reconsideracion` siempre `false` hasta T23. Campo de más: `producto_codigo`. | 401, 403 |
| `GET originacion/expedientes/{id}` (**en Laravel desde el 07/11**, V3) | analista, oficial | — | `Expediente`. `central` sale de la última evaluación (con `fuente: simulada` en modo simulado y `calificacion: "No informada"`), o `null` si no hubo evaluación automática. `observaciones` `[]`, `concepto`, `analista` y `reconsideracion` `null` hasta T17 y T23. | 401, 403, 404 `no_encontrada` (no existe o no está radicada) |
| `POST .../{id}/observaciones` | analista, oficial | `{texto}` | `Observacion` | 422 |
| `POST .../{id}/documentos-requeridos` | analista | `{documentos: [{tipo, motivo}]}` | `Expediente`: pasa a PENDIENTE_CLIENTE y el cliente tiene 15 días | 409 `estado_invalido` |
| `GET evaluacion/solicitudes/{id}/evaluacion` (**en Laravel desde el 02/11**, T10) | analista, oficial | — | `Evaluacion`, **siempre con `version_reglas`** (RN-44). Campos de más, que el portal puede ignorar: `solicitud_id`, `secuencia` (RN-45: una reevaluación es una fila nueva; se devuelve la última), `causal` (variable que más restó si se negó, o `cuota_supera_limite` si RN-41 impidió aprobar) y `version_parametros`. `duracion_segundos` va de la radicación al resultado (RN-46). | 404 `sin_evaluacion` (la central no respondió, faltó la autorización o pasó a estudio manual) |
| `POST evaluacion/solicitudes/{id}/concepto` | analista | `{recomendacion, texto}` | `Expediente`: pasa a EN_DECISION | 409, 422 |
| `GET evaluacion/decisiones/contexto/{id}` (**en Laravel desde el 07/11**, T15) | oficial | — | `ContextoDecision`: atribución, tasa máxima legal vigente y `bloqueo` (`conflicto_interes` si el oficial es el cliente o declaró un vínculo con él; `segregacion` si publicó una versión de parámetros). `decisiones_previas` incluye las del motor (`automatizada: true`, autor "Motor de reglas"). | 401, 403, 404 `no_encontrada` |
| `POST evaluacion/decisiones` (**en Laravel desde el 07/11**, T15) | oficial | `NuevaDecision` | **201** con el `Expediente`. Sin `ajustes` se aprueba lo pedido a la tasa de la solicitud. Toda decisión final, también la automática del motor (RN-46), publica `Evaluacion\Events\DecisionRegistrada(solicitudId, decisionId, clienteId, resultado, monto, plazoMeses, tasaEa, automatizada, motivoCondicion, decididaEn)` con las condiciones finales (firma de fullstack-senior, 07/11); el envío a comité no la publica. Desembolso la escucha para emitir la oferta cuando `resultado` empieza por `aprobada`. **Las decisiones son de solo adición** (RN-58, trait y triggers). Si otro oficial decidió primero, 409 `transicion_invalida` y no se guarda nada. | 403 `fuera_de_atribucion` (RN-53), `conflicto_interes` (RN-55), `segregacion` (RN-56); 422 `motivo_requerido` (RN-54, menos de 10 caracteres), `resultado_invalido`, `tasa_supera_maxima` (RN-57), `ajuste_fuera_de_rango`, validación de `solicitud_id` y `ajustes`; 409 `en_comite`, `estado_invalido`; 404 `no_encontrada` |

**Primera versión (P9):** el concepto del analista está postergado. Cuando el motor escala (500–699, cuota sobre el 40 % o tercero caído), la solicitud pasa por EN_ESTUDIO y sigue enseguida a EN_DECISION con el motivo "Concepto del analista postergado en la primera versión (P9)" (D20), así que llega directo a la bandeja del oficial.

**Escenario de la demo (D21):** Laura (`laura.mejia@demo.finantech.co`, CC terminada en 6782) tiene perfil medio en la central simulada (mora máxima 30 días, 3 obligaciones, 3 consultas, deuda de 5 veces el ingreso). Para que caiga entre 500 y 699 y pase por Camila (oficial, atribución de 30 millones): declarar **antigüedad laboral menor a 12 meses** (por ejemplo, 6) y una **cuota entre el 20 % y el 30 % del ingreso disponible** (por ejemplo, libre inversión de 5.000.000 a 24 meses con ingreso de 1.100.000 y egreso 0). Puntaje: 600 + 30 + 60 + 0 − 30 = 660, versión R-2026.10-1. Con antigüedad de 24 meses o más y cuota de hasta el 20 % se aprueba sola. La evaluación sale con `fuente_central: simulada` y cada consulta queda en la auditoría con `modo_simulado` (MR-003). Lo cubre `tests/Feature/Evaluacion/DecisionOficialTest.php` ("D21").

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
