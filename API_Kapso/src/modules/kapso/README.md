# Módulo Kapso

Integración entre el CRM y **Kapso Platform API** para onboarding, sincronización y recepción de webhooks de WhatsApp.

## Objetivo

Persistir localmente cada número WhatsApp del CRM en la tabla consolidada `kapso_phone_numbers`, incluyendo:

- Identidad del número y payload remoto
- Proyecto y cliente asociados
- Estado del setup OAuth
- Snapshot de webhooks remotos (Kapso + Meta)
- Auditoría del último webhook recibido

## Flujo principal (número nuevo)

1. Kapso/Meta termina el onboarding del número.
2. Kapso envía `whatsapp.phone_number.created` a:
   - `POST /api/v1/webhooks/kapso/platform`
3. La API valida la firma HMAC (`x-webhook-signature`) y registra la auditoría.
4. `KapsoSyncService` consulta el detalle remoto del número.
5. Si Kapso aún no expone el detalle (`WhatsApp configuration not found`), el registro queda en **`pending_remote_sync`** y el worker reintenta automáticamente.
6. Cuando el detalle está disponible, se hace upsert en `kapso_phone_numbers`.
7. Se garantizan dos webhooks por número:
   - **Kapso events** → `/webhooks/kapso/events`
   - **Meta relay** → `/webhooks/kapso/meta`
8. Se guarda el snapshot de webhooks en `webhooks_json`.

## Rutas de soporte

| Ruta | Propósito |
|------|-----------|
| `POST /api/v1/kapso/bootstrap/sync` | Reconstruye el estado local desde la cuenta Kapso |
| `POST /api/v1/kapso/phone-numbers/:id/sync` | Reintenta sync de un número |
| `GET /api/v1/kapso/setup/success` | Captura redirect exitoso y dispara sync |
| `GET /api/v1/kapso/setup/failure` | Captura redirect fallido del onboarding |
| `GET /api/v1/kapso/customers` | Lista clientes únicos desde números sincronizados |
| `GET /api/v1/kapso/phone-numbers` | Lista números persistidos localmente |

## Webhooks expuestos

| Ruta | Origen | Firma HMAC |
|------|--------|------------|
| `POST /webhooks/kapso/platform` | Eventos de ciclo de vida del número | Sí (`kapso.platformWebhookSecret`) |
| `POST /webhooks/kapso/events` | Mensajería WhatsApp (`kind: kapso`) | Sí (`kapso.whatsappWebhookSecret`) |
| `POST /webhooks/kapso/meta` | Reenvío Meta | No |

## Worker de reintentos

`KapsoSyncService` arranca un intervalo configurable al iniciar NestJS:

- `KAPSO_PENDING_SYNC_INTERVAL_MS` (default: `30000`)
- `KAPSO_PENDING_SYNC_BATCH_SIZE` (default: `10`)

Reintenta filas con `setup_sync_status` o `last_processing_status` en `pending_remote_sync`.

## Estados relevantes

| Campo | Valores comunes |
|-------|-----------------|
| `setup_sync_status` | `pending`, `synced`, `pending_remote_sync`, `processed`, `processed_with_warnings`, `sync_failed` |
| `last_processing_status` | `received`, `processed`, `pending_remote_sync`, `failed`, `deleted` |
| `last_webhook_scope` | `platform`, `kapso`, `meta` |

## Archivos clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `controllers/kapso.controller.ts` | API REST y páginas HTML de setup |
| `controllers/kapso-webhooks.controller.ts` | Recepción y validación de webhooks |
| `services/kapso-sync.service.ts` | Orquestación y worker de reintentos |
| `services/kapso-platform-api.service.ts` | Cliente HTTP hacia Kapso |
| `repositories/kapso.repository.ts` | Persistencia en `kapso_phone_numbers` |
| `entities/kapso-phone-number.entity.ts` | Modelo TypeORM y tipos de estado |

## Tabla principal

- `kapso_phone_numbers` — estado consolidado por `phone_number_id`

## Checkpoint de validación

Para un número recién creado en Kapso, el resultado esperado es:

1. El webhook de plataforma llega a `/webhooks/kapso/platform`
2. Existe fila local en `kapso_phone_numbers` (aunque sea en `pending_remote_sync`)
3. Tras disponibilidad remota, existen webhooks Kapso + Meta configurados
4. `webhooks_json` refleja la configuración remota
5. `last_processing_status` termina en `processed` o `processed_with_warnings`

## API key por proyecto

Kapso confirmo que `GET /platform/v1/whatsapp/phone_numbers/{phone_number_id}` es **project-scoped**.

Por eso este modulo guarda y reutiliza:

- `phone_number_id`
- `project.id`
- `customer.id`

Cuando el webhook `whatsapp.phone_number.created` llega primero, el API toma `project.id` del payload y usa ese contexto para:

1. consultar el detalle remoto del numero
2. crear los webhooks `kapso` y `meta`
3. reintentar despues si el numero queda en `pending_remote_sync`

Configuracion esperada:

- `KAPSO_API_KEY`: API key default
- `KAPSO_PROJECT_API_KEYS_JSON`: mapa JSON `project.id -> apiKey`
