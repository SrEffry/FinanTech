# Portal FinanTech (frontend)

React 19 + TypeScript + Vite + Tailwind CSS 4. Portal web responsive y mobile-first para clientes y consola interna para analistas, oficiales, administradores, contabilidad y directivos.

## Correrlo

```bash
npm install
npm run dev        # http://localhost:5173
```

El backend tiene que estar arriba (`docker compose up -d` en la raíz): el registro de clientes (RF-01) usa la API real de Laravel por el proxy de Vite (`/api` → `localhost:8000`).

### API simulada (MSW)

El backend todavía no tiene la mayoría de endpoints. Mientras tanto, [Mock Service Worker](https://mswjs.io) los simula en el navegador con datos **sintéticos**:

- Se activa con `VITE_API_SIMULADA=true` en `.env.development` (activo por defecto en `npm run dev`).
- Lo que no está simulado pasa al backend real. Hoy eso es solo el registro.
- Cuando Laravel implemente un endpoint, se **borra su handler** en `src/mocks/handlers/` y la pantalla queda conectada sin tocar nada más.
- El contrato que esperan las pantallas está en [`docs/contrato-api-v1-frontend.md`](../docs/contrato-api-v1-frontend.md) y los tipos en `src/lib/api/tipos.ts`.
- Los datos viven en `localStorage` del navegador. La franja "Datos de demostración" de arriba tiene el botón para reiniciarlos.
- `npm run build` no incluye nada de los mocks: sin la variable, el import dinámico de `src/mocks` desaparece del bundle.

### Cuentas de demostración

Todas con la contraseña `Demo#2026!`. El código del segundo factor aparece en pantalla (solo en modo simulado).

| Rol | Correo |
|---|---|
| Cliente | laura.mejia@demo.finantech.co |
| Analista de crédito | andres.rojas@demo.finantech.co |
| Oficial de crédito (atribución $30.000.000) | camila.ortiz@demo.finantech.co |
| Administrador | sergio.paez@demo.finantech.co |
| Auxiliar contable | diana.vargas@demo.finantech.co |
| Directivo | hernan.cuellar@demo.finantech.co |

**Escenarios preparados:**
- **Laura:**
  - Una oferta aprobada con condiciones, lista para firmar.
  - Una solicitud negada, con la reconsideración disponible.
  - Una solicitud con un documento rechazado.
- **Camila:**
  - FT-2026-000406 supera su atribución, así que solo la puede negar o enviar a comité.
  - FT-2026-000408 es de un cliente con el que tiene vínculo (conflicto de interés, RN-55).
- **Cliente nuevo:** al registrarte de verdad, en el paso de identidad puedes forzar el escenario del proveedor simulado (éxito, coincidencia baja, documento ilegible, servicio caído o lista restrictiva).
- **Central de riesgo:** la simulada no responde para documentos que terminan en 0. La solicitud pasa a estudio sin negarse (RF-08 FA-02).

Los códigos del registro real (correo y SMS) se escriben en `backend/storage/logs/laravel.log`.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm test         # Vitest + Testing Library (incluye pruebas con MSW en Node)
npm run lint     # ESLint con reglas de accesibilidad (jsx-a11y)
npm run build    # tsc + build de producción
```

## Estructura

```
src/
  app/              router (rutas diferidas por pantalla) y páginas de error
  components/
    ui/             piezas genéricas: Button, Field, Modal, DataTable, FileDrop…
    dominio/        CuotaConTea, Costos, Estado, Evaluacion, Distintivos, Marca
    layouts/        PublicoLayout, PortalLayout, ConsolaLayout, RutaProtegida
  features/         una carpeta por dominio: acceso, registro, identidad, simulacion,
                    cliente, consola, administracion
  lib/
    api/            cliente HTTP (ErrorApi), funciones por dominio y tipos del contrato
    estados.ts      máquina de estados y etiquetas para el cliente (RN-36)
    formato.ts      moneda, fechas y enmascarado de datos (RNF-06)
  mocks/            API simulada: base sintética, motor de reglas y handlers
  styles/index.css  tokens de la ERS (RI-02) en @theme de Tailwind
```

## Reglas que el portal cumple

- **Cuota y TEA** siempre juntas y con el mismo peso visual (`CuotaConTea`, RNF-20), con desglose completo de costos y el aviso de que la simulación no es una aprobación (RN-24, RN-25).
- **Datos sensibles**: solo los últimos 4 dígitos (`enmascarar`, RNF-06).
- **Resultados de terceros simulados**: siempre llevan `DistintivoSimulado`, incluido el pagaré firmado (MR-003, MR-004).
- **Autorización**: `RutaProtegida` solo ordena la navegación; la autorización real va en el servidor, y los mocks también la aplican.
- **Accesibilidad**: WCAG 2.1 AA (RNF-19). Foco visible, salto al contenido, etiquetas y errores asociados a cada campo, áreas táctiles de 44 px, cifras leídas con su unidad y `prefers-reduced-motion`.
- **Consola interna**: se cierra a los 15 minutos sin actividad, con un minuto de aviso (RN-16).
