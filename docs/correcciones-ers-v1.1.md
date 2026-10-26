# Correcciones a la ERS — paso a la versión 1.1

**Proyecto:** Plataforma Digital Integrada FinanTech
**Fecha:** 20/10/2026
**Objetivo:** dejar el documento coherente con las solicitudes de modificación aprobadas (MR-001, MR-002, MR-003), registrar una nueva (MR-004) y corregir las inconsistencias encontradas en la revisión.

Cada corrección indica la sección, el texto actual y el texto propuesto, para trasladarla al documento fuente (Word). Lo marcado como **[Decisión del equipo]** no puede resolverse sin que el equipo elija.

---

## Parte A — MR-004: Adaptador simulado de firma electrónica y de desembolso bancario

Se incorpora al punto 9 como **9.7 MR-004** (las conclusiones pasan a 9.8) y se añade a la tabla resumen de 9.3:

| ID MR | Título | Prioridad | Tipo de mantenimiento | Estado |
|---|---|---|---|---|
| MR-004 | Adaptador simulado de firma electrónica y de desembolso bancario | 2 | Adaptativo | Propuesto |

### 9.7 MR-004 — Adaptador simulado de firma electrónica y de desembolso bancario

El requisito RF-11 exige que el pagaré se firme electrónicamente y se custodie con sello de tiempo de un proveedor certificado, y el requisito RF-12 exige ordenar el desembolso a una entidad bancaria con confirmación de la transacción. Ambos dependen de terceros que requieren contrato y habilitación, igual que los servicios cubiertos por el MR-003. El plan de pruebas (punto 11.2) ya reconoce que "el pagaré se genera y se almacena sin sello de tiempo de proveedor certificado", pero esa decisión no estaba registrada como modificación. Tal como está, la primera versión incumpliría las reglas RN-62 y RN-63 sin que el documento lo justifique.

#### 9.7.1 Solicitud de modificación

| Solicitud de Modificación | |
|---|---|
| **Sección I** | |
| Nombre del solicitante | Equipo de Ingeniería de Software |
| Fecha de recepción | 20/10/2026 |
| Sistema | Plataforma Digital Integrada FinanTech |
| Creador | Equipo de Ingeniería de Software |
| Descripción del problema | Los requisitos RF-11 y RF-12 dependen de dos servicios externos que el equipo no puede contratar: un proveedor de firma electrónica con sello de tiempo certificado y el servicio de desembolso de una entidad bancaria. Consecuencias: (1) RF-11 no puede cumplir RN-62, porque el pagaré no tendría sello de tiempo ni evidencia de firma; (2) RN-63 impide desembolsar sin pagaré firmado y validado, de modo que RF-12 queda bloqueado cuando se construya en la segunda entrega; (3) el caso de uso UC12 y las pantallas 8.2.5 no pueden demostrarse completas; (4) el punto 11.2 del plan de pruebas excluye la funcionalidad sin una modificación aprobada que lo respalde. |
| Prioridad | 1 **2** 3 4 5 |
| **Sección II** | |
| Número de MR | MR-004 |
| Mantenedor | Equipo de Ingeniería de Software |
| Prioridad | 2. Afecta una actividad esencial —la formalización del crédito— y sin una alternativa la cadena se detiene en la aceptación de la oferta. |
| Tipo de mantenimiento | Adaptativo: ajusta la integración con terceros a las condiciones reales del proyecto sin alterar el comportamiento especificado del sistema. |
| **Sección III** | |
| Id opción | OPC-11 (recomendada) |
| Estado del MR | Propuesto — pendiente de aprobación |
| Fecha | [Pendiente] |
| Resultado del análisis | [Pendiente de aprobación] Se propone la OPC-11: definir las interfaces `FirmaElectronicaService` y `DesembolsoBancarioService`, cada una con un adaptador simulado configurable y el contrato listo para el adaptador real. El adaptador simulado de firma calcula la huella SHA-256 del pagaré y emite un sello de tiempo local, ambos marcados como simulados. El de desembolso devuelve un comprobante simulado y respeta la clave de idempotencia de RN-65. **Condición de aprobación:** la misma del MR-003. El modo simulado debe ser visible en toda pantalla y documento generado, quedar en la bitácora de auditoría, y ningún pagaré firmado con el adaptador simulado puede presentarse como título valor real. |
| Aprobado por | [Pendiente] |

#### 9.7.2 Historial del MR

| ID MR | Fecha de recepción | Fecha de análisis | Estado de MR | Documentos afectados |
|---|---|---|---|---|
| MR-004 | 20/10/2026 | [Pendiente] | Propuesto | ERS (RF-11, RF-12, RI-10, reglas RN-62, RN-63, RN-65, RN-66), casos de uso UC12 y UC13, diagrama de secuencia SEC-03, punto 8.2.5 del prototipo, punto 11.2 del plan de pruebas |

#### 9.7.3 Prueba de verificación

| Registro de Pruebas del MR | |
|---|---|
| ID Prueba | PRU-MR004-01 |
| ID MR | MR-004 |
| Nombre del sistema | Plataforma Digital Integrada FinanTech |
| Responsable de la prueba | [Integrante QA / Documentación] |
| Objetivo | Confirmar que la ausencia de proveedores de firma electrónica y de desembolso bloquea la formalización y no solo la integración externa. |
| Resultado obtenido | **1.** Los proveedores de firma electrónica con sello de tiempo certificado exigen contrato con persona jurídica. **2.** El servicio de desembolso exige convenio con una entidad bancaria. Ninguno está disponible para un equipo estudiantil. **3.** Se trazó la dependencia: RN-62 exige sello de tiempo y evidencia de firma; RN-63 impide desembolsar sin pagaré validado; RF-12 depende en cadena de RF-11. **4.** La lógica propia del sistema sí es implementable: generación del pagaré, cálculo de la huella del documento, exigencia del segundo factor (RN-61), vigencia de la oferta (RN-59) e idempotencia de la orden (RN-65). Lo único ausente es la respuesta del tercero. **Conclusión:** el bloqueo es real y tiene el mismo origen que el del MR-003. |

#### 9.7.4 Registro de opciones

| ID Opción | Descripción | Extensión | Impacto | Riesgos |
|---|---|---|---|---|
| OPC-10 | Contratar un proveedor real de firma electrónica y un convenio bancario. | **Alta:** gestión contractual fuera del control del equipo. | **Nulo dentro del plazo.** | Inviabilidad cierta; bloquea el hito H5 sin fecha de resolución. |
| OPC-11 ✓ | Interfaz de servicio por cada integración, con adaptador simulado configurable y contrato listo para el adaptador real. Selección por la variable `SERVICIOS_EXTERNOS`, la misma del MR-003. | **Media:** ~16 h para las dos interfaces, sus adaptadores y sus pruebas. | **Alto positivo:** completa RF-11 en la primera versión y deja RF-12 listo para la segunda sin rediseño. | Confundir el pagaré simulado con un título valor real. Se mitiga con la condición de aprobación. |
| OPC-12 | Generar el pagaré sin firma ni sello y almacenarlo tal cual, como describe hoy el punto 11.2. | **Baja:** ~2 h. | **Alto negativo:** incumple RN-62 y deja sin evidencia probatoria la aceptación del cliente. | Inaceptable: el pagaré es la prueba de la obligación. Se documenta para dejar constancia del rechazo. |

**Recomendación: OPC-11.** Repite la decisión del MR-003 y aprovecha la infraestructura que ya define (interfaz propia, selección por variable de entorno y distintivo visible), de modo que el costo adicional es bajo y el sistema queda listo para el proveedor definitivo.

#### 9.7.5 Asignación de recursos

| ID Opción | N° Personas | N° Horas | Costo | Observación |
|---|---|---|---|---|
| OPC-10 | 1 + gestión externa | Indeterminado | **Inviable** | Fuera del alcance de un proyecto académico. |
| OPC-11 ✓ | 2 | 16 h | **Medio-bajo** | 1 backend para las interfaces y adaptadores; 1 QA para los escenarios de firma exitosa, caída del proveedor (FA-03 de RF-11) y orden duplicada (RN-65). |
| OPC-12 | 1 | 2 h | **Inaceptable en consecuencias** | Rechazada. |

#### Cambios derivados en el plan de pruebas

- Punto 11.2, fila "Integración bancaria y firma electrónica": reemplazar la descripción por *"Firma electrónica y desembolso se prueban contra adaptadores simulados (MR-004), no contra los servicios reales."*
- Punto 11.3: los 5 casos de "Formalización — oferta y pagaré (RF-11)" incluyen el escenario de caída del proveedor de firma.

---

## Parte B — Sincronización de la ERS con los MR aprobados

| # | Sección | Texto actual | Texto propuesto |
|---|---|---|---|
| B1 | 7.1.3 RI-09 (descripción) | "El sistema DEBE interactuar con PostgreSQL mediante un mapeador objeto-relacional, con un esquema por microservicio." | "El sistema DEBE interactuar con MySQL 8 (motor InnoDB, juego de caracteres utf8mb4) mediante el mapeador objeto-relacional de Laravel, con un esquema lógico por módulo de dominio identificado por prefijo de tabla (MR-001, MR-002)." |
| B2 | RI-09, especificaciones | "Transacciones para operaciones críticas, con patrón de saga para las que cruzan microservicios" / "Separación lógica de esquemas por dominio" | "Transacciones de base de datos para las operaciones críticas; las operaciones que cruzan módulos se coordinan por eventos de dominio internos" / "Separación lógica de esquemas por módulo mediante prefijo de tabla" |
| B3 | 6.1, segundo párrafo | "La arquitectura se organiza en microservicios coordinados por una puerta de enlace única…" | Anteponer: "**Arquitectura objetivo.**" y añadir al final: "**Estrategia de la primera versión (MR-002).** La primera versión funcional se construye como monolito modular en Laravel, con un módulo por dominio, frontera explícita entre módulos verificada en integración continua y un único despliegue. Cada módulo conserva su interfaz pública y su esquema lógico, de modo que pueda extraerse como microservicio sin reescribir la lógica de negocio." |
| B4 | 6.1, tabla de capas, fila "Aplicaciones" | "Microservicios de identidad, cliente, originación, …" | "Módulos de identidad, cliente, originación, evaluación, desembolso, contabilidad y analítica —microservicios en la arquitectura objetivo—, más el portal web" |
| B5 | 7.3.8 RNF-21 | Sin distinción de versión | Añadir: "**Aplicabilidad:** exigible en la arquitectura objetivo. En la primera versión (MR-002) el escalado horizontal se aplica al despliegue único, que conserva la condición de servicio sin estado." |
| B6 | 5.3.2, funcionalidades técnicas | "Diseño responsive del portal y aplicación móvil nativa multiplataforma" | "Diseño responsive del portal web; la aplicación móvil nativa multiplataforma queda para una entrega posterior" |
| B7 | 7.1.3 RI-10, especificaciones | Sin mención a los adaptadores | Añadir: "Cada integración se consume a través de una interfaz propia con adaptador real y adaptador simulado, seleccionables por la variable de entorno `SERVICIOS_EXTERNOS` (MR-003, MR-004)." |
| B8 | Portada o control de versiones | — | Añadir la tabla: "v1.0 — 09/10/2026 — Aprobación en H1 · v1.1 — [fecha] — Incorpora MR-001 a MR-004" |

## Parte C — Cronograma alineado con el alcance de la primera versión

El punto 7.10 y el plan de pruebas dejan desembolso, contabilidad, analítica y app nativa para la segunda entrega, pero el cronograma del punto 4 los programa antes del 28/11.

| # | Elemento | Actual | Propuesto |
|---|---|---|---|
| C1 | Fase 4 — nombre y objetivo | "Desembolso y contabilidad — Cerrar la cadena con el desembolso, la causación automática y la analítica" | "Formalización — Cerrar la primera versión con la oferta, la firma del pagaré y el plan de amortización" |
| C2 | Hito H4 | "Flujo extremo a extremo (13 nov)" | "Camino de originación integrado, del registro a la firma del pagaré (13 nov)" |
| C3 | Actividad 21 | "Aplicación móvil sobre la misma interfaz de programación" | "Verificación del portal responsive en dispositivos móviles (RNF-16)" |
| C4 | Actividades 30 a 33 | Integración bancaria, causación, conciliación y tablero directivo | Pasan a una sección nueva, "Segunda entrega", con su duración estimada (punto 7.10). En su lugar, en la Fase 4: "30 · Adaptadores de firma electrónica y desembolso (MR-004)" y "31 · Oferta, vigencia y aceptación con segundo factor (RF-11)" |
| C5 | Actividad 26 | "Integración con la central de información crediticia" | "Integración con la central de información crediticia mediante adaptador simulado (MR-003)" |
| C6 | Imagen del cronograma | Fase 4 "Desembolso y contabilidad" | Regenerar con los nombres de C1 y C2 |

## Parte D — Estimación del punto 7.10

**D1. Archivos de interfaz externos de la primera versión.** La primera versión usa tres servicios externos, pero la tabla cuenta dos:

| Servicio | Complejidad (punto 7.3) |
|---|---|
| Verificación de identidad | Media |
| Listas restrictivas | Media |
| Central de información crediticia | Alta |

Fila EIF corregida: Baja 0 · Media 2 · Alta 1 · `0x5 + 2x7 + 1x10` = **24** (antes 17).

**D2. Recálculo** (mismo ATC = 61, mismos supuestos):

| Concepto | Actual | Corregido |
|---|---|---|
| PFSA de la primera versión | 125 | **132** |
| PFA | 157,50 | **166,32** |
| Esfuerzo | 945 h/persona | **997,92 h/persona** |
| Horas por miembro (5 personas) | 189 h | **199,58 h** |
| Duración | 1,89 meses ≈ 8,2 semanas | **1,9958 meses ≈ 8,65 semanas** |
| Presupuesto | $29.051.502 | **$30.678.386** |
| PFSA de la segunda entrega | 193 | **186** (2,81 meses con 5 personas) |

Interpretación corregida: 8,65 semanas caben en las 9 del cronograma, con un margen de **menos de media semana** para la estabilización.

**D3. [Decisión del equipo] Tamaño del equipo.** La portada lista **cuatro** autores y toda la estimación usa **cinco** desarrolladores. Con cuatro personas:

| Concepto | Con 4 personas |
|---|---|
| Horas por miembro | 249,48 h |
| Duración | 2,49 meses ≈ **10,8 semanas** |
| Segunda entrega | 3,52 meses |

Con cuatro personas la primera versión **no cabe en las 9 semanas**. Hay tres salidas: confirmar que el equipo son cinco y completar la portada; reducir el alcance de la primera versión (por ejemplo, llevar la explicación de la decisión o el plan de amortización a la segunda entrega) y recalcular; o justificar más horas productivas por día. El presupuesto no cambia, porque depende de las horas-persona y no del número de personas.

**D4.** Punto 7.8: "4,8082 meses ≈ 4 meses, 3 semanas y 3 días" mezcla bases. 0,8082 meses son 16,2 días laborales, o sea **3 semanas y 1 día hábil**. Hay que usar la misma base de 20 días laborales del resto del cálculo.

## Parte E — Usuarios, casos de uso y modelo de datos

**E1. Perfil del Directivo (nuevo 6.3.6; la matriz pasa a 6.3.7).** La matriz de permisos y RF-03 manejan seis roles, pero solo hay cinco perfiles. Propuesta, que el equipo debe ajustar:

| Atributo | Descripción |
|---|---|
| Cantidad estimada | 3 – 6 usuarios |
| Nivel educativo | Profesional con posgrado en finanzas, administración o afines |
| Edad | 35 – 65 años |
| Experiencia técnica | Intermedia |
| Familiaridad con tecnología | Media – consumo de tableros e informes |
| Dispositivo principal | Escritorio y móvil para consulta fuera de oficina |
| Contexto de uso | Comités, reuniones de seguimiento y cierre de periodo |
| Frecuencia de uso | Semanal, intensiva en cierre de mes |
| Tiempo promedio de sesión | 10 – 30 minutos |
| Conectividad | Estable |
| Motivación | Alta – decisiones sobre colocación, riesgo y equidad del modelo |
| Necesidades principales | Indicadores confiables con fuente única de verdad y exportación |
| Limitaciones | Sin acceso a datos personales identificables (RN-79); no decide sobre solicitudes |

**E2. Casos de uso del Administrador.** El Administrador aparece como actor y tiene las pantallas 8.6, pero ningún caso de uso. Se proponen, con su ficha en el formato existente:

| Código | Caso de uso | Actor principal | Módulo | Requisitos asociados |
|---|---|---|---|---|
| UC15 | Gestionar usuarios y roles | Administrador | Identidad | F-ADM-01, RNF-05, RN-56 |
| UC16 | Parametrizar productos y reglas | Administrador | Evaluación | F-ADM-02, F-EVA-01, RN-44 |
| UC17 | Consultar el registro de auditoría | Administrador | Gobierno | F-ADM-04, RNF-08 |

Ajustar el punto 2 del Capítulo 2: "diecisiete casos de uso en cuatro módulos". La causación contable dentro de UC13 se nombra como **UC13.1 – Causar y conciliar contabilidad**, para que tenga código.

**E3. Máquina de estados de la solicitud (nuevo apartado en 7.2.6 o en el Capítulo 2).** OE-03 y F-ORI-03 la exigen, pero no está definida. Propuesta:

| Estado interno | Etiqueta visible al cliente (RN-36) | Entra desde | Sale hacia |
|---|---|---|---|
| BORRADOR | Borrador | — | RADICADA, DESISTIDA (RN-31) |
| RADICADA | Radicada | BORRADOR | EN_EVALUACION, PENDIENTE_CLIENTE |
| PENDIENTE_CLIENTE | Necesitamos un documento | RADICADA, EN_ESTUDIO | RADICADA, DESISTIDA (15 días, UC8-A2) |
| EN_EVALUACION | En evaluación | RADICADA | APROBADA, NEGADA, EN_ESTUDIO |
| EN_ESTUDIO | En estudio | EN_EVALUACION (escalada o tercero caído) | EN_DECISION, PENDIENTE_CLIENTE |
| EN_DECISION | En decisión | EN_ESTUDIO | APROBADA, APROBADA_CONDICIONADA, NEGADA, EN_COMITE |
| EN_COMITE | En decisión | EN_DECISION (RF-10 FA-01) | APROBADA, APROBADA_CONDICIONADA, NEGADA |
| APROBADA / APROBADA_CONDICIONADA | Aprobada | EN_EVALUACION, EN_DECISION, EN_COMITE | OFERTA_ACEPTADA, OFERTA_RECHAZADA, OFERTA_VENCIDA (RN-59) |
| NEGADA | No aprobada | EN_EVALUACION, EN_DECISION, EN_COMITE | EN_ESTUDIO (reconsideración, RN-49) |
| OFERTA_ACEPTADA | Aprobada | APROBADA* | FORMALIZADA |
| FORMALIZADA | Pagaré firmado | OFERTA_ACEPTADA | DESEMBOLSADA (segunda entrega) |
| DESEMBOLSADA | Desembolsada | FORMALIZADA | — |
| DESISTIDA, OFERTA_RECHAZADA, OFERTA_VENCIDA | Cerrada | — | — (terminales) |

Las reversiones de una decisión automatizada (RF-10 FA-02) no son estados: se registran como una nueva fila en DECISION.

**E4. Ajustes al modelo relacional y al diccionario de datos.**

| Tabla | Cambio | Motivo |
|---|---|---|
| SOLICITUD | Añadir `ingreso_mensual`, `egreso_mensual`, `ocupacion`, `empleador`, `antiguedad_laboral_meses`, `consentimiento_centrales_id`, `estado_sla_pausado` | RN-41 no puede calcularse sin ingresos y egresos; RN-33 y la pausa del reloj (UC8) necesitan su dato |
| REGLA_VERSION (nueva) | `id_version`, `codigo`, `definicion` (JSON), `vigente_desde`, `publicada_por`, `estado` | RN-44: la versión aplicada debe poder recuperarse para reproducir una evaluación |
| EVALUACION | `version_reglas` pasa a FK a REGLA_VERSION; añadir `variables_determinantes` (JSON), `capacidad_pago`, `fuente_central` (real o simulada) | RF-08 paso 8, RF-09 y la condición del MR-003 |
| OFERTA (nueva) | `id_oferta`, FK `id_solicitud`, `monto`, `plazo_meses`, `tasa_ea`, `cuota`, `costo_total`, `vence_en`, `estado` | RN-38/RN-59: vigencia de 15 días y condiciones definitivas |
| RECONSIDERACION (nueva) | `id_reconsideracion`, FK `id_solicitud`, FK `id_decision`, `motivo_cliente`, `estado`, `vence_en` | RF-09 y RN-50 (15 días hábiles) |
| DECISION | Añadir `id_decision_revertida` (FK a sí misma, nullable) y `automatizada` (boolean) | RF-10 FA-02 y RF-09 paso 4 |
| CONSENTIMIENTO | Quitar `estado` modificable; cada otorgamiento o revocación es una fila nueva con `accion` (otorga/revoca), `canal` y `fecha_registro` | RN-21: histórico inmutable |
| RELACIONADO_EMPLEADO (nueva) | FK `id_empleado`, `num_documento_relacionado`, `tipo_relacion` | RN-55: conflicto de interés |
| CUENTA_DESTINO (nueva, segunda entrega) | FK `id_cliente`, `banco`, `numero_cifrado`, `titularidad_verificada` | RN-67 |

Actualizar los textos "11 tablas" y "7 tablas" con el nuevo conteo después de redibujar las vistas.

## Parte F — Plan de pruebas

| # | Sección | Actual | Propuesto |
|---|---|---|---|
| F1 | 15.3, condición 2 | "Al menos doce de los catorce casos resultan exitosos." | "Al menos trece de los catorce casos resultan exitosos (92,9 %), en concordancia con el criterio de aceptación del 90 % del punto 12.3." Ajustar "Los dos casos restantes" → "El caso restante". |
| F2 | 14.14 CP0014 | Pasos 7 y 8 y criterios sobre el panel de equidad | Retirar el panel de equidad del caso, porque RF-14 está excluido de la primera versión (11.2). El caso conserva la inspección del catálogo de variables, la prueba por pares y la reversión humana. El panel se prueba en la segunda entrega. |
| F3 | 15, fila 3 | CP0003 — requisito "MR-003, RNF-20" | "MR-003, RF-02, RI-10" |
| F4 | 10.2, fila Prototipo | "Descripción funcional de las 19 pantallas del sistema" | "…de las 21 pantallas del sistema" |
| F5 | 12.2, fila Esquema | Prefijos `identidad_, cliente_, originacion_, evaluacion_, auditoria_` | Usar los mismos módulos del MR-002: `identidad_, cliente_, originacion_, evaluacion_, desembolso_, contabilidad_, analitica_`. La auditoría es transversal y vive en el módulo de identidad (`identidad_auditoria`). **[Decisión del equipo]** si se prefiere un módulo propio de auditoría, añadirlo también al MR-002. |
| F6 | 14.12 CP0012, necesidades | "Acceso al bus de eventos para verificar la publicación" | "Acceso al registro de eventos de dominio internos para verificar la publicación" (en el monolito modular no hay bus de eventos). |
| F7 | 9.1, primer párrafo | "Al cerrar la Fase 1 … aparecieron tres discrepancias" | "Durante las fases 1 y 2 aparecieron cuatro discrepancias…" y añadir el MR-004 a la lista. |

## Parte G — Equipo y datos pendientes

| # | Dónde | Qué hacer |
|---|---|---|
| G1 | Todos los MR, punto 10 y punto 16 | Reemplazar `[Nombre del docente]` por **Manuel De Jesús Giraldo Carreazo**. |
| G2 | Puntos 9, 10, 14 y 16 | Reemplazar `[Integrante 2]` a `[Integrante 5]` por los nombres reales. **[Decisión del equipo]** La portada tiene cuatro autores (García Pernett, González López, Suarez Negrete, Martínez Martínez) y el plan de pruebas cinco roles. Ver D3. |
| G3 | Punto 10 frente a puntos 16 y 16.1 | Unificar el rol de cada integrante: Integrante 4 aparece como "Frontend/UX" y como "desembolso y contabilidad"; la evaluación aparece implementada por Integrante 3 (punto 16) y por García Pernett (16.1); MySQL aparece configurado por García Pernett (MR-001) y por Integrante 4 (16.1). |

## Parte H — Forma y referencias

| # | Sección | Corrección |
|---|---|---|
| H1 | Índice | Regenerar: no incluye los puntos 9 a 16 ni el Capítulo 3 completo. |
| H2 | RNF-13, RNF-16, RNF-19, RNF-23, 13.2 y 15.3 | Las listas numeradas continúan la numeración de una lista anterior (empiezan en 8, 16, 20, 24, 3 y 7). Reiniciar cada una en 1. |
| H3 | 5.5 Referencias | Retirar **PCI DSS v4.0** (la emisión de tarjetas está fuera de alcance, 5.3.3). Añadir **Ley 2157 de 2021**, que modifica la Ley 1266 de 2008 (habeas data financiero). |
| H4 | RN-68 | "requiere autorización de un rol distinto al que aprobó" → "requiere autorización de un **usuario** distinto al que aprobó" (aprobación y desembolso ya son roles distintos; lo que debe impedirse es que la misma persona tenga ambos). |
| H5 | RN-40 | Indicar la escala del puntaje (por ejemplo, 0 – 1.000) y el valor del umbral de monto de RN-39, o remitir a la parametrización de F-ADM-02. |
