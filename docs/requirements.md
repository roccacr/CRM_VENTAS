# Levantamiento de Requerimientos

## Decision Base

Este proyecto es completamente nuevo. No reemplaza ni reutiliza codigo del API Kapso anterior.

## Alcance Inicial

Construir una API NestJS para conectar Kapso con CRM Ventas.

Primero se trabajara solo la integracion inicial de numeros WhatsApp:

- recibir evento de numero creado;
- guardar datos esenciales en MySQL CRM Ventas;
- recibir evento de numero eliminado;
- eliminar por completo la integracion del numero;
- exponer endpoints internos para el frontend;
- dejar Swagger/OpenAPI desde el inicio;
- crear pruebas automatizadas.

## Fuera de Alcance Inicial

- Chats de WhatsApp.
- Webhooks por numero.
- Conversaciones.
- Asignacion real de vendedores.
- Pantalla final de administracion Kapso.
- Sincronizacion completa con Kapso.
- Docker.

## Base de Datos

La base de datos del `.env` es produccion.

Reglas:

- Usar `mysql_crm_ventas` MCP para inspeccion y cambios.
- No aplicar migraciones automaticamente.
- Crear tablas solo cuando el SQL este claro.
- Evitar cambios destructivos salvo que sean parte exacta del flujo aprobado.
- Para evento `deleted`, la decision funcional actual es eliminar por completo los datos de ese numero.

## Tabla Propuesta

Nombre:

`kapso_integracion_numero_whatsapp`

Proposito:

- Representar la primera configuracion entre Kapso, CRM y esta API.
- Guardar lo necesario para futuras asignaciones de vendedor.
- Permitir futura recuperacion de chats por numero.

Campos iniciales:

| Campo                       | Tipo sugerido                  | Requerido |
| --------------------------- | ------------------------------ | --------- |
| `id`                        | BIGINT UNSIGNED AUTO_INCREMENT | Si        |
| `kapso_phone_number_id`     | VARCHAR(80)                    | Si        |
| `kapso_project_id`          | VARCHAR(80)                    | Si        |
| `kapso_customer_id`         | VARCHAR(80)                    | No        |
| `display_phone_number`      | VARCHAR(40)                    | No        |
| `phone_number`              | VARCHAR(40)                    | No        |
| `business_account_id`       | VARCHAR(80)                    | No        |
| `business_name`             | VARCHAR(160)                   | No        |
| `status`                    | VARCHAR(40)                    | Si        |
| `is_active`                 | TINYINT(1)                     | Si        |
| `idnetsuite_admin_asignado` | INT                            | No        |
| `ultimo_payload_kapso`      | JSON                           | No        |
| `last_sync_at`              | DATETIME                       | No        |
| `connected_at`              | DATETIME                       | Si        |
| `created_at`                | TIMESTAMP                      | Si        |
| `updated_at`                | TIMESTAMP                      | Si        |

Indices sugeridos:

- UNIQUE `kapso_phone_number_id`
- INDEX `kapso_project_id`
- INDEX `kapso_customer_id`
- INDEX `is_active`
- INDEX `idnetsuite_admin_asignado`

## Eventos Kapso

Eventos iniciales:

- `whatsapp.phone_number.created`
- `whatsapp.phone_number.deleted`

Eventos documentados pero no iniciales:

- `workflow.execution.handoff`
- `workflow.execution.failed`
- `project.event`

No se encontro evento oficial de update de numero en la documentacion revisada. Si se requiere editar/sincronizar datos de numero, se hara por endpoint interno de sincronizacion o API de Kapso.

## Seguridad

Webhooks Kapso:

- Validar `X-Webhook-Signature`.
- Leer evento desde `X-Webhook-Event`.
- Usar `X-Idempotency-Key` para trazabilidad.
- Responder `200 OK` rapido cuando el evento sea recibido correctamente.
- La firma se calcula con HMAC SHA256 sobre el JSON raw y el secret del webhook.
- Comparar firmas con metodo timing-safe.

API interna:

- El frontend CRM debe enviar token interno.
- Sin token valido, responder `401`.
- No imprimir tokens ni secretos en logs.
- Header principal: `Authorization: Bearer <CRM_API_INTERNAL_TOKEN>`.
- Header alternativo para herramientas internas: `X-CRM-API-Token`.
- Si `CRM_API_INTERNAL_TOKEN` no esta configurado, los endpoints internos fallan cerrado.

## Logs

Usar `nestjs-pino`.

Reglas:

- Consola compacta.
- Archivos locales en `logs/`.
- No guardar logs de monitoreo en base de datos.
- No imprimir `.env`, API keys, secrets, tokens ni payloads completos por defecto.

## Frontend CRM

Ruta base:

`CRM VENTAS/produccion/src`

Primera tarea futura:

- localizar vista Kapso existente;
- limpiar implementacion previa de Kapso;
- dejar solo:

```jsx
<h1>Kapso integracion</h1>
```

Luego se agregara:

- listado de integraciones;
- activar/inactivar;
- conexion con API mediante token.

## Herramientas

Backend:

- NestJS
- TypeScript
- Prisma recomendado para MySQL
- Pino / nestjs-pino
- Swagger/OpenAPI
- Jest
- Playwright
- ESLint
- Prettier

Sin Docker.

## Politica De Pruebas

Regla obligatoria del proyecto:

- Toda funcion importante que ejecute una accion, consulte datos, modifique estado, valide seguridad o devuelva una respuesta debe tener pruebas automatizadas.
- Cada funcion o flujo importante debe cubrir minimo 3 escenarios.
- Cuando el flujo tenga riesgo de negocio, seguridad, base de datos o integracion externa, debe cubrir preferiblemente 4 escenarios.
- Ninguna funcion importante queda como terminada si no esta probada y documentada.
- Cada avance debe dejar evidencia en `docs/construccion.md` y actualizar el checklist en `tasks/todo.md`.

Escenarios minimos por funcion/flujo:

| Escenario           | Que valida                                  |
| ------------------- | ------------------------------------------- |
| Exito               | La funcion hace lo esperado                 |
| Fallo esperado      | Validacion, permiso, dato faltante o firma  |
| Error controlado    | DB, Kapso, dependencia o excepcion interna  |
| Caso borde opcional | Duplicado, payload incompleto o estado raro |

Aplicacion por tipo:

| Tipo                  | Pruebas esperadas                         |
| --------------------- | ----------------------------------------- |
| Funcion pura          | Unit tests                                |
| Servicio NestJS       | Unit tests con dependencias mockeadas     |
| Repository DB         | Unit tests + lectura segura si aplica     |
| Controller/API        | E2E con Supertest                         |
| Flujo observable      | Playwright                                |
| Seguridad/token/firma | Exito, rechazo y header faltante          |
| Integracion con MySQL | Lectura segura; escritura solo autorizada |

## Variables de Entorno

```env
PORT=8002
DATABASE_URL=
KAPSO_API_KEY=
KAPSO_PLATFORM_WEBHOOK_SECRET=
CRM_API_INTERNAL_TOKEN=
LOG_LEVEL=info
```

## Criterios de Aceptacion Inicial

- API levanta con `npm run start:dev`.
- Swagger disponible.
- Healthcheck responde OK.
- Webhook de Kapso valida firma.
- Evento de numero creado crea la integracion.
- Evento de numero eliminado elimina la integracion.
- Endpoints internos rechazan solicitudes sin token.
- Endpoints internos permiten listar, activar e inactivar integraciones.
- Logs son legibles y compactos.
- Pruebas cubren minimo exito, fallo esperado y error controlado por funcion importante.

## Preguntas Pendientes

- Confirmar si Kapso tiene endpoint API estable para consultar detalle completo de un numero por `phone_number_id`.
- Confirmar reglas de pantalla para validar `idnetsuite_admin_asignado` contra `admins.idnetsuite_admin`.
- Confirmar si al eliminar numero en Kapso tambien deben eliminarse datos futuros relacionados: chats, mensajes, asignaciones y logs funcionales.
