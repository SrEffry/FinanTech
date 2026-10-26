# FinanTech — PagaMas

Plataforma digital de originación de crédito de consumo. Proyecto académico de Ingeniería de Sistemas, Universidad de Córdoba.

El cliente se registra y verifica su identidad, inicia sesión con segundo factor, simula un crédito, radica la solicitud y recibe una evaluación automática; un oficial toma la decisión y, si se aprueba, el cliente acepta la oferta y firma el pagaré.

> **Primera versión funcional:** 28 de noviembre de 2026.

## Estado

| Funcionalidad | Requisito | Estado |
|---|---|---|
| Base del proyecto: entorno, módulos y prueba de frontera | MR-001, MR-002 | Listo |
| Registro de clientes con verificación de correo y celular | RF-01 | Listo (API) |
| Verificación de identidad con servicios simulados | RF-02 | Pendiente |
| Inicio de sesión con segundo factor | RF-03 | Pendiente |
| Consentimiento: "Mis datos y privacidad" | RF-04 | Pendiente |
| Simulación, radicación, evaluación, decisión | RF-05 a RF-10 | Pendiente |
| Oferta y pagaré | RF-11 | Pendiente |
| Portal web (pantallas) | — | Pendiente |

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

# 2. Levantar los contenedores (app, web y mysql)
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

| Servicio | Dirección |
|---|---|
| API | http://localhost:8000 (comprobar con `/up`) |
| Portal | http://localhost:5173 |
| MySQL | `localhost:3307`, base `finantech`, usuario `finantech`, contraseña `finantech_dev` |

En desarrollo los correos y SMS no se envían de verdad: los códigos de verificación aparecen en `backend/storage/logs/laravel.log`.

Si `npm install` avisa que bloqueó el script de `esbuild`, ejecuta `npm approve-scripts esbuild` y luego `npm rebuild`.

## Pruebas

```bash
docker compose exec app ./vendor/bin/pest                # todas
docker compose exec app ./vendor/bin/pest --group=arch   # frontera entre módulos (CP0002)
docker compose exec app ./vendor/bin/pest --filter=Registro
```

Las pruebas usan la base `finantech_test` en MySQL, que se crea sola al levantar el contenedor.

## Estructura

```
backend/
  app/Modules/      Un módulo por dominio: Identidad, Cliente, Originacion,
                    Evaluacion, Desembolso, Contabilidad, Analitica
  app/Shared/       Código común que no pertenece a ningún módulo
  tests/            Feature/ (por módulo) y Arch/ (frontera entre módulos)
frontend/           Portal web
docker/             Configuración de PHP, nginx y MySQL
docs/               Correcciones propuestas a la ERS
CLAUDE.md           Reglas de arquitectura, negocio y seguridad del proyecto
```

El backend es un **monolito modular**: cada módulo tiene sus propias tablas (con prefijo, por ejemplo `identidad_`), sus rutas y sus servicios. **Ningún módulo usa los modelos de otro**; se comunican por sus servicios públicos. Una prueba automática lo verifica.

Los servicios de terceros (verificación de identidad, listas restrictivas, centrales de riesgo, firma electrónica y desembolso) tienen un adaptador simulado y uno real, elegidos con `SERVICIOS_EXTERNOS=simulado|real`. Todo resultado simulado se muestra marcado como simulado.

## API disponible

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/identidad/politica-vigente` | Política de datos vigente y sus finalidades |
| POST | `/api/v1/clientes/registro` | Inicia el registro y envía los códigos |
| POST | `/api/v1/clientes/registro/{id}/reenviar` | Reenvía los códigos |
| POST | `/api/v1/clientes/registro/{id}/verificar` | Verifica los códigos y crea el cliente |

Los errores de negocio responden con `{ "codigo", "mensaje", "datos" }` y mensajes en español.

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
