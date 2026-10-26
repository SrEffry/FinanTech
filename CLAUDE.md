# PagaMas — Plataforma Digital Integrada FinanTech

Proyecto académico (Universidad de Córdoba, Ingeniería de Sistemas). Plataforma de originación de crédito de consumo: registro y verificación del cliente → inicio de sesión con segundo factor → simulación → radicación → evaluación automática → decisión del oficial → oferta y pagaré.

**Estado (20/10/2026):** base del proyecto armada y registro de clientes (RF-01) funcionando con pruebas. Primera versión funcional: **28/11/2026**.

**Equipo (4 personas):** Frank García (líder técnico, backend), Efren Suarez (backend), Tomás González (frontend), Kevin Martínez (QA y documentación). La estimación de la ERS supone 5 personas, así que el plazo está ajustado: hay que priorizar el camino crítico.

## Documentos fuente

- `Sistema FinanTech — …Crédito.md`: ERS completa (requisitos, casos de uso, modelo de datos, estimación, prototipo, plan de mantenimiento y plan de pruebas). Es una conversión OCR del PDF, así que el texto de los diagramas y de la portada viene corrupto; las tablas sí son confiables.
- `docs/correcciones-ers-v1.1.md`: correcciones pendientes de pasar al documento, el MR-004, la máquina de estados y los ajustes al modelo de datos.

**Prioridad entre documentos:** los MR (punto 9) y `docs/correcciones-ers-v1.1.md` mandan sobre el cuerpo de la ERS. El cuerpo todavía dice PostgreSQL y microservicios: **no seguir eso**.

Cita los requisitos por su ID (RF-xx, RN-xx, RNF-xx, UCxx, CPxxxx) en commits, pruebas y comentarios cuando una regla venga de la ERS.

## Stack (MR-001, MR-002)

- Backend (`backend/`): PHP 8.4 y Laravel 13, con API REST bajo `/api/v1/` (RI-07).
- Frontend (`frontend/`): React 19, TypeScript y Vite en el puerto 5173. Corre en el host con `npm`; el proxy de Vite manda `/api` a `localhost:8000`. Solo portal web responsive y mobile-first; no hay app nativa en la primera versión.
- Base de datos: MySQL 8.4, InnoDB, `utf8mb4`. Base `finantech` para la app y `finantech_test` para las pruebas. Las pruebas corren sobre MySQL, nunca sobre SQLite.
- Entorno: Docker Compose (`app` php-fpm, `web` nginx en :8000, `mysql` expuesto en :3307). **En el host no hay PHP ni Composer: todo comando de PHP se corre con `docker compose exec app …`.**
- Pruebas: Pest 5, incluidas las pruebas de arquitectura (`tests/Arch`).

## Arquitectura: monolito modular (MR-002)

Un módulo por dominio, cada uno con su espacio de nombres y su prefijo de tabla:

| Módulo | Prefijo | 1.ª versión |
|---|---|---|
| Identidad (usuarios, roles, MFA, consentimiento, auditoría) | `identidad_` | Sí |
| Cliente (portal, simulación) | `cliente_` | Sí |
| Originacion (solicitud, documentos, estados) | `originacion_` | Sí |
| Evaluacion (motor de reglas, puntaje, decisión) | `evaluacion_` | Sí |
| Desembolso (oferta, pagaré) | `desembolso_` | Solo oferta y pagaré |
| Contabilidad | `contabilidad_` | No |
| Analitica | `analitica_` | No |

Estructura de cada módulo en `backend/app/Modules/<Modulo>/`:

```
<Modulo>ServiceProvider.php   # extiende App\Modules\ModuleServiceProvider; se registra en bootstrap/providers.php
Database/Migrations/          # se cargan automáticamente; tablas con el prefijo del módulo
Database/Seeders/
Models/                       # privados del módulo
Services/                     # interfaz pública que pueden usar otros módulos
Contracts/ + Adapters/        # servicios externos (interfaz + adaptador simulado/real)
Http/Controllers/, Http/Requests/
Routes/api.php                # se publica bajo /api/v1 con el middleware 'api'
```

Código compartido que no es de ningún módulo: `app/Shared/` (por ejemplo el trait `SoloAdicion` y la excepción `ErrorNegocio`). `Shared` no puede depender de ningún módulo.

Convenciones:
- Los nombres de dominio van en español, igual que en la ERS: tablas, modelos, servicios y estados (`Solicitud`, `RegistroCliente`, `estado_kyc`). Lo genérico del framework sigue en inglés.
- Los errores de negocio se lanzan como `App\Shared\Exceptions\ErrorNegocio('codigo', 'mensaje legible', httpStatus)`, que responde `{codigo, mensaje, datos?}`.
- Los mensajes al usuario van en español y sin jerga técnica (`backend/lang/es/`).
- Las operaciones sensibles se registran con `App\Modules\Identidad\Services\Auditoria::registrar()`.

Reglas que no se rompen:

- **Ningún módulo importa modelos de otro módulo.** Se comunican por la interfaz pública del módulo (servicios o contratos) o por eventos de dominio internos. Esto se verifica con una prueba de arquitectura de Pest (CP0002) y, si falla, la integración no pasa.
- Entre módulos no hay llaves foráneas físicas; se referencian por identificador.
- Las tablas de solo adición no tienen update ni delete en ninguna capa: auditoría, consentimientos, decisiones, evaluaciones, asientos y movimientos. Una corrección se guarda como registro nuevo. Se implementan con el trait `SoloAdicion` en el modelo **y** con triggers `BEFORE UPDATE/DELETE` en la migración (como en `identidad_auditoria`).
- Las columnas sensibles usan el cast `encrypted`. Si además hay que buscarlas o exigir unicidad, se agrega una columna `*_hash` calculada con `IndiceCiego`.

## Servicios externos (MR-003, MR-004)

Cada tercero tiene una interfaz propia y dos implementaciones (simulada y real), elegidas con `SERVICIOS_EXTERNOS=simulado|real`:
`VerificacionIdentidadService`, `ListasRestrictivasService`, `CentralRiesgoService`, `FirmaElectronicaService`, `DesembolsoBancarioService`.

- Los adaptadores simulados permiten forzar escenarios: éxito, coincidencia menor a 0,85, documento ilegible y caída del servicio; listas restrictivas con coincidencia positiva.
- **Cuando se usa el modo simulado, toda pantalla o documento que muestre su resultado lleva un distintivo visible, y cada llamada queda en la auditoría.** Nunca presentar un resultado simulado como real.
- Si un tercero no está disponible, la solicitud pasa a evaluación manual; **nunca se niega por eso** (RF-08 FA-02).

## Reglas de negocio que el código debe imponer

- Registro: documento y correo únicos; solo mayores de 18 años; finalidades opcionales **sin marcar por defecto** (RN-05); contraseña con función de derivación de clave.
- No se puede radicar sin identidad verificada (RN-07). La coincidencia biométrica mínima es 0,85.
- Inicio de sesión: 5 intentos fallidos bloquean la cuenta 30 minutos; el mensaje de error es el mismo exista o no el usuario (RN-17); token de acceso de 15 min y de renovación de 7 días con rotación; MFA siempre para los roles internos.
- Simulación y oferta: la **TEA siempre al lado de la cuota, con el mismo peso visual**; desglose completo de costos; tasa nunca mayor a la máxima legal; aviso de "no constituye aprobación".
- Radicación: no volver a pedir datos que ya se tienen (RN-32); JPG, PNG o PDF de hasta 10 MB; una sola solicitud activa por producto; radicado único y secuencial por año.
- Evaluación: puntaje ≥ 700 se aprueba, 500–699 se escala y < 500 se niega; la cuota no puede pasar del 40 % del ingreso disponible; **cada evaluación guarda la versión de reglas y sus variables determinantes**; tiempo máximo de 10 minutos.
- **Prohibido usar como variables (ni sus aproximaciones):** sexo, estado civil, origen étnico, religión, afiliación política o estado de salud (RN-43).
- Decisión: motivo obligatorio; atribución por monto verificada en el servidor; nadie decide sobre sí mismo ni sobre un relacionado; quien parametriza no decide.
- Oferta válida 15 días; aceptarla exige segundo factor.

## Seguridad (RNF-05 a RNF-08)

- Autorización siempre en el servidor (RBAC y segregación de funciones).
- Columnas sensibles cifradas en reposo: documento, ruta de archivos y cuenta bancaria.
- En pantalla solo se muestran los últimos 4 dígitos.
- Nada sensible en los logs.
- Consultas parametrizadas; secretos solo en `.env`, nunca en el repositorio.
- **Solo datos sintéticos** (factories) fuera de producción.

## Comandos

Desde la raíz del repositorio (Docker Desktop tiene que estar abierto):

```bash
docker compose up -d --build                          # API en http://localhost:8000
docker compose exec app php artisan migrate:fresh --seed
docker compose exec app ./vendor/bin/pest             # todas las pruebas (~40 s)
docker compose exec app ./vendor/bin/pest --group=arch   # frontera de módulos (CP0002)
docker compose exec app ./vendor/bin/pest --filter=Registro
docker compose exec app composer require <paquete>
cd frontend && npm run dev                            # portal en http://localhost:5173
```

- Los códigos de verificación (correo y SMS) se escriben en `backend/storage/logs/laravel.log`, porque `MAIL_MAILER=log` y el SMS es simulado.
- Al crear clases nuevas, si no se cargan, correr `docker compose exec app composer dump-autoload`.

Cobertura mínima: 75 % global y 95 % en el motor de reglas y la lógica contable (RNF-12).

## Fuera de la primera versión

Desembolso real, contabilidad y conciliación (RF-12, RF-13), tableros y panel de equidad (RF-14), solicitudes de acceso, rectificación y supresión (RF-15, salvo el consentimiento) y la app móvil nativa. No implementarlos sin que se pida.
