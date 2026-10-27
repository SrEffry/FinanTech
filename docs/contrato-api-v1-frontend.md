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
| `GET identidad/sesion` | — | `{usuario: Usuario \| null}` (200 también sin sesión) | — |
| `DELETE identidad/sesion` | — | 204 | — |
| `POST identidad/recuperacion` | `{email}` | 202 `{mensaje}`, siempre el mismo (RN-17) | — |
| `GET/POST clientes/verificacion-identidad` | POST multipart: `documento_frente`, `documento_reverso`, `rostro` y `escenario` (este último solo en modo simulado) | `VerificacionIdentidad` | 409 `identidad_ya_verificada`, 422 de validación |
| `GET identidad/consentimientos` | — | `Consentimientos` | — |
| `POST identidad/consentimientos` | `{finalidad, accion: 'otorga' \| 'revoca', canal}` | `Consentimientos`. **Cada cambio es un registro nuevo** (RN-22). | 422 `finalidad_invalida` |

**Pendiente en el registro actual (RF-01):** hoy `POST clientes/registro/{id}/verificar` crea el cliente pero **no abre sesión**. El portal propone que la abra, porque el paso 4 del asistente (verificar la identidad) la necesita. La API simulada lo hace así.

### Simulación

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `GET cliente/productos` (pública) | — | `Producto[]` | — |
| `POST cliente/simulaciones` (pública) | `{producto, monto, plazo_meses}` | `Simulacion`. **La suma de `desglose` es igual a `costo_total`** (CP0011) y `tasa_ea` es menor o igual a `tasa_maxima_legal_ea` (RN-23). | 422 `producto_invalido`, `fuera_de_rango` (`datos.minimo` y `datos.maximo`) |

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
