# 36 - Registro de entrega de Administracion

Actualizado: 2026-10-13. Consolidacion del trabajo de esta continuidad, contrastada con el codigo del checkout. No acredita despliegue, estado actual de produccion ni aceptacion final del Owner. Los resultados anteriores se identifican como evidencia historica, no como pruebas ejecutadas durante esta actualizacion documental.

## Lectura y autoridad

- [Ley de producto](00-Producto-CRM-TINK-y-P0.md): alcance aprobado; Administracion antes de Leads.
- [Cierre operativo](34-Cierre-Operativo-Administracion-P0-S1.md): antecedentes, seguridad y compuertas de aceptacion.
- [Catalogos, esquema y migracion](35-Catalog-API-and-Schema.md): contratos, fuentes y restricciones por dominio.
- [Auditoria y conflictos](37-Auditoria-Trazabilidad-y-Conflictos.md): historial transaccional y errores de permisos.
- [Entrega visual y QA](../../frontend/Arquitectura/27-Entrega-Administracion-y-QA.md): comportamiento vigente y pruebas manuales.

Este registro describe implementacion existente, no autoriza nuevas migraciones ni operaciones productivas. Las secciones historicas fechadas de documentos anteriores conservan su valor como evidencia; las decisiones vigentes de este registro sustituyen sus descripciones obsoletas de carga incremental y almacenamiento compartido.

## Matriz de trazabilidad

Las rutas de codigo y pruebas son relativas a su aplicacion. Una prueba existente no equivale a una prueba ejecutada ni a cobertura total.

| Solicitud / decision | Implementacion y regla vigente | Evidencia verificable | Estado / limite |
| --- | --- | --- | --- |
| Replicar Proyectos en Campanas | `src/modules/crm/campaigns`, adaptador `src/integrations/legacy-crm/campaigns`; agregado propio y contrato canonico | `test/catalogs/campaigns*`, `test/integrations/legacy-campaigns.writer.spec.ts`; migracion 010 | Construido; DML legacy real requiere autorizacion y aceptacion separadas |
| Clases con el mismo patron | Carpetas `classes`; nombres maximo 100, estado 1 activo / 0 o null inactivo | `test/catalogs/classes*`, `test/integrations/legacy-classes*`; migracion 011 | Construido; no borrar ni fusionar origen automaticamente |
| Ubicaciones | Carpetas `locations`; nombres maximo 100 y referencias por proveedor | `test/catalogs/locations*`, `test/integrations/legacy-locations*`; migracion 012 | Construido; mismas restricciones de sincronizacion |
| Subsidiarias | Carpetas `subsidiaries`; nombres maximo 250 | `test/catalogs/subsidiaries*`, `test/integrations/legacy-subsidiaries*`; migracion 013 | Construido; duplicidad historica de proveedor 63 pendiente de resolver |
| Corredores sin columnas obsoletas | Carpetas `brokers`; solo PK, identificador proveedor, nombre y estado del origen; nombre maximo 250 | `test/catalogs/brokers*`, `test/integrations/legacy-brokers*`; migracion 014 | Construido; categoria, empresa, telefono, correo y valoridNetsuite no se incorporan |
| Paginacion real y retorno sin consultas repetidas | Frontend `catalogs/CatalogItemsPage.tsx`; limit/offset, total filtrado, cache local de 20 paginas | Frontend `test/catalogs/CatalogItemsPage.spec.tsx` | Construido; no es snapshot consistente entre escrituras concurrentes |
| Inventario de expedientes sin carga masiva | `src/modules/crm/unit-files`, adaptador `legacy-crm/unit-files`, criterios antes de consultar, keyset | `test/unit-files/*`; migraciones 015 y 016 | Vista y API de lectura construidas; inventario no importado en la preparacion registrada |
| Proyecto CRM y multiples proveedores | FK interna a `crm_project`; referencias externas en tabla hija, traduccion solo en adaptador | `unit-files.contract.ts`, `unit-files.columns.ts`, `unit-files-legacy.port.ts` | Construido; relaciones ambiguas no se inventan |
| Filtros completos aunque solo exista una pagina en memoria | `/unit-files/facets`, conteos del alcance completo; SearchPanes nativo | `test/unit-files/unit-files-search.spec.ts`; frontend `test/unit-files/*` | Construido; agregaciones limitan salida, no garantizan ausencia de escaneo |
| Comparacion legible y ranking | Frontend `unit-files/UnitFilesComparison.tsx`; costos menores y areas mayores favorecidos | Frontend `test/unit-files/*` | Construido; maximo actual ocho expedientes, no puntuacion financiera global |
| Planos como enlace | Frontend `UnitFilesPage.tsx`; solo URL HTTP/HTTPS valida, pestana nueva y noopener/noreferrer | Frontend `test/unit-files/*` | Construido; no convierte otros valores arbitrarios en enlaces |
| Roles por modulo y seccion | Frontend `roles-security-sections.ts`, `RolePermissionHierarchy.tsx`, `RolePermissionSection.tsx` | Frontend `test/administration/RolePermissionHierarchy.spec.tsx`, `RolesSecurityPage.spec.tsx` | Construido; catalogo API determina secciones disponibles |
| Auditoria antes/despues y referencia exacta | `audit-change-set.ts`, `audit-read.*`, repositorios de identidad y catalogos | `test/audit/*` | Construido para escritores instrumentados; no captura cambios SQL externos |
| Mensajes de eventos legibles | Frontend `audit-event-description.ts` | Frontend `test/administration/audit-event-description.spec.ts` | Construido; codigos tecnicos permanecen internos |
| 409 al actualizar permisos | Frontend `services/api/api-client.ts`; solo conflicto de version de permisos renueva sesion | Frontend `test/app/api-client-conflicts.spec.ts` | Corregido; conflictos de negocio no se reenvian |
| Conexion reiniciada y resultado de guardado incierto | Frontend `RolesSecurityPage.tsx`; mensaje explicito, sin replay de mutacion | Frontend `test/administration/RolesSecurityPage.spec.tsx` | Tratamiento construido; causa historica del reset no reproducida |

## Arquitectura y reglas compartidas

CRM_THINK_V2 es la fuente primaria del nuevo CRM. El legacy es una dependencia transitoria aislada, no el contrato publico. API NestJS/Fastify, TypeScript estricto, Kysely/mysql2; frontend React/Vite, DataTables/SearchPanes y Ant Design. Las aplicaciones conservan scripts y lockfiles separados; no Docker ni workspace Node raiz.

Cada dominio posee controlador, servicio, repositorio, DTO y puerto en su carpeta. SQL y nombres de proveedor del origen quedan en `integrations/legacy-crm/<dominio>`. `catalog-policy/catalog-item.operations.ts` reutiliza autorizacion, validacion y orquestacion; no contiene SQL ni clientes ERP. El frontend comparte infraestructura visual cuando la responsabilidad es realmente comun, sin mezclar almacenamiento o reglas de distintos dominios.

La identidad publica CRM no se deriva del proveedor. Los identificadores externos son cadenas y viven en referencias `{systemCode, externalId, status}`. Un registro puede tener varios proveedores. No crear columnas publicas llamadas NetSuite/Odoo ni identificadores ficticios para referencias ausentes. Propiedad unica por proveedor/identificador, incluso al archivar; no reasignar silenciosamente referencias.

Los seis catalogos editables dedicados son Projects, Campaigns, Classes, Locations, Subsidiaries y Brokers. Sus tablas son `crm_project`, `crm_campaign`, `crm_class`, `crm_location`, `crm_subsidiary`, `crm_broker`, cada una con su tabla `_external_reference`. Unit Files tiene su propio agregado de lectura; no debe tratarse como CRUD generico de catalogos.

### Lectura y escritura de catalogos

1. Validar sesion, permiso scoped, entradas y motivo auditable.
2. Listar nativo primero y despues legacy no promovido; excluir identidades antiguas ya poseidas, incluidas eliminadas, antes de contar y paginar.
3. Con `ENABLE_LEGACY_FALLBACK` habilitado, crear en ambos destinos cuando el dominio lo permite. Una edicion legacy promueve a identidad CRM; editar un nativo sin contraparte no crea una contraparte arbitraria.
4. Persistir datos nativos, referencias, cambio legacy permitido y auditoria en la misma transaccion del servidor MySQL. Requiere tablas InnoDB y acceso al mismo servidor; no es una transaccion distribuida entre servidores.
5. Si falla auditoria o sincronizacion, revertir. Las lecturas legacy usan su pool y transacciones de solo lectura. El switch global deshabilita llamadas nuevas; no cancela transacciones ya iniciadas.
6. Actualizar identidad devuelta tras promocion. No hay endpoint de borrado fisico de estos catalogos. Las bajas son cambios de estado auditados.

Las limitaciones particulares del legacy (NetSuite obligatorio en Proyectos, longitudes y campos nulos) siguen en documento 35. Soporte multiproveedor de esquema no significa conectores Odoo/NetSuite operativos, webhooks o sincronizacion automatica instalados.

### Deriva entre sistemas: pendiente explicito

La precedencia nativa evita duplicados en lecturas, pero tambien significa que un nombre cambiado posteriormente por otra API en legacy no sustituye automaticamente el nombre CRM ya promovido. La cache no resuelve esa divergencia. No existe aqui un reconciliador bidireccional automatico, CDC ni job que vigile todos los cambios externos.

Antes de implementarlo se debe acordar autoridad por campo, version/fecha de origen fiable, deteccion de conflicto y politica de resolucion. Propuesta pendiente: identificar por referencia estable, detectar diferencias, no emparejar por nombre, aplicar cambios autorizados con antes/despues y registrar conflictos concurrentes para revision. Reintentos idempotentes y outbox serian necesarios si los destinos dejan de compartir transaccion. Esta propuesta no es funcionalidad entregada.

## Migracion y recuperacion

| Migracion | Responsabilidad |
| --- | --- |
| `202610090009_projects_domain` | Agregado de Proyectos |
| `202610120010_campaigns_domain` | Agregado de Campanas |
| `202610120011_classes_domain` | Agregado de Clases |
| `202610120012_locations_domain` | Agregado de Ubicaciones |
| `202610120013_subsidiaries_domain` | Agregado de Subsidiarias |
| `202610120014_brokers_domain` | Agregado de Corredores |
| `202610120015_unit_files_domain` | Expedientes y referencias externas |
| `202610120016_unit_files_naming` | Renombrado conservador al estandar fisico |

No reescribir migraciones historicas ni ejecutar toda la cadena como prueba. Los cutovers de catalogos rechazan registros compartidos existentes en lugar de borrarlos. Verificar destino CRM_THINK_V2, ledger, esquema, motor y respaldo antes de una ejecucion autorizada. La palabra schema-only del runner no garantiza ausencia de DML de seguridad.

`scripts/prepare-unit-files.ts` es el preflight report-only. El modo `--apply-project-identities` modifica solo identidades nativas verificadas y requiere autorizacion explicita; no importa unidades. El origen confirmado es `crmdatabase-api.expedientes`, no el nombre inicialmente supuesto expediente_unidad.

Snapshot historico del documento 35: 3.358 expedientes; 1.332 bloqueados en referencias 2, 21, 9, 7, 40 y 0; 21 proyectos preparados y dos preexistentes conservados. No son conteos actuales. El grupo 40 tiene correspondencia ambigua; no adivinar por nombre ni por PK legacy. La FK nativa de unidad referencia el PK interno `crm_project.id_project`; el JSON expone la identidad publica CRM del proyecto. La referencia plana de origen es procedencia y se traduce mediante el proveedor en el adaptador, sin alterar produccion.

Recuperacion: deshabilitar fallback y reiniciar solo con coordinacion operativa; verificar que los datos requeridos existen nativamente antes de retirar legacy. No eliminar tablas ni revertir identidades preparadas automaticamente. Nunca rotar credenciales compartidas como parte de esta entrega.

## Evidencia, comandos y limites

Ultima evidencia historica de la correccion 409: frontend `pnpm check` completo, 257 pruebas en 19 archivos, formato/lint/typecheck/build aprobados; 13 pruebas de protecciones de acceso API aprobadas. La advertencia de tamano de bundle Ant Design no bloquea el build. El check raiz encontro formato preexistente en `apps/api/test/unit-files/unit-files-search.spec.ts`. No convertir estos resultados en una afirmacion de check global aprobado.

Comandos reproducibles, desde la carpeta indicada:

```powershell
# Raiz: verificacion oficial; no ejecuta migraciones.
.\check-all.cmd
# apps/frontend
pnpm check
pnpm exec vitest run test/app/api-client-conflicts.spec.ts test/administration/RolesSecurityPage.spec.tsx
# apps/api: suites sin habilitar DML legacy real
pnpm exec vitest run test/audit test/unit-files test/identity/identity-access-management.service.spec.ts --maxWorkers=1
```

Las pruebas MySQL son opt-in y usan configuracion local segura; consultar documento 35 y cada suite antes de habilitarlas. Rollback-only nativo, SELECT legacy real y SQL compilado en mocks son tres evidencias distintas. No habilitar flags de DML legacy real sin aprobacion. No incluir secretos, tokens o valores de .env en reportes.

## Pendientes y criterios de cierre

| Pendiente | Criterio de aceptacion |
| --- | --- |
| Aceptacion manual Owner y otro perfil | Guardados permitidos, rechazos protegidos, revocacion efectiva y auditoria exacta comprobados con fixtures autorizados |
| Relaciones de expedientes bloqueadas | Correspondencias aprobadas, sin duplicados de proveedor ni huerfanos; preflight limpio por alcance |
| Migracion del inventario | Plan/importador idempotente aprobado, paridad de los 27 valores, referencias y conteos; rollback probado |
| Deriva de datos externa | Autoridad por campo y conflictos acordados; reconciliador implementado y probado antes de prometer consistencia automatica |
| Rendimiento real | EXPLAIN y tiempos bajo volumen/concurrencia representativos; indices legacy solo con aprobacion, medicion y rollback |
| Cobertura de auditoria futura | Instrumentar nuevos escritores; definir ingestacion de cambios de otras APIs/SQL, retencion y exportacion si se requieren |
| Conexion y check global | Reproducir resets con evidencia servidor/red; resolver bloqueos globales por tarea autorizada |
| Despliegue y retiro legacy | Release, migraciones y smoke tests explicitamente aprobados; ninguna dependencia ni dato sin migrar |

No considerar Administracion cerrada ni avanzar a Leads por el solo hecho de que existen pantallas o pasan pruebas locales.
