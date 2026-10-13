# 36 - Registro de entrega de Administracion

Actualizado: 2026-10-13. Consolidacion del trabajo de esta continuidad, contrastada con el codigo del checkout. No acredita despliegue, estado actual de produccion ni aceptacion final del Owner. Los resultados anteriores se identifican como evidencia historica, no como pruebas ejecutadas durante esta actualizacion documental.

## Lectura y autoridad

### Perfil Formalizacion / Inicio - 2026-10-13

Alcance aprobado: rol `formalizacion`, modulo `formalizacion`, seccion `home`
(Inicio), permiso unico `formalizacion.home.read`. El modulo ya existia activo
en la inspeccion previa; el rol y sus grants no existian. Migracion incremental
`202610130017_formalization_home_role` reutiliza identidades existentes, agrega
las faltantes y registra el cambio con snapshot en auditoria dentro de la misma
transaccion. Reejecutarla con el estado esperado es un no-op. Rechaza modulos o
roles inactivos, permisos de configuracion incompatible y grants no-Home
preexistentes; no los sobreescribe ni reactiva silenciosamente. La atribucion de
esta ejecucion administrativa usa el primer Owner activo verificado por el
script, no una sesion de navegador ni un usuario suministrado por cliente.

Crear un usuario del rol sin areas explicitas asigna por defecto Formalizacion
en backend; la UI deriva ese mismo modulo desde el catalogo de permisos del rol.
La edicion/revocacion de acceso no vuelve a agregar el modulo automaticamente.
Se conservan validacion, motivo, estado inicial, activacion local/Microsoft y
auditoria existentes. La migracion no crea usuarios ni les asigna el rol. El
perfil exclusivo recibe solamente Inicio; roles adicionales o overrides
explicitos pueden ampliar permisos segun las reglas generales, no por el rol
Formalizacion en si. Owner permanece protegido y no se modifica su asignacion.

Inicio usa `/home/formalization`, separado de Resumen y sin consultas de negocio
ni metricas ficticias. Expedientes, Contratos, Catalogos y el Resumen anterior
no aparecen para un perfil Home-only; sus API conservan permisos propios. La
existencia del modulo visible no concede permisos de seccion.

Verificacion especifica: suite `test/migrations/formalization-home-role.mysql.spec.ts`
con `FORMALIZATION_MYSQL_TESTS=1` usa transacciones y savepoints rollback-only;
comprueba grant unico, idempotencia, alta temporal y permisos efectivos, rechazo
de grants ajenos y rollback si falla auditoria. Ningun fixture deja una cuenta
persistida. Pruebas unitarias cubren el default de alta, la seccion Inicio en
catalogo y rechazo de catalogos/inventario al perfil Home-only. No repetir
`002_identity_seed_p0_s1.sql`: su historico otorgaba secciones operativas y
reemplazaba grants; no es el mecanismo de alta de este perfil.

Evidencia de esta entrega (2026-10-13): migracion 017 aplicada mediante seleccion
`--only` y ledger verificado en CRM_THINK_V2; rol activo, grant unico Home y cero
titulares en el chequeo posterior. Cuatro pruebas MySQL rollback-only aprobadas,
incluyendo sesion obsoleta tras incremento de version y rechazo del estado
parcial modulo faltante/grant existente. Suite API: 392 aprobadas; typecheck y
build aprobados; lint de archivos tocados aprobado. Suite frontend `pnpm check`:
269 aprobadas, formato/lint/typecheck/build aprobados. El check global sigue
bloqueado por formato preexistente de unit-files-search.spec.ts; lint API global
reporta cinco JSDoc preexistentes en Catalogs/Projects. No se corrigieron archivos
ajenos a este alcance. Advertencia de bundle Ant Design persiste.

Tras reautenticacion de Roberto, navegador real confirmo dos roles y
Formalizacion / Inicio con 1/1 habilitado; Contratos, Expedientes, Firmas y
Catalogos con cero grants en las opciones del modulo. En Nuevo usuario elegir
Formalizacion muestra Aplica en Formalizacion y 1 rol / 1 modulo. No se envio
el formulario ni se creo una cuenta real. Evidencia visual local:
`C:/codex-data/visualizations/formalization-home/role-home-permission.png` y
`C:/codex-data/visualizations/formalization-home/create-user-default-module.png`.
La prueba de login real de una persona Formalizacion queda para QA manual:
esta entrega prueba su perfil/sesion con fixture rollback-only y navegacion
con contratos de prueba, sin crear credenciales ni usuarios ficticios duraderos.

Requisitos antes de habilitar cualquier seccion de Formalizacion:

1. Aprobacion explicita de flujo, datos visibles y acciones por rol; no heredar
   `file.read` como permiso de Inicio ni otorgar todos los catalogos.
2. Definir contrato canonico, relaciones CRM, estado de expediente/contrato,
   alcance por usuario/equipo y reglas de transicion; no usar IDs ERP como FK.
3. Crear permiso atomico y seccion propia, validacion backend, navegacion y
   proteccion de URL coherentes; lectura no concede crear/editar/aprobar.
4. Si hay escritura, registrar actor/contexto y antes/despues en la misma
   transaccion. Probar denegacion, revocacion, concurrencia y rollback.
5. Preparar migracion puntual con preflight, respaldo, autorizacion, rollback,
   paginacion y medicion de consultas. No importar negocio por habilitar menu.
6. Ejecutar QA con Owner y perfil Formalizacion; comprobar APIs directas sin
   permiso y ausencia de datos sensibles en Home. Solo despues aprobar release.

- [Ley de producto](00-Producto-CRM-TINK-y-P0.md): alcance aprobado; Administracion antes de Leads.
- [Cierre operativo](34-Cierre-Operativo-Administracion-P0-S1.md): antecedentes, seguridad y compuertas de aceptacion.
- [Catalogos, esquema y migracion](35-Catalog-API-and-Schema.md): contratos, fuentes y restricciones por dominio.
- [Auditoria y conflictos](37-Auditoria-Trazabilidad-y-Conflictos.md): historial transaccional y errores de permisos.
- [Entrega visual y QA](../../frontend/Arquitectura/27-Entrega-Administracion-y-QA.md): comportamiento vigente y pruebas manuales.

Este registro describe implementacion existente, no autoriza nuevas migraciones ni operaciones productivas. Las secciones historicas fechadas de documentos anteriores conservan su valor como evidencia; las decisiones vigentes de este registro sustituyen sus descripciones obsoletas de carga incremental y almacenamiento compartido.

## Matriz de trazabilidad

Las rutas de codigo y pruebas son relativas a su aplicacion. Una prueba existente no equivale a una prueba ejecutada ni a cobertura total.

| Solicitud / decision                                       | Implementacion y regla vigente                                                                                      | Evidencia verificable                                                                          | Estado / limite                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Replicar Proyectos en Campanas                             | `src/modules/crm/campaigns`, adaptador `src/integrations/legacy-crm/campaigns`; agregado propio y contrato canonico | `test/catalogs/campaigns*`, `test/integrations/legacy-campaigns.writer.spec.ts`; migracion 010 | Construido; DML legacy real requiere autorizacion y aceptacion separadas                 |
| Clases con el mismo patron                                 | Carpetas `classes`; nombres maximo 100, estado 1 activo / 0 o null inactivo                                         | `test/catalogs/classes*`, `test/integrations/legacy-classes*`; migracion 011                   | Construido; no borrar ni fusionar origen automaticamente                                 |
| Ubicaciones                                                | Carpetas `locations`; nombres maximo 100 y referencias por proveedor                                                | `test/catalogs/locations*`, `test/integrations/legacy-locations*`; migracion 012               | Construido; mismas restricciones de sincronizacion                                       |
| Subsidiarias                                               | Carpetas `subsidiaries`; nombres maximo 250                                                                         | `test/catalogs/subsidiaries*`, `test/integrations/legacy-subsidiaries*`; migracion 013         | Construido; duplicidad historica de proveedor 63 pendiente de resolver                   |
| Corredores sin columnas obsoletas                          | Carpetas `brokers`; solo PK, identificador proveedor, nombre y estado del origen; nombre maximo 250                 | `test/catalogs/brokers*`, `test/integrations/legacy-brokers*`; migracion 014                   | Construido; categoria, empresa, telefono, correo y valoridNetsuite no se incorporan      |
| Paginacion real y retorno sin consultas repetidas          | Frontend `catalogs/CatalogItemsPage.tsx`; limit/offset, total filtrado, cache local de 20 paginas                   | Frontend `test/catalogs/CatalogItemsPage.spec.tsx`                                             | Construido; no es snapshot consistente entre escrituras concurrentes                     |
| Inventario de expedientes sin carga masiva                 | `src/modules/crm/unit-files`, adaptador `legacy-crm/unit-files`, criterios antes de consultar, keyset               | `test/unit-files/*`; migraciones 015 y 016                                                     | Vista y API de lectura construidas; inventario no importado en la preparacion registrada |
| Proyecto CRM y multiples proveedores                       | FK interna a `crm_project`; referencias externas en tabla hija, traduccion solo en adaptador                        | `unit-files.contract.ts`, `unit-files.columns.ts`, `unit-files-legacy.port.ts`                 | Construido; relaciones ambiguas no se inventan                                           |
| Filtros completos aunque solo exista una pagina en memoria | `/unit-files/facets`, conteos del alcance completo; SearchPanes nativo                                              | `test/unit-files/unit-files-search.spec.ts`; frontend `test/unit-files/*`                      | Construido; agregaciones limitan salida, no garantizan ausencia de escaneo               |
| Comparacion legible y ranking                              | Frontend `unit-files/UnitFilesComparison.tsx`; costos menores y areas mayores favorecidos                           | Frontend `test/unit-files/*`                                                                   | Construido; maximo actual ocho expedientes, no puntuacion financiera global              |
| Planos como enlace                                         | Frontend `UnitFilesPage.tsx`; solo URL HTTP/HTTPS valida, pestana nueva y noopener/noreferrer                       | Frontend `test/unit-files/*`                                                                   | Construido; no convierte otros valores arbitrarios en enlaces                            |
| Roles por modulo y seccion                                 | Frontend `roles-security-sections.ts`, `RolePermissionHierarchy.tsx`, `RolePermissionSection.tsx`                   | Frontend `test/administration/RolePermissionHierarchy.spec.tsx`, `RolesSecurityPage.spec.tsx`  | Construido; catalogo API determina secciones disponibles                                 |
| Auditoria antes/despues y referencia exacta                | `audit-change-set.ts`, `audit-read.*`, repositorios de identidad y catalogos                                        | `test/audit/*`                                                                                 | Construido para escritores instrumentados; no captura cambios SQL externos               |
| Mensajes de eventos legibles                               | Frontend `audit-event-description.ts`                                                                               | Frontend `test/administration/audit-event-description.spec.ts`                                 | Construido; codigos tecnicos permanecen internos                                         |
| 409 al actualizar permisos                                 | Frontend `services/api/api-client.ts`; solo conflicto de version de permisos renueva sesion                         | Frontend `test/app/api-client-conflicts.spec.ts`                                               | Corregido; conflictos de negocio no se reenvian                                          |
| Conexion reiniciada y resultado de guardado incierto       | Frontend `RolesSecurityPage.tsx`; mensaje explicito, sin replay de mutacion                                         | Frontend `test/administration/RolesSecurityPage.spec.tsx`                                      | Tratamiento construido; causa historica del reset no reproducida                         |

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

| Migracion                          | Responsabilidad                           |
| ---------------------------------- | ----------------------------------------- |
| `202610090009_projects_domain`     | Agregado de Proyectos                     |
| `202610120010_campaigns_domain`    | Agregado de Campanas                      |
| `202610120011_classes_domain`      | Agregado de Clases                        |
| `202610120012_locations_domain`    | Agregado de Ubicaciones                   |
| `202610120013_subsidiaries_domain` | Agregado de Subsidiarias                  |
| `202610120014_brokers_domain`      | Agregado de Corredores                    |
| `202610120015_unit_files_domain`   | Expedientes y referencias externas        |
| `202610120016_unit_files_naming`   | Renombrado conservador al estandar fisico |

No reescribir migraciones historicas ni ejecutar toda la cadena como prueba. Los cutovers de catalogos rechazan registros compartidos existentes en lugar de borrarlos. Verificar destino CRM_THINK_V2, ledger, esquema, motor y respaldo antes de una ejecucion autorizada. La palabra schema-only del runner no garantiza ausencia de DML de seguridad.

`scripts/prepare-unit-files.ts` es el preflight report-only. El modo `--apply-project-identities` modifica solo identidades nativas verificadas y requiere autorizacion explicita; no importa unidades. El origen confirmado es `crmdatabase-api.expedientes`, no el nombre inicialmente supuesto expediente_unidad.

Snapshot historico del documento 35: 3.358 expedientes; 1.332 bloqueados en referencias 2, 21, 9, 7, 40 y 0; 21 proyectos preparados y dos preexistentes conservados. No son conteos actuales. El grupo 40 tiene correspondencia ambigua; no adivinar por nombre ni por PK legacy. La FK nativa de unidad referencia el PK interno `crm_project.id_project`; el JSON expone la identidad publica CRM del proyecto. La referencia plana de origen es procedencia y se traduce mediante el proveedor en el adaptador, sin alterar produccion.

Recuperacion: deshabilitar fallback y reiniciar solo con coordinacion operativa; verificar que los datos requeridos existen nativamente antes de retirar legacy. No eliminar tablas ni revertir identidades preparadas automaticamente. Nunca rotar credenciales compartidas como parte de esta entrega.

## Autorizacion por operacion - 2026-10-13

### Catalogos: lectura no concede escritura

Las operaciones compartidas y dedicadas de catalogos exigen el codigo exacto
`<contexto>.<modulo_catalogo>.<accion>`. Crear usa `create`; editar y reactivar
usan `update`; inactivar usa `inactivate`. `read`, un codigo sin contexto o un
grant de otro modulo no sustituyen el permiso requerido. La denegacion expresa
prevalece. Owner solo conserva la exencion de membresia de area: su nombre no
omite la comprobacion del permiso efectivo. No se cambian grants persistidos.

La UI oculta botones y acciones denegadas en cabecera, filas y detalle, y
revalida antes de enviar. La API rechaza el acceso directo sin permiso antes
de cualquier escritura o promocion legacy. Las pruebas de autorizacion usan
perfiles controlados y repositorios simulados; no crean corredores reales.

Verificacion nueva de catalogos: 3.840 casos HTTP en
`test/catalogs/catalog-authorization.http.spec.ts` cubren seis dominios, cinco
contextos y ambas superficies de rutas, con servicios reales y persistencia
simulada. Incluyen grants exactos, solo lectura, otro contexto/catalogo, deny,
Owner, membresia, revocacion y CSRF. La suite API completa obtuvo 4.427
aprobados, 96 omitidos y un timeout del test de limites de imports; este ultimo
aprobo al ejecutarlo aislado, sin modificar sus reglas ni aumentar timeouts.
Typecheck, build, formato y lint de los archivos API modificados aprobados.
Frontend `pnpm check` completo aprobado: 341 pruebas, formato, lint, typecheck
y build. Las pruebas nuevas usan perfil Formalizacion no Owner; la aceptacion
manual del usuario real permanece separada de esa evidencia automatizada.

### Usuarios y Roles

Usuarios y Roles comprueban permisos efectivos de la sesion autenticada en cada
solicitud. La UI no sustituye esta validacion. No basta el nombre Owner: el
servicio exige el grant efectivo; ante permisos contradictorios, denegar prevalece.

| Operacion | Permiso obligatorio |
| --- | --- |
| Listar usuarios | `user.view_list` |
| Consultar detalle de usuario | `user.view_detail` |
| Crear usuario con roles iniciales | `user.create` y `role.assign` |
| Asignar clave inicial al crear | Los anteriores y `user.assign_password` |
| Editar nombre/correo/metodos de acceso | `user.update` |
| Cambiar roles o modulos al editar | `user.update` y `role.assign` |
| Activar usuario | `user.activate` |
| Bloquear o inactivar usuario | `user.deactivate` |
| Consultar/renombrar/eliminar roles, leer/reemplazar matrices o acceso | `role.assign` |

El alta no puede usar roles arbitrarios con solo `user.create`. La edicion
compara roles/modulos actuales y solicitados; conservarlos no exige un grant
adicional, cambiarlos si. Las protecciones de identidad propia comparan IDs sin
distinguir mayusculas, coherentes con la busqueda de MySQL. Owner conserva las
restricciones de negocio existentes; denegaciones de seguridad no eliminan esas
protecciones. No se crearon codigos distintos para renombrar o eliminar roles:
ambas acciones pertenecen al permiso actual `role.assign`.

El directorio conserva `orgUnit` por compatibilidad y agrega `orgUnits` con la
lista completa de asignaciones. Asi una edicion de datos no elimina modulos
adicionales. Para actores sin `role.assign`, la transaccion preserva las
asignaciones y comprueba el snapshot bajo bloqueo antes de escribir, evitando
restaurar una asignacion que otro administrador acaba de cambiar.

La pantalla parte sin autoridad, revalida antes de mutar y retira controles
cuando no puede confirmar permisos. Catalogos de seguridad vacios o fallidos
no se sustituyen por roles ficticios. Las pruebas HTTP usan servicios reales y
persistencia simulada; las pruebas MySQL de reemplazo de acceso usan rollback y
un rol de fixture propio, sin depender de que exista un rol de Ventas activo.
No se aplican migraciones ni se guardan cuentas o cambios de acceso por esta revision.

Evidencia de esta revision: 588 pruebas API aprobadas con `--maxWorkers=2`,
96 pruebas opt-in omitidas en esa ejecucion; las 167 regresiones HTTP nuevas
estan incluidas en ese total. Typecheck, build, formato y lint focalizados
aprobados. Ocho casos MySQL ejecutados por separado con rollback (reemplazo de
acceso/sesiones, historial de actor y preservacion de asignaciones). La primera
ejecucion global con 79 workers tuvo un timeout en la prueba de limites de
imports; la repeticion acotada aprobo, sin aumentar timeouts ni relajar reglas.
El lint API global sigue bloqueado por cinco JSDoc preexistentes en Catalogos y
Proyectos; el check raiz sigue bloqueado por formato en unit-files-search.spec.ts.
Verificacion real Owner en Roles sin guardar cambios; captura en
`C:/codex-data/visualizations/authorization-users-roles/owner-permissions.png`.
La aceptacion manual con cuentas de permisos limitados permanece pendiente.
Frontend `pnpm check` completo aprobado: 315 pruebas, formato, lint, typecheck
y build. Se mantiene la advertencia no bloqueante del bundle Ant Design.

## Diagnostico de sesion local al recargar - 2026-10-13

El diagnostico reportado y confirmado mediante inspeccion de DB identifica una
revocacion de la sesion CRM y su refresh por reemplazo de accesos de un usuario
de autenticacion local, el 2026-10-13 a las 15:32 de Costa Rica (UTC-06), unos seis
minutos despues del login. No habia transcurrido la vigencia de ocho horas: el
cierre corresponde a revocacion, no a expiracion por tiempo.

La politica que produjo ese cierre queda sustituida el 2026-10-13 por decision
explicita del usuario. El [contrato de seguridad 24](24-Seguridad-Autenticacion-BFF-OIDC-Local.md)
exige ahora incrementar la version de permisos sin revocar la identidad activa
ni su refresh por un cambio de accesos. La autorizacion obsoleta se rechaza y
renueva antes de continuar: refresh rota cookies a la version vigente y devuelve
solo un snapshot minimo de usuario/sesion, sin roles ni permisos. Despues,
`/identity/me` o la solicitud protegida resuelve los grants canonicos actuales;
refresh no consulta el perfil completo despues del commit. No se retienen
permisos retirados ni se fuerza logout. No se promete
un 409 en todos los caminos de sesion obsoleta. Logout, bloqueo/inactivacion y
replay de refresh conservan revocacion fuerte. La implementacion esta terminada
y verificada localmente segun la evidencia reportada abajo. El diagnostico anterior permanece como
evidencia historica, no como regla vigente ni como nueva consulta DB.

Aceptacion: tres recargas finales con API estable conservaron la autenticacion
del login local de Formalizacion. Ambas cookies permanecieron presentes, con
valores y expiracion identicos, sin imprimir secretos. La inspeccion DB reporto
sesion activa, version de permisos 4/4 y ninguna revocacion. Solo queda pendiente
la edicion manual real de permisos: no se realizo. Las pruebas HTTP/MySQL con
rollback verifican el reemplazo de accesos y la renovacion a derechos actuales
sin logout forzado ni conservacion de permisos retirados.

Cierre reportado con fuentes congeladas: snapshots minimos de usuario/sesion y bloqueo de
fila protegen frente a la carrera posterior al commit; la auditoria de refresh
esta dentro de la transaccion y su fallo revierte la renovacion. Suite API:
4.430 aprobadas y 102 omitidas; ocho pruebas SQL rollback aprobadas. Verificacion
independiente: 92 pruebas unitarias core y seis nuevas HTTP/MySQL aprobadas.
Typecheck, build, lint y formato acotados aprobados. El formato API global falla
solo por formato preexistente en `unit-files-search.spec.ts`; lint global conserva
cinco hallazgos preexistentes de JSDoc faltante en Catalogs/Projects.

Frontend: 62 pruebas core de autenticacion aprobadas. Check final completo
aprobado: formato, lint, typecheck, 369 pruebas en 24 archivos y build. Una
ejecucion anterior encontro un fallo intermitente de catalogo legacy; el caso
paso aislado y despues paso la suite completa sin checks pesados simultaneos.
Se conserva la advertencia no bloqueante de tamano de bundle Ant Design.

Tambien se corrigio `resolveAuthState`: solo un refresh rechazado con 401
confirma anonimato. Red, servidor o CSRF fallidos muestran el problema de acceso
y conservan la URL, sin forzar login ni repetir automaticamente la rotacion.

En navegador integrado se reporto login local de Formalizacion y primera
recarga autenticada con cookie identica, sin registrar su valor. Recargas
posteriores encontraron `ERR_CONNECTION_RESET` / `ERR_CONNECTION_REFUSED`
durante ediciones del API en modo watch; el reintento recupero acceso sin
credenciales. Es evidencia de interrupcion de red, no de expiracion de cookie.
La evidencia final de tres recargas estables indicada arriba sustituye ese
pendiente de recarga. Esta actualizacion documental recoge resultados reportados;
no ejecuta pruebas, consultas DB ni mutaciones de negocio y no acredita despliegue.

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

| Pendiente                             | Criterio de aceptacion                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aceptacion manual Owner y otro perfil | Guardados permitidos, rechazos protegidos, revocacion efectiva y auditoria exacta comprobados con fixtures autorizados                                                           |
| Relaciones de expedientes bloqueadas  | Correspondencias aprobadas, sin duplicados de proveedor ni huerfanos; preflight limpio por alcance                                                                               |
| Migracion del inventario              | Plan/importador idempotente aprobado, paridad de los 27 valores, referencias y conteos; rollback probado                                                                         |
| Deriva de datos externa               | Autoridad por campo y conflictos acordados; reconciliador implementado y probado antes de prometer consistencia automatica                                                       |
| Rendimiento real                      | EXPLAIN y tiempos bajo volumen/concurrencia representativos; indices legacy solo con aprobacion, medicion y rollback                                                             |
| Cobertura y navegacion de auditoria   | Instrumentar nuevos escritores; definir ingestacion de cambios de otras APIs/SQL, retencion y exportacion; el deep link al registro especifico aun no existe, solo Abrir seccion |
| Conexion y check global               | Reproducir resets con evidencia servidor/red; resolver bloqueos globales por tarea autorizada                                                                                    |
| Despliegue y retiro legacy            | Release, migraciones y smoke tests explicitamente aprobados; ninguna dependencia ni dato sin migrar                                                                              |

No considerar Administracion cerrada ni avanzar a Leads por el solo hecho de que existen pantallas o pasan pruebas locales.
