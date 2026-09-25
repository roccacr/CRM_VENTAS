# 25 - Contrato Canonico Minimo Lead P0-S1

## Veredicto

Este documento no cierra el CRM completo.

Este documento define el contrato minimo vivo para poder avanzar de forma ordenada hacia el modelo MySQL minimo.

Regla principal:

```txt
producto -> contrato canonico minimo -> modelo MySQL minimo -> NestJS
```

Si falta claridad en este documento, no se debe inventar una tabla, endpoint, migracion ni DTO para llenar el vacio.

## Como se debe usar

Este contrato se construye en el camino, pero no desde la imaginacion.

Cada campo queda clasificado asi:

| Estado | Significado |
| --- | --- |
| Aprobado P0-S1 | Puede entrar al modelo minimo y al contrato futuro. |
| Candidato | Parece necesario por el CRM actual o por negocio, pero necesita validacion antes de ser obligatorio. |
| Fuera de P0-S1 | Pertenece a vision futura o a otro modulo. No autoriza codigo ahora. |

El objetivo no es tener todos los campos perfectos desde el dia uno. El objetivo es evitar que el nuevo CRM copie nombres malos, estructuras mezcladas o decisiones heredadas sin entenderlas.

## Que es un lead

Un lead es un expediente comercial inicial.

Representa una intencion o posibilidad de venta asociada a una persona/contacto, un proyecto, un responsable comercial y un estado comercial.

Un lead no es simplemente una fila importada del CRM viejo. En el CRM nuevo debe tener:

- contacto principal;
- responsable o pendiente de asignacion;
- estado comercial;
- estado operativo;
- origen/campana cuando exista;
- timeline obligatorio;
- auditoria minima;
- posible marca de relacion con otro lead.

Un lead puede avanzar por este flujo comercial:

```txt
lead -> oportunidad -> estimacion -> orden de venta -> contrato
```

En P0-S1 solo se define el nucleo del lead. Oportunidad, estimacion, orden de venta y contrato quedan como flujo reconocido, no como implementacion autorizada.

## Que es un contacto

Un contacto es la persona o entidad humana con la que se comunica la empresa.

El contacto vive separado del lead porque una misma persona puede aparecer en mas de un lead, proyecto, campana o proceso comercial.

El contacto contiene datos de identificacion y comunicacion. El lead contiene el expediente comercial.

Regla:

```txt
contacto = quien es la persona
lead = que proceso comercial existe con esa persona
```

## Campos minimos aprobados P0-S1

### Contacto

| Nombre canonico | Tipo conceptual | Obligatorio | Para que sirve |
| --- | --- | --- | --- |
| `fullName` | texto | Si | Nombre visible de la persona/contacto. |
| `email` | texto/email | No | Comunicacion y posible relacion con otros leads. |
| `phone` | texto/telefono | No | Comunicacion y posible relacion con otros leads. |
| `countryCode` | codigo pais | Si | Pais base del contacto. Por defecto `CR`. |

Regla minima:

- un contacto debe tener `fullName`;
- `email` y `phone` pueden estar vacios en P0-S1;
- si existen, deben guardarse normalizados para busqueda;
- no se bloquea la creacion por posible duplicado en P0-S1.

### Lead

| Nombre canonico | Tipo conceptual | Obligatorio | Para que sirve |
| --- | --- | --- | --- |
| `primaryContact` | objeto contacto | Si | Contacto principal del lead. |
| `ownerUserPublicId` | identificador publico | No | Usuario asignado. Debe existir vendedor responsable cuando venga informado; si no viene, el lead se crea pendiente de asignacion. |
| `statusCode` | codigo catalogo | Si | Estado comercial inicial. |
| `operationalStateCode` | codigo catalogo | Si | Estado operativo inicial. |
| `projectPublicId` | identificador publico | Si | Proyecto de interes. Siempre debe venir. |
| `campaignPublicId` | identificador publico | Si | Campana comercial. Siempre debe venir. |
| `sourceCode` | codigo catalogo | Si | Canal/origen del lead. Siempre debe venir. |
| `comment` | texto | No | Comentario inicial visible en timeline. |
| `hasRelatedLead` | booleano | Si | Marca simple de posible relacion con otro lead. No bloquea. |

Valores iniciales minimos:

```txt
statusCode = interesado
operationalStateCode = new
hasRelatedLead = false
countryCode = CR
```

Reglas cerradas:

- `projectPublicId` siempre debe venir.
- `campaignPublicId` siempre debe venir.
- `sourceCode` siempre debe venir.
- `ownerUserPublicId` debe venir cuando el lead ya tenga vendedor conocido.
- si no viene `ownerUserPublicId`, el lead se crea igualmente y queda pendiente de asignacion.
- el vendedor asignado puede editar los datos del lead y su informacion completa, siempre dejando bitacora.
- todo cambio o accion contra el lead debe registrar motivo de accion.

Si el lead entra desde una integracion, el adapter debe traducir el payload externo a este contrato. El core del CRM no recibe nombres de proveedor.

## Campos opcionales candidatos

Estos campos son candidatos porque existen en el CRM actual o aparecen en el proceso comercial, pero no deben forzar el primer modelo hasta confirmar uso real.

| Campo candidato | Motivo | Estado |
| --- | --- | --- |
| `subsidiaryPublicId` | El CRM actual maneja subsidiaria. | Candidato |
| `currencyCode` | Puede ser necesario para estimaciones/ordenes futuras. | Candidato |
| `brokerPublicId` | Corredor puede asignarse al lead. | Fuera de P0-S1 |
| `alternatePhone` | Existe en informacion extra actual. | Candidato |
| `nationalId` | Puede ser relevante despues para formalizacion. | Fuera de P0-S1 |
| `purchaseReasonCode` | Perfil comercial extendido. | Fuera de P0-S1 |
| `purchaseTimingCode` | Perfil comercial extendido. | Fuera de P0-S1 |
| `budgetRangeCode` | Calificacion comercial futura. | Fuera de P0-S1 |
| `companyName` | Existe en legacy, uso pendiente de validar. | Candidato |
| `externalReferences` | Necesario para ERP/legacy, pero no como campo core del lead. | Candidato tecnico |

Regla:

Los candidatos no se vuelven obligatorios solo por existir en la base vieja. Primero se valida si negocio los usa, en que pantalla, con que filtro y con que decision.

## Nombres canonicos aprobados

Los nombres canonicos para API y modelo interno deben ser estables, legibles y neutrales.

| Concepto | Nombre canonico |
| --- | --- |
| Nombre del contacto | `fullName` |
| Correo | `email` |
| Correo normalizado | `normalizedEmail` |
| Telefono | `phone` |
| Telefono normalizado | `normalizedPhone` |
| Pais | `countryCode` |
| Lead | `lead` |
| Contacto principal | `primaryContact` |
| Responsable | `ownerUserPublicId` |
| Estado comercial | `statusCode` |
| Estado operativo | `operationalStateCode` |
| Proyecto | `projectPublicId` |
| Campana | `campaignPublicId` |
| Origen | `sourceCode` |
| Comentario inicial | `comment` |
| Lead relacionado | `hasRelatedLead` |
| Tipo de accion | `actionTypeCode` |
| Motivo de accion | `actionReasonCode` |
| Seccion de origen | `sectionCode` |
| Canal de origen | `sourceChannel` |

Reglas de nombres:

- usar palabras, no numeros magicos;
- no usar nombres heredados como `segimineto`, `caida`, `idnetsuite`, `idinterno`, `accion_lead`;
- no usar nombres de proveedores externos en DTOs publicos ni tablas core;
- los labels de UI pueden estar en espanol, pero el contrato tecnico debe ser estable.

## Source code y section code

Estos nombres son tecnicos, pero representan conceptos simples.

`sourceCode` significa de donde nacio el lead.

Ejemplos iniciales propuestos:

| `sourceCode` | Significado para negocio |
| --- | --- |
| `crm_manual` | Lead creado manualmente dentro del CRM. |
| `website` | Lead que viene de formulario web. |
| `facebook` | Lead que viene de Facebook. |
| `instagram` | Lead que viene de Instagram. |
| `whatsapp` | Lead que viene de WhatsApp o Kapso cuando esa integracion se apruebe. |
| `erp_import` | Lead recibido desde un ERP por adapter. |
| `legacy_import` | Lead importado desde el CRM viejo cuando esa fase se apruebe. |
| `referral` | Lead referido. |
| `other` | Otro origen controlado, no texto libre. |

Para P0-S1, la lista definitiva puede iniciar pequena. Lo importante es que siempre sea codigo legible y no numero.

`sectionCode` significa desde que parte del CRM se hizo una accion.

Ejemplos iniciales propuestos:

| `sectionCode` | Significado para negocio |
| --- | --- |
| `lead_create` | Creacion del lead. |
| `lead_detail` | Detalle del lead. |
| `lead_edit` | Edicion de datos del lead. |
| `lead_list` | Lista de leads. |
| `lead_status_change` | Cambio de estado del lead. |
| `lead_assignment` | Asignacion o cambio de responsable. |
| `lead_timeline` | Accion registrada desde la historia del lead. |
| `system_integration` | Accion provocada por una integracion o proceso interno. |

Regla:

- `sourceCode` explica de donde viene el lead;
- `sectionCode` explica desde donde se hizo la accion;
- ambos deben ser codigos legibles;
- ninguno debe ser un id numerico heredado.

## Que no entra en este contrato

No entra en P0-S1:

- calendarios;
- notas adhesivas;
- Kapso;
- WhatsApp operativo;
- dual-read con CRM viejo;
- sincronizacion real con ERP;
- oportunidad completa;
- estimacion completa;
- orden de venta completa;
- contrato completo;
- formalizacion;
- cobros;
- modificaciones;
- delegaciones avanzadas;
- denegaciones explicitas;
- motor ABAC completo;
- Redis;
- RabbitMQ;
- jobs reales;
- reporteria ejecutiva avanzada.

Esto puede existir como vision en otros documentos, pero no autoriza tablas, pantallas ni endpoints para P0-S1.

## Ejemplo JSON canonico

Ejemplo conceptual de creacion de lead desde frontend o desde un adapter ya normalizado:

```json
{
  "primaryContact": {
    "fullName": "Maria Rodriguez",
    "email": "maria@example.com",
    "phone": "88888888",
    "countryCode": "CR"
  },
  "ownerUserPublicId": "01J00000000000000000000001",
  "statusCode": "interesado",
  "operationalStateCode": "new",
  "projectPublicId": "01J00000000000000000000002",
  "campaignPublicId": "01J00000000000000000000003",
  "sourceCode": "website",
  "comment": "Cliente solicita informacion inicial.",
  "hasRelatedLead": false
}
```

Respuesta conceptual minima:

```json
{
  "lead": {
    "publicId": "01J00000000000000000000004",
    "statusCode": "interesado",
    "operationalStateCode": "new",
    "hasRelatedLead": false,
    "createdAt": "2026-09-24T18:00:00.000-06:00"
  },
  "primaryContact": {
    "publicId": "01J00000000000000000000005",
    "fullName": "Maria Rodriguez",
    "email": "maria@example.com",
    "phone": "88888888",
    "countryCode": "CR"
  },
  "timeline": [
    {
      "actionTypeCode": "lead_created",
      "sectionCode": "lead_create",
      "sourceChannel": "crm_web",
      "title": "Lead creado",
      "detail": "Cliente solicita informacion inicial."
    }
  ]
}
```

Este JSON es ejemplo de contrato, no OpenAPI aprobado.

## Reglas minimas de bitacora

Todo lead creado o modificado debe dejar timeline.

Para P0-S1, la bitacora minima debe registrar:

| Dato | Obligatorio | Motivo |
| --- | --- | --- |
| `leadPublicId` | Si | Saber a que expediente pertenece. |
| `actionTypeCode` | Si | Saber que paso. |
| `actionReasonCode` | Si | Todo cambio o accion contra el lead debe explicar el motivo. |
| `actorUserPublicId` | Si si hay usuario | Saber quien lo hizo. |
| `actorRoleCodeSnapshot` | Si si hay usuario | Mantener evidencia aunque cambie el rol despues. |
| `effectivePermissionCode` | Si para acciones sensibles | Saber que permiso permitio la accion. |
| `sectionCode` | Si | Saber desde que parte del CRM ocurrio. |
| `sourceChannel` | Si | Distinguir web, sistema, integracion u otro canal. |
| `title` | Si | Resumen visible para usuario. |
| `detail` | No | Explicacion cuando aplique. |
| `occurredAt` | Si | Fecha/hora real de la accion. |

Reglas:

- si falla crear bitacora, falla la operacion del lead;
- cambios de estado deben dejar estado anterior y nuevo;
- cambios de campos relevantes deben dejar antes/despues;
- todo cambio o accion contra el lead debe registrar `actionReasonCode`;
- el frontend no envia ids numericos de motivos;
- el API devuelve motivos y acciones por codigo/nombre legible;
- las acciones de sistema tambien deben tener source channel y correlation id cuando exista.

## Reglas minimas de permisos

P0-S1 no implementa el sistema completo de permisos.

Debe cubrir solo esto:

| Accion | Permitido en P0-S1 |
| --- | --- |
| Crear lead | vendedor, supervisor, gerente, owner. |
| Ver lead propio | usuario asignado. |
| Ver leads del equipo | supervisor, gerente u owner por alcance aprobado. |
| Ver timeline | quien tenga visibilidad del lead. |
| Editar datos del lead e informacion completa | vendedor asignado o jefatura con permiso. |
| Cambiar estado | usuario asignado o jefatura con permiso. |

Reglas:

- el frontend nunca decide permisos finales;
- el backend siempre calcula permiso efectivo;
- P0-S1 puede usar permisos atomicos simples;
- el vendedor asignado puede editar toda la informacion del lead bajo auditoria;
- multiples roles, grants directos, denies y delegaciones quedan como modelo objetivo, pero no bloquean el primer slice.

## Decisiones cerradas

Estas decisiones ya quedan cerradas para P0-S1:

| Decision | Resultado |
| --- | --- |
| Proyecto obligatorio | `projectPublicId` siempre debe venir. |
| Campana obligatoria | `campaignPublicId` siempre debe venir. |
| Origen obligatorio | `sourceCode` siempre debe venir. |
| Vendedor asignado | Debe venir cuando se conoce; si no viene, el lead se crea pendiente de asignacion. |
| Edicion por vendedor | El vendedor asignado puede editar toda la informacion del lead. |
| Motivo de acciones | Todo cambio o accion contra el lead debe registrar motivo. |

## Dudas abiertas

Estas dudas no bloquean escribir este contrato, pero si bloquean convertir ciertos candidatos en modelo fisico:

1. Cual sera la lista oficial minima de `sourceCode` para P0-S1.
2. Cual sera la lista oficial minima de `sectionCode` para P0-S1.
3. Cuales campos del contacto se consideran sensibles en UI.
4. Si la marca `hasRelatedLead` debe calcularse al insertar o actualizarse despues por proceso separado.
5. Que datos del CRM actual se revisaran como evidencia antes de marcar campos candidatos como aprobados.

## Criterio para pasar a modelo MySQL minimo

Se puede avanzar al modelo MySQL minimo cuando:

- los campos aprobados P0-S1 esten aceptados;
- los nombres canonicos no tengan conflicto con negocio;
- las dudas abiertas criticas esten respondidas o marcadas como fuera del primer corte;
- el modelo resultante no copie nombres legacy ni nombres de proveedores externos;
- jefatura pueda entender que dato se guarda y por que.
