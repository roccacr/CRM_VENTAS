# 09 - Decisiones P0, Permisos y Preguntas Pendientes

## Estado

Este documento fija decisiones nuevas confirmadas por negocio antes de crear el runtime P0 del API.

## Decisiones confirmadas

1. La base nueva del CRM sera MySQL.
2. Nombre confirmado de la base nueva: `CRM_THINK_V2`.
3. La version de MySQL no es una decision de negocio, pero el API debe detectarla en diagnosticos porque afecta capacidades SQL e indices.
4. La base nueva estara en el mismo entorno/servidor operativo del CRM actual, pero como base separada.
5. No se usara Docker para runtime ni base de datos.
6. Las credenciales no deben documentarse aqui ni versionarse.
7. La capa principal de acceso a datos sera Kysely + mysql2.
8. Los leads nuevos nacen solo en la base nueva.
9. Crear lead debe existir tanto desde CRM como desde ERP, usando contrato canonico.
10. El frontend envia JSON estandar del CRM, nunca JSON de NetSuite/Odoo.
11. El API mapea el JSON estandar hacia el proveedor activo dentro de `src/integrations/*`.
12. La base nueva no debe usar nombres NetSuite/Odoo en tablas o columnas core.
13. En P0 no se consultara el CRM viejo en el flujo principal.
14. En P1 el API podra leer de la base nueva y del CRM viejo, pero siempre devolvera un JSON estandar.
15. El frontend no debe conocer de que base o proveedor viene el dato.
16. La UI sera en espanol y orientada a usuarios de Costa Rica.
17. La autenticacion inicia con Microsoft Entra ID como metodo principal.
18. Correo y clave queda como alternativa, no como metodo principal de inicio.
19. La autorizacion debe soportar multiples roles por usuario.
20. La autorizacion debe soportar permisos directos a usuarios.
21. La autorizacion debe soportar denegaciones especificas por usuario.
22. La delegacion temporal o revocable de permisos queda prevista para fase posterior, fuera de P0-S1A.
23. Normalizar la base de datos es regla obligatoria.

## Modelo de permisos aprobado

El sistema no usara RBAC simple. Usara permisos efectivos.

Componentes:

- `roles`: grupos funcionales como vendedor, supervisor, gerente o administrador.
- `permissions`: acciones atomicas del sistema.
- `user_roles`: multiples roles por usuario.
- `role_permissions`: permisos base de cada rol.
- `user_permission_grants`: permisos adicionales asignados directamente a una persona.
- `user_permission_denials`: permisos retirados explicitamente a una persona aunque los tenga por rol.
- `permission_delegations`: previsto para fase posterior; fuera de P0-S1A.
- `role_hierarchy`: jerarquia entre roles para supervision, no para copiar permisos automaticamente sin reglas.

## Orden de resolucion

El backend debe calcular permisos en este orden:

1. permisos base de todos los roles activos del usuario;
2. permisos directos otorgados al usuario;
3. denegaciones explicitas del usuario.

La denegacion explicita siempre gana.

Ejemplo:

```txt
Usuario: gerente
Rol gerente: tiene aprobar_descuento
Admin deniega aprobar_descuento al usuario especifico
Resultado: no puede aprobar_descuento aunque su rol lo permita
```

## Reglas de seguridad para permisos

- El frontend nunca decide permisos finales.
- Todo permiso se valida en backend.
- Toda asignacion, denegacion o revocacion genera auditoria.
- Delegacion temporal avanzada queda fuera de P0-S1A.
- Los permisos deben ser atomicos y nombrados por accion, no por pantalla.
- El rol mas alto puede supervisar vistas y operaciones de roles inferiores si tiene permisos efectivos para ello.
- Un vendedor no hereda permisos superiores por pertenecer a una estructura supervisada.
- Ver lo que ve otro rol no significa poder ejecutar todas sus acciones; lectura y accion deben separarse.

## Roles iniciales propuestos

Pendiente de nombres finales, pero el modelo debe arrancar con esta jerarquia conceptual:

1. `super_admin` o `jefe_general`: rol mas alto del sistema; puede supervisar toda la operacion.
2. `gerente`: supervisa areas comerciales o funcionales segun alcance.
3. `supervisor`: supervisa equipos/vendedores asignados.
4. `vendedor`: gestiona sus propios leads y actividades.
5. `formalizacion`: gestiona vistas/acciones de formalizacion cuando el flujo lo requiera.

La jerarquia sirve para alcance de supervision. Los permisos reales se calculan por permisos efectivos.

## Estados actuales de leads

Estados observados y confirmados desde el sistema actual:

| Codigo legacy | Nombre operativo actual | Conteo observado |
|---|---:|---:|
| `07-LEAD-PERDIDO` | Lead perdido | 50377 |
| `01-LEAD-INTERESADO` | Lead interesado | 3417 |
| `08-LEAD-SEGUIMIENTO` | Lead seguimiento | 1556 |
| `05-LEAD-CONTRATO` | Lead contrato | 201 |
| `02-LEAD-OPORTUNIDAD` | Lead oportunidad | 109 |
| `04-LEAD-RESERVA` | Lead reserva | 87 |
| `03-LEAD-PRE-RESERVA` | Lead pre-reserva | 43 |

Regla nueva:

- los estados deben vivir en tabla catalogo;
- no depender del prefijo numerico del texto legacy;
- permitir insertar nuevos estados entre estados existentes usando `sort_order`;
- conservar el codigo legacy como referencia externa cuando aplique.

## Campos P0 de lead

Campos nucleo para el nuevo CRM:

- nombre;
- email;
- telefono;
- estado;
- propietario/vendedor;
- proyecto;
- campana;
- subsidiaria;
- comentario;
- fecha de creacion;
- fecha de actualizacion;
- ultima accion;
- motivo de perdida cuando aplique;
- indicador `has_related_lead`.

Campos de referencia/compatibilidad:

- id externo del sistema;
- id interno legacy;
- id externo de proyecto;
- id externo de subsidiaria;
- id externo de campana;
- accion externa de campana.

## Duplicados

No bloquear por duplicado en P0.

Regla:

- al insertar, buscar relacion posible por email o telefono normalizado;
- si existe, marcar `has_related_lead = true`;
- opcionalmente guardar filas en `lead_relations`;
- no fusionar;
- no bloquear;
- no agregar reglas por proyecto hasta una fase posterior.

## Preguntas ya cerradas para crear el schema inicial

| Pregunta | Decision |
| --- | --- |
| Nombre exacto de la base nueva | `CRM_THINK_V2`. |
| Base de datos | MySQL. |
| Runtime con Docker | No usar Docker. |
| Acceso SQL | Kysely + mysql2. |
| Package manager | pnpm. |
| Metodo principal de login | Microsoft Entra ID. |
| Correo y clave | Alternativa controlada por API. |
| Leads nuevos | Nacen en base nueva. |
| Duplicados | No bloquear; marcar relacion posible. |
| ERP/proveedores en frontend | Prohibido. |
| ERP/proveedores en DB core | Prohibido. |
| Perdida automatica P0 | No se activa. |
| 4 dias de atencion | Dias naturales en P0. |

## Preguntas criticas despues del schema inicial

1. Quien puede crear usuarios: administrador del CRM, TI, sincronizacion desde Microsoft 365 o todos?
2. Cuales son los permisos atomicos iniciales definitivos?
3. Que permisos puede delegar un gerente?
4. Que permisos puede delegar un supervisor?
5. Una delegacion requiere fecha de expiracion obligatoria o puede quedar indefinida?
6. Quien puede revocar permisos delegados: quien delego, gerente superior, administrador o todos los anteriores?
7. Que dato sera maestro para cliente: CRM nuevo, ERP o legacy durante la transicion?
8. Que dato sera maestro para orden/contrato: CRM nuevo, ERP o legacy?
9. Que eventos exactos de lead deben ir al outbox desde P0?

## Preguntas importantes despues del schema inicial

1. Habra sucursales desde P0?
2. Habra equipos comerciales desde P0?
3. Un vendedor puede ver solo sus leads o tambien leads de su equipo?
4. Un supervisor puede reasignar leads entre vendedores?
5. Se requiere aprobacion por monto, descuento, etapa o tipo de cliente?
6. Se requiere historial completo de cambios campo por campo?
7. Se requiere exportacion Excel en P0?
8. Se requiere calendario Microsoft 365 en P0 o P1?
9. Se requiere auditoria de lectura de datos sensibles o solo escritura/cambios?
10. Se requiere multiempresa o solo una empresa inicialmente?

## Decisiones bloqueadas hasta respuesta

- Catalogo inicial de permisos.
- Modelo de sucursal/equipo/propietario.
- Adapter de legacy CRM para P1.
- Primer caso real de integracion NetSuite.

## Recomendacion

El siguiente paso no es ampliar modulos. El siguiente paso es responder las preguntas criticas y luego crear el schema minimo MySQL para:

- usuarios;
- roles;
- permisos;
- grants/denials/delegations;
- leads;
- estados de lead;
- relaciones entre leads;
- actividades;
- auditoria.
