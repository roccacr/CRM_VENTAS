# Base De Datos

## Ambiente

Base inspeccionada con `mysql_crm_ventas`:

- MySQL: `8.0.45`
- Charset: `utf8mb4`
- Collation: `utf8mb4_0900_ai_ci`
- Motor usado: `InnoDB`

## Tabla Principal

`kapso_integracion_numero_whatsapp`

Uso:

- Guardar la integracion inicial del numero WhatsApp creado en Kapso.
- Permitir activar/inactivar la integracion desde CRM.
- Preparar una futura asignacion a usuario/vendedor CRM por `admins.idnetsuite_admin`.
- Guardar el ultimo payload relevante de Kapso como respaldo funcional.

## Estructura

| Campo                       | Tipo                                                           | Uso                               |
| --------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `id`                        | BIGINT UNSIGNED AUTO_INCREMENT                                 | ID interno                        |
| `kapso_phone_number_id`     | VARCHAR(80)                                                    | ID unico del numero en Kapso      |
| `kapso_project_id`          | VARCHAR(80)                                                    | Proyecto Kapso                    |
| `kapso_customer_id`         | VARCHAR(80)                                                    | Customer Kapso, si viene          |
| `display_phone_number`      | VARCHAR(40)                                                    | Numero visible                    |
| `phone_number`              | VARCHAR(40)                                                    | Numero normalizado                |
| `business_account_id`       | VARCHAR(80)                                                    | Cuenta WhatsApp/Business          |
| `business_name`             | VARCHAR(160)                                                   | Nombre del negocio                |
| `status`                    | VARCHAR(40)                                                    | Estado funcional                  |
| `is_active`                 | TINYINT(1)                                                     | Activar/inactivar desde CRM       |
| `idnetsuite_admin_asignado` | INT                                                            | Futuro vendedor asignado          |
| `ultimo_payload_kapso`      | JSON                                                           | Ultimo payload relevante de Kapso |
| `last_sync_at`              | DATETIME                                                       | Ultima sincronizacion             |
| `connected_at`              | DATETIME DEFAULT CURRENT_TIMESTAMP                             | Fecha de conexion                 |
| `created_at`                | DATETIME DEFAULT CURRENT_TIMESTAMP                             | Fecha de creacion                 |
| `updated_at`                | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Fecha de actualizacion            |

## Indices

| Indice                                                 | Columnas                    | Tipo   |
| ------------------------------------------------------ | --------------------------- | ------ |
| `PRIMARY`                                              | `id`                        | Unico  |
| `uk_kapso_integracion_numero_whatsapp_phone_number_id` | `kapso_phone_number_id`     | Unico  |
| `idx_kapso_integracion_numero_whatsapp_project`        | `kapso_project_id`          | Normal |
| `idx_kapso_integracion_numero_whatsapp_customer`       | `kapso_customer_id`         | Normal |
| `idx_kapso_integracion_numero_whatsapp_phone`          | `phone_number`              | Normal |
| `idx_kapso_integracion_numero_whatsapp_active`         | `is_active`                 | Normal |
| `idx_kapso_integracion_numero_whatsapp_netsuite_admin` | `idnetsuite_admin_asignado` | Normal |

## Tabla Puente De Asignaciones

`kapso_integracion_admin_asignacion`

Uso:

- Asignar una integracion Kapso a uno o varios admins CRM.
- Permitir CRUD de asignaciones sin duplicar numeros ni mezclar IDs en un solo campo.
- Borrar asignaciones automaticamente cuando se elimina la integracion principal.

| Campo                                  | Tipo                                                           | Uso                     |
| -------------------------------------- | -------------------------------------------------------------- | ----------------------- |
| `id`                                   | BIGINT UNSIGNED AUTO_INCREMENT                                 | ID interno asignacion   |
| `kapso_integracion_numero_whatsapp_id` | BIGINT UNSIGNED                                                | Integracion Kapso local |
| `idnetsuite_admin`                     | INT                                                            | Admin CRM asignado      |
| `created_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP                             | Fecha de creacion       |
| `updated_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Fecha de actualizacion  |

Indices:

| Indice                                 | Columnas                                                   | Tipo   |
| -------------------------------------- | ---------------------------------------------------------- | ------ |
| `PRIMARY`                              | `id`                                                       | Unico  |
| `uk_kapso_integracion_admin`           | `kapso_integracion_numero_whatsapp_id`, `idnetsuite_admin` | Unico  |
| `idx_kapso_integracion_admin_netsuite` | `idnetsuite_admin`                                         | Normal |

Reglas:

- No se crea foreign key contra `admins.idnetsuite_admin` porque en produccion ese campo no es unico.
- La API valida que exista al menos un admin activo con ese `idnetsuite_admin`.
- Si se repite la misma integracion + admin, la API responde conflicto y la BD lo bloquea con indice unico.
- Tiene foreign key contra `kapso_integracion_numero_whatsapp(id)` con `ON DELETE CASCADE`.

## Tabla Legacy De Proyectos

`kapso_integracion_proyecto_asignacion`

Uso:

- Tabla creada durante la primera version de asignacion de proyectos.
- Queda como legacy; el flujo funcional nuevo no usa asignacion directa integracion + proyecto.
- La relacion correcta para proyectos vive en `kapso_cronjob_configuracion`.

| Campo                                  | Tipo                                                           | Uso                     |
| -------------------------------------- | -------------------------------------------------------------- | ----------------------- |
| `id`                                   | BIGINT UNSIGNED AUTO_INCREMENT                                 | ID interno asignacion   |
| `kapso_integracion_numero_whatsapp_id` | BIGINT UNSIGNED                                                | Integracion Kapso local |
| `idproyecto_lead`                      | INT                                                            | Proyecto CRM asignado   |
| `created_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP                             | Fecha de creacion       |
| `updated_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Fecha de actualizacion  |

Indices:

| Indice                                | Columnas                                                  | Tipo   |
| ------------------------------------- | --------------------------------------------------------- | ------ |
| `PRIMARY`                             | `id`                                                      | Unico  |
| `uk_kapso_integracion_proyecto`       | `kapso_integracion_numero_whatsapp_id`, `idproyecto_lead` | Unico  |
| `idx_kapso_integracion_proyecto_lead` | `idproyecto_lead`                                         | Normal |

Reglas legacy:

- No se crea foreign key contra `leads.idproyecto_lead` porque `leads` no es catalogo unico.
- La API valida que exista al menos un lead con ese `idproyecto_lead`.
- Si se repite la misma integracion + proyecto, la API responde conflicto y la BD lo bloquea con indice unico.
- Tiene foreign key contra `kapso_integracion_numero_whatsapp(id)` con `ON DELETE CASCADE`.

## Tabla Configuracion Cronjob

`kapso_cronjob_configuracion`

Uso:

- Registrar un cronjob general por `cronjob_id`.
- Controlar si el cronjob general esta activo con `is_active`.
- Guardar configuracion futura en `config`.
- Las columnas `kapso_integracion_numero_whatsapp_id`, `idnetsuite_admin` e `idproyecto_lead` quedan como legacy/compatibilidad y ya no son obligatorias.

| Campo                                  | Tipo                                                           | Uso                       |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| `id`                                   | BIGINT UNSIGNED AUTO_INCREMENT                                 | ID interno configuracion  |
| `cronjob_id`                           | VARCHAR(80)                                                    | ID unico del cronjob      |
| `kapso_integracion_numero_whatsapp_id` | BIGINT UNSIGNED NULL                                           | Legacy/compatibilidad     |
| `idnetsuite_admin`                     | INT NULL                                                       | Legacy/compatibilidad     |
| `idproyecto_lead`                      | INT NULL                                                       | Legacy/compatibilidad     |
| `is_active`                            | TINYINT(1) DEFAULT 1                                           | Activa/inactiva ejecucion |
| `config`                               | JSON                                                           | Configuracion futura      |
| `created_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP                             | Fecha de creacion         |
| `updated_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Fecha de ultima edicion   |

Indices:

| Indice                                | Columnas                                                   | Tipo   |
| ------------------------------------- | ---------------------------------------------------------- | ------ |
| `PRIMARY`                             | `id`                                                       | Unico  |
| `uk_kapso_cronjob_id`                 | `cronjob_id`                                               | Unico  |
| `idx_kapso_cronjob_integracion_admin` | `kapso_integracion_numero_whatsapp_id`, `idnetsuite_admin` | Normal |
| `idx_kapso_cronjob_proyecto`          | `idproyecto_lead`                                          | Normal |
| `idx_kapso_cronjob_active`            | `is_active`                                                | Normal |

Reglas:

- `cronjob_id` no se puede repetir.
- `cronjob_id` no se puede repetir.
- Cuando el cronjob se ejecute, primero debe leer esta tabla; si `is_active = 0`, no ejecuta ningun proyecto.

## Tabla Proyectos Por Cronjob

`kapso_cronjob_proyecto_configuracion`

Uso:

- Relacionar un cronjob general con una integracion Kapso y un proyecto CRM.
- Mantener `idnetsuite_admin` nullable por compatibilidad futura.
- Controlar si ese proyecto especifico ejecuta el cronjob.

| Campo                                  | Tipo                                                           | Uso                             |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `id`                                   | BIGINT UNSIGNED AUTO_INCREMENT                                 | ID interno configuracion        |
| `kapso_cronjob_configuracion_id`       | BIGINT UNSIGNED                                                | Cronjob general                 |
| `kapso_integracion_numero_whatsapp_id` | BIGINT UNSIGNED                                                | Integracion Kapso local         |
| `idproyecto_lead`                      | INT                                                            | Proyecto CRM del flujo          |
| `idnetsuite_admin`                     | INT NULL                                                       | Reservado futuro/compatibilidad |
| `is_active`                            | TINYINT(1) DEFAULT 1                                           | Activa/inactiva este proyecto   |
| `config`                               | JSON                                                           | Configuracion futura            |
| `created_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP                             | Fecha de creacion               |
| `updated_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Fecha de ultima edicion         |

Indices:

| Indice                                  | Columnas                               | Tipo   |
| --------------------------------------- | -------------------------------------- | ------ |
| `PRIMARY`                               | `id`                                   | Unico  |
| `idx_kapso_cronjob_project_cronjob`     | `kapso_cronjob_configuracion_id`       | Normal |
| `idx_kapso_cronjob_project_integracion` | `kapso_integracion_numero_whatsapp_id` | Normal |
| `idx_kapso_cronjob_project_admin`       | `idnetsuite_admin`                     | Normal |
| `idx_kapso_cronjob_project_proyecto`    | `idproyecto_lead`                      | Normal |
| `idx_kapso_cronjob_project_active`      | `is_active`                            | Normal |

Reglas:

- La API valida que exista el cronjob general.
- La API valida que exista la integracion Kapso.
- La API valida que exista al menos un lead con ese `idproyecto_lead`.
- Desde la vista CRM actual se envia `idnetsuite_admin = NULL`.
- Si una integracion futura informa `idnetsuite_admin`, la API valida que el admin exista activo.
- Si una integracion futura informa `idnetsuite_admin`, la API valida que el admin este asignado a esa integracion.
- Si una integracion futura informa `idnetsuite_admin`, el proyecto se valida contra `leads.id_empleado_lead`.
- Si `is_active = 0`, ese proyecto no ejecuta el cronjob aunque el cronjob general este activo.

## Referencia A Vendedor/Admin

La referencia funcional correcta para el vendedor/usuario CRM es:

`admins.idnetsuite_admin`

La asignacion actual vive en `kapso_integracion_admin_asignacion.idnetsuite_admin`.

`kapso_integracion_numero_whatsapp.idnetsuite_admin_asignado` queda como campo legacy/compatibilidad, pero la vista nueva usa la tabla puente.

## Referencia A Proyecto

La referencia funcional correcta para proyecto CRM es:

`leads.idproyecto_lead`

## Tabla Intentos Template Inicial

`kapso_envio_template_inicial_intento`

Uso:

- Garantizar un solo intento de envio del template `saludo` por lead.
- Registrar el estado tecnico del intento antes/despues de llamar a Kapso.
- Guardar IDs de mensaje Kapso y `kapso_conversation_id` cuando Kapso lo informe por webhook.

| Campo                                  | Tipo                                 | Uso                                     |
| -------------------------------------- | ------------------------------------ | --------------------------------------- |
| `id`                                   | BIGINT UNSIGNED AUTO_INCREMENT       | ID interno                              |
| `id_lead`                              | INT                                  | Lead CRM procesado                      |
| `id_admin`                             | INT                                  | Admin relacionado al lead               |
| `idproyecto_lead`                      | INT NULL                             | Proyecto CRM del lead                   |
| `kapso_integracion_numero_whatsapp_id` | BIGINT UNSIGNED NULL                 | Integracion Kapso usada                 |
| `kapso_phone_number_id`                | VARCHAR(80) NULL                     | Numero Kapso usado para enviar          |
| `to_phone_number`                      | VARCHAR(20) NULL                     | Telefono normalizado para Kapso         |
| `kapso_message_ids`                    | JSON NULL                            | IDs de mensajes devueltos por Kapso     |
| `kapso_conversation_id`                | VARCHAR(120) NULL                    | Conversacion recibida luego por webhook |
| `status`                               | VARCHAR(40)                          | `processing`, `sent`, `failed`, etc.    |
| `error_message`                        | TEXT NULL                            | Error de Kapso si falla                 |
| `raw_response`                         | JSON NULL                            | Respuesta controlada del envio          |
| `created_at`                           | DATETIME DEFAULT CURRENT_TIMESTAMP   | Fecha de intento                        |
| `updated_at`                           | DATETIME ON UPDATE CURRENT_TIMESTAMP | Ultima actualizacion                    |

Indices:

| Indice                                          | Columnas                | Tipo   |
| ----------------------------------------------- | ----------------------- | ------ |
| `PRIMARY`                                       | `id`                    | Unico  |
| `uk_kapso_envio_template_inicial_lead`          | `id_lead`               | Unico  |
| `idx_kapso_envio_template_inicial_admin`        | `id_admin`              | Normal |
| `idx_kapso_envio_template_inicial_project`      | `idproyecto_lead`       | Normal |
| `idx_kapso_envio_template_inicial_status`       | `status`                | Normal |
| `idx_kapso_envio_template_inicial_conversation` | `kapso_conversation_id` | Normal |

Reglas:

- `id_lead` es unico: un lead solo puede tener un intento del template inicial.
- El intento se crea como `processing` antes de llamar a Kapso.
- Si Kapso acepta el envio, cambia a `sent`.
- Si el telefono es invalido, queda `invalid_phone`.
- Si Kapso devuelve error, queda `failed`.
- El campo `kapso_conversation_id` se completa cuando el webhook de respuesta trae `conversation.id`.

El nombre visible se toma de:

`leads.proyecto_lead`

La relacion funcional vive en `kapso_cronjob_proyecto_configuracion.idproyecto_lead`.

## Regla De Eliminacion

Cuando Kapso envie `whatsapp.phone_number.deleted`, la regla funcional aprobada es eliminar por completo la integracion de ese numero.

## Verificacion De Conexion

Comando:

```powershell
npm run db:check
```

Este comando solo hace lecturas:

- conecta con Prisma;
- ejecuta conteo sobre `kapso_integracion_numero_whatsapp`;
- no crea, actualiza ni elimina datos.
