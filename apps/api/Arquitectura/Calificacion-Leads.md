# Indicador de calificación de leads

| Fuente | Tabla | Columna | Valores | Default |
|---|---|---|---|---|
| CRM_THINK_V2 | crm_lead | is_qualified_lead | 0 No calificado / 1 Calificado | 0 |
| crmdatabase-api | leads | calificado_lead | 0 No calificado / 1 Calificado | 0 |

Ambas columnas son TINYINT(1) NOT NULL con CHECK que limita a 0/1 y default 0. Representan el indicador manual persistido. La consulta del reporte no modifica ese indicador ni copia leads entre fuentes; su clasificacion efectiva se resuelve por separado a partir de evidencia real.

Migración nativa: `202611030073_lead_qualification`, registrada en el runner y en su ledger al aplicarla. Ejecutar desde apps/api: `pnpm migrate:identity:schema --only=202611030073_lead_qualification`. Solo esa migración, sin ejecutar las anteriores pendientes.

Legacy separado: `pnpm exec tsx scripts/migrate-legacy-lead-qualification.ts --plan` y `--apply=crmdatabase-api`. Verifica destino, tabla InnoDB y contrato de cualquier columna/restricción existente; nunca sobrescribe una definición incompatible ni reinicia calificaciones en reintentos.

## Clasificacion efectiva y filtro de Captacion

`GET /marketing/leads/report?period=day|week|month|all&qualification=all|qualified|unqualified` mantiene `mercadeo.leads.read` y sus scopes/denies existentes. `qualification` tiene default `all` y se devuelve como eco en la respuesta. La pantalla `/home/marketing/leads` ofrece Todos, Calificado y No calificado.

Un lead queda calificado si su indicador manual es 1 **O** tiene evidencia de cita valida **O** estimacion/prerreserva **O** orden de venta. La prioridad de lectura es cita, estimacion y OV; no se suman como calificaciones diferentes. Flag 0 sin ninguna evidencia queda No calificado. No se infiere calificacion desde interes, oportunidad, cantidad, estado del lead ni un flag de reserva inventado.

Relaciones utilizadas:

- Citas nativas: `crm_calendar_appointment.lead_id_calendar_appointment` y `crm_calendar_event_link` hacia el lead. Solo tipo Cita/appointment, fecha valida y estado `scheduled` o `completed` califican; eventos/vinculos borrados y citas canceladas no califican.
- Citas legacy: `calendars.id_lead` referencia `leads.idinterno_lead`, cuya unicidad se exige. Si `crm_calendar_event.legacy_calendar_id_calendar_event` identifica un evento promovido, prevalecen su estado y fecha canonicos; un evento canonico borrado se trata como cancelado. Su fecha se proyecta como `YYYY-MM-DDTHH:mm:ss` para conservar la validacion existente.
- Citas CRM nuevas relacionadas con leads legacy: `crm_calendar_event_link.source_calendar_event_link='legacy'`, tipo entidad `lead` y `entity_public_id_calendar_event_link` hacia `leads.id_lead` (PK exacta). Esta relacion no depende de la unicidad de la referencia provider. Se excluyen eventos/vinculos borrados.
- Estimaciones/prerreservas: `estimaciones.idLead_est` hacia `leads.idinterno_lead`; la prerreserva real es parte de la estimacion (`pre_reserva`). No hay fuente nativa de estimaciones en el runtime actual.
- OV: `crm_sales_order.lead_id_sales_order` hacia `crm_lead.id_lead`, excluyendo OV nativas borradas; legacy `ordenventa.id_ov_lead` hacia `leads.idinterno_lead`.

Referencias provider vacias, cero, duplicadas o aliases ambiguos no atribuyen evidencia comercial ni citas legacy por provider: se excluye esa asociacion porque no identifica un lead unico. La evidencia por PK exacta mantiene su validez independiente. Una promocion con referencia externa unica combina evidencia de citas/comercial y conserva una sola cohorte con autoridad nativa; el flag manual legacy no reemplaza el nativo. No se unen clientes por email.

El filtro se aplica despues de resolver cohortes, aliases y ACL, antes de agregar filas, medidas, calidad y conteos por fuente. `coverage` conserva las fechas de cohortes visibles anteriores al filtro para mantener los controles de fecha. Todas las medidas y los filtros de fecha, proyecto, campana y anuncio trabajan sobre la seleccion resultante.

Esta lectura y su selector no realizan UPDATE, backfill, cambios de esquema ni grants. No se incorporan comandos de escritura del indicador, nota o prohibicion de retirar una calificacion; esas acciones requieren su propio contrato.

Verificación: metadatos de columnas y restricciones, DEFAULT desde MySQL y conteos 0/1/nulos. No crear leads ficticios en las BDs compartidas para probar el default. Reversión manual futura: retirar primero consumidores y luego la restricción y columna en cada fuente; no ejecutar automáticamente, pues eliminaría calificaciones guardadas.

Compatibilidad legacy MySQL 8.4: las relaciones existentes referencian índices no únicos. El servidor rechaza incluso ADD COLUMN con ER_DROP_INDEX_FK mientras `restrict_fk_on_non_standard_key=ON`. El ejecutor legacy usa OFF solo en su sesión y restaura el valor inicial en finally, sin tocar índices, relaciones, la configuración global ni `foreign_key_checks` (debe permanecer en 1). Referencia: https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_restrict_fk_on_non_standard_key


## Verificación de lectura — 2026-11-03

Snapshot RDS de solo lectura con los repositorios y el modelo actuales, posterior a la corrección del formato de fecha de citas promovidas:

- Total: **57.907 = 1.011 calificados + 56.896 no calificados**.
- Noviembre (1–3): **49 = 1 calificado + 48 no calificados**.
- Partición `all = qualified + unqualified`: **PASS** por cada clave de fila y las cinco medidas (`leads`, `noAppointment`, `scheduled`, `completed`, `lost`) en los cuatro períodos (`all`, `month`, `week`, `day`).
- `coverage` idéntica en los tres filtros: **2024-01-09 a 2026-11-03**.
- La fuente nativa contiene **0 leads** en este snapshot; su comportamiento se verificó mediante pruebas automatizadas, no con cohortes nativas reales.

No se realizaron escrituras ni cambios de esquema. Esta evidencia no acredita despliegue.

Verificacion visual comunicada por el agente principal: noviembre muestra Todos 49, Calificado 1 y No calificado 48; al combinar No calificado con Con cita, el resultado es 0.
