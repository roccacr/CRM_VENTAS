# API Kapso - CRM Ventas

API NestJS para integrar CRM Ventas con Kapso, administrar numeros de WhatsApp, asignar lineas Kapso a asesores y ejecutar flujos de templates por proyecto sin repetir leads.

## Resumen Ejecutivo

El objetivo del sistema es automatizar el primer contacto por WhatsApp usando templates aprobados en Kapso/Meta, pero manteniendo control operativo dentro del CRM.

El flujo actual permite:

- sincronizar numeros creados en Kapso;
- crear webhooks Kapso y Meta por numero;
- asignar un numero Kapso a cada asesor;
- habilitar flujos por proyecto;
- detectar leads nuevos candidatos;
- enviar el template inicial `saludo`;
- guardar el estado del lead dentro del flujo;
- procesar respuestas de botones;
- detener el flujo cuando corresponde;
- registrar bitacoras CRM cuando no se puede continuar.

## Tecnologia

- NestJS 11
- TypeScript
- TypeORM
- MySQL
- Kapso Platform API
- Webhooks Kapso y Meta
- Jest para pruebas unitarias y e2e
- `libphonenumber-js` para validar y normalizar telefonos

## Como Correr

```bash
npm install
npm run migration:run
npm run start:dev
```

La API queda disponible en:

```text
http://localhost:8002/api/v1
```

Comandos de verificacion:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

## Variables Principales

| Variable                          | Uso                                                               |
| --------------------------------- | ----------------------------------------------------------------- |
| `PORT`                            | Puerto local, normalmente `8002`                                  |
| `GLOBAL_PREFIX`                   | Prefijo API, normalmente `api/v1`                                 |
| `KAPSO_API_KEY`                   | API key default del proyecto Kapso                                |
| `KAPSO_PROJECT_API_KEYS_JSON`     | Mapa `project.id -> apiKey` cuando existen varios proyectos Kapso |
| `KAPSO_PUBLIC_BASE_URL`           | URL publica usada para webhooks, por ejemplo ngrok                |
| `KAPSO_PLATFORM_WEBHOOK_SECRET`   | Secreto del webhook Platform                                      |
| `KAPSO_WHATSAPP_WEBHOOK_SECRET`   | Secreto del webhook WhatsApp/Kapso events                         |
| `KAPSO_PENDING_SYNC_INTERVAL_MS`  | Intervalo del worker de sincronizacion de numeros                 |
| `KAPSO_LEAD_TEMPLATE_INTERVAL_MS` | Intervalo del worker de leads candidatos                          |

## Arquitectura General

```mermaid
flowchart TD
  A["Kapso / Meta"] --> B["Webhooks API"]
  B --> C["KapsoSyncService"]
  C --> D["Kapso Platform API"]
  C --> E["MySQL CRM Ventas"]
  E --> F["kapso_phone_numbers"]
  E --> G["admin_kapso_integrations"]
  E --> H["kapso_business_flows"]
  E --> I["kapso_template_catalog"]
  E --> J["kapso_lead_flow_executions"]
  E --> K["leads / admins / proyectos / bitacoras"]
```

Responsabilidades:

| Capa         | Responsabilidad                                                            |
| ------------ | -------------------------------------------------------------------------- |
| Controllers  | Exponer REST, redirects de setup y webhooks                                |
| Services     | Orquestar sincronizacion, envio de templates y procesamiento de respuestas |
| Repositories | Consultar y persistir datos en MySQL                                       |
| Entities     | Representar tablas Kapso locales                                           |
| Common       | Constantes, tipos y helpers de dominio                                     |

## Flujo 1: Onboarding de Numeros Kapso

Cuando se crea o conecta un numero en Kapso, el sistema debe guardarlo localmente y asegurar que los webhooks por numero existan.

```mermaid
sequenceDiagram
  participant K as Kapso
  participant API as API Kapso CRM
  participant DB as MySQL
  participant KP as Kapso Platform API

  K->>API: POST /webhooks/kapso/platform<br/>whatsapp.phone_number.created
  API->>API: Valida firma e idempotencia
  API->>DB: Guarda phone_number_id, project.id, customer.id
  API->>KP: GET /platform/v1/whatsapp/phone_numbers/{id}
  alt Detalle disponible
    KP-->>API: Detalle del numero
    API->>DB: Upsert en kapso_phone_numbers
    API->>KP: Crear webhook Kapso events
    API->>KP: Crear webhook Meta relay
    API->>DB: setup_sync_status = processed
  else Kapso aun no expone detalle
    KP-->>API: WhatsApp configuration not found
    API->>DB: setup_sync_status = pending_remote_sync
    API->>API: Worker reintenta luego
  end
```

Punto importante confirmado por Kapso:

`GET /platform/v1/whatsapp/phone_numbers/{phone_number_id}` es project-scoped. Por eso el API guarda `project.id` y usa el API key del mismo proyecto que genero el setup link.

## Flujo 2: Configuracion Admin-Kapso

Esta vista define que numero puede usar cada asesor.

Regla:

- El lead trae `id_empleado_lead`.
- Ese valor se compara contra `admins.idnetsuite_admin`.
- El asesor debe tener una relacion activa en `admin_kapso_integrations`.
- Si no existe relacion activa, el lead no puede usar Kapso.

```mermaid
flowchart LR
  A["admins.idnetsuite_admin"] --> B["admin_kapso_integrations"]
  B --> C["kapso_phone_numbers"]
  C --> D["Numero Kapso activo"]
```

## Flujo 3: Flujos de Negocio por Proyecto

Un flujo representa una idea de negocio completa. No es solo una regla suelta.

Flujo actual:

| Campo           | Valor                                   |
| --------------- | --------------------------------------- |
| UUID            | `94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01`  |
| Codigo          | `lead_initial_contact`                  |
| Nombre          | `Saludo inicial y seguimiento de leads` |
| Primer template | `saludo`                                |
| Estado esperado | `active` cuando este listo para operar  |

La tabla `kapso_business_flow_projects` define que proyectos pueden ejecutar cada flujo.

Relacion de proyecto:

```text
leads.idproyecto_lead -> proyectos.id_ProNetsuite
```

Si un proyecto no esta permitido, ningun lead de ese proyecto debe ejecutar el flujo.

```mermaid
flowchart TD
  A["Lead candidato"] --> B{"Proyecto permitido para el flujo?"}
  B -- "No" --> C["No ejecuta flujo"]
  B -- "Si" --> D["Valida asesor y numero Kapso"]
```

## Template Inicial: saludo

Template creado y aprobado en Kapso/Meta.

| Campo                 | Valor                   |
| --------------------- | ----------------------- |
| Accion CRM            | `lead_initial_greeting` |
| Nombre Kapso          | `saludo`                |
| ID remoto             | `1004936342403599`      |
| Referencia Kapso      | `4108dccb`              |
| Idioma                | `es_ES`                 |
| Categoria             | `MARKETING`             |
| Estado local esperado | `approved`              |
| Parametros            | 3                       |

Texto:

```text
Hola {{1}}, soy {{2}}, asesor de {{3}}.

Vi que pediste informacion del proyecto.

Te parece bien si te comparto la informacion por este medio?
```

Mapeo de parametros:

| Parametro | Origen                |
| --------- | --------------------- |
| `{{1}}`   | `leads.nombre_lead`   |
| `{{2}}`   | `admins.name_admin`   |
| `{{3}}`   | `leads.proyecto_lead` |

Botones:

| Boton                    | Accion del sistema                                             |
| ------------------------ | -------------------------------------------------------------- |
| `Si, enviar informacion` | Marcar ejecucion como `answered_yes` y continuar el flujo      |
| `No, gracias`            | Marcar como `answered_no`, pasar lead a perdido y cerrar flujo |

## Condicion Actual para Lead Nuevo

El worker toma leads que cumplen:

```sql
leads.segimineto_lead = '01-LEAD-INTERESADO'
AND leads.whatsapp_template_contact_sent = 2
AND leads.estado_lead = 1
```

Adicionalmente:

- `id_empleado_lead` no puede venir vacio;
- el proyecto debe estar permitido para el flujo;
- el asesor debe tener numero Kapso activo;
- el template debe estar aprobado;
- el lead no debe tener una ejecucion previa para el mismo `flow_uuid`.

## Flujo 4: Envio del Template Inicial

```mermaid
flowchart TD
  A["Worker cada minuto"] --> B["Busca leads candidatos"]
  B --> C{"Ya existe flow_uuid + idinterno_lead?"}
  C -- "Si" --> D["No reprocesa"]
  C -- "No" --> E{"Proyecto permitido?"}
  E -- "No" --> F["Ignora flujo"]
  E -- "Si" --> G{"Asesor tiene numero Kapso activo?"}
  G -- "No" --> H["Bitacora CRM y no reintenta"]
  G -- "Si" --> I{"Telefono valido?"}
  I -- "No" --> J["Bitacora id_caida 68 y estado invalid_phone"]
  I -- "Si" --> K["Reserva ejecucion"]
  K --> L["Envia template saludo"]
  L --> M{"Kapso acepta envio?"}
  M -- "Si" --> N["execution_status = initial_template_sent"]
  M -- "Telefono invalido" --> J
  M -- "Error tecnico" --> O["execution_status = failed"]
```

## Normalizacion de Telefonos

El CRM tiene telefonos con multiples formatos. El sistema limpia y valida antes de enviar.

Ejemplos soportados:

| Valor CRM         | Resultado para Kapso |
| ----------------- | -------------------- |
| `87515938`        | `50687515938`        |
| `50687515938`     | `50687515938`        |
| `+506 8751 5938`  | `50687515938`        |
| `+1 720 353 5091` | `17203535091`        |
| `+57 311 5283868` | `573115283868`       |

Ejemplos rechazados:

| Valor CRM           | Motivo                     |
| ------------------- | -------------------------- |
| `88888888`          | Digitos repetidos          |
| `50600000000`       | Numero no valido           |
| `506982214`         | Longitud/formato no valido |
| Texto, vacio o nulo | No hay telefono usable     |

Cuando el telefono no es valido:

- no se llama a Kapso;
- no se modifica el lead;
- se registra bitacora con `id_caida = 68`;
- la ejecucion queda en `invalid_phone`;
- no vuelve a ejecutarse ese flujo para ese lead.

## Respuesta del Cliente

Las respuestas entran por webhooks Kapso o Meta.

```mermaid
sequenceDiagram
  participant Cliente
  participant K as Kapso / Meta
  participant API as API Kapso CRM
  participant DB as MySQL

  Cliente->>K: Toca boton del template
  K->>API: POST /webhooks/kapso/events o /meta
  API->>API: Normaliza telefono entrante
  API->>DB: Busca ejecucion initial_template_sent por phone_number_id + lead_phone_number
  alt Responde Si
    API->>DB: execution_status = answered_yes
    API->>DB: Guarda payload de respuesta
  else Responde No
    API->>DB: execution_status = answered_no
    API->>DB: leads.segimineto_lead = 07-LEAD-PERDIDO
    API->>DB: leads.estado_lead = 0
    API->>DB: leads.id_Caida = 67
    API->>DB: Inserta bitacora CRM
  end
```

Regla para `No, gracias`:

- el flujo se cierra para ese lead;
- el lead pasa a perdido;
- `id_Caida = 67`;
- se inserta bitacora indicando que el cliente no desea recibir informacion por WhatsApp.

Regla para telefono invalido:

- `id_Caida = 68`;
- se inserta bitacora de numero no valido;
- no se cambia el estado comercial del lead.

## Control Anti-Repeticion

La tabla `kapso_lead_flow_executions` evita ciclos infinitos.

Clave funcional:

```text
flow_uuid + idinterno_lead
```

Estados principales:

| Estado                  | Significado                                  |
| ----------------------- | -------------------------------------------- |
| `reserved`              | Lead reservado para envio, aun no confirmado |
| `initial_template_sent` | Template inicial enviado                     |
| `answered_yes`          | Cliente acepto recibir informacion           |
| `answered_no`           | Cliente rechazo informacion por WhatsApp     |
| `invalid_phone`         | Telefono no valido; no se reintenta          |
| `manual_intervention`   | Asesor intervino manualmente                 |
| `completed`             | Flujo terminado                              |
| `failed`                | Error tecnico terminal                       |

## Modelo de Datos Kapso

```mermaid
erDiagram
  kapso_phone_numbers ||--o{ admin_kapso_integrations : asigna
  kapso_business_flows ||--o{ kapso_business_flow_projects : habilita
  kapso_business_flows ||--o{ kapso_business_flow_steps : contiene
  kapso_template_catalog ||--o{ kapso_business_flow_steps : usa
  kapso_business_flows ||--o{ kapso_lead_flow_executions : controla

  kapso_phone_numbers {
    int id
    varchar phone_number_id
    varchar display_phone_number
    varchar business_account_id
    varchar kapso_project_id
    varchar kapso_customer_id
    varchar setup_sync_status
    json webhooks_json
  }

  admin_kapso_integrations {
    int id_admin_kapso_integration
    int idnetsuite_admin
    int kapso_phone_number_id
    tinyint status_admin_kapso_integration
  }

  kapso_business_flows {
    int id_kapso_business_flow
    char flow_uuid
    varchar flow_code
    varchar flow_name
    varchar status
    tinyint enabled
  }

  kapso_business_flow_projects {
    int id_kapso_business_flow_project
    int id_kapso_business_flow
    int id_proyecto
    int id_pronetsuite
    varchar project_name
    tinyint enabled
  }

  kapso_template_catalog {
    int id_kapso_template_catalog
    varchar action_code
    varchar template_name
    varchar template_external_id
    varchar status
    json parameter_mapping_json
  }

  kapso_lead_flow_executions {
    int id_kapso_lead_flow_execution
    char flow_uuid
    int idinterno_lead
    int idnetsuite_admin
    int id_pronetsuite
    varchar phone_number_id
    varchar lead_phone_number
    varchar execution_status
  }
```

## Rutas Principales

| Ruta                                                   | Proposito                               |
| ------------------------------------------------------ | --------------------------------------- |
| `GET /api/v1/kapso/customers`                          | Lista clientes sincronizados localmente |
| `GET /api/v1/kapso/phone-numbers`                      | Lista numeros Kapso locales             |
| `GET /api/v1/kapso/templates/catalog`                  | Lista templates locales                 |
| `GET /api/v1/kapso/projects/options`                   | Lista proyectos CRM para configuracion  |
| `GET /api/v1/kapso/business-flows`                     | Lista flujos y proyectos permitidos     |
| `POST /api/v1/kapso/business-flows/:flowUuid/projects` | Habilita un proyecto para un flujo      |
| `POST /api/v1/kapso/bootstrap/sync`                    | Reconstruye estado local desde Kapso    |
| `POST /api/v1/kapso/phone-numbers/:phoneNumberId/sync` | Reintenta sync de un numero             |
| `GET /api/v1/kapso/setup/success`                      | Recibe redirect exitoso del setup link  |
| `GET /api/v1/kapso/setup/failure`                      | Recibe redirect fallido del setup link  |
| `POST /api/v1/webhooks/kapso/platform`                 | Webhook de altas/bajas de numeros       |
| `POST /api/v1/webhooks/kapso/events`                   | Webhook Kapso events                    |
| `POST /api/v1/webhooks/kapso/meta`                     | Webhook relay Meta                      |
| `GET /api/v1/kapso/admin-integrations`                 | Lista asignaciones admin-Kapso          |
| `POST /api/v1/kapso/admin-integrations`                | Crea asignacion admin-Kapso             |

## Checklist Operativo Antes de Enviar Templates

- [ ] El numero existe en `kapso_phone_numbers`.
- [ ] Los webhooks Kapso y Meta existen para ese numero.
- [ ] El asesor tiene asignacion activa en `admin_kapso_integrations`.
- [ ] El flujo esta activo.
- [ ] El proyecto del lead esta permitido para ese flujo.
- [ ] El template `saludo` esta `approved`.
- [ ] El mapeo de parametros esta configurado.
- [ ] El telefono del lead es valido.
- [ ] No existe ejecucion previa para `flow_uuid + idinterno_lead`.

## Que Sigue en el Flujo

El sistema ya tiene el primer paso funcional. Los siguientes hitos logicos son:

1. Definir que template se envia despues de `answered_yes`.
2. Configurar el mapeo de parametros del segundo template.
3. Definir cuando se detiene el flujo por respuesta, intervencion manual o fin comercial.
4. Agregar trazabilidad visible en CRM para que el asesor sepa en que etapa va cada lead.
5. Validar reglas de ventana de 24 horas de WhatsApp antes de mensajes libres.

## Estado Actual del Proyecto

Listo:

- sincronizacion de numeros Kapso;
- webhooks platform/events/meta;
- asignacion Admin-Kapso;
- flujo de negocio por proyecto;
- catalogo local del template `saludo`;
- envio inicial del template;
- procesamiento de respuesta `Si` / `No`;
- control anti-repeticion;
- normalizacion y validacion de telefonos;
- bitacora por asesor sin numero;
- bitacora por telefono invalido (`id_caida = 68`);
- perdida por respuesta negativa (`id_caida = 67`).

Pendiente funcional:

- definir el segundo template despues de respuesta afirmativa;
- confirmar como se detiene el flujo por intervencion manual del asesor;
- exponer en frontend la trazabilidad completa por lead;
- cerrar reglas de seguimiento final segun ventas.
