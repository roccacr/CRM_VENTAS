# 88 — Motivo y envío del adéndum

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
