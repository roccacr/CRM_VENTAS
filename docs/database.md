# Base De Datos

## Ambiente

Base inspeccionada con `mysql_crm_ventas`:

- MySQL: `8.0.45`
- Charset: `utf8mb4`
- Collation: `utf8mb4_0900_ai_ci`
- Motor usado: `InnoDB`

## Tabla Creada

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

## Referencia A Vendedor

La referencia funcional correcta para el vendedor/usuario CRM es:

`admins.idnetsuite_admin`

Por ahora `idnetsuite_admin_asignado` queda sin foreign key para no forzar una regla incompleta en produccion. Cuando se defina la pantalla de asignacion, se validara contra `admins.idnetsuite_admin`.

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
