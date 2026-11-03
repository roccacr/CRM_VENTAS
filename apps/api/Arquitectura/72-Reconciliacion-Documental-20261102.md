# 72 — Reconciliación documental integral del 2 de noviembre de 2026

## Corte histórico sustituido

El inventario vigente y la revisión archivo por archivo del 2026-11-03 están en [85](85-Reconciliacion-Documental-20261103.md). Este informe conserva exactamente el corte del02/11: sus afirmaciones de receptor sin escritor, Graph pendiente, adéndum pendiente,55 migraciones y resultados de checks corresponden a esa fecha. No describen los cambios posteriores ni deben sumarse a las pruebas actuales.

Fecha de corte: **2026-11-02, America/Costa_Rica**.
Checkout: `CRM VERION NESTJS`; HEAD inspeccionado:
`fcbf0c20ff172c8542f7d20785b75ee0a18cb845`.
Estado: revisión documental y verificaciones locales; no certificación productiva.

## 1. Alcance, precedencia y método

Se contrastó el historial **alcanzable desde HEAD**, el árbol de trabajo y los
contratos API/UI, esquemas, pruebas, herramientas y operación documentada. Los35
commits de este checkout van de `16f03a3` (25sept) a `fcbf0c2` (30oct). Los1.150
commits de `git log --all` incluyen ramas legacy/Kapso: no son35 entregas extra
ni código ejecutado por este CRM. No se hizo checkout de esas ramas.

Se revisaron archivos de los commits, no solo sus títulos. `bf8caa5` modifica433
archivos e incorpora implementación, pruebas y despliegue aunque se titula
`docs`. `fd3cc1d` cambia logging, SuiteScript y pruebas; `fcbf0c2` añade la
excepción temporal del emisor Sandbox. Cambios locales057 y plan70 se inventarían
aparte: no están acreditados por ese HEAD ni por la publicación del29.

La ley de producto [00](00-Producto-CRM-TINK-y-P0.md), los contratos actuales y
los mapas [API22](22-Mapa-de-Implementacion-API.md) y
[frontend30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md)
prevalecen sobre blueprints y pausas históricas. Esta revisión actualiza la
documentación de lo solicitado/implementado; no amplía por inferencia el producto.
Las propuestas continúan como propuestas y la evidencia fechada no se redató.

Plan ejecutado:

1. Inventariar commits, cambios locales, archivos y documentación propia.
2. Distribuir revisión API/BD, frontend y auditoría transversal independiente.
3. Contrastar rutas, permisos, fuentes, estados visuales, scripts y evidencias.
4. Actualizar documentos existentes, índices, entrada, operación y pendientes.
5. Verificar enlaces locales, cobertura por área y checks disponibles.
6. Registrar fallos, exclusiones y aceptación todavía necesaria, sin fabricar cierres.

Se aplicaron las skills de guardrails, documentación y verificación; no se
instalaron dependencias ni nuevas skills. No se ejecutaron migraciones, imports,
comandos de negocio, SSH, publicaciones, operaciones NetSuite/Graph ni cambios de
credenciales. No se leyó configuración privada para divulgarla en documentos.

## 2. Inventario estructural inicial

Conteos obtenidos de archivos propios rastreados y no rastreados, excluyendo
dependencias, builds, cobertura y paquetes de skills locales:

| Superficie | Inventario de partida |
| --- | --- |
| Archivos propios | 1.142 |
| Markdown | 130, antes de agregar este informe |
| Fuente API/frontend | 528:312 API +216 frontend |
| Dominios en `modules/crm` | 17 |
| Áreas frontend en `modules` | 6 |
| Archivos `*.module.ts` API | 24 |
| Declaraciones `@Controller` | 31 |
| Decoradores HTTP en fuente | 119; conteo estático, no prueba de rutas desplegadas |
| Archivos de `schema-only` | 56:55 migraciones registradas +1 helper SQL/TypeScript |
| Archivos de pruebas API/frontend | 217/93 |
| Scripts y artefactos operativos | 27 |
| Enlaces Markdown relativos iniciales | 1.000; sin destinos de archivo faltantes |

La existencia de un archivo no acredita que esté registrado, autorizado,
ejecutado, cubierto por pruebas reales o desplegado. La matriz del apéndice
permite rastrear las áreas sin convertir esos conteos en una cobertura semántica
del100%. No se incluyen los PDFs locales ignorados como documentación normativa.

## 3. Estado por capacidad

| Capacidad | Estado contrastado y límites |
| --- | --- |
| Identidad/BFF | Sesión local/Microsoft, CSRF, cookies, permissionVersion, usuarios/roles, deny prioritario y auditoría implementados; correo/reset operativo y sesiones reales conservan sus criterios de aceptación |
| Catálogos | Proyectos, campañas, clases, corredores, expedientes, subsidiarias y ubicaciones tienen contratos, esquemas y consumidores dedicados; no son métricas ficticias ni imports implícitos |
| Leads | Esquema nativo, referencias externas, etapas/motivos e historial están separados del adaptador antiguo; no implica CRUD completo o ficha pública de lead |
| Auditoría | Auditoría central y bitácoras especializadas preservan actor, fuente, cambios y recibos según cada comando; no se importó historia legacy por esta revisión |
| Formalización | Home, seguimiento, consulta de orden, capítulos NetSuite/BD, cliente/unidad/historial y comandos implementados se documentan en22/52/63–65; no llamar demo a toda Información primaria |
| Permisos de Formalización | Banners controlan contadores/listas; `formalizacion.orders.read` permite ficha independientemente. Ambos roles gestionan todas las órdenes con permiso de acción, respetando deny/versiones/reglas |
| Operación todavía pendiente | Edición comercial general, gestión completa de responsables, registro de firma/documentos, bancos, validación conjunta de saldo/traspaso/llaves, correos/adendas/finiquitos y OneDrive no quedan implementados por tener una ficha o etapa |
| Mercadeo | Inicio y Captación federados, prioridad nativa, filtros/series por vendedor y métricas de citas;056 añade `mercadeo.reports.read_all` de forma separada, sin CRUD ni imports |
| Calendario | Lectura y escritura nativas autorizadas, participantes, lookup y vínculos, además de adaptador legacy de lectura; no equivale a sincronización Outlook, correo o editor legacy |
| Notas | Privadas/compartidas, respuestas/menciones, campana, sockets, posiciones/PIN, responsables, vencimientos, recordatorios, historial y Homes adicionales; ACL de nota y permiso comercial son independientes |
| Relaciones de notas | Cliente/lead y orden mediante Select con búsqueda; identidad tipo+fuente+ID, aliases confirmados, principal inmutable, secundarios auditados/idempotentes y captions reautorizados; no se inventaron fichas inexistentes de otros módulos |
| Tiempo real | Persistencia/outbox/reconciliación implementadas; Redis multinodo, latencia y aceptación real entre cuentas no se certifican con mocks ni conteos de suites |
| NetSuite lectura/aprobación | GET y acción PUT de Formalización son flujos distintos; PUT continúa acotado a Sandbox y requiere confirmación. Una lectura o200 genérico no certifica una aprobación |
| NetSuite evento local | Receptor de máquina en development, cuenta Sandbox exacta y acuse `persisted:false`; sin actualización CRM, cola durable ni reconciliación |
| Sincronización durable | [Plan70](70-Plan-Sincronizacion-Ordenes-NetSuite.md), todavía sin escritor; exige evento/versionado, autoridad única, deduplicación, control de mensajes viejos y auditoría confiable |
| Habita | Runbook y recibo del29 existen; no se inspeccionó el servidor hoy ni se comprobó publicación del HEAD/locales actuales |
| Tickets/adjuntos/copia legacy | Una nota colaborativa no es un sistema completo de tickets; adjuntos y copia compatible de notas a legacy no se activan por este corte |

Contratos detallados de notas: [60](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md),
[62](62-Notas-Tiempo-Real-Implementacion.md), [66](66-Notas-Enterprise-Seguimiento.md)
y [68](68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md). Calendario:
[64](64-Calendario-Global-API-y-Contexto.md) y
[68](68-Calendario-Participantes-y-Vinculos.md). Mercadeo:
[46](46-Mercadeo-Resumen-Leads.md), [48](48-Mercadeo-Metricas-Citas.md),
[53](53-Captacion-Leads-Reporte-Federado.md) y [69](69-Mercadeo-Lectura-Global.md).

## 4. Cambios locales y BD

Antes de esta revisión ya estaban modificados el diccionario39, el registro de
migraciones y `sales-orders.tables.ts`; estaban sin rastrear057, su prueba,
el script de flags legacy y plan70. Se conservaron esos cambios sin modificarlos.

La migración057 define siete hechos independientes: unidad entregada,
traspasada, llaves entregadas, validación fideicomiso/prima, comisión aprobada,
comisión del corredor calculada y cuotas completamente pagadas. Native usa
`yes/no/unknown`; legacy admite1/0/NULL. `pagadas_ov` no representa cuotas
completamente pagadas. Ninguna casilla mueve automáticamente una etapa.

[Diccionario39](39-Diccionario-Ordenes-Venta.md) conserva una verificación real
fechada del30. No se volvió a consultar MySQL aquí: no se afirman esos conteos,
hashes o ledger como estado de hoy. El código/plan indican que los lectores y
el escritor de sincronización no están completados por agregar columnas.

El registro nativo contiene55 migraciones:001,003–025 y027–057. `sales-order-stage-duration.sql.ts`
es helper, no otra migración. Los números002/026 corresponden a antecedentes
SQL fuera de esa secuencia registrada. No ejecutar herramientas de DDL/import
para corregir un enlace o actualizar una descripción documental.

## 5. Seguridad, operación y entrega

- `RouteSecurity(public)` del evento local no lo hace anónimo: requiere
  `LocalServiceToken`, flag explícito, secreto exclusivo y development. Solo
  ese método sustituye CSRF por prueba de máquina. Producción no lo habilita.
- Logging: query/fragment del URL se eliminan y secretos se censuran antes del
  formato legible de desarrollo; producción retiene JSON compacto. Logs no son
  una copia de snapshots comerciales ni de códigos OAuth.
- SuiteScript declara versión `2026.10.30.4`. La inspección estática del grafo
  AMD validó18 archivos sin ejecutar APIs del proveedor ni generar ZIP.
- El emisor conserva una excepción temporal de credencial directa de Sandbox
  versionada en `fcbf0c2`; se documentó sin copiar su valor. API Secrets y la
  revisión de esa excepción permanecen pendientes. No se rotaron claves.
- El publicador excluye `.env`/llaves, pero no sanea credenciales dentro de JS.
  `verify-release.py` verifica hashes y además puede eliminar archivos del clon
  dentro del release confirmado; no es un diagnóstico puramente read-only.
- [Runbook Habita](../../../deploy/habita/README.md) y
  [recibo del29](../../../deploy/habita/DEPLOYMENT-20261029.md) ya están enlazados
  desde los documentos raíz. Eran los dos documentos sin camino de entrada.
- La configuración de entorno pública es `.env.example` y sus validadores;
  no se reprodujeron los valores de `.env`. Los comandos operativos requieren
  su autorización, preflight, destino exacto y rollback propios.

## 6. Verificación ejecutada en este corte

| Comprobación | Resultado y alcance |
| --- | --- |
| `check-all.cmd` oficial | Falló en format:check API por `SS2_1_LIB_CRM_EjecutarAccion.js`; no ejecutó por esa vía los pasos posteriores |
| API lint independiente | Aprobado, exit0; no convierte el check raíz interrumpido en aprobado |
| API typecheck independiente | Aprobado |
| API tests independientes | 6.961 aprobadas,1 fallida,161 omitidas condicionales;217 archivos (189 pass/1fail/27skip) |
| Fallo API | `test/migrations/identity-schema-migration.spec.ts:98`: expectativa termina en056, registro local incorpora057; no se alteró la prueba para ocultarlo |
| API build independiente | Aprobado; se ejecutó aparte porque el fallo de pruebas interrumpió la cadena anterior |
| Frontend check | Formato aprobado; se detuvo en lint por4 errores existentes descritos debajo |
| Frontend typecheck/tests/build aparte | Tipos aprobados;1270 pruebas aprobadas/1fallida (92 archivos pass/1fail); build separado aprobado |
| MySQL/integraciones reales | No ejecutados; no se usan mocks, omisiones o evidencia de octubre para acreditarlos |
| Enlaces relativos | Final:131 Markdown,1368 referencias locales comprobadas,0 destinos faltantes; todos alcanzables desde documentos raíz |

Frontend lint detectó orden de imports en `CalendarEventDrawer.tsx`,
`CalendarGuestFields.tsx` y `PersonalNotes.tsx`, y complejidad10 frente al máximo8
en `NotesInbox`. Son pendientes técnicos, no cambios documentales corregidos.
La prueba frontend `personal-notes.spec.tsx:161` observó60px en lugar de70px al
mover rápidamente la nota; el resultado aprobado histórico no cierra este fallo.
No se afirmó una causa ni se modificó runtime para hacerlo pasar. Ambas builds
se ejecutaron aparte con exit0; Vite conserva advertencia de chunk grande.
Los logs del corte están en `C:/codex-data/docs-20261102-*.log`; son evidencia
local y no un artefacto publicado en CI. Los números del29 y los de suites
focales se preservan con su fecha; no se suman entre sí.

CI [quality.yml](../../../.github/workflows/quality.yml) contiene check+coverage
por app, más auditoría de dependencias y MySQL **informativos**. La allowlist
MySQL autoriza5 suites; hay27 archivos MySQL descubiertos y22 fuera del grupo.
No se ejecutó CI remoto, cobertura, audit de dependencias ni tests MySQL desde
este cierre. Que el job informativo no bloquee no significa que MySQL pasó.

## 7. Pendientes y criterios de cierre

Los pendientes funcionales/operativos están centralizados en
[Pendiente Roberto](../../../Pendiente%20Roberto.md), sin marcar como hechas
decisiones aún abiertas. Prioridades de este corte:

1. Corregir formato SuiteScript, expectativa057, los4 errores de lint frontend e
   investigar el movimiento60px/70px en la prueba de notas;
   después repetir el check raíz completo. Esta tarea no cambia código runtime.
2. Resolver API Secrets del emisor, versión/identidad de eventos y actor de
   integración antes del escritor durable; no habilitar producción por un acuse.
3. Completar aceptación de permisos por cuentas reales, SQL de relaciones,
   Redis multinodo y tiempos/carga. El timeout del29 es evidencia histórica;
   no se volvió a comprobar disponibilidad MySQL el02/11.
4. Continuar las funciones de Formalización, tickets/documentos y correo que el
   propietario mantiene pendientes; conservar alcance y reglas confirmadas.
5. Validar servicios/release en su entorno solo cuando exista una tarea
   operativa autorizada, separada de esta reconciliación documental.

Los apéndices siguientes inventarían cada dominio, herramienta, commit y
documento inicial, de modo que nuevas entregas puedan actualizar su fila y
contrato sin depender de esta conversación.

### Recibos locales y cierre documental

| Evidencia | Archivo local | Exit |
| --- | --- | --- |
| Comando raíz | `C:/codex-data/docs-20261102-check-all.log` | 1 |
| API lint | `C:/codex-data/docs-20261102-api-lint.log` | 0 |
| API tipos y pruebas | `C:/codex-data/docs-20261102-api-validation.log` | 1 por prueba de registro; tipos sí terminaron0 |
| API build aparte | `C:/codex-data/docs-20261102-api-build.log` | 0 |
| Frontend check | `C:/codex-data/docs-20261102-frontend-check.log` | 1 por lint; formato sí aprobó |
| Frontend tipos y pruebas | `C:/codex-data/docs-20261102-frontend-validation.log` | 1 por movimiento; tipos sí terminaron0 |
| Frontend build aparte | `C:/codex-data/docs-20261102-frontend-build.log` | 0 |
| Inventario independiente | `C:/codex-data/crm-docs-nov02-independent-inventory.json` | Lectura estructural, sin mutación |
| Enlaces/grafo final | `C:/codex-data/crm-docs-nov02-independent-final-links.json` | 0 destinos faltantes |

Se revisó el diff documental y se preservaron los cambios locales de código
preexistentes. Las verificaciones de enlaces cubren existencia de archivos y
conectividad del grafo documental; no anchors, URLs externas, permisos remotos ni
veracidad de cada frase histórica. Los131 documentos son accesibles desde las
entradas raíz; no se borró ninguno de los130 iniciales. El lector encuentra
estado/contrato/pendiente por área sin confundir una propuesta con implementación.

Como comprobación adicional,46 anclas Markdown se contrastaron con encabezados
locales mediante un cálculo de slug compatible de forma aproximada con GitHub;
no se encontraron discrepancias. Esto no acredita el render de cada plataforma
ni sustituye validación de URLs externas. Evidencia local:
`C:/codex-data/docs-20261102-anchor-candidates.json`.

La revisión dejó59 archivos documentales con cambios:58 existentes actualizados
y este informe nuevo, preservando las modificaciones previas de39 y70. No se
modificó código para convertir en verdes los fallos encontrados.

<!-- INVENTARIO-GENERADO-DEL-CORTE: conservar las tablas con su fecha; no son prueba de despliegue. -->

## Apéndice A — Cobertura de dominios y capas

| Dominio API | Archivos fuente | Contratos revisados |
| --- | --- | --- |
| audit | 15 | [37-Auditoria-Trazabilidad-y-Conflictos.md](37-Auditoria-Trazabilidad-y-Conflictos.md), [44-Bitacora-Legacy-y-Timeline.md](44-Bitacora-Legacy-y-Timeline.md) |
| brokers | 8 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| calendar | 11 | [64-Calendario-Global-API-y-Contexto.md](64-Calendario-Global-API-y-Contexto.md), [68-Calendario-Participantes-y-Vinculos.md](68-Calendario-Participantes-y-Vinculos.md) |
| campaigns | 7 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| catalog-policy | 1 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| catalogs | 8 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| classes | 7 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| identity | 27 | [31-Contrato-Identidad-y-Permisos-P0-S1.md](31-Contrato-Identidad-y-Permisos-P0-S1.md), [33-Contrato-API-Identidad-P0-S1.md](33-Contrato-API-Identidad-P0-S1.md) |
| leads | 5 | [43-Leads-Esquema-Nativo.md](43-Leads-Esquema-Nativo.md), [44-Bitacora-Legacy-y-Timeline.md](44-Bitacora-Legacy-y-Timeline.md) |
| locations | 7 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| marketing | 17 | [46-Mercadeo-Resumen-Leads.md](46-Mercadeo-Resumen-Leads.md), [48-Mercadeo-Metricas-Citas.md](48-Mercadeo-Metricas-Citas.md), [53-Captacion-Leads-Reporte-Federado.md](53-Captacion-Leads-Reporte-Federado.md), [69-Mercadeo-Lectura-Global.md](69-Mercadeo-Lectura-Global.md) |
| notes | 34 | [60-Notas-Etapa4-Colaboracion-y-Notificaciones.md](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md), [62-Notas-Tiempo-Real-Implementacion.md](62-Notas-Tiempo-Real-Implementacion.md), [66-Notas-Enterprise-Seguimiento.md](66-Notas-Enterprise-Seguimiento.md), [68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md](68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md) |
| permissions | 4 | [28-Matriz-Roles-Permisos-Areas-P0-S1.md](28-Matriz-Roles-Permisos-Areas-P0-S1.md), [42-Jefaturas-Modulos-y-Permisos.md](42-Jefaturas-Modulos-y-Permisos.md) |
| projects | 6 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| sales | 43 | [38-Ordenes-Venta-Estados-Auditoria.md](38-Ordenes-Venta-Estados-Auditoria.md), [39-Diccionario-Ordenes-Venta.md](39-Diccionario-Ordenes-Venta.md), [52-Etapas-Responsables-y-Tiempos.md](52-Etapas-Responsables-y-Tiempos.md), [65-Formalizacion-Correcciones-Roles-y-Recuperacion.md](65-Formalizacion-Correcciones-Roles-y-Recuperacion.md) |
| subsidiaries | 8 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |
| unit-files | 11 | [35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) |

Además de esos dominios, se inspeccionaron `app.module.ts`, bootstrap y health,
configuración/logging, `common/security`, filtros HTTP, pool/database, proveedores
Microsoft365, adaptadores `legacy-crm` y `netsuite`. Registro y límites en22,
seguridad en05/24/33, operación/CI en sus runbooks y contratos ERP en04.

| Área frontend | Archivos fuente | Contrato/inventario |
| --- | --- | --- |
| administration | 65 | [Mapa30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) y contratos de cada consumidor |
| auth | 2 | [Mapa30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) y contratos de cada consumidor |
| calendar | 13 | [Mapa30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) y contratos de cada consumidor |
| home | 58 | [Mapa30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) y contratos de cada consumidor |
| marketing | 12 | [Mapa30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) y contratos de cada consumidor |
| notes | 23 | [Mapa30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) y contratos de cada consumidor |

El mapa30 incluye asimismo rutas, componentes comunes, estado de sesión y los
siete grupos de servicios. Su matriz clasifica los34 documentos de Arquitectura
frontend entre contratos implementados, cortes históricos y blueprints futuros.

## Apéndice B — Herramientas y efectos

No se ejecutaron estas herramientas operativas para actualizar documentación.
La columna indica qué ocurriría al invocarlas, no una acción hecha en este corte.

| Archivo | Responsabilidad / límite |
| --- | --- |
| [apps/api/scripts/run-schema-migrations.ts](../scripts/run-schema-migrations.ts) | DDL nativo y datos de seguridad explícitos; exige autorización y destino confirmado |
| [apps/api/scripts/migrate-legacy-sales-order-flags.ts](../scripts/migrate-legacy-sales-order-flags.ts) | Preflight o DDL aditivo de flags en destino legacy fijo; no importación |
| [apps/api/scripts/migrate-legacy-sales-order-stage-tracking.ts](../scripts/migrate-legacy-sales-order-stage-tracking.ts) | DDL aditivo de tracking legacy; no ejecutar como consulta de documentación |
| [apps/api/scripts/migrate-legacy-calendar-context.ts](../scripts/migrate-legacy-calendar-context.ts) | DDL/trigger legacy, sujeto a permisos y revisión DBA |
| [apps/api/scripts/import-legacy-users.ts](../scripts/import-legacy-users.ts) | Importación explícita de usuarios; no de leads/órdenes ni parte del arranque |
| [apps/api/scripts/clear-native-business-data.ts](../scripts/clear-native-business-data.ts) | Limpieza destructiva bajo guard; nunca equivale a migración normal |
| [apps/api/scripts/restore-owner-from-backup.ts](../scripts/restore-owner-from-backup.ts) | Recuperación de seguridad del Owner con política protegida |
| [apps/api/scripts/prepare-unit-files.ts](../scripts/prepare-unit-files.ts) | Diagnóstico/preparación de expedientes; revisar flags admitidos antes de uso |
| [apps/api/scripts/verify-calendar-relations.ts](../scripts/verify-calendar-relations.ts) | Inspección read-only de metadata/conteos; no crea fixtures |
| [apps/api/scripts/package-netsuite.mjs](../scripts/package-netsuite.mjs) | Inspecciona AST/grafo/hash y prepara ZIP local Windows; no sube a NetSuite |
| [apps/api/scripts/performance/home-summary-benchmark.ts](../scripts/performance/home-summary-benchmark.ts) | Benchmark sintético con dobles; no prueba SLA productivo |
| [apps/api/scripts/performance/home-summary-double.ts](../scripts/performance/home-summary-double.ts) | Helper de identidad/driver sintético; no conexión comercial |
| [apps/api/scripts/performance/home-summary-synthetic.ts](../scripts/performance/home-summary-synthetic.ts) | Modelo/oráculo sintético de benchmark; no datos reales |
| [apps/api/scripts/run-mysql-ci.ts](../scripts/run-mysql-ci.ts) | Guard de MySQL aislado y allowlist de cinco suites; ejecución con efectos en entorno de prueba |
| [apps/api/scripts/ensure-pnpm.mjs](../scripts/ensure-pnpm.mjs) | Guard de gestor/versión pnpm; no instala ni migra por sí mismo |
| [apps/frontend/scripts/ensure-pnpm.mjs](../../frontend/scripts/ensure-pnpm.mjs) | Guard de gestor/versión pnpm; no instala ni migra por sí mismo |
| [scripts/check-all.ps1](../../../scripts/check-all.ps1) | Checks secuenciales de apps; entrada oficial única check-all.cmd |
| [deploy/habita/publish.ps1](../../../deploy/habita/publish.ps1) | Copia fija, builds, transferencia y activación remota; despliegue con efectos |
| [deploy/habita/activate-release.sh](../../../deploy/habita/activate-release.sh) | Instalación runtime, activación de symlink/servicio y rollback remotos |
| [deploy/habita/verify-release.py](../../../deploy/habita/verify-release.py) | Hashes y paths; también poda archivos del clon dentro del release validado |
| [deploy/habita/renewal-hook.sh](../../../deploy/habita/renewal-hook.sh) | Recarga Apache para el certificado indicado |
| [deploy/habita/ecosystem.config.cjs](../../../deploy/habita/ecosystem.config.cjs) | Configuración del proceso PM2 aislado del API |
| [deploy/habita/habita-api.service](../../../deploy/habita/habita-api.service) | Alternativa de recuperación; no ejecutar junto con PM2 |
| [deploy/habita/habita-pm2.service](../../../deploy/habita/habita-pm2.service) | Supervisor PM2 aislado |
| [deploy/habita/apache-http.conf](../../../deploy/habita/apache-http.conf) | Plantilla vhost HTTP/proxy |
| [deploy/habita/apache-https.conf](../../../deploy/habita/apache-https.conf) | Plantilla TLS, SPA, proxy API/WebSocket |
| [apps/api/scripts/sql/legacy-calendar-context-trigger.sql](../scripts/sql/legacy-calendar-context-trigger.sql) | DDL de trigger para revisión/ejecución DBA, no consulta inocua |

Para parámetros y preflight consultar03,40, CI-MySQL-Pruebas y deploy/habita/README;
la existencia del comando no sustituye su autorización ni las credenciales del operador.

## Apéndice C — Los35 commits del corte

Cada fila conserva el asunto original. Los contratos actuales de los apéndices
A/D y los mapas22/30 describen el estado final; no ejecutar código histórico
como si cada commit fuera un producto adicional o un despliegue confirmado.

| Commit | Fecha | Asunto original |
| --- | --- | --- |
| `16f03a3` | 2026-09-25 | chore: add CRM TINK api and frontend baseline |
| `339eb8b` | 2026-09-28 | chore: checkpoint crm tink identity and frontend architecture |
| `4a3d8ec` | 2026-09-30 | feat(auth): close identity authentication cut |
| `dc97992` | 2026-10-01 | feat(identity): add administration users and role security |
| `d2c5c6b` | 2026-10-09 | feat(administration): synchronize catalogs, access controls and documentation |
| `65c4245` | 2026-10-09 | Refine projects catalog table and responsive detail drawer |
| `e28f741` | 2026-10-09 | Polish projects UX and document reusable enterprise design rules |
| `c900224` | 2026-10-12 | feat(projects): implement dedicated project tables, remove legacy importer, and establish owner-only recovery policy |
| `91fecb5` | 2026-10-12 | feat(projects): enhance Projects page with refined layout, improved accessibility, and integrated API total display |
| `9df7cd9` | 2026-10-12 | feat(projects): update Projects layout and functionality with enhanced status display, refined toolbar, and improved accessibility features |
| `1f79e16` | 2026-10-13 | feat(consolidation): implement comprehensive updates across campaigns, classes, locations, subsidiaries, brokers, and unit files with dedicated schemas, enhanced API functionality, and improved audit mechanisms |
| `568a757` | 2026-10-13 | feat(authentication): enhance user session management with local session continuity, initial password assignment, and refined access controls for roles and permissions |
| `c606b23` | 2026-10-20 | feat(formalization): introduce calendar and management features in Formalization module, enhancing navigation and user experience with new routes and visual elements |
| `730462f` | 2026-10-20 | feat(formalization): implement new banner for approval notifications and enhance role management with complementary supervisor role, improving user navigation and access control |
| `6126754` | 2026-10-20 | feat(formalization): update welcome visuals and logo across components, enhancing user experience with improved imagery and layout adjustments |
| `72a0c0e` | 2026-10-20 | feat(branding): update logo source to rocca-concept.png across multiple components, ensuring consistent branding and improved visual quality in the application |
| `af42469` | 2026-10-20 | feat(formalization): enhance visual hierarchy and replace generic icons with custom SVGs, improving aesthetics and user experience in the Formalization module |
| `3d45912` | 2026-10-22 | fix(quality): stabilize import boundary and audit assertions |
| `4b4118f` | 2026-10-22 | feat(sales): persist lifecycle audit and approval summary foundations |
| `4807ec3` | 2026-10-22 | feat(formalization): wire approval banner and retire home sample rows |
| `989e96c` | 2026-10-22 | fix(frontend): restore history and isolate lazy route failures |
| `855742c` | 2026-10-22 | fix(security): deny implicit access and protect legacy mutations |
| `7572b97` | 2026-10-22 | ci: add measured coverage and isolated MySQL verification gates |
| `25521fc` | 2026-10-22 | fix(identity): align disabled reset HTTP metadata |
| `056f9d0` | 2026-10-22 | test(identity): inspect reset metadata without unbound methods |
| `f2dc4f1` | 2026-10-22 | docs(audit): record remediation evidence and unresolved prerequisites |
| `f02e9f5` | 2026-10-22 | docs: reconcile current implementation and historical audit evidence |
| `936a51a` | 2026-10-22 | fix(api): patch Fastify and ip-address security advisories |
| `f9ba243` | 2026-10-22 | fix(auth): enforce declared route permissions before domain operations |
| `dd57624` | 2026-10-22 | docs(audit): record permission enforcement checks and confirmed order authority |
| `049b59c` | 2026-10-23 | docs: update changelog and README with recent migrations, role permissions, and audit enhancements |
| `ce19e12` | 2026-10-27 | docs: update AGENTS, README, and changelog with recent documentation reconciliations, role permissions, and operational limits |
| `bf8caa5` | 2026-10-30 | docs: update AGENTS, README, and changelog with recent QA results, role management clarifications, and documentation enhancements |
| `fd3cc1d` | 2026-10-30 | feat(logging): enhance logging configuration for development and production environments, add ESLint rules for SuiteScript integration, and update documentation for local console behavior |
| `fcbf0c2` | 2026-10-30 | docs(netsuite): update README and SuiteScript to reflect temporary Sandbox credential usage and testing instructions |

## Apéndice D — Inventario de los130 Markdown de partida

Se conserva trazabilidad completa de las portadas, contratos, propuestas y
artefactos documentales encontrados. No se reescriben evidencias antiguas para
simular pruebas nuevas. La entrada actual de API es72/22, y frontend30 clasifica
sus blueprints; cada documento mantiene su función y fecha al leer los detalles.

| Documento | Área / tratamiento de vigencia |
| --- | --- |
| [.archify/architecture-crm-actual-20261026-084555/LEEME.md](../../../.archify/architecture-crm-actual-20261026-084555/LEEME.md) | Artefacto fechado del26; HTML/recibos no regenerados |
| [AGENTS.md](../../../AGENTS.md) | Entrada, seguimiento, reglas, habilidades o historia del repositorio |
| [CHANGELOG.md](../../../CHANGELOG.md) | Entrada, seguimiento, reglas, habilidades o historia del repositorio |
| [Pendiente Roberto.md](../../../Pendiente%20Roberto.md) | Entrada, seguimiento, reglas, habilidades o historia del repositorio |
| [README.md](../../../README.md) | Entrada, seguimiento, reglas, habilidades o historia del repositorio |
| [SKILLS.md](../../../SKILLS.md) | Entrada, seguimiento, reglas, habilidades o historia del repositorio |
| [apps/GUIA-AUTH-CRM-TINK.md](../../GUIA-AUTH-CRM-TINK.md) | Guía transversal BFF y límites de autenticación |
| [apps/api/AGENTS.md](../AGENTS.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/00-Indice.md](00-Indice.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md](00-Producto-CRM-TINK-y-P0.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/01-Resumen-API.md](01-Resumen-API.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/02-Arquitectura-Backend.md](02-Arquitectura-Backend.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/03-Base-Datos-y-Migracion.md](03-Base-Datos-y-Migracion.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/04-Integraciones-ERP.md](04-Integraciones-ERP.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/05-Seguridad-Auditoria-Observabilidad.md](05-Seguridad-Auditoria-Observabilidad.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/06-ADRs-API.md](06-ADRs-API.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/07-Skills-Codex-Instaladas.md](07-Skills-Codex-Instaladas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md](08-Revision-Blueprint-y-Siguiente-Paso.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/09-Decisiones-P0-Permisos-y-Preguntas.md](09-Decisiones-P0-Permisos-y-Preguntas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/10-Analisis-CRM-Actual-Roles-Leads.md](10-Analisis-CRM-Actual-Roles-Leads.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/11-Contrato-Canonico-y-Normalizacion.md](11-Contrato-Canonico-y-Normalizacion.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/12-Modelo-Datos-P0-MySQL-Kysely.md](12-Modelo-Datos-P0-MySQL-Kysely.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/13-Bitacora-Acciones-y-Timeline-Lead.md](13-Bitacora-Acciones-y-Timeline-Lead.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/14-Diccionario-de-Datos-y-Modulos.md](14-Diccionario-de-Datos-y-Modulos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/15-Flujo-Comercial-Lead-a-Contrato.md](15-Flujo-Comercial-Lead-a-Contrato.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/16-Alcance-PDFs-y-Modularizacion-Dominios.md](16-Alcance-PDFs-y-Modularizacion-Dominios.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/17-Calendarios-por-Dominio-y-Supervision.md](17-Calendarios-por-Dominio-y-Supervision.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/18-Notas-Adhesivas-y-Anotaciones.md](18-Notas-Adhesivas-y-Anotaciones.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/19-Reglas-Operativas-Leads-SLA-y-Perdida.md](19-Reglas-Operativas-Leads-SLA-y-Perdida.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/20-Pendientes-Decisiones-y-Preguntas-P0.md](20-Pendientes-Decisiones-y-Preguntas-P0.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/21-P0-Direccion-Tecnica-Construccion-Pausada.md](21-P0-Direccion-Tecnica-Construccion-Pausada.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/22-Mapa-de-Implementacion-API.md](22-Mapa-de-Implementacion-API.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/23-Alcance-P0-Vertical-Leads.md](23-Alcance-P0-Vertical-Leads.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/24-Seguridad-Autenticacion-BFF-OIDC-Local.md](24-Seguridad-Autenticacion-BFF-OIDC-Local.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/25-Contrato-Canonico-Minimo-Lead-P0-S1.md](25-Contrato-Canonico-Minimo-Lead-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/26-Estandar-Nombres-Base-Datos.md](26-Estandar-Nombres-Base-Datos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/27-Identidad-Usuarios-Roles-P0-S1.md](27-Identidad-Usuarios-Roles-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/28-Matriz-Roles-Permisos-Areas-P0-S1.md](28-Matriz-Roles-Permisos-Areas-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/29-Modelo-Fisico-MySQL-Identidad-P0-S1.md](29-Modelo-Fisico-MySQL-Identidad-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/30-Identidad-Canonica-y-Referencias-Externas.md](30-Identidad-Canonica-y-Referencias-Externas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/31-Contrato-Identidad-y-Permisos-P0-S1.md](31-Contrato-Identidad-y-Permisos-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/32-Seeds-Identidad-P0-S1.md](32-Seeds-Identidad-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/33-Contrato-API-Identidad-P0-S1.md](33-Contrato-API-Identidad-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/34-Cierre-Operativo-Administracion-P0-S1.md](34-Cierre-Operativo-Administracion-P0-S1.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/35-Catalog-API-and-Schema.md](35-Catalog-API-and-Schema.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/36-Registro-Entrega-Administracion.md](36-Registro-Entrega-Administracion.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/37-Auditoria-Trazabilidad-y-Conflictos.md](37-Auditoria-Trazabilidad-y-Conflictos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md](38-Ordenes-Venta-Estados-Auditoria.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/39-Diccionario-Ordenes-Venta.md](39-Diccionario-Ordenes-Venta.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md](40-Formalizacion-Home-Resumen-y-Rendimiento.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/41-Owner-Herencia-y-Denegaciones.md](41-Owner-Herencia-y-Denegaciones.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/42-Jefaturas-Modulos-y-Permisos.md](42-Jefaturas-Modulos-y-Permisos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/43-Leads-Esquema-Nativo.md](43-Leads-Esquema-Nativo.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/44-Bitacora-Legacy-y-Timeline.md](44-Bitacora-Legacy-y-Timeline.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/45-Usuarios-Por-Correo.md](45-Usuarios-Por-Correo.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/46-Mercadeo-Resumen-Leads.md](46-Mercadeo-Resumen-Leads.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/47-Calendario-Compartido-Esquema.md](47-Calendario-Compartido-Esquema.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/48-Mercadeo-Metricas-Citas.md](48-Mercadeo-Metricas-Citas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md](49-Estado-Actual-y-Cierre-Documental.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/50-Plan-Seguimiento-Formalizacion.md](50-Plan-Seguimiento-Formalizacion.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/51-Limpieza-Datos-Nativos.md](51-Limpieza-Datos-Nativos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/52-Etapas-Responsables-y-Tiempos.md](52-Etapas-Responsables-y-Tiempos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md](53-Captacion-Leads-Reporte-Federado.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/55-Revision-Documental-Integral-20261027.md](55-Revision-Documental-Integral-20261027.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/56-Orden-Bitacora-y-Expediente-Lectura.md](56-Orden-Bitacora-y-Expediente-Lectura.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/56-Plan-Notas-Colaborativas-y-Convivencia-Legacy.md](56-Plan-Notas-Colaborativas-y-Convivencia-Legacy.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/57-Notas-Etapa2-API.md](57-Notas-Etapa2-API.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/58-Notas-Etapa3-Interfaz-Personal.md](58-Notas-Etapa3-Interfaz-Personal.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/59-Notas-Contexto-Opcional-y-Vistas.md](59-Notas-Contexto-Opcional-y-Vistas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/61-Plan-Notas-Tiempo-Real.md](61-Plan-Notas-Tiempo-Real.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md](62-Notas-Tiempo-Real-Implementacion.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/63-Aprobacion-Formalizacion-NetSuite.md](63-Aprobacion-Formalizacion-NetSuite.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/63-Formalizacion-Lectura-Por-Banner.md](63-Formalizacion-Lectura-Por-Banner.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/64-Calendario-Global-API-y-Contexto.md](64-Calendario-Global-API-y-Contexto.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/64-Formalizacion-Permiso-Ver-Orden.md](64-Formalizacion-Permiso-Ver-Orden.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/65-Formalizacion-Correcciones-Roles-y-Recuperacion.md](65-Formalizacion-Correcciones-Roles-y-Recuperacion.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/66-Notas-Enterprise-Seguimiento.md](66-Notas-Enterprise-Seguimiento.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/67-Plan-QA-Regresiones-20261029.md](67-Plan-QA-Regresiones-20261029.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/68-Calendario-Participantes-y-Vinculos.md](68-Calendario-Participantes-y-Vinculos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md](68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/69-Mercadeo-Lectura-Global.md](69-Mercadeo-Lectura-Global.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/70-Plan-Sincronizacion-Ordenes-NetSuite.md](70-Plan-Sincronizacion-Ordenes-NetSuite.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/CI-MySQL-Pruebas.md](CI-MySQL-Pruebas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/Diccionario-Datos/01-Identidad-y-Permisos.md](Diccionario-Datos/01-Identidad-y-Permisos.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/Diccionario-Datos/12-Notas-Colaborativas.md](Diccionario-Datos/12-Notas-Colaborativas.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/Operacion-Despliegue-Rollback.md](Operacion-Despliegue-Rollback.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/Plan-Correctivo-Auditoria-CRM-TINK.md](Plan-Correctivo-Auditoria-CRM-TINK.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md](Reauditoria-54-Plan-y-Resultados.md) | Contrato/mapa API o blueprint; portadas actuales22/72 y ley00 |
| [apps/api/src/integrations/netsuite/README.md](../src/integrations/netsuite/README.md) | Contrato ERP/paquete; distinguir recepción, lectura y escritura |
| [apps/api/src/integrations/netsuite/suitescript/README.md](../src/integrations/netsuite/suitescript/README.md) | Contrato ERP/paquete; distinguir recepción, lectura y escritura |
| [apps/frontend/AGENTS.md](../../frontend/AGENTS.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/00-Indice.md](../../frontend/Arquitectura/00-Indice.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md](../../frontend/Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/01-Resumen-Frontend.md](../../frontend/Arquitectura/01-Resumen-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/02-Arquitectura-Frontend.md](../../frontend/Arquitectura/02-Arquitectura-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/03-UI-UX-CRM.md](../../frontend/Arquitectura/03-UI-UX-CRM.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/04-API-Client-y-Estado.md](../../frontend/Arquitectura/04-API-Client-y-Estado.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/05-Testing-Frontend.md](../../frontend/Arquitectura/05-Testing-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/06-ADRs-Frontend.md](../../frontend/Arquitectura/06-ADRs-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/07-Skills-Codex-Instaladas.md](../../frontend/Arquitectura/07-Skills-Codex-Instaladas.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md](../../frontend/Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/09-Decisiones-P0-UX-Permisos-y-Preguntas.md](../../frontend/Arquitectura/09-Decisiones-P0-UX-Permisos-y-Preguntas.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/10-Contrato-Canonico-Frontend.md](../../frontend/Arquitectura/10-Contrato-Canonico-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/11-UX-Bitacora-Acciones-y-Timeline-Lead.md](../../frontend/Arquitectura/11-UX-Bitacora-Acciones-y-Timeline-Lead.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/12-Diccionario-Funcional-y-Acciones-CRM.md](../../frontend/Arquitectura/12-Diccionario-Funcional-y-Acciones-CRM.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/13-Flujo-Comercial-CRM.md](../../frontend/Arquitectura/13-Flujo-Comercial-CRM.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/14-Modularizacion-Frontend-por-Areas-y-Roles.md](../../frontend/Arquitectura/14-Modularizacion-Frontend-por-Areas-y-Roles.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/15-UX-Calendarios-por-Area-y-Supervision.md](../../frontend/Arquitectura/15-UX-Calendarios-por-Area-y-Supervision.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md](../../frontend/Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/17-UX-Dashboard-Leads-SLA-y-Perdida.md](../../frontend/Arquitectura/17-UX-Dashboard-Leads-SLA-y-Perdida.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md](../../frontend/Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/19-Mapa-de-Implementacion-Frontend.md](../../frontend/Arquitectura/19-Mapa-de-Implementacion-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md](../../frontend/Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md](../../frontend/Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md](../../frontend/Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/23-Regla-IDs-Canonicos-y-Proveedores-Frontend.md](../../frontend/Arquitectura/23-Regla-IDs-Canonicos-y-Proveedores-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/24-Contrato-Visual-Identidad-P0-S1.md](../../frontend/Arquitectura/24-Contrato-Visual-Identidad-P0-S1.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/25-Continuidad-Administracion.md](../../frontend/Arquitectura/25-Continuidad-Administracion.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/26-Projects-Design-System.md](../../frontend/Arquitectura/26-Projects-Design-System.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/27-Entrega-Administracion-y-QA.md](../../frontend/Arquitectura/27-Entrega-Administracion-y-QA.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/28-Formalizacion-Recorrido-Visual.md](../../frontend/Arquitectura/28-Formalizacion-Recorrido-Visual.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/29-Formalizacion-Reunion-Ajustes.md](../../frontend/Arquitectura/29-Formalizacion-Reunion-Ajustes.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md](../../frontend/Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/30-Estado-Frontend-Verificado.md](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/Arquitectura/Calendario-Global-Frontend.md](../../frontend/Arquitectura/Calendario-Global-Frontend.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/design-qa.md](../../frontend/design-qa.md) | Contrato/mapa UX o blueprint; clasificación de alcance en30 |
| [apps/frontend/public/Logo/README.md](../../frontend/public/Logo/README.md) | Activos de marca; referencias verificadas sin nueva evaluación visual |
| [deploy/habita/DEPLOYMENT-20261029.md](../../../deploy/habita/DEPLOYMENT-20261029.md) | Operación o recibo de despliegue fechado; no estado remoto actual |
| [deploy/habita/README.md](../../../deploy/habita/README.md) | Operación o recibo de despliegue fechado; no estado remoto actual |

Este informe agrega una nueva entrada al inventario, no reemplaza los130
documentos previos. Las tablas son cobertura estructural y trazabilidad; no
afirman que toda propuesta esté implementada ni que cada afirmación histórica
haya sido probada de nuevo.
