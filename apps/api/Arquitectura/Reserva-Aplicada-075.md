# Reserva Aplicada — custbody209

## Alcance local — 2026-11-12

NetSuite es la fuente del checkbox `custbody209` (Reserva Aplicada). Se acepta
exclusivamente `true`, `false`, `T` o `F`. Ausente conserva el valor anterior;
presente pero inválido rechaza la observación. No se modifica el responsable,
el secreto de eventos ni la configuración de NetSuite.

| Origen | Columna | Representación |
| --- | --- | --- |
| NetSuite | custbody209 | Checkbox |
| CRM_THINK_V2.crm_sales_order | reservation_applied_sales_order | yes / no / unknown |
| crmdatabase-api.ordenventa | reserva_ov | 1 / 0 |

La regla vigente confirmada por negocio es `custbody209 → reserva_ov` en legacy y `custbody209 → reservation_applied_sales_order` en nativa. El backend viejo también registra acciones de reserva en esa columna; no se mantiene una copia paralela para el banner. El check Saldo validado es independiente y jamás se infiere de reserva.

La librería local `SS2_1_LIB_CRM_habita.js`, versión **2026.11.12.2**, incluye
el campo en la lectura de la ficha y en las dos lecturas verificadas de eventos.
El RESTlet ya delega esas lecturas en la librería: no requiere otro enrutador.
El importador crea la orden y usa el mismo escritor/mapeo que una edición.
Un productor anterior que no incluya el campo no borra valores existentes.

## Migración y rollback

`202611120075_sales_order_reservation_applied` agrega la columna nativa con
default `unknown`, sin backfill ni cambios a datos comerciales existentes.
Agrega `reservation_modified_ms` y `reservation_completed_ms` a
`int_netsuite_order_cursor`: son el watermark exclusivo de este campo.
No adelanta el cursor de sincronización completa.

El DDL legacy está exportado aparte como `legacyReservationAppliedUp` en el
mismo archivo. Históricamente agregó `reserva_aplicada_ov TINYINT UNSIGNED NULL`, pero esa columna está obsoleta: el runtime usa `reserva_ov`. Se conserva el DDL aplicado para trazabilidad; no se borra ni se copia sobre reserva_ov.
El runner nativo no altera la BD vieja implícitamente.

Rollback, después de respaldar valores y detener escritores que usan el campo:

```sql
ALTER TABLE CRM_THINK_V2.int_netsuite_order_cursor
  DROP COLUMN reservation_modified_ms, DROP COLUMN reservation_completed_ms;
ALTER TABLE CRM_THINK_V2.crm_sales_order
  DROP COLUMN reservation_applied_sales_order;
ALTER TABLE `crmdatabase-api`.ordenventa DROP COLUMN reserva_aplicada_ov;
```

`down` y `legacyReservationAppliedDown` contienen esas operaciones. MySQL hace
commit implícito de DDL: aplicar cada esquema con respaldo y revisión de ledger.
No ejecutar el runner sin seleccionar la migración aprobada. Estas instrucciones
no autorizan cambios en producción: **no aplicada en producción en esta tarea**.

## Resincronización exclusiva

Desde `apps/api`, con entorno validado y después de instalar ambos esquemas y
la librería en el ambiente autorizado:

```powershell
# Inventario; no consulta NetSuite ni actualiza órdenes.
pnpm exec tsx scripts/backfill-reservation-applied.ts
# Ejecución explícita; el diario debe ser nuevo.
pnpm exec tsx scripts/backfill-reservation-applied.ts --apply --output C:/temp/reservas.jsonl
# Reintentar solo los fallos del diario anterior.
pnpm exec tsx scripts/backfill-reservation-applied.ts --apply --retry C:/temp/reservas.jsonl --output C:/temp/reservas-reintento.jsonl
```

Reutiliza `NetsuiteRestletClient.readSalesOrderSnapshot`, validación de la foto,
autoridad nativa primero / legacy después, transacción y auditoría central.
No inicia el servidor, trabajadores, importadores de relaciones ni migraciones.
Requiere la persistencia habilitada para el ambiente configurado y auditoría.

El inventario usa páginas de 50 IDs y deduplicación por ID ERP. Se procesa una
orden a la vez, con espera mínima de un segundo y hasta tres intentos con pausa
creciente. Cada resultado se guarda en JSONL antes de continuar; un fallo del
diario detiene el proceso. Solo cambia la columna Reserva Aplicada en la orden,
además del control técnico y la bitácora en la BD nueva. No toca etapa,
aprobaciones, relaciones, notas ni timestamps comerciales. No crea órdenes.

El watermark bloquea lecturas atrasadas del backfill y evita que un webhook
anterior revierta el campo. El reenvío del mismo valor no genera otro cambio ni
otra anotación central. Una actualización o auditoría fallida hace rollback.
El log no contiene snapshots, clientes, tokens ni excepciones crudas.

## Finiquito y límites de verificación

El banner y el flujo local incorporan saldo validado como check propio, separado de Reserva Aplicada. La validación requiere caída y reserva; el envío requiere además contrato firmado. Esquema076, API/UI, exclusiones y límites operativos: [Finiquito076](Finiquito-076.md). La implementación local no acredita despliegue ni migraciones en producción.

Pruebas locales cubren T/F en una orden nueva importada, ambas bases existentes,
backfill limitado a una columna, repetición sin duplicar auditoría, orden de
observaciones, migración y rollback, valores inválidos, propiedades y fuzzing.
Los esquemas SQL de prueba viven en MariaDB desechable en loopback 3309, nunca RDS.
No se ha ejecutado el inventario/resincronización sobre las órdenes reales ni
publicado la librería: las cifras reales actualizadas/omitidas/fallidas siguen
pendientes y no se deducen del número de pruebas.

## Archivos del cambio

- `src/integrations/netsuite/suitescript/SS2_1_LIB_CRM_habita.js`: productor y versión; secreto intacto.
- `src/integrations/netsuite/netsuite-order-event.mapper.ts`: mapeo opcional estricto de custbody209.
- `src/integrations/netsuite/netsuite-order-event.repository.ts`: carga exclusiva, autoridad y auditoría reutilizadas.
- `src/integrations/netsuite/netsuite-order-event.ordering.ts`: control de antigüedad específico de reserva.
- `src/integrations/netsuite/netsuite-order-event.service.ts`: reutilización de validación temporal y huella.
- `src/integrations/netsuite/netsuite-reservation-backfill.ts`: lotes, espera, reintentos y resultados sanitizados.
- `scripts/backfill-reservation-applied.ts`: inventario, ejecución explícita y reintento desde JSONL.
- `migrations/schema-only/202611120075_sales_order_reservation_applied.ts` y `scripts/run-schema-migrations.ts`: esquema y registro075; DDL legacy separado.
- `src/modules/crm/sales/sales-orders/{sales-orders.tables,contract-transition.port,contract-transition.repository,finiquito.policy}.ts`: tipo, consulta exclusiva y elegibilidad del finiquito existente.
- `src/integrations/legacy-crm/legacy-contract-transition.writer.ts`: lectura exclusiva del indicador ERP, sin ampliar la consulta de las demás transiciones.
- Pruebas en `test/integrations/netsuite-reservation-*.spec.ts`, fixture SQL de eventos, productor real, arnés SuiteScript, paquete, registro de migraciones y finiquito/lector legacy.

## Evidencia previa de075 (anterior a076)

- `pnpm check` del API: exit0, 8786 pruebas aprobadas y 288 SQL/opt-in omitidas por ese comando; incluye formato, lint, TypeScript y build.
- `check-all.cmd`: exit0. Frontend: 2119 pruebas aprobadas, formato, lint, TypeScript y build correctos. El chequeo global precedió a la separación final de la lectura de reserva; el `pnpm check` del API posterior verificó esa separación.
- Suite SQL afectada en instancia desechable: exit0, **53 pruebas ejecutadas**, incluyendo ambos destinos, 075/rollback, reordenamiento y rollback de auditoría.
- Paquete SuiteScript: exit0, 15 pruebas; productor real de la librería con custbody209 verdadero y falso: exit0, 14 pruebas.
- Revisión independiente reprodujo el riesgo de sobrescritura atrasada y verificó su corrección con el watermark exclusivo.
- No hubo ejecución del backfill contra órdenes reales; actualizadas/omitidas/fallidas reales: **no medido**.



## Aplicación autorizada — 2026-11-12

Esta actualización sustituye las menciones anteriores de migraciones pendientes en RDS.
Se aplicaron exclusivamente075 y076 con selección `--only` mediante el runner nativo; ambas quedaron en `conf_schema_migration`.
Se aplicaron por separado `legacyReservationAppliedUp` y `applyLegacyFiniquitoWorkflow`, bajo el mismo lock de migración.
Respaldo previo de DDL, conteos y evidencia de finiquito: `C:/codex-data/backups/habita-finiquito-2026-11-12T20-29-55.679Z/before.json`.
Se verificaron12 columnas nuevas nativas (incluidos dos cursores técnicos) y10 legacy.
Las órdenes conservaron sus cantidades:15 nativas y469 legacy. No había historia previa de finiquito para restaurar.
La consulta real `readFiniquitoOverview` usando ambas fuentes terminó sin error y devolvió las cuatro cifras en0.
Reserva Aplicada sigue desconocida en las484 órdenes; no se infirió desde `reserva_ov` ni se ejecutó backfill contra NetSuite.
Saldo validado quedó en0 por defecto, independiente de reserva. No se marcaron envíos ni recepciones.
Pendientes operativos: traer `custbody209` con la librería actualizada y la resincronización exclusiva autorizada; no se hizo deploy en esta operación.


## Corrección de autoridad de reserva — 2026-11-12

La aclaración posterior de negocio sustituye la separación inicial de dos marcas legacy:
`custbody209` se escribe en `crmdatabase-api.ordenventa.reserva_ov` (T/true→1, F/false→0).
En `CRM_THINK_V2.crm_sales_order` se conserva `reservation_applied_sales_order` (yes/no).
Importación/creación nativa, sincronización manual, edición webhook y backfill reutilizan este mismo mapa.
Los filtros de finiquito y su validación de acciones leen la misma columna canónica en cada destino.
`reserva_aplicada_ov` queda obsoleta y sin lectores/escritores runtime; no se elimina esquema ni se copia su valor sobre los datos existentes.
La075 ya aplicada conserva su SQL histórico y rollback. Este arreglo no requiere otra migración.
No se borran cursores/recibos: un evento idéntico continúa siendo duplicado; una lectura fresca puede reconciliar el dato respetando antigüedad.
Legacy ya tiene reservas históricas y no necesita completar la columna obsoleta para aparecer en Validación de saldo.
La carga inicial de Reserva Aplicada en órdenes nativas aún desconocidas requiere una lectura nueva de NetSuite; no se inventa desde otra marca.
Saldo validado, usuario/fecha y el resto de pasos de finiquito permanecen separados. No se cambia SuiteScript ni el secreto.

### Evidencia de la corrección canónica

- Regresión inicial:3 fallos reproducidos con el mapa anterior; después del arreglo68 pruebas unitarias afectadas aprobadas.
- Propiedades/fuzz de checkbox: semillas209,200 casos por propiedad; se comprueba el nombre físico canónico además de T/F, ausente y repetición.
- SQL aislado:53/53 de NetSuite (creación/importación, edición, backfill, antigüedad y rollback) y12/12 de finiquito en ambas fuentes.
- El fixture de finiquito incluye valores contradictorios de la columna obsoleta y demuestra que no participa en conteos ni elegibilidad.
- Consulta real de solo lectura con el código corregido:131 órdenes en Validación de saldo; pendientes de envío/firma/formalizadas en0.
- Revisor independiente confirmó en lectura los caminos compartidos y las protecciones de idempotencia; no ejecutó SQL ni modificó archivos.
- No se desplegó, no se borraron columnas ni se ejecutó backfill real. No se cambió SuiteScript ni credenciales en esta corrección.

Chequeo final de esta corrección: `check-all.cmd` exit0; API8820 pruebas aprobadas,300 opt-in omitidas (65 SQL afectadas ejecutadas aparte); frontend2159 pruebas aprobadas. Formato, lint, TypeScript y builds correctos. La comprobación final readonly del banner volvió a devolver131 en Validación de saldo. Los fallos históricos de Mercadeo anotados antes ya no aparecen en esta ejecución; no se atribuye a este arreglo la modificación de esos archivos ajenos. Sin deploy ni edición real en NetSuite en esta tarea.

## Estado vigente: columna legacy obsoleta eliminada — 2026-11-12

Esta actualización sustituye las menciones anteriores de conservar físicamente la columna obsoleta.
Con autorización explícita del propietario se ejecutó únicamente:

```sql
ALTER TABLE `crmdatabase-api`.ordenventa DROP COLUMN reserva_aplicada_ov;
```

- Respaldo previo de definición y469 pares ID/valores: `C:/codex-data/backups/habita-remove-obsolete-reserve-2026-11-12T21-04-46.211Z/before.json`; valores inmediatamente anteriores alDROP en `pre-drop-values.json` del mismo directorio.
- Los469 valores obsoletos eranNULL. No se detectaron referencias en vistas, triggers, rutinas, eventos, índices, columnas generadas ni restricciones visibles.
- `reserva_ov` y sus469 valores quedaron idénticos antes/después. La columna nativa `reservation_applied_sales_order ENUM('yes','no','unknown')` permanece intacta.
- El banner y las acciones consumen exclusivamente las columnas canónicas. La consulta real posterior alDROP devolvió131 en Validación de saldo,0 en las otras tres secciones y25 filas en la primera página.
- Prueba InnoDB aislada posterior:13/13, incluyendo ausencia física de la columna, lectura del banner, elegibilidad y validación de saldo legacy sin alterar reserva_ov.
- Componente/lista del banner:9/9 pruebas aprobadas. No se modificó código de aplicación en esta limpieza; el chequeo global de la corrección canónica anterior ya aprobó.
- El export `legacyReservationAppliedUp` se conserva solo como definición histórica/rollback, no como paso de instalación vigente. El runner nativo075 no lo ejecuta ni recrea la columna.
- Rollback: recrear exclusivamente `reserva_aplicada_ov TINYINT UNSIGNED NULL DEFAULT NULL` y restaurar solo sus valores por `id_ov` desde el respaldo. No copiarla a reserva_ov. DDL con commit implícito, sin rollback transaccional prometido.
- No se publicaron versiones ni se actualizó SuiteScript. La limpieza no requiere cambios en la BD nueva.
