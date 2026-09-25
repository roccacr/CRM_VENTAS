# 14 - Diccionario de Datos y Modulos

## Veredicto

El API debe mantener un diccionario de datos vivo.

Cada tabla nueva del CRM debe tener documentado:

- para que sirve;
- que entidad de negocio representa;
- que modulo la posee;
- que tablas la relacionan;
- que campos son obligatorios;
- que campos son sensibles;
- que indices soportan consultas reales;
- que acciones pueden escribir en ella;
- que eventos/timeline/auditoria debe generar cuando cambia;
- que datos vienen de integracion externa, si aplica;
- que datos nunca deben depender de nombres legacy o proveedores externos.

Este diccionario es obligatorio antes de crear migraciones definitivas.

## Regla de organizacion

Los documentos deben vivir dentro del API:

```txt
apps/api/Arquitectura/
```

Para evitar archivos gigantes, el diccionario se organiza por dominio:

```txt
Diccionario-Datos/
+-- 00-Indice.md
+-- 01-Identidad-y-Permisos.md
+-- 02-Leads-y-Contactos.md
+-- 03-Timeline-Bitacora-y-Auditoria.md
+-- 04-Actividades-y-Calendario.md
+-- 05-Oportunidades.md
+-- 06-Estimaciones.md
+-- 07-Ordenes-de-Venta.md
+-- 08-Contratos.md
+-- 09-Corredores.md
+-- 10-Integraciones-y-Referencias-Externas.md
+-- 11-Reporteria.md
```

Estos archivos se crearan conforme se implemente cada modulo. No se deben mezclar todos los detalles en un solo documento.

## Plantilla obligatoria por tabla

Cada tabla debe documentarse con esta estructura:

```md
## crm_table_name

Proposito:

Modulo propietario:

Tipo:
- transaccional
- catalogo
- relacion
- auditoria
- integracion
- reporting

Reglas de negocio:

Campos principales:

| Campo | Tipo | Obligatorio | Sensible | Descripcion |
| --- | --- | --- | --- | --- |

Relaciones:

| Tabla relacionada | Relacion | Motivo |
| --- | --- | --- |

Indices:

| Indice | Columnas | Consulta que soporta |
| --- | --- | --- |

Acciones que escriben aqui:

Eventos/timeline que deben generarse:

Notas de migracion legacy:

Notas de rendimiento:

Riesgos:
```

## Diccionario inicial P0

El diccionario detallado de identidad ya vive en:

```txt
Diccionario-Datos/01-Identidad-y-Permisos.md
```

Ese archivo manda sobre el resumen de esta seccion.

### sec_user

Proposito: usuarios internos del CRM.

Representa vendedores, supervisores, gerentes, administradores y usuarios de sistema.

Reglas:

- autenticacion principal con Microsoft Entra ID;
- correo/clave como alternativa controlada;
- no guardar permisos efectivos materializados como fuente de verdad;
- no guardar `idnetsuite_admin`, `idodoo_user` ni ids legacy en `sec_user`;
- el jefe/supervisor se resuelve por roles, areas y `sec_user_org_unit`;
- el usuario puede tener multiples roles.

### sec_role

Proposito: catalogo de roles de negocio.

Ejemplos:

```txt
owner
general_manager
sales_manager
supervisor
salesperson
formalization
admin
system
```

Reglas:

- el rol define permisos base;
- un usuario puede tener varios roles;
- un rol no debe usarse para guardar excepciones temporales.

### sec_permission

Proposito: catalogo atomico de permisos.

Ejemplos:

```txt
lead.view
lead.create
lead.update
lead.status.change
lead.lost.mark
lead.timeline.view
lead.audit.view
lead.broker.assign
opportunity.create
estimate.create
sales_order.create
contract.view
```

Reglas:

- permisos con nombres estables;
- el backend autoriza siempre;
- el frontend solo usa permisos para UX, no como seguridad real.

### sec_user_role

Proposito: relacion muchos-a-muchos entre usuarios y roles.

Reglas:

- permite que una persona tenga mas de un rol;
- debe auditar altas y bajas de roles.

### sec_role_permission

Proposito: permisos incluidos por rol.

Reglas:

- define el permiso base;
- no debe guardar excepciones individuales.

### crm_user_permission_grants

Proposito: permisos directos dados a una persona.

Ejemplo: un vendedor recibe temporalmente permiso para aprobar una accion.

Reglas:

- debe tener actor que otorga;
- debe tener alcance y fecha de expiracion cuando aplique;
- debe generar auditoria.

### crm_user_permission_denials

Proposito: negar un permiso especifico a una persona aunque venga por rol.

Reglas:

- la denegacion directa gana sobre roles y grants;
- debe auditar quien la aplico y por que.

### crm_permission_delegations

Proposito: tabla prevista para fase posterior, fuera de P0-S1A.

Reglas:

- no se implementa en identidad S1A;
- no forma parte del SQL de identidad actual;
- se define solo si negocio aprueba delegacion temporal avanzada.

### crm_contacts

Proposito: persona/contacto comercial.

Reglas:

- email y telefono normalizados para busqueda;
- un contacto puede relacionarse con varios leads;
- no bloquear duplicados en P0, solo marcar relacion posible.

### crm_leads

Proposito: oportunidad comercial inicial antes de convertirse en oportunidad formal.

Reglas:

- no copiar la tabla legacy `leads`;
- guardar propietario, estado, proyecto, campana y contacto principal;
- no guardar nombres de proveedores externos;
- toda mutacion debe crear timeline.

### crm_lead_statuses

Proposito: catalogo ordenado de estados del lead.

Estados iniciales:

```txt
interesado
seguimiento
oportunidad
pre_reserva
reserva
contrato
perdido
```

Reglas:

- agregar un estado nuevo debe ser cambio de catalogo, no cambio de codigo;
- usar `sort_order` para ordenar el pipeline.

### crm_lead_action_types

Proposito: tipos de accion ejecutada sobre un lead.

Ejemplos:

```txt
lead_created
lead_updated
status_changed
note_added
activity_scheduled
email_sent
whatsapp_received
broker_assigned
opportunity_created
estimate_created
sales_order_created
contract_signed
lead_lost
```

Reglas:

- describe que paso;
- no debe confundirse con el motivo.

### crm_lead_action_reasons

Proposito: motivos seleccionables para explicar una accion.

Sustituye el uso ambiguo de `caidas`.

Reglas:

- no llamar "motivo de caida" a todo;
- un motivo puede estar disponible solo para una vista mediante `ui_scope`;
- el frontend recibe motivos por palabra/codigo, no por id numerico.

### crm_lead_timeline_entries

Proposito: historia visible del lead.

Reglas:

- toda accion importante genera una entrada;
- guarda actor, rol efectivo, permiso usado, seccion, canal, fecha y detalle;
- debe poder filtrarse por lead, fecha, usuario, tipo, motivo y seccion.

### crm_lead_field_changes

Proposito: detalle de campos modificados.

Reglas:

- guarda valor anterior y nuevo;
- valores sensibles se enmascaran segun permiso;
- se vincula al timeline.

### crm_lead_status_history

Proposito: historial formal de cambios de estado.

Reglas:

- permite medir conversion, tiempo por etapa y cambios indebidos;
- cada cambio de estado debe tener timeline asociado.

### crm_brokers

Proposito: corredores externos o internos asignables a leads.

Reglas:

- no guardar corredor como texto libre en el lead;
- normalizar correo/telefono;
- referencias externas van en tablas `int_`, por ejemplo `int_external_reference`.

### crm_lead_broker_assignments

Proposito: historial de asignaciones de corredor a lead.

Reglas:

- asignar o retirar corredor genera timeline;
- debe conservar historico, no sobrescribir sin rastro.

### crm_lead_profile_details

Proposito: perfil extendido o datos de calificacion del lead.

Incluye identificacion, nacionalidad, profesion, direccion, ingresos, motivo de compra, momento de compra, trabajo, origen de fondos y perfil comprador.

Reglas:

- no usar el nombre legacy `info_extra_lead`;
- no duplicar columnas para segunda persona.

### crm_lead_related_people

Proposito: personas adicionales relacionadas con el lead.

Ejemplos:

```txt
conyuge
codeudor
comprador_secundario
tercero_interesado
referido
```

Reglas:

- reemplaza columnas duplicadas tipo `nombre_extra`, `cedula_extra`, etc.;
- puede crecer sin alterar la tabla principal.

### crm_activities

Proposito: tareas, llamadas, reuniones, seguimientos, correos o actividades comerciales planificadas/ejecutadas.

Reglas:

- puede relacionarse a lead/contacto/oportunidad;
- completar, cancelar o editar genera timeline.

### crm_calendar_events

Proposito: eventos con fecha/hora para calendario.

Reglas:

- debe soportar integracion futura con Microsoft 365;
- debe generar timeline al crear, editar, cancelar o completar.

### crm_opportunities

Proposito: oportunidad comercial formal creada desde un lead calificado.

Reglas:

- crear oportunidad desde lead genera timeline;
- debe conservar referencia al lead origen;
- no debe borrar el lead.

### crm_estimates

Proposito: estimaciones/cotizaciones comerciales.

Reglas:

- crear, enviar, aprobar, rechazar o caer una estimacion genera timeline;
- integracion externa se maneja por adapter, no por columnas core.

### crm_sales_orders

Proposito: ordenes de venta o reservas formalizadas.

Reglas:

- debe tener estado propio;
- envio a sistema externo genera outbox y timeline;
- errores de integracion no deben borrar la accion comercial.

### crm_contracts

Proposito: contratos y cierres firmados.

Reglas:

- firma o anulacion genera timeline;
- documentos deben referenciarse sin guardar binarios pesados en tabla principal.

### crm_business_logs

Proposito: bitacora funcional de negocio para acciones importantes.

Reglas:

- puede resumir acciones cross-module;
- no reemplaza el timeline del lead.

### crm_audit_logs

Proposito: auditoria tecnica y de seguridad.

Reglas:

- registra cambios sensibles, permisos, accesos, errores criticos y acciones administrativas;
- visible solo para roles autorizados.

### int_external_system

Proposito: catalogo generico de sistemas externos.

Reglas:

- puede contener valores configurables de proveedores;
- no debe forzar nombres de proveedor dentro del dominio core.

### int_external_reference

Proposito: vincular entidades internas con ids externos.

Reglas:

- evita columnas core con nombres de proveedor;
- toda integracion debe consultar aqui para relacionar registros.
- aplica a leads, oportunidades, estimaciones, ordenes de venta, contratos y otras entidades internas;
- no define relaciones internas del CRM;
- si dos proveedores devuelven ids distintos para el mismo lead, ambos apuntan al mismo `crm_lead.id_lead`;
- si no hay certeza para relacionar, se crea pendiente de reconciliacion y no se mezclan datos a ciegas.

### int_outbox_event

Proposito: eventos pendientes para sincronizar hacia sistemas externos.

Reglas:

- se escribe dentro de la misma transaccion de negocio;
- workers lo procesan con reintentos e idempotencia.

### int_inbox_event

Proposito: eventos entrantes desde integraciones.

Reglas:

- evita procesar dos veces el mismo evento externo;
- debe guardar correlation id y payload controlado.

## Diccionario de acciones

Cada accion del CRM tambien debe documentarse en archivo propio cuando el modulo exista.

Estructura sugerida:

```txt
Acciones/
+-- 00-Indice.md
+-- Leads.md
+-- Oportunidades.md
+-- Estimaciones.md
+-- Ordenes-de-Venta.md
+-- Contratos.md
+-- Corredores.md
+-- Calendario.md
+-- Integraciones.md
```

Cada accion debe documentar:

```md
## action_code

Nombre visible:

Modulo:

Quien puede ejecutarla:

Permiso requerido:

Precondiciones:

Datos requeridos:

Cambios en base:

Timeline generado:

Audit log generado:

Outbox/integracion:

Errores esperados:

Impacto en reporteria:
```

## Regla para estimaciones, oportunidades y ordenes de venta

Estos modulos no deben improvisarse.

Antes de implementarlos se debe documentar:

- flujo completo;
- estados;
- permisos;
- tablas;
- acciones;
- timeline generado;
- integraciones;
- filtros de UI;
- reportes esperados;
- migracion o convivencia con datos actuales.

## Decisiones cerradas del flujo comercial

| Pregunta | Decision |
| --- | --- |
| Donde nace el proceso comercial? | Todo nace desde lead. |
| Cual es el orden oficial? | Lead -> Oportunidad -> Estimacion -> Orden de Venta -> Contrato. |
| Una estimacion puede nacer sin oportunidad? | No en el flujo oficial; nace desde oportunidad. |
| Una orden de venta puede nacer sin estimacion? | No en el flujo oficial; nace desde estimacion. |
| Reserva es entidad separada? | No en P0; es una marca/estado dentro de orden de venta y estado visible del lead. |
| Pre-reserva, reserva y contrato tienen diferencia estructural? | Son hitos del avance comercial. La diferencia principal es el estado/marca y el timeline registrado. |
| Quien aprueba o cae estimaciones? | Depende de permisos efectivos, no de un rol fijo. |
| Hay campos obligatorios globales del perfil para avanzar? | No en P0. |
| Puede cambiar corredor despues de reserva o contrato? | Si, con timeline y auditoria. |

Ver detalle y diagramas en `15-Flujo-Comercial-Lead-a-Contrato.md`.

## Preguntas pendientes

1. Campos exactos de estimacion.
2. Campos exactos de orden de venta.
3. Documentos requeridos para contrato.
4. Reglas de comision o impacto comercial cuando cambia corredor.
5. Filtros exactos de reporteria para gerencia.
