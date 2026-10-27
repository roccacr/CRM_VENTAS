# 22 - Mapa de Implementacion API

## Inventario registrado y contratos - revision 2026-10-27

Fuentes: `src/app.module.ts`, metadatos de controladores/modulos y contratos
referenciados. Tabla de ampliaciones verificadas por lectura de codigo; no es
una ejecucion HTTP ni prueba nueva de MySQL.

| Ruta | Registro y contrato | Autorizacion/limite |
| --- | --- | --- |
| `GET /marketing/home/summary` | `MarketingHomeModule`, `marketing-home.contract.ts` | `mercadeo.home.read`; period day/week/month/year; lectura agregada |
| `GET /marketing/leads/report` | mismo modulo, `MarketingLeadsReportController`, `marketing-leads-report.contract.ts` | `mercadeo.leads.read`; period day/week/month/all; fuentes y calidad, sin filas PII |
| `GET /formalization/approvals/summary` | `ApprovalSummaryModule` | `formalizacion.home.approvals.read`; lector autoriza alcance |
| `GET /formalization/contracts/summary` | `ContractSummaryModule` | rol efectivo Formalizacion + `formalizacion.home.stages.read` |
| `GET /formalization/home/summary` | `HomeSummaryModule` | misma lectura de etapas; aprobaciones conservan permiso independiente |
| `GET /formalization/home/follow-up` | `FollowUpController`, `follow-up.contract.ts` | permisos/alcance por recurso, busqueda/proyecto/bandeja, pageSize maximo 100 |
| `GET /formalization/orders/:source/:id/timing` | `OrderTimingController`, `order-timing.contract.ts` | lectura de visitas/tiempos autorizada, no inserta historia al consultar |
| `POST /formalization/contracts/send` | `ContractTransitionModule`, `ContractTransitionDto` | `formalizacion.contracts.send`; registra evidencia CRM, no envia correo |
| `POST /formalization/contracts/revert` | mismo modulo/DTO | `formalizacion.contracts.revert`; motivo obligatorio |
| `POST /formalization/orders/stage` | `FormalizationStageController`, mismo servicio/DTO | `formalizacion.orders.stage.update`; aprobaciones, firma y retrocesos validados |
| `GET /formalization/orders/:source/:id/netsuite` | `NetsuiteModule` y adaptador dedicado | rol/permiso de etapas y alcance CRM; GET externo, sin persistencia |

Los comandos comparten validacion estricta, CSRF, version e idempotencia; el API
resuelve actor y autoridad de fuente. Las tablas nativas y referencias son
independientes del proveedor. Inspeccion NetSuite devuelve payload externo solo
en su endpoint dedicado; no modifica el contrato comercial.

Identidad, auditoria, catalogos genericos y seis catalogos dedicados conservan
sus controladores existentes. Expedientes registra consulta, no CRUD. No existe
ruta operativa de agenda, CRUD HTTP general de Leads, oportunidades o estimaciones.
`GET /formalization/contracts/orders` tampoco esta registrado. El detalle actual
se construye desde el seguimiento, sin inventar un endpoint `GET orders/:id`.
Las rutas publicas/privadas exactas y sus clasificadores se contrastan en
`test/identity/app-module-security.spec.ts`; el codigo, no el conteo historico de
handlers citado por cortes anteriores, gobierna nuevas ampliaciones.

La migracion 038 retira Eventos y citas y su permiso; no afecta los lectores de
metricas ni `mercadeo.calendar.read`. Ver [53](53-Captacion-Leads-Reporte-Federado.md).

Actualizacion autorizada 20/10/2026: el usuario habilito el esquema de ordenes
de venta y su persistencia interna de estados/aprobaciones. Ver documento 38.
Desde el corte 2026-10-22 existe tambien el endpoint de lectura del contador;
ese corte inicial no incluia mutaciones; la ampliacion 2026-10-26 registra los comandos acotados descritos en el inventario siguiente.

## Inventario contrastado - 2026-10-23

`src/app.module.ts` registra `ApprovalSummaryModule`, `ContractSummaryModule`, `HomeSummaryModule` y `MarketingHomeModule`: resumenes de lectura. El corte posterior registra ContractTransitionModule para send/revert/set-stage y el seguimiento federado; no registra el listado contractual independiente. `src/modules/crm/marketing` contiene el resumen de leads/citas; `src/modules/crm/leads` contiene tablas e historia; `src/modules/crm/calendar` contiene tipos de tablas, sin modulo/controlador de agenda. `AuditReadController` registra el timeline nativo. El adapter legacy aporta lectores de Mercadeo, no importacion. Detalle de cobertura: [49](49-Estado-Actual-y-Cierre-Documental.md).

### Inventario del corte 2026-10-22

Fuentes ejecutables: `src/common/security` (autenticacion/cuotas), `src/common/health`, `src/common/filters`, `src/modules/crm/identity`, modulos de catalogos/expedientes y `src/modules/crm/sales/sales-orders` (persistencia y summary). Las migraciones incrementales viven en `migrations/schema-only`, no en la carpeta ilustrativa del blueprint. Swagger opcional se genera desde controladores registrados; no es contrato estatico exclusivo de identidad.

Ver [registro de entrega](36-Registro-Entrega-Administracion.md) y [remediacion](Reauditoria-54-Plan-y-Resultados.md). Las estructuras futuras y el primer slice descritos debajo son planificacion historica; no prueban existencia de carpetas, usuarios dedicados ni migraciones aplicadas actualmente.

## Proposito

Este documento responde una pregunta practica:

```txt
Si voy a construir algo en el API, en que carpeta va y que reglas debo leer?
```

Debe usarse antes de crear modulos, endpoints, repositorios, migraciones, integraciones, jobs o reglas de negocio.

Antecedente de la ley `0.3.19`: el primer runtime se limito a identidad. Para alcance vigente usar las ampliaciones fechadas de la ley y el inventario anterior; no inferir autorizacion para verticales futuras.

Para el primer corte ejecutable, identidad manda. `23-Alcance-P0-Vertical-Leads.md` aplica despues de cerrar identidad, usuarios, roles, permisos, contrato canonico y modelo MySQL minimo.

## Regla principal

El API es la fuente de verdad de:

- reglas de negocio;
- permisos efectivos;
- auditoria;
- bitacora;
- integraciones externas;
- normalizacion de datos;
- contratos publicos para frontend.

El frontend nunca decide permisos finales, estados finales, integraciones ni transformaciones de proveedores externos.

## Mapa de carpetas

| Carpeta | Que va aqui | Que no va aqui | Leer antes |
| --- | --- | --- | --- |
| `src/modules/crm/leads` (actual); `sales/leads` (blueprint) | Tablas/historia actuales; CRUD de ventas futuro. | Integraciones directas, payloads externos, reglas de frontend. | `11`, `12`, `13`, `19`, `21`, `43`, `44`. |
| `src/modules/crm/sales/opportunities` | Oportunidades creadas desde lead. | Estimaciones u ordenes de venta. | `15`. |
| `src/modules/crm/sales/estimates` | Estimaciones despues de oportunidad. | Ordenes de venta o formalizaciones. | `15`. |
| `src/modules/crm/sales/sales-orders` | Ordenes de venta, pre-reserva, reserva y avance a contrato. | Formalizacion operativa completa. | `15`, `16`. |
| `src/modules/crm/formalizations` | Flujo posterior de formalizacion cuando el alcance lo apruebe. | Reglas de leads iniciales. | `16`. |
| `src/modules/crm/calendar` | Tipos de tablas actuales del esquema 034; reglas de agenda, participantes y sincronizacion futuras. | Agenda HTTP o Graph operativo por la sola existencia del esquema. | `17`, `47`. |
| `src/modules/crm/notes` | Notas persistidas, sticky notes, anotaciones y permisos de notas. | Envio directo por Kapso/correo/Microsoft. | `18`. |
| `src/modules/crm/permissions` | Calculo de permisos efectivos, grants y denials. Delegacion temporal queda fuera de S1A. | Permisos calculados en frontend. | `05`, `09`, `21`. |
| `src/modules/crm/audit` | Auditoria tecnica, eventos sensibles y fachada HTTP actual del timeline nativo de Leads. El lector/contrato de historia vive en `crm/leads`. | Importar historia legacy o exponer comandos comerciales sin autorizacion. | `05`, `13`, `37`, `44`. |
| `src/modules/crm/identity/ports` | Interfaces estables para proveedores externos usados por identidad. | Implementaciones concretas. | `04`, `11`. |
| `src/integrations/netsuite` | Cliente, DTOs, mappers y errores especificos de NetSuite. | Reglas core del CRM. | `04`. |
| `src/integrations/odoo` | Cliente, DTOs, mappers y errores especificos de Odoo. | Reglas core del CRM. | `04`. |
| `src/integrations/kapso` | Mensajeria, templates, webhooks y mappers de Kapso. | UI o reglas de lead core. | `04`, `13`. |
| `src/integrations/microsoft365` | Entra ID OIDC, MSAL Node, Graph photo con timeout y adapters tecnicos Microsoft. | Reglas CRM de calendario, permisos o negocio. | `04`, `17`, `24`, `33`. |
| `src/integrations/legacy-crm` | Lectura temporal del CRM viejo y mapeo a contrato canonico. | Nuevas reglas de negocio. | `10`, `11`. |
| `src/database` | Conexion Kysely, tipos DB y utilidades de persistencia para `CRM_THINK_V2`. | SQL de negocio en controllers, lectura del CRM viejo o payloads de proveedores. | `12`. |
| `migrations/schema-only` | Migraciones versionadas reales; `SQL/034` es fuente estatica del calendario. | Datos sensibles o credenciales; no usar `database/migrations` del blueprint como ruta actual. | `03`, `12`, `21`. |
| `openapi` | Contratos OpenAPI publicados. | Reglas no implementadas sin marcar como futuras. | `11`, `13`, `21`. |

## Flujo de dependencia permitido

```mermaid
flowchart TD
  Controller[Controller DTO] --> UseCase[Application use case]
  UseCase --> Domain[Domain rule]
  UseCase --> RepositoryPort[Repository/port]
  RepositoryPort --> KyselyAdapter[Kysely adapter]
  UseCase --> IntegrationPort[Integration port]
  IntegrationPort --> ProviderAdapter[Provider adapter]
```

Regla:

```txt
CRM core -> ports -> adapters
```

Regla de independencia:

```txt
CRM_THINK_V2 != CRM viejo != NetSuite != Odoo != Kapso.
```

Cada fuente/proveedor se implementa y se desconecta por su carpeta. El CRM viejo solo puede vivir en `src/integrations/legacy-crm`; NetSuite solo en `src/integrations/netsuite`; Odoo solo en `src/integrations/odoo`; Kapso solo en `src/integrations/kapso`. Lo global se limita a configuracion, seguridad, conexion a la base nueva y puertos compartidos.

Conexion legacy aprobada:

```txt
src/database -> DB_NAME -> CRM_THINK_V2
src/integrations/legacy-crm -> LEGACY_CRM_DB_NAME -> base vieja
```

El adapter actual reutiliza `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` y `DB_SSL_CA`, con nombre legacy separado. No existen variables implementadas `LEGACY_CRM_DB_USER`/`LEGACY_CRM_DB_PASSWORD`. Separar cuentas y privilegios es pendiente DBA; la transaccion de lectura no limita por si sola las credenciales. Los seis escritores de catalogos requieren ambos flags, produccion y destino exacto. El escritor contractual preparado usa una compuerta distinta (ambos flags y destino exacto, sin exigir produccion), y sus comandos HTTP acotados ya estan registrados; no confundir ambas politicas ni activarlos desde esta guia. No cambiar `DB_NAME` al CRM viejo.

Nunca:

```txt
CRM core -> provider concreto
Controller -> Kysely
Frontend -> proveedor externo
CRM nuevo -> query directa al CRM viejo
```

## Primer vertical slice historico

El desarrollo real aprobado por la ley `0.3.19` debe ser identidad:

1. Leer `33-Contrato-API-Identidad-P0-S1.md`.
2. Crear bootstrap NestJS minimo solo para identidad.
3. Configurar Kysely/MySQL solo contra `CRM_THINK_V2`.
4. Preparar contrato de sesion/usuario actual.
5. Preparar autenticacion BFF con Microsoft como login principal.
6. Preparar login local por invitacion/reset seguro.
7. Exponer usuario actual sin tokens en frontend.
8. Exponer permisos efectivos basicos.
9. Registrar auditoria de seguridad.
10. Respetar `permission_version_user` para revocacion de permisos.

No entra todavia:

- leads;
- sincronizacion completa con ERP;
- migracion historica completa;
- perdida automatica;
- formalizacion completa;
- pausa/perdida/dashboard hasta P0-S2;
- calendarios, notas y permisos delegados.
- usuarios inventados, credenciales seed o datos reales de clientes.

## Vertical comercial futuro

Despues de cerrar identidad, el siguiente corte comercial sera:

1. Crear lead canonico.
2. Crear contacto si aplica.
3. Crear estado operativo del lead.
4. Crear timeline `lead_created`.
5. Registrar auditoria basica.
6. Devolver JSON canonico.
7. Listar leads con paginacion.
8. Obtener detalle de lead.

## Checklist para cualquier cambio API

Antes de tocar codigo:

1. Confirmar modulo correcto.
2. Leer documentos de arquitectura relacionados.
3. Verificar si existe contrato OpenAPI.
4. Verificar si requiere migracion.
5. Verificar si requiere timeline.
6. Verificar si requiere auditoria.
7. Verificar permisos efectivos.
8. Verificar si debe generar outbox.
9. Confirmar que el producto, modelo y contrato P0 ya fueron aprobados.
10. Solo entonces recrear runtime e implementar con pnpm.
11. Cuando exista runtime, ejecutar `pnpm run typecheck` y `pnpm run build`.

## Estado del corte inicial de identidad (historico)

| Elemento | Estado |
| --- | --- |
| Esqueleto NestJS | Autorizado solo como runtime minimo de identidad por ley vigente `0.3.28`; no autoriza modulos comerciales. |
| Kysely/mysql2 | Autorizado para runner schema-only y runtime minimo de identidad contra `CRM_THINK_V2`. |
| SQL identidad P0-S1 | Esquema validado y seed de catalogos S1A ejecutado en `CRM_THINK_V2`; usuarios, credenciales y datos de negocio siguen fuera. |
| Contrato API identidad | Creado como documento conceptual; no es OpenAPI ejecutable. |
| OpenAPI identidad | Permitido solo si se limita al contrato minimo de identidad; OpenAPI comercial sigue prohibido. |
| Primer vertical slice real | Identidad; aprobado como runtime minimo por ley `0.3.28`. |
| MySQL `.env` local | Existe para runtime minimo con usuario dedicado; no debe contener usuario master compartido ni usarse para DDL. |
| Runner schema-only | Creado con pnpm/Kysely/mysql2; `SQL/003` aplicado por runner idempotente con usuario dedicado de migracion schema-only. |
| Migracion aplicada en DB | `SQL/001` registrado por marca manual equivalente; `SQL/002` ejecutado solo como catalogos S1A; `SQL/003` aplicado y registrado como `202609250003_identity_login_readiness`. `SQL/004` queda creado y registrado en runner como `202609280004_identity_microsoft_session`; para produccion debe verificarse su aplicacion en el ambiente objetivo antes de activar Microsoft. |
