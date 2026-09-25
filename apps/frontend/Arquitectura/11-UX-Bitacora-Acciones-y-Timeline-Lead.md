# 11 - UX de Bitacora, Acciones y Timeline del Lead

## Veredicto

La vista de lead debe tener una seccion de timeline/bitacora clara, filtrable y confiable.

El vendedor, supervisor, gerente o administrador debe poder entender rapidamente:

- que paso con el lead;
- cuando paso;
- quien lo hizo;
- con que rol actuo;
- desde que seccion lo hizo;
- que motivo selecciono;
- que estado cambio;
- que datos se modificaron;
- que eventos, notas, correos, WhatsApp o tareas existen;
- que corredor fue asignado o retirado;
- que informacion extra/perfil fue completada.

## Regla de lenguaje

El frontend no debe usar nombres legacy ni nombres de proveedores externos.

Prohibido en codigo nuevo de UI:

```txt
id_caida
caida
id_Caida
idnetsuite
netsuite
odoo
info_extra_lead
segimineto_lead
estado_caida
segui
```

El frontend usa nombres canonicos:

```txt
actionReason
actionType
timeline
leadProfile
broker
status
section
sourceChannel
```

## Principio de pantalla

La UI no debe mostrar numeros internos para motivos.

Correcto:

```txt
Motivo: No contesta
Accion: Nota manual
Estado: Seguimiento
Seccion: Detalle del lead
```

Incorrecto:

```txt
id_caida: 25
estado_caida: 3
segui: 0
```

## Vista detalle del lead

La pantalla de detalle debe organizarse asi:

```txt
Header
+-- nombre/contacto principal
+-- estado actual
+-- vendedor/responsable
+-- proyecto
+-- campana
+-- proxima actividad
+-- ultimo contacto

Tabs
+-- Resumen
+-- Timeline
+-- Actividades
+-- Perfil
+-- Documentos
+-- Auditoria
```

`Auditoria` puede estar limitada por permiso. `Timeline` debe ser visible segun permiso operativo.

## Timeline

El timeline debe mostrar entradas en orden cronologico descendente.

Cada item debe mostrar:

```txt
titulo
detalle
tipo de accion
motivo
usuario actor
rol usado
fecha/hora
seccion origen
canal origen
cambios antes/despues cuando aplique
```

Tipos visuales recomendados:

```txt
lead_created
lead_updated
status_changed
note_added
activity_scheduled
activity_completed
calendar_event_created
email_sent
whatsapp_sent
whatsapp_received
broker_assigned
owner_assigned
duplicate_marked
opportunity_created
pre_reservation_created
reservation_created
contract_signed
lead_lost
integration_synced
integration_failed
system_cleanup
```

## Filtros de timeline

Filtros obligatorios:

```txt
fecha desde/hasta
tipo de accion
motivo/categoria
usuario
rol
seccion
canal
solo cambios de estado
solo actividades
solo notas
solo integraciones
```

El frontend recibe opciones desde API. No hardcodear listas de motivos.

## Motivos por vista

Cada modal o vista solicita motivos segun scope.

Ejemplos:

```txt
lost_lead_modal -> motivos de perdida
follow_up_modal -> motivos de seguimiento
activity_modal -> motivos de actividad
whatsapp_flow -> motivos de WhatsApp
status_change_modal -> motivos de cambio de estado
bulk_cleanup -> motivos de limpieza
```

El vendedor ve palabras de negocio, no numeros.

## Acciones que deben crear bitacora

Toda accion del usuario sobre lead debe generar timeline desde el API:

```txt
crear lead
editar datos del lead
cambiar estado
asignar vendedor
reasignar vendedor
agregar nota
crear evento
editar evento
cancelar evento
completar evento
programar seguimiento
enviar correo
registrar llamada
enviar WhatsApp
recibir WhatsApp
marcar perdido
crear oportunidad
crear pre-reserva
crear reserva
registrar contrato firmado
asignar corredor
retirar corredor
editar perfil del lead
marcar posible duplicado/relacionado
sincronizar con sistema externo
fallo de sincronizacion
```

## Formularios

Cada formulario que modifica lead debe enviar:

```txt
payload canonico del cambio
reasonCode cuando aplique
detail cuando aplique
sectionCode
```

El API debe inferir actor, rol, permisos y fecha desde el token/sesion.

El frontend no envia:

```txt
actorUserId
actorRoleId
permissionCode
createdAt
externalProvider
```

## Perfil del lead

La antigua idea de `info_extra_lead` debe mostrarse como:

```txt
Perfil del lead
```

Grupos de UI:

```txt
Identificacion
+-- cedula
+-- nacionalidad
+-- edad
+-- estado civil

Contacto
+-- telefono alternativo
+-- direccion
+-- zona de residencia

Perfil comercial
+-- profesion
+-- ingresos
+-- motivo de compra
+-- momento de compra
+-- trabajo
+-- origen de fondos
+-- perfil comprador

Personas relacionadas
+-- nombre
+-- cedula
+-- telefono
+-- correo
+-- relacion
```

## Corredor

`Corredor` es una asignacion del lead, no texto suelto.

UI requerida:

```txt
Selector de corredor activo
Ver empresa/categoria/contacto
Historial de asignaciones
Accion de asignar
Accion de retirar
Motivo opcional
```

Toda asignacion o retiro debe aparecer en timeline.

## Permisos

La UI puede ocultar botones por permisos, pero el API decide la autorizacion real.

Permisos esperados:

```txt
lead.timeline.view
lead.audit.view
lead.note.create
lead.activity.create
lead.status.change
lead.lost.mark
lead.profile.update
lead.broker.assign
lead.owner.assign
lead.field_changes.view
lead.sensitive_values.view
```

Si el usuario tiene varios roles, la UI muestra la accion si el API la permite. Si existe una denegacion directa, la accion no se muestra.

## Estados visuales

El timeline debe soportar:

```txt
cargando
vacio
error recuperable
sin permiso
filtros sin resultados
entrada con valores sensibles ocultos
entrada generada por sistema
entrada generada por integracion
```

## Regla de no ambiguedad

Si el usuario final necesita preguntar "que significa este numero?", el diseno esta mal.

Toda opcion visible debe tener:

```txt
label claro
categoria clara
descripcion opcional
orden de aparicion
estado activo/inactivo
scope de uso
```

## Benchmark aplicado a UX

Patrones a seguir:

- Salesforce: actividad e historial del lead dentro del registro.
- HubSpot: timeline con filtros por tipo, usuario/equipo, fecha y actividades.
- Dynamics/Dataverse: auditoria clara de quien cambio que y cuando.
- Zoho: separar timeline del registro y audit log global.
- Pipedrive: actividades accionables vinculadas a lead/deal/contacto.
- Odoo: chatter/actividades y planes de actividad.
- Bitrix24: timeline como centro operativo del registro.
- Insightly/SugarCRM: historial de campos con valor anterior/nuevo.

Decision UX: el vendedor trabaja desde el timeline; auditoria avanzada queda para roles con permiso.
