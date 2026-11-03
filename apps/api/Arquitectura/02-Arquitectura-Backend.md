# 02 - Arquitectura Backend

## Corte vigente contrastado — 2026-11-03

Revisión documental del árbol de trabajo de `temp/crm-tink-api-frontend-inicial`,
con base en HEAD `4d446ed`. Incluye cambios locales; no acredita publicación.

- NetSuite v2 dispone de escritor transaccional nativo primero y legacy solo en
  ausencia de autoridad nativa, recibos/cursor, snapshot y auditoría. v1 mantiene
  `persisted:false`. La ampliación de campos está en [75](75-Matriz-Campos-Ordenes-NetSuite.md)
  y la evidencia real acotada de diez indicadores en [73](73-Sincronizacion-Estados-Ordenes-NetSuite.md).
- Contratos usa aprobación de Formalización; la acción que otorga esa aprobación
  conserva sus prerrequisitos independientes. Origen de fondos, ocho etapas y
  combinaciones confirmadas de cierre están en [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).
  Eventos NetSuite `edit`/`xedit` pueden avanzar visitas finales existentes según
  esos indicadores; no hay retroceso automático ni etapas inventadas al consultar.
- Microsoft 365 tiene adaptador y endpoints conectados para agenda propia,
  disponibilidad, salas, invitaciones y Teams, condicionados a sesión Microsoft,
  permisos CRM y consentimiento: [64](64-Calendario-Global-API-y-Contexto.md).
  Implementación no equivale a aceptación externa con cuenta real.
- El adéndum es un marcador independiente de la etapa, con versión y nota manual;
  calendario conserva orden/cliente fijos y bloquea otro adéndum futuro.
  Contratos funcionales/esquema: [83](83-Adendum-Migracion-065-y-Rollback.md) y
  [84](84-Adendum-Manual-Migracion-066-y-Permisos.md), incluida la corrección067.

Los cortes inferiores conservan cronología y resultados de su fecha. Este corte
prevalece para inventario actual; no autoriza migraciones, escrituras, cambios de
credenciales, publicación ni despliegue. No se vuelven a ejecutar suites por editar documentación.

## Composición contrastada - 2026-11-02

El grafo real de `src/app.module.ts` incluye `NotesModule` y `CalendarModule`;
los párrafos del27 que llaman a toda agenda o notas «futuras» se conservan como
antecedente y no describen el runtime actual. Notas separa contenido/colaboración,
workflow, avisos y entrega; reutiliza identidad, auditoría y transacciones nativas.
Sus vínculos de negocio usan lectores/resolvedores autorizados sin importar
registros ([68](68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md)). Calendario reutiliza
la misma identidad comercial para lookup y guarda eventos nativos con sus
participantes/vínculos ([68 calendario](68-Calendario-Participantes-y-Vinculos.md)).

`NetsuiteModule` contiene lectura CRM/ERP, aprobación acotada y recepción local
de snapshots. v2 persiste mediante `NetsuiteOrderEventRepository`; v1 sigue sin
persistir. El plan70 conserva el diseño anterior a la implementación73/75. Oportunidades, estimaciones y CRUD general de
Leads continúan fuera del grafo operativo. Ver [22](22-Mapa-de-Implementacion-API.md)
para todas las fronteras actuales; existencia de carpetas o tablas no acredita
una operación, despliegue ni credenciales vigentes.

## Composicion vigente - 2026-10-27

Ademas de identidad/catalogos/auditoria, `AppModule` registra los resumenes y
seguimiento real de Formalizacion, `ContractTransitionModule` para comandos
send/revert/set-stage, `MarketingHomeModule` con dos controladores de lectura e
`NetsuiteModule` para inspeccion GET. El selector de etapas reutiliza
`ContractTransitionService` y su escritor transaccional, no un segundo motor.
Los lectores de timing y NetSuite comparten resolucion de autoridad nativa y
alcance; la conexion externa se realiza despues de cerrar el snapshot SQL.
El arbol siguiente sigue siendo blueprint donde incluye CRUD de Leads,
oportunidades, agenda HTTP, notas, comunicaciones o sincronizaciones futuras.
Inventario verificable en [22](22-Mapa-de-Implementacion-API.md).

## Estado de fase

Esta arquitectura combina runtime implementado y estructura futura. Inventario base contrastado al 2026-10-23, actualizado con ampliaciones al 2026-10-27: ver [49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md); [36 - Registro](36-Registro-Entrega-Administracion.md) conserva la evidencia de entrega fechada.

Estado actual:

```txt
apps/api implementa identidad/Administracion, catalogos, expedientes, resumenes de Formalizacion y Mercadeo, y timeline nativo de auditoria; CRUD HTTP de Leads sigue pendiente; seguimiento y comandos HTTP acotados de Formalizacion ya estan registrados
```

Identidad fue el primer modulo real aprobado. Oportunidades, estimaciones, CRUD de Leads, agenda, notas y sincronizaciones operativas siguen futuros. Los esquemas de Leads/calendario, persistencia interna de ordenes y lectores agregados son ampliaciones limitadas, no el flujo completo.

Las carpetas de integracion pueden existir como frontera fisica, pero no autorizan clientes, adapters, jobs, DTOs operativos ni sincronizaciones hasta que la ley `00-Producto-CRM-TINK-y-P0.md` apruebe ese corte.

## Patron principal

Monolito modular + DDD + arquitectura hexagonal.

```txt
HTTP Controllers
      |
Application Services / Use Cases
      |
Domain Rules
      |
Ports
      |
Adapters: Kysely/mysql2, NetSuite, Odoo, Microsoft 365, Kapso, Legacy CRM
```

## Estructura esperada futura

```txt
src/
├── modules/
│   └── crm/
│       ├── sales/
│       │   ├── leads/
│       │   ├── opportunities/
│       │   ├── estimates/
│       │   └── sales-orders/
│       ├── formalizations/
│       ├── collections/
│       ├── modifications/
│       ├── management/
│       ├── customer-journey/
│       ├── documents/
│       ├── calendar/
│       ├── notes/
│       ├── communications/
│       ├── reporting/
│       ├── identity/
│       ├── permissions/
│       ├── audit/
│       └── configuration/
├── integrations/
│   ├── common/
│   │   └── ports/
│   ├── netsuite/
│   ├── odoo/
│   ├── microsoft365/
│   ├── kapso/
│   └── legacy-crm/
├── database/
├── config/
├── common/
└── jobs/
```

## Regla de aislamiento

`src/modules/crm` solo puede depender de puertos comunes. No puede importar:

- `src/integrations/netsuite`
- `src/integrations/odoo`
- `src/integrations/legacy-crm`
- `src/integrations/kapso`
- `src/integrations/microsoft365`

Separacion obligatoria:

| Carpeta | Responsabilidad | Regla de desconexion |
|---|---|---|
| `src/database` | Conexion y tipos para `CRM_THINK_V2`. | No conoce CRM viejo, NetSuite, Odoo ni Kapso. |
| `src/modules/crm/**` | Dominio, casos de uso y repositories del CRM nuevo. | Solo habla contratos canonicos y puertos. |
| `src/integrations/legacy-crm` | Extraer datos del CRM viejo y traducirlos a contratos canonicos. | Si el viejo se apaga, se elimina este adapter sin tocar core. |
| `src/integrations/netsuite` | Enviar/recibir payloads NetSuite y mapear errores/respuestas. | Si cambia el ERP, se desconecta aqui. |
| `src/integrations/odoo` | Preparar convivencia/migracion futura hacia Odoo. | Puede activarse sin renombrar core ni frontend. |
| `src/integrations/kapso` | Mensajeria, WhatsApp, templates y webhooks Kapso. | No puede ser llamado directo por React. |
| `src/integrations/microsoft365` | Entra ID, foto y adaptador Graph de calendario mediante `ExternalCalendarPort`. | No decide permisos/reglas CRM; aceptación externa se verifica separadamente. |
| `src/modules/crm/identity/ports` | Interfaces de proveedor que identidad conoce. | No contiene implementaciones concretas. |

Nueva regla para cualquier proveedor futuro:

```txt
Proveedor nuevo = carpeta nueva en src/integrations/<proveedor> + port comun si aplica + mapper canonico. Nunca se mete dentro del core.
```

Regla de conexion legacy:

```txt
DB_NAME no cambia. CRM_THINK_V2 usa src/database. El CRM viejo usa src/integrations/legacy-crm con LEGACY_CRM_DB_NAME.
```

El adapter reutiliza `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` y `DB_SSL_CA`; `LEGACY_CRM_DB_USER/PASSWORD` son variables obsoletas ignoradas. La base nativa sigue siendo `CRM_THINK_V2`; legacy solo admite `LEGACY_CRM_DB_NAME=crmdatabase-api`. El pool lector es independiente y usa transacciones de solo lectura; la cuenta compartida no es de privilegios exclusivamente lectores. Lecturas requieren `ENABLE_LEGACY_FALLBACK=true`. Los seis writers de catalogos requieren ademas `NODE_ENV=production`, destino legacy configurado y `ENABLE_LEGACY_WRITES=true`; ambas banderas son booleanos estrictos y predeterminadas `false`. Leer no habilita escribir. No cambiar credenciales ni grants compartidos. Para retirada fisica, quitar primero registro/import de integracion y despues su carpeta; desactivar la bandera no cancela operaciones en curso.

## Controllers

Solo reciben request, validan DTOs y llaman casos de uso. No contienen queries, mapeos ERP ni reglas comerciales profundas.

## Use cases

Contienen flujo de aplicacion:

- identificar usuario actual;
- validar sesion BFF;
- calcular permisos efectivos;
- registrar auditoria de seguridad;
- crear lead;
- asignar vendedor;
- cambiar estado;
- registrar actividad;
- crear oportunidad;
- solicitar sincronizacion ERP.

Regla de carpeta:

- el blueprint ubica el futuro CRUD de leads en `src/modules/crm/sales/leads`; el codigo actual de tablas e historia vive en `src/modules/crm/leads`, sin ese CRUD;
- oportunidades vive en `src/modules/crm/sales/opportunities`;
- estimaciones vive en `src/modules/crm/sales/estimates`;
- ordenes de venta vive en `src/modules/crm/sales/sales-orders`;
- formalizaciones no se mezcla con ventas; vive en `src/modules/crm/formalizations`;
- calendario transversal vive en `src/modules/crm/calendar`;
- notas transversales viven en `src/modules/crm/notes`;
- permisos y auditoria viven separados de los modulos de negocio.

## Adapters

Contienen detalles externos:

- Kysely/mysql2.
- NetSuite.
- Odoo.
- Microsoft Graph.
- Kapso.
- MySQL legacy.

Cada adapter debe tener DTOs, cliente, mapper y errores propios cuando sea aprobado. Ningun adapter puede exportar payloads externos como contrato publico del API.
