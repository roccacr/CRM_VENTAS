# 10 - Analisis del CRM Actual: Roles, Leads y Reglas a No Copiar

## Alcance revisado

Revision de solo lectura sobre:

- backend actual `CRM_VENTAS BACKEND`;
- frontend actual `produccion`;
- base `crmdatabase-api` mediante consultas SELECT/SHOW;
- tabla `admins`;
- tabla `leads`;
- procedimientos principales de leads.

## Hallazgos verificados

### Base actual

- Base conectada: `crmdatabase-api`.
- MySQL observado: `8.0.45`.
- Charset/collation observados: `utf8mb4` / `utf8mb4_0900_ai_ci`.

Esto no obliga al nuevo CRM a depender de esa version exacta, pero el API debe registrar la version en diagnosticos tecnicos.

### Roles actuales

No se encontro tabla formal de roles en la base actual. El rol vive principalmente en:

```txt
admins.id_rol_admin
```

Distribucion observada:

| id_rol_admin | total | activos | sin supervisor |
|---:|---:|---:|---:|
| 1 | 14 | 9 | 0 |
| 2 | 16 | 8 | 2 |
| 3 | 14 | 14 | 14 |

El sistema actual usa `rol_admin` y `idnetsuite_admin` como parametros para filtrar listados.

Regla observada en procedimientos:

```txt
typeRol = 1 ve todo
otros roles ven registros donde id_empleado_lead = idEmploye
```

Esto aparece en procedimientos como:

- `32_OBTENER_TODOS_LOS_LEADS_NUEVOS`;
- `33_OBTENER_TODOS_LOS_LEADS_COMPLETOS`;
- `34_CONSULTAR_LEADS_PENDIENTES_ATENCION`;
- `36_OBTENER_TOTAL_LEADS`.

### Problema del modelo actual de roles

El modelo actual mezcla:

- identidad;
- rol unico;
- visibilidad;
- usuario de NetSuite;
- supervisor;
- permisos simples;
- flags como `permisos_admin`, `pass_admin`, `viewAdmin`.

No debe copiarse al nuevo CRM.

El nuevo CRM debe separar:

- usuarios;
- roles;
- permisos;
- jerarquia;
- alcance;
- permisos directos;
- denegaciones;
- delegaciones.

### Jerarquia real observada

Existe `admins.id_supervisor_admin`, pero el codigo actual tambien contiene reglas manuales para eventos:

- directores por lista fija de `idnetsuite_admin`;
- supervisor por lista fija de `idnetsuite_admin`;
- asesores solo propios.

Esto confirma que la jerarquia actual no esta suficientemente normalizada.

Decision para el nuevo CRM:

- no usar listas hardcodeadas de usuarios para jerarquia;
- usar tablas de alcance y supervision;
- permitir que el rol mas alto supervise todo;
- permitir que roles superiores vean informacion de roles inferiores si tienen permiso;
- no permitir que roles inferiores hereden capacidades superiores.

## Leads actuales

Tabla revisada:

```txt
leads
```

Campos mas relevantes observados:

- `id_lead`;
- `id_admin_lead`;
- `id_empleado_lead`;
- `id_rol_lead`;
- `idnetsuite_lead`;
- `idinterno_lead`;
- `nombre_lead`;
- `email_lead`;
- `telefono_lead`;
- `proyecto_lead`;
- `idproyecto_lead`;
- `subsidiaria_lead`;
- `idsubsidaria_lead`;
- `estadointeresado_lead`;
- `comentario_lead`;
- `campana_lead`;
- `idcampana_lead`;
- `empresa_lead`;
- `referencia_lead`;
- `moneda_lead`;
- `contribucion_lead`;
- `estado_lead`;
- `creado_lead`;
- `actualizado_lead`;
- `accion_lead`;
- `actualizadaaccion_lead`;
- `segimineto_lead`;
- `id_Caida`;
- `valor_segimineto_lead`;
- `seguimiento_calendar`;
- `whatsapp_template_contact_sent`;
- `custentityaccion_campana`.

## Campos mas consistentes

Sobre 55790 leads observados:

| Campo | Registros con valor |
|---|---:|
| email | 55790 |
| telefono | 55790 |
| nombre | 55674 |
| vendedor/asignado | 55790 |
| proyecto | 55790 |
| id proyecto | 55789 |
| campana | 55790 |
| id campana | 55790 |
| motivo caida | 52394 |
| accion campana | 6782 |
| corredor | 0 |

Decision:

- nombre, email, telefono, vendedor, proyecto, campana, estado y fechas son campos nucleo;
- accion campana queda como metadata/referencia;
- corredor no entra en el nucleo P0.

## Estados actuales de leads

| Estado legacy | Total observado |
|---|---:|
| `07-LEAD-PERDIDO` | 50377 |
| `01-LEAD-INTERESADO` | 3417 |
| `08-LEAD-SEGUIMIENTO` | 1556 |
| `05-LEAD-CONTRATO` | 201 |
| `02-LEAD-OPORTUNIDAD` | 109 |
| `04-LEAD-RESERVA` | 87 |
| `03-LEAD-PRE-RESERVA` | 43 |

Decision:

- guardar estados en una tabla catalogo;
- no depender del prefijo numerico en el texto;
- usar `sort_order` para insertar estados nuevos entre estados existentes;
- conservar el codigo legacy como referencia externa.

## Duplicados actuales

El procedimiento legacy `19_OBTENER_LEADS_CON_CORREOS_DUPLICADOS` busca duplicados por correo dentro de leads nuevos/en proceso/interesados.

Conteo observado:

- emails distintos: 36934;
- telefonos distintos: 38772;
- grupos de emails repetidos: 8729;
- grupos de telefonos repetidos: 8208.

Decision P0:

- no bloquear creacion por duplicado;
- marcar posible relacion si correo o telefono coincide;
- guardar relacion opcional;
- no fusionar automaticamente;
- no usar proyecto como parte de la regla P0.

## Reglas actuales que si deben conservarse como concepto

- Listados filtrados por usuario y alcance.
- El usuario de mayor nivel puede ver mas que el vendedor.
- El vendedor trabaja principalmente sus propios leads.
- Los leads tienen bitacora comercial.
- Los eventos/calendarios se relacionan con leads.
- Estados como oportunidad, pre-reserva, reserva, contrato y perdido forman parte del ciclo comercial.

## Reglas actuales que no deben copiarse

- `rol_admin = 1` como permiso magico.
- Roles como numeros sin tabla propia.
- Listas hardcodeadas de directores/supervisores.
- Nombres legacy mal escritos como `segimineto_lead` en el dominio nuevo.
- Procedimientos almacenados como unica capa de negocio.
- Frontend enviando `rol_admin` como criterio confiable de autorizacion.

## Decision para el nuevo modelo

El nuevo CRM debe modelar permisos con:

- roles multiples por usuario;
- permisos atomicos;
- permisos directos;
- denegaciones explicitas;
- delegaciones auditables;
- jerarquia de supervision;
- alcance por usuario, equipo, sucursal o recurso.

El backend calcula permisos efectivos. El frontend solo consume el resultado.
