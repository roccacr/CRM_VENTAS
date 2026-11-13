# 88 — Motivo y envío del adéndum

## Selección masiva — implementación local del 13 de noviembre de 2026

Pendientes de seguimiento permite seleccionar órdenes por identidad fuente/ID,
conservarlas al paginar y seleccionar todas las páginas del filtro actual. Un
cambio de filtros o de capacidad de marcación reinicia la selección. La barra
ofrece también seleccionar todas para pantallas donde el encabezado está oculto.

El modal comparte capa y campo de motivo con la acción individual. Presenta
orden, cliente, proyecto, unidad, advertencias y resultado de cada orden. Se aplica
un motivo común obligatorio de 3 a 2000 caracteres. Por decisión del usuario,
una orden ya pendiente se puede renovar desde la selección, reemplazando su
motivo y registrando antes/después en bitácora. El flujo individual sigue
rechazando una nueva marca sobre un pendiente existente.

- `POST /formalization/orders/addendum/pending/preview`: `{ orders: [{ source, id }] }`,
  entre 1 y 100 identidades por petición. Devuelve `{ items: [{ source, id, order }] }`
  en el mismo orden. `order` es el marcador con capacidades y `availableForPending`,
  o `null` cuando no fue posible verificarlo. Solo lectura; no se muta ninguna orden.
- `POST /formalization/orders/addendum/pending/bulk-item`: mismo contrato estricto
  de motivo, versión y operación que `/pending`; permite renovar pendientes.
  Una transacción por orden, reutilizando el repositorio y la bitácora existentes.
- Ambas rutas exigen sesión, CSRF y los permisos efectivos `formalizacion.orders.read`,
  `formalizacion.orders.addendum.read` y `formalizacion.orders.addendum.mark_pending`.
  No se omiten denegaciones, identidad inequívoca, disponibilidad activa, control
  de versión ni bitácora habilitada. Las órdenes que no pasan esos controles no se
  escriben; su resultado se distingue de las advertencias de estado renovables.
- Cada orden conserva su UUID y versión para reintentos inciertos. No se reenvían
  éxitos confirmados. Si el replay confirma una operación cuya orden cambió después,
  el modal lo informa sin afirmar que el estado actual sigue pendiente.

Se añadieron casos de selección de todas las páginas, resultados parciales,
renovación nativa/legacy, replay, CAS, rollback de auditoría, CSRF, denegación e
inputs generados (semilla `20261113`). **No se ejecutaron pruebas por instrucción
del usuario.** La implementación local no acredita despliegue ni aceptación visual
o SQL real. La revisión adversarial de ejecución y las propiedades transaccionales
en fixtures SQL aisladas exigidas antes de merge siguen pendientes; las pruebas
agregadas con dobles no sustituyen esa evidencia.

Seguimiento del mismo 13 de noviembre, con autorización posterior del usuario
para ejecutar pruebas: se reprodujeron 2 fallos frontend en los casos de
reintento y 1 fallo API en el inventario de rutas. El botón de reintento tenía un
nombre accesible variable por el icono de carga de Ant Design durante su
animación; se fijó `aria-label`, siguiendo el flujo individual. El inventario
esperaba 118 handlers aunque las dos rutas nuevas elevan el total a 120; se
actualizó el conteo y se exigió explícitamente la presencia de ambas rutas.

Regresión focal posterior: frontend **101/101**, cuatro archivos; API **866/866**,
cuatro archivos, incluidos 801 casos del inventario de permisos. Ambos comandos
terminaron con exit 0. La instrucción de no ejecutar pruebas corresponde a la
entrega inicial; estos resultados documentan la autorización y ejecución
posteriores. Logs: `frontend-failed-suite.log`, `api-failed-suite.log` (fallos
reproducidos), `frontend-regression.log` y `api-regression.log` (regresión final),
en `C:/codex-data/tmp/bulk-addendum-20261113/`. No se ejecutó la suite integral ni
se acredita aceptación visual o SQL real con estos resultados.

Verificación estática final: API `pnpm typecheck` y `pnpm build`, frontend
`pnpm build` (incluye `tsc --noEmit`), lint focal de todos los archivos TypeScript
modificados y `git diff --check`: exit 0. El build frontend advierte paquetes de
más de 500 kB; no se ajustaron sus límites. No se ejecutó `check-all.cmd` porque
incluye pruebas. No hubo commits, publicación, migraciones ni cambios de datos.
Logs completos: `C:/codex-data/tmp/bulk-addendum-20261113/`.

Archivos de esta entrega, relativos a la raíz del repositorio:

- `apps/frontend/src/modules/home/FormalizationFollowUpPreview.tsx`: selección,
  paginación y acción masiva.
- `apps/frontend/src/modules/home/FormalizationBulkAddendum.tsx` (nuevo): consulta
  previa, advertencias, motivo común, resultados parciales y reintentos.
- `apps/frontend/src/modules/home/FormalizationMarkAddendum.tsx`: modal y campo
  de motivo compartidos, conservando el controlador individual.
- `apps/frontend/src/modules/home/FormalizationHomePage.css`: columna de checks.
- `apps/frontend/src/services/formalization/order-addendum-service.ts`: contratos
  tipados de consulta previa y renovación por selección.
- `apps/api/src/modules/crm/sales/sales-orders/sales-order-addendum.ts`: rutas,
  autorización y reutilización del servicio individual.
- `apps/api/src/modules/crm/sales/sales-orders/sales-order-addendum.repository.ts`:
  renovación explícita conservando CAS, replay y transacción de bitácora.
- `apps/frontend/test/home/formalization-bulk-addendum.spec.tsx` (nuevo).
- `apps/frontend/test/home/formalization-follow-up.spec.tsx`.
- `apps/frontend/test/home/order-addendum-service.spec.ts`.
- `apps/api/test/calendar/sales-order-addendum.repository.spec.ts`.
- `apps/api/test/security/sales-order-addendum.http.spec.ts`.
- `apps/api/test/security/route-permission.http.spec.ts`.
- Este documento (`apps/api/Arquitectura/88-Adendum-Motivo-y-Envio.md`).

Los cambios concurrentes en `GlobalHomeShell.css` y
`public/illustrations/habita-header-skyline.svg` quedan fuera de esta entrega.

Comandos PowerShell para que el usuario ejecute las pruebas focales y comparta
salida completa y código de salida de cada comando:

```powershell
Set-Location -LiteralPath 'C:\Users\RobertoCarlosZuñigaA\Documents\ROCCA ARCHIVOS\Desarrollo\PROYECTOS DESAROLLOS\CRM VERION NESTJS'
pnpm --dir apps/frontend exec vitest run test/home/formalization-bulk-addendum.spec.tsx test/home/formalization-follow-up.spec.tsx test/home/formalization-mark-addendum.spec.tsx test/home/order-addendum-service.spec.ts
Write-Output "Frontend exit=$LASTEXITCODE"
pnpm --dir apps/api exec vitest run test/calendar/sales-order-addendum.repository.spec.ts test/calendar/sales-order-addendum.service.spec.ts test/security/sales-order-addendum.http.spec.ts test/security/route-permission.http.spec.ts
Write-Output "API exit=$LASTEXITCODE"
```

Validación integral oficial posterior, desde la misma raíz: `.\check-all.cmd`.
La aceptación visual debe comprobar selección individual y total con filtros,
renovación de pendientes, una orden concurrentemente modificada, motivo común y
una entrada de bitácora por escritura, además del flujo individual sin cambios.

Refinamiento visual local del 13 de noviembre: el modal masivo adopta el alcance
`formalization-modal` para heredar los tokens del portal. Tabla con filas separadas,
jerarquía orden/cliente y proyecto/unidad, estados compactos y motivo en sección
propia. En móvil las órdenes se apilan y el pie permanece visible mientras se
desplaza el cuerpo. Verificación visual local con datos ficticios en escritorio
1280×900 y móvil 390×844, incluidos avisos de pendientes existentes; sin conexiones
ni escrituras de órdenes reales. Regresión de ambos modales: 19 pruebas aprobadas.

Corrección de selección total local, 13 de noviembre: la implementación inicial
recorría peticiones completas de seguimiento en serie sin tiempo límite. Una
petición pendiente mantenía bloqueados los controles sin mostrar avance. Ahora
se reutiliza el listado cuando ya contiene todas las órdenes; para varias páginas
se leen lotes de 100 en serie. La barra muestra
avance y permite cancelar. Un límite total de 30 segundos libera la interfaz y
presenta un error, incluso si una espera del cliente HTTP no observa el aborto.
La selección solo se publica cuando todas las páginas se validan: un error no
convierte un resultado parcial en “todas”. Sin escrituras ni cambios de backend.
La duración real de la consulta del usuario no se midió porque la ventana de
diagnóstico local no comparte su sesión autenticada.

Verificación de esta corrección: 101 pruebas aprobadas en seguimiento y su servicio,
incluidos 449 registros, carga bloqueada, cancelación y timeout con petición que
ignora el aborto. Lint focal y build frontend: exit 0. Logs `select-all-tests-final.log`,
`select-all-lint-final.log` y `select-all-build-final.log` en la carpeta de evidencia.

Diagnóstico real posterior del 13 de noviembre: la pestaña local mostró pérdidas
de conexión durante reinicios del API por ediciones concurrentes. Con el API
activo, la lectura de páginas 2 y 3 respondió HTTP 503. La reproducción SELECT
de solo lectura identificó MySQL `ER_QUERY_TIMEOUT`, errno 3024. La concurrencia
de dos consultas completas agravaba el fallo; aun en serie la paginación con
`ORDER BY pageOrdinal LIMIT ... OFFSET ...` agotó el límite en una reproducción.
Se conservó la carga serial y se acotó `paged` mediante `pageOrdinal > offset AND
pageOrdinal <= offset + limit`, reutilizando el ordinal ya calculado. No se cambió
el orden global, los filtros, permisos, límite de 100 filas ni `MAX_EXECUTION_TIME(5000)`.

La variante corregida leyó 449 filas en cinco páginas (100/100/100/100/49) en una
transacción de solo lectura por página, sin timeout: unos 21,5 segundos acumulados.
Se comprobó también el rango de ordinales 1–449. Regresión: 70 pruebas API y 102
frontend aprobadas; lint focal y builds de ambos proyectos aprobados. El frontend
distingue ahora una pérdida de conexión del mensaje genérico de filtros. No hubo
escrituras comerciales. La selección final desde la pantalla quedó sin confirmar
porque la sesión regresó al login y Microsoft local no completó el acceso; no se
presenta la reproducción SQL como aceptación completa de la UI.

## Antecedente del flujo individual — 3 de noviembre de 2026

Estado: implementado y esquema compartido aplicado con aprobación explícita, 2026-11-03. No se enviaron correos ni se cambiaron marcas de órdenes reales para pruebas.

## Reglas confirmadas

- Adéndum es un marcador de la orden, independiente de las ocho etapas de Formalización. Ninguna acción cambia etapa, origen de fondos, lead ni estado comercial.
- Marcar pendiente exige motivo no vacío3..2000 caracteres, almacenado en `note`/columnas de nota existentes. También se valida la ruta de creación/conversión de un evento Adéndum: su descripción se presenta como motivo obligatorio y se conserva en la marca.
- Cualquier usuario autenticado que tenga acceso efectivo a la orden y lectura del adéndum puede registrar «Adéndum enviado»; no requiere permisos de marcar pendiente ni de completar/cancelar. Denegaciones y autorización de la orden se mantienen. No es acceso público ni otorga permisos de catálogo/administración.
- Enviado es distinto de completado. Se conservan estados anteriores y capacidades existentes de completar/cancelar; una marca enviada puede completarse/cancelarse por esas capacidades. Marcar enviado solo parte de pendiente; replay idéntico conserva idempotencia, conflicto/versiones preservan cambios concurrentes.
- Bitácora nativa registra actor, fecha, motivo conservado y diff también para órdenes legacy. Registrar enviado no envía correo ni invitaciones.

## Contratos y plan

1. Inspeccionar/reutilizar SalesOrderAddendumService/Repository/puerto/adaptador legacy, marcación manual, calendario contextual, widgets y parsers de seguimiento. Mantener permisos existentes y definición de etapas.
2. Agregar `sent` al marcador y endpoint dedicado `POST /formalization/orders/addendum/sent`, body `{source,id,expectedVersion,operationId}`. Respuestas de adéndum incluyen `canMarkSent`; el POST general conserva solo completed/cancelled y su permiso update.
3. Migración072 en CRM_THINK_V2 y CLI legacy revisable: ampliar ENUM al final a `pending,completed,cancelled,sent`, conservando NULL/default/comentarios y todos los valores previos. Sin backfill, columnas nuevas ni grants. Preparar rollback y pedir aprobación antes de aplicarla al RDS y BD vieja.
4. Frontend motivo obligatorio, etiquetas de marca independientes de etapa, acción «Marcar adéndum como enviado» y parsers sent en órdenes/listas. Completar y cancelar conservan permiso específico.
5. Pruebas TDD de motivo ausente/blanco, calendar bypass, permisos lector vs editor/deny, enviado separado de completado, replay/CAS, auditoría y ausencia de cambios de etapa en ambas BDs. SQL solo en QA aislada; no tocar órdenes reales para simular envíos.

## Comandos y límites

Cada app usa pnpm: `pnpm exec vitest run <suites focales>`, `pnpm lint`, `pnpm typecheck`, `pnpm build`. Raíz: `.\check-all.cmd`. Reportar fallos ajenos por separado. Sin dependencias nuevas, commits, deploy ni mensajes externos. No inventar motivos para marcas históricas con nota vacía.

## Resultados

- API:119 pruebas aprobadas (servicio, repositorio, HTTP, calendario y8 SQL reales), más6 focales del inventario de rutas. SQL usa repositorio, escritor legacy y bitácora reales en QA aislada loopback3311: motivo inválido, trim, pendiente→enviado→completado por actores distintos, conservación de motivo, replay/CAS, concurrencia, rollback tras insertar auditoría y nota histórica NULL. No acredita una prueba de envío real de correo: esa acción solo registra la marca.
- Frontend:117 focales,19 regresiones de calendario y15 casos ampliados de calendario aprobados. Typecheck, build y lint focal aprobados. Se abrió LV208 sin escribir: motivo de2 caracteres mantiene botón deshabilitado; motivo válido lo habilita; se cerró sin guardar. La ficha muestra Adéndum separado de Acciones de la etapa. No se marcó enviada una orden real.
- API build/lint focal/formato propio aprobados. Typecheck inicial bloqueado por mock concurrente sin `cancel`; último corte bloqueado por `src/modules/crm/calendar/calendar-external.service.ts:211,233` usando `expectedOutlookVersion` ausente del contrato concurrente. Check global y suite frontend completa se reportan aparte; no se consideran aprobados por pasar los focales.
- El usuario autorizó expresamente ambos cambios de esquema después de QA. Se aplicó exclusivamente el CLI legacy `--apply=crmdatabase-api`, luego runner nativo `--only=202611030072_formalization_addendum_sent`. Ledger nativo verificado:2026-11-03T19:04:50.467Z. Metadata compartida en ambas columnas: `enum('pending','completed','cancelled','sent')`, NULL permitido, DEFAULT NULL, comentario vacío conservado. No grants, backfill ni UPDATE comercial; sin cambios de etapas/leads ni despliegue.
- Verificación SQL de esquema independiente:32 unitarias/runner y1 prueba real de072 en ambas BDs con reintento, ordinales y atributos conservados. Compatibilidad local MariaDB10.4.32; aplicación compartida confirmada por metadata y ledger, sin inferir resultados de la suite local como certificación completa del servidor.

## Apéndice — esquema072 y operación controlada

- `202611030072_formalization_addendum_sent` se registra después de071 en el runner nativo. Selección aislada: `pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030072_formalization_addendum_sent` (desde `apps/api`). No reejecutar065 para extender un ENUM ya migrado; su contrato histórico se conserva.
- Legacy se revisa con `pnpm exec tsx scripts/migrate-legacy-addendum-sent.ts --plan`; la ejecución exige `--apply=crmdatabase-api`. Comparte el candado de entorno del runner (`DB_NAME` y `MIGRATION_CONFIRM_SCHEMA_ONLY` nativos), su pool/TLS, y fija el destino legacy. Ni arranque de aplicación ni adaptador legacy ejecutan DDL.
- El preflight exige el destino exacto, tabla InnoDB y columna existente nullable/default NULL/sin EXTRA, con ENUM original o final exacto. La extensión agrega `sent` al final; preserva ordinales1..3, charset, collation y comentario, sin UPDATE/backfill, permisos, columnas nuevas ni cambios de etapa. Drift y ausencia abortan antes del ALTER. Una repetición después del DDL valida el contrato final y no hace otro ALTER.
- El único ALTER usa `ALGORITHM=INPLACE, LOCK=NONE`. No existe fallback a COPY ni bloqueo exclusivo. Agregar un cuarto literal mantiene el tamaño del ENUM; si la versión del servidor no admite esta operación, falla explícitamente. Se acota `lock_wait_timeout=10` antes de consultar metadata y se restaura al terminar. MDL todavía puede bloquear brevemente operaciones. DDL confirma implícitamente y no se revierte con ROLLBACK transaccional.
- Para conservar comentarios con comillas/backslashes se establece temporalmente `NO_BACKSLASH_ESCAPES`, se duplican comillas simples y se restaura sql_mode. Las sentencias mostradas por `--plan` están preparadas para ese modo de sesión; aplicar mediante el CLI, no copiar a una sesión con modo distinto.
- Rollback: detener nuevas marcas enviadas y desplegar consumidores compatibles; consultar cuántas filas tienen `sent` en cada columna. Si existe una sola, bloquear el rollback del ENUM hasta que el usuario defina la resolución. Nunca convertir enviado en completed automáticamente. Solo con cero `sent`, aprobación y metadata revisada, restaurar el ENUM original con los mismos atributos; el rollback es otro DDL no transaccional. No borrar bitácora, notas ni columnas.
- Desplegar parsers/etiquetas que comprendan `sent` junto con el esquema antes de habilitar la acción. `sent` no representa completado y no altera el parser de etapas. Verificación SQL aislada: `RUN_ADDENDUM_SENT_MYSQL_QA=3311` habilita la suite `formalization-addendum-sent.mysql.spec.ts`, fija loopback3311 y no carga `.env`. Resultados de MariaDB acreditan compatibilidad local, no equivalen a una ejecución ni certificación de MySQL RDS.

Evidencia local de072: en 2026-11-03 la suite SQL aislada pasó1 prueba en MariaDB10.4.32, host127.0.0.1:3311 con datadir validado `crm-banks-qa-20261103-3311`. Verificó ambos destinos, metadata preservada, conteo de registros, ordinales existentes y reintentos. La primera ejecución detectó case folding de nombres en Windows; se reutilizó el validador existente que solo normaliza nombre cuando `@@lower_case_table_names` lo permite. Esa primera fase solo usó QA. La aplicación posterior aprobada en ambos esquemas compartidos está registrada en Resultados, con ledger y metadata verificados.

## Límites del chequeo global al cierre

`check-all.cmd` se detuvo por formato en archivos compartidos ajenos al cambio;072 y runner fueron formateados después y sus32 pruebas volvieron a pasar. Lint frontend global detectó9 errores en otras áreas (incluye seguimiento/notas); lint focal de Adéndum aprobado. Las suites completas se ejecutaron además de las focales y sus fallos no se presentan como éxito de todo el repositorio. Los cambios concurrentes de calendario/NetSuite/notas se preservaron.

Suite API completa:7850 aprobadas,227 fallidas,266 omitidas (8343);9 archivos fallidos,230 aprobados y37 omitidos. El árbol compartido sigue teniendo fallos globales fuera de los focales de Adéndum; no se declara verde. Evidencia local: `C:/codex-data/tmp/crm-banks-20261103/addendum-api-all-tests.log`.

Suite frontend completa terminada:1970 aprobadas y9 fallidas (1979),123 archivos aprobados y7 fallidos. Ninguna suite focal de motivo/envío falló; los fallos globales pertenecen a App, banners, seguimiento, navegación, proyección NetSuite y avance. Evidencia local: `C:/codex-data/tmp/crm-banks-20261103/addendum-frontend-all-tests.log`. No se modificaron esas reglas para forzar verde el árbol concurrente.
