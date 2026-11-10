# FinanTech — PagaMas

Plataforma digital de originación de crédito de consumo. Proyecto académico de Ingeniería de Sistemas, Universidad de Córdoba.

El cliente se registra y verifica su identidad, inicia sesión con segundo factor, simula un crédito, radica la solicitud y recibe una evaluación automática; un oficial toma la decisión y, si se aprueba, el cliente acepta la oferta y firma el pagaré.

> **Entrega de la primera versión:** 28 de noviembre de 2026.

## Estado (9 de noviembre de 2026)

El recorrido completo funciona de punta a punta en el portal contra la API real, desde el registro hasta el pagaré firmado. Los servicios de terceros son simulados y se marcan como tales.

| Funcionalidad | Requisito | Estado |
|---|---|---|
| Base del proyecto: entorno, módulos y prueba de frontera | MR-001, MR-002 | Listo |
| Registro con verificación de correo y celular (respuesta neutra si la cuenta ya existe) | RF-01, RN-17 | Listo |
| Verificación de identidad con documento y foto (simulada) | RF-02 | Listo |
| Inicio de sesión con segundo factor y recuperación de contraseña | RF-03 | Listo |
| Consentimiento: "Mis datos y privacidad" | RF-04 | Listo |
| Simulación con TEA y desglose de costos | RF-05 | Listo |
| Radicación con documentos y seguimiento de la solicitud | RF-06, RF-07 | Listo |
| Evaluación automática con motor de reglas versionado | RF-08 | Listo |
| Bandeja, expediente y decisión del oficial | RF-09, RF-10 | Listo; falta la reconsideración y la descarga de documentos |
| Oferta de 15 días y pagaré con firma simulada | RF-11 | Listo |
| Administración, auditoría, comité y funciones del analista | — | Postergado en esta versión |
| Desembolso real, contabilidad y tableros | RF-12 a RF-14 | Fuera de la primera versión |

Pruebas al 9/11: 369 de Pest en verde, con 97,2 % de cobertura y 99,8 % en el motor de reglas; 82 del portal. Lo que falta antes de la entrega está en la sección "Pendiente para el 28/11" de [CLAUDE.md](CLAUDE.md).

## Tecnologías

- **Backend:** PHP 8.4, Laravel 13, API REST bajo `/api/v1`.
- **Frontend:** React 19, TypeScript y Vite.
- **Base de datos:** MySQL 8.4.
- **Pruebas:** Pest 5, incluidas pruebas de arquitectura.
- **Entorno:** Docker Compose. No hace falta instalar PHP, Composer ni MySQL en el equipo.

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.
- [Node.js](https://nodejs.org/) 20 o superior, para el frontend.
- Git.

## Puesta en marcha

Desde la raíz del repositorio:

```bash
# 1. Variables de entorno del backend
cp backend/.env.example backend/.env

# 2. Levantar los contenedores (app, web, mysql y mailpit)
docker compose up -d --build

# 3. Dependencias de PHP, clave de la aplicación y base de datos
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate:fresh --seed

# 4. Frontend
cd frontend
npm install
npm run dev
```

`vendor` vive en un volumen de Docker (`vendor-data`) y no en la carpeta del proyecto, porque leerla desde el montaje de Windows hace muy lenta la API. Por eso, **cada vez que se crea o se recrea el contenedor `app` en un volumen nuevo, o cambia `composer.lock`, hay que correr** `docker compose exec app composer install`. Sin ese paso, la API responde con error porque no encuentra `vendor/autoload.php`. Un cambio en un archivo PHP se ve en la API a más tardar 10 segundos después (`opcache.revalidate_freq`).

| Servicio | Dirección |
|---|---|
| API | http://localhost:8000 (comprobar con `/up`) |
| Portal | http://localhost:5173 |
| MySQL | `localhost:3307`, base `finantech`, usuario `finantech`, contraseña `finantech_dev` |
| Mailpit (correo de desarrollo) | http://localhost:8025 |

En desarrollo nada sale a internet. Los correos (códigos de verificación y de segundo factor) y una copia de cada SMS simulado llegan a la bandeja de **Mailpit** en http://localhost:8025. Si después de reconstruir los contenedores la API responde 502, ejecuta `docker compose restart web`.

### Cuentas de demostración

Todas usan la contraseña `Demo#2026!` y las crea el seeder. La lista completa está en [frontend/README.md](frontend/README.md).

| Rol | Correo |
|---|---|
| Cliente | laura.mejia@demo.finantech.co |
| Oficial de crédito | camila.ortiz@demo.finantech.co |

Para que una radicación llegue a la bandeja del oficial, usa 6 meses de antigüedad, ingreso de 1.100.000 y gastos de 0. Con 12 meses o más, el motor la aprueba solo.

Si `npm install` avisa que bloqueó el script de `esbuild`, ejecuta `npm approve-scripts esbuild` y luego `npm rebuild`.

## Pruebas

```bash
docker compose exec app ./vendor/bin/pest                # todas
docker compose exec app ./vendor/bin/pest --group=arch   # frontera entre módulos (CP0002)
docker compose exec app ./vendor/bin/pest --filter=Registro
cd frontend && npm test                                  # pruebas del portal
```

Las pruebas usan la base `finantech_test` en MySQL, que se crea sola al levantar el contenedor. GitHub Actions corre las pruebas del backend, la frontera de módulos, la cobertura del motor y las pruebas, el lint y el build del portal en cada push y pull request.

## Estructura

```
backend/
  app/Modules/      Un módulo por dominio: Identidad, Cliente, Originacion,
                    Evaluacion, Desembolso, Contabilidad, Analitica
  app/Shared/       Código común que no pertenece a ningún módulo
  tests/            Feature/ (por módulo) y Arch/ (frontera entre módulos)
frontend/           Portal web
docker/             Configuración de PHP, nginx y MySQL
docs/               Contrato de la API, correcciones a la ERS, QA (trazabilidad),
                    UX (dirección visual) y equipo (plan y decisiones)
CLAUDE.md           Reglas de arquitectura, negocio y seguridad del proyecto
```

El backend es un **monolito modular**: cada módulo tiene sus propias tablas (con prefijo, por ejemplo `identidad_`), sus rutas y sus servicios. **Ningún módulo usa los modelos de otro**; se comunican por sus servicios públicos. Una prueba automática lo verifica.

Los servicios de terceros (verificación de identidad, listas restrictivas, centrales de riesgo, firma electrónica y desembolso) tienen un adaptador simulado y uno real, elegidos con `SERVICIOS_EXTERNOS=simulado|real`. Todo resultado simulado se muestra marcado como simulado.

## API disponible

Todas las rutas van bajo `/api/v1`. El contrato completo está en [docs/contrato-api-v1-frontend.md](docs/contrato-api-v1-frontend.md).

| Área | Rutas principales | Quién |
|---|---|---|
| Registro | `POST clientes/registro`, `…/{id}/reenviar`, `…/{id}/verificar`; `GET identidad/politica-vigente` | Público |
| Sesión | `POST identidad/sesiones`, `…/{desafio}/verificar`; `POST identidad/sesion/renovar`; `GET` y `DELETE identidad/sesion`; `POST identidad/recuperacion` | Público / con sesión |
| Identidad y datos | `GET` y `POST clientes/verificacion-identidad`; `GET` y `POST identidad/consentimientos` | Cliente |
| Simulación | `GET cliente/productos`, `POST cliente/simulaciones` | Público |
| Solicitudes | `GET` y `POST originacion/solicitudes`; `…/{id}/documentos`, `…/{id}/radicar`, `…/{id}/decision` | Cliente |
| Consola interna | `GET originacion/bandeja`, `GET originacion/expedientes/{id}`, `POST evaluacion/decisiones` | Analista y oficial (decide el oficial) |
| Oferta y pagaré | `GET desembolso/ofertas/{id}`; `…/desafio-mfa`, `…/aceptar`, `…/rechazar` | Cliente |

La sesión viaja en cookies httpOnly (token de acceso de 15 minutos y de renovación de 7 días); el portal nunca guarda tokens. Los errores de negocio responden con `{ "codigo", "mensaje", "datos" }` y mensajes en español.

## Cómo trabajamos

- Cada funcionalidad en su propia rama, con pull request hacia `main`.
- Antes de subir, **todas las pruebas deben pasar**, incluida la de frontera entre módulos.
- En commits, pruebas y comentarios se citan los requisitos de la ERS por su ID (RF-01, RN-05, CP0004…).
- Solo datos de prueba sintéticos; nunca datos reales ni secretos en el repositorio (`.env` no se sube).
- Las reglas completas del proyecto están en [CLAUDE.md](CLAUDE.md), y la especificación en la ERS de la raíz.

## Equipo

| Integrante | Rol |
|---|---|
| Frank García | Líder técnico, backend |
| Efren Suarez | Backend |
| Tomás González | Frontend |
| Kevin Martínez | QA y documentación |
