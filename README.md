# API Kapso GIT

API NestJS para conectar Kapso con la base de datos CRM Ventas y, luego, con la vista Kapso del frontend CRM.

## Objetivo

Registrar y administrar la integracion inicial de numeros WhatsApp conectados en Kapso.

Bitacora de construccion y avances: [docs/construccion.md](docs/construccion.md).

Primera etapa:

- Recibir webhooks de Kapso Platform.
- Validar firma del webhook.
- Crear registro cuando Kapso conecte un numero.
- Eliminar por completo el registro cuando Kapso elimine un numero.
- Exponer endpoints internos para el frontend CRM.
- Documentar todo con Swagger/OpenAPI.
- Probar cada flujo con casos de exito, fallo y error.

## Flujo General

```mermaid
flowchart LR
    K[Kapso Platform] -->|Webhook firmado| A[API NestJS]
    A -->|Valida firma + evento| S[Servicio Kapso]
    S -->|Consulta o actualiza| DB[(CRM Ventas MySQL)]
    F[Frontend CRM] -->|Token interno| A
    A -->|Datos integracion| F
```

## Primera Integracion

```mermaid
sequenceDiagram
    participant Kapso
    participant API as API NestJS
    participant DB as CRM Ventas MySQL

    Kapso->>API: POST /api/v1/webhooks/kapso/platform
    API->>API: Verificar X-Webhook-Signature
    API->>API: Leer X-Webhook-Event

    alt whatsapp.phone_number.created
        API->>DB: Crear integracion del numero
        API-->>Kapso: 200 OK
    else whatsapp.phone_number.deleted
        API->>DB: Eliminar datos del numero
        API-->>Kapso: 200 OK
    else Evento no soportado
        API-->>Kapso: 200 OK sin procesar
    end
```

## Eventos Kapso V1

```mermaid
flowchart TD
    E[Evento Kapso Platform] --> C{Tipo de evento}
    C -->|whatsapp.phone_number.created| N[Crear numero integrado]
    C -->|whatsapp.phone_number.deleted| D[Eliminar numero integrado]
    C -->|workflow.execution.handoff| P[Pendiente etapa futura]
    C -->|workflow.execution.failed| P
    C -->|project.event| P
```

No se encontro evento oficial de actualizacion de numero en la documentacion revisada. Si Kapso no lo ofrece, se manejara con sincronizacion manual/API en una etapa posterior.

## Arquitectura Backend

```mermaid
flowchart TB
    M[AppModule] --> CFG[ConfigModule]
    M --> LOG[LoggerModule]
    M --> DB[DatabaseModule]
    M --> H[HealthModule]
    M --> W[KapsoWebhooksModule]
    M --> I[KapsoIntegrationsModule]

    W --> WV[WebhookSignatureService]
    W --> WS[PlatformWebhookService]
    I --> IS[WhatsappNumberIntegrationService]
    IS --> R[Repository / Prisma]
    R --> DB
```

## Tabla Inicial

Nombre propuesto:

`kapso_integracion_numero_whatsapp`

Uso:

- Guardar la integracion inicial entre Kapso, API y CRM.
- Permitir futura asignacion de vendedor.
- Preparar futura lectura de chats/conversaciones por numero.

Campos propuestos:

| Campo                       | Uso                                                    |
| --------------------------- | ------------------------------------------------------ |
| `id`                        | ID interno                                             |
| `kapso_phone_number_id`     | ID principal enviado por Kapso                         |
| `kapso_project_id`          | Proyecto Kapso                                         |
| `kapso_customer_id`         | Customer Kapso, si existe                              |
| `display_phone_number`      | Numero visible, si Kapso lo entrega o se sincroniza    |
| `phone_number`              | Numero normalizado, nullable                           |
| `business_account_id`       | WABA/Business account, nullable                        |
| `business_name`             | Nombre negocio, nullable                               |
| `status`                    | Estado reportado por Kapso                             |
| `is_active`                 | Activo/inactivo desde CRM                              |
| `idnetsuite_admin_asignado` | Futuro vendedor asignado por `admins.idnetsuite_admin` |
| `ultimo_payload_kapso`      | Ultimo payload relevante de Kapso, nullable            |
| `last_sync_at`              | Ultima sincronizacion con Kapso                        |
| `connected_at`              | Fecha de conexion                                      |
| `created_at`                | Creacion CRM                                           |
| `updated_at`                | Ultima actualizacion CRM                               |

Regla actual: si Kapso manda `whatsapp.phone_number.deleted`, se elimina por completo la integracion del numero.

Detalle verificado de la tabla: [docs/database.md](docs/database.md).

## Seguridad

```mermaid
flowchart LR
    K[Kapso] -->|X-Webhook-Signature| API[Webhook publico]
    F[Frontend CRM] -->|Token interno| INT[Endpoints internos]
    API --> OK{Firma valida?}
    OK -->|Si| P[Procesar]
    OK -->|No| R[401]
    INT --> T{Token valido?}
    T -->|Si| D[Responder datos]
    T -->|No| X[401]
```

Variables de entorno esperadas:

```env
KAPSO_API_KEY=
KAPSO_PLATFORM_WEBHOOK_SECRET=
CRM_API_INTERNAL_TOKEN=
PORT=8002
DATABASE_URL=
```

No subir `.env` al repo.

## Logs

```mermaid
flowchart TD
    A[API] --> L[Pino logger]
    L --> C[Consola compacta]
    L --> F[Archivo local logs/]
    F --> CL[Limpieza facil]
```

Politica:

- Consola compacta en desarrollo.
- No imprimir secretos.
- No imprimir payloads enormes en consola normal.
- Guardar logs locales en `logs/` para monitoreo y limpieza simple.
- Usar `event`, `idempotencyKey`, `phoneNumberId` y `requestId` para rastrear.

## Endpoints Esperados

| Metodo  | Ruta                                            | Uso                             |
| ------- | ----------------------------------------------- | ------------------------------- |
| `GET`   | `/api/v1/health`                                | Verificar API                   |
| `POST`  | `/api/v1/webhooks/kapso/platform`               | Recibir Kapso Platform webhooks |
| `GET`   | `/api/v1/kapso/whatsapp-numbers`                | Listar integraciones            |
| `PATCH` | `/api/v1/kapso/whatsapp-numbers/:id/activate`   | Activar integracion             |
| `PATCH` | `/api/v1/kapso/whatsapp-numbers/:id/deactivate` | Inactivar integracion           |
| `POST`  | `/api/v1/kapso/whatsapp-numbers/sync`           | Sincronizacion futura           |

Endpoints internos CRM:

- Usan `Authorization: Bearer <CRM_API_INTERNAL_TOKEN>`.
- Tambien aceptan `X-CRM-API-Token` para herramientas internas.
- Si `CRM_API_INTERNAL_TOKEN` no existe, fallan cerrado con error de configuracion.
- Playwright solo prueba escrituras bloqueadas sin token para no modificar produccion.

## Frontend CRM

Primera accion futura:

- Buscar la vista Kapso existente en `produccion/src`.
- Limpiar lo relacionado a Kapso.
- Dejar solo un `h1` con: `Kapso integracion`.

Despues:

- Consumir endpoints internos de esta API.
- Usar token interno.
- Mostrar integraciones.
- Activar/inactivar una integracion.

## Desarrollo Local

```powershell
npm install
npm run start:dev
ngrok http 8002
```

El endpoint en Kapso debe apuntar a:

```text
https://<ngrok-url>/api/v1/webhooks/kapso/platform
```

## Pruebas

```mermaid
flowchart LR
    U[Unit tests] --> I[Integration tests]
    I --> E[E2E API]
    E --> P[Playwright smoke]
```

Regla:

- Toda funcion importante que haga una accion, consulte datos, modifique estado, valide seguridad o devuelva una respuesta debe tener pruebas.
- Cada funcion/flujo importante debe tener minimo 3 escenarios y preferiblemente 4 cuando aplique.
- Escenarios base:
  - exito;
  - fallo esperado o validacion;
  - error externo/controlado;
  - caso borde o dato incompleto.
- Si una funcion nueva no tiene pruebas, no se considera terminada.
- Cada etapa debe actualizar `docs/construccion.md` y `tasks/todo.md` con lo probado.

Playwright valida lo observable del sistema actual:

- health API;
- rutas inexistentes;
- Swagger UI;
- OpenAPI JSON;
- webhook Kapso Platform firmado sin tocar BD;
- rechazo de firma invalida;
- rechazo de header de evento faltante;
- API interna listar integraciones con token;
- API interna rechazos sin token/token invalido;
- bloqueo de activacion sin token;
- lectura segura de la tabla Kapso.

Comandos esperados:

```powershell
npm run verify
```

El comando anterior ejecuta toda la revision del proyecto:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:e2e
npm run test:playwright
npm run build
npm audit --omit=dev
npm run db:check
npm run verify:start:dev
```

## Etapas

```mermaid
flowchart TD
    A[1. Documentacion y levantamiento] --> B[2. Scaffold NestJS]
    B --> C[3. Configuracion y seguridad]
    C --> D[4. Tabla integracion inicial]
    D --> E[5. Webhook Platform]
    E --> F[6. Endpoints internos]
    F --> G[7. Vista CRM minima]
    G --> H[8. WhatsApp webhooks por numero]
    H --> I[9. Chats y vendedor asignado]
```

## Fuentes Kapso Revisadas

- https://docs.kapso.ai/docs/introduction
- https://docs.kapso.ai/docs/platform/webhooks/overview
- https://docs.kapso.ai/docs/platform/webhooks/project-webhooks
