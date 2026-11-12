# Ventas caídas · Gestión de finiquito — 076

## Alcance local, 12 de noviembre de 2026

Implementación local del banner real, sus colas paginadas y las tres marcas financieras.
No acredita aplicación en RDS, publicación de Habita ni actualización de NetSuite.
La migración075/Reserva Aplicada y la076 deben estar instaladas en ambos esquemas antes de habilitar estas consultas.

**Saldo validado es un check propio del CRM, independiente de Reserva Aplicada.**
No se deriva de reserva, contrato, preparación ni envío histórico.

| Dato | CRM_THINK_V2.crm_sales_order | crmdatabase-api.ordenventa |
| --- | --- | --- |
| Saldo validado | balance_validated_sales_order | saldo_validado_ov |
| Usuario que validó | balance_validated_by_sales_order | saldo_validado_por_ov |
| Fecha de validación | balance_validated_at_sales_order | saldo_validado_fecha_ov |
| Finiquito enviado | finiquito_sent_sales_order | finiquito_enviado_ov |
| Usuario de envío | finiquito_sent_by_sales_order | finiquito_enviado_por_ov |
| Fecha de envío | finiquito_sent_at_sales_order | finiquito_enviado_fecha_ov |
| Finiquito recibido | finiquito_received_sales_order | finiquito_recibido_ov |
| Usuario de recepción | finiquito_received_by_sales_order | finiquito_recibido_por_ov |
| Fecha de recepción | finiquito_received_at_sales_order | finiquito_recibido_fecha_ov |

Checks: TINYINT UNSIGNED NOT NULL DEFAULT 0. Usuarios: CHAR(26) NULL, identidad pública del actor autenticado.
Fechas: DATETIME(3) NULL, UTC del servidor. No hay nuevos índices ni permisos.
La076 restaura envío/recepción acreditados por la bitácora histórica, con actor y fecha de su primera evidencia;
saldo continúa en0. Una orden nativa promovida conserva la identidad canónica legacy de su auditoría.

## Reglas y acciones

1. Venta caída `custbody43=T` y Reserva Aplicada `custbody209=T`, sin saldo validado: **Validación de saldo**.
2. «Marcar saldo validado» acepta la caída con reserva aunque todavía falte contrato. No altera checks ERP.
3. Con saldo, caída, reserva y Contrato firmado confirmados: **Finiquito pendiente**.
   Si faltan requisitos ERP después de validar, conserva la marca y aparece al consultar todas las órdenes del circuito, con advertencia.
4. «Marcar finiquito enviado»: **Finiquito firmado**, nombre actual del banner para enviado pendiente de devolución.
5. «Marcar finiquito recibido»: **Formalizada**. No equivale al cierre comercial de una venta activa.

Los botones ordinarios no saltan ni revierten. El ajuste manual de órdenes antiguas se describe abajo. Cada acción exige confirmación. El servidor relee y bloquea la orden,
valida permisos vivos, versión e idempotencia y deriva actor/fecha sin aceptar esos valores del cliente.
Reenvío idéntico no duplica marcas ni auditoría; devuelve la foto actual. Un UUID con otro actor/contenido es409.
Un conflicto requiere recargar, no reintentar con una versión inventada.
Enviar/recibir registran hechos: este cambio no envía correos automáticamente.

Las etiquetas del circuito «Venta caída» y «Contrato firmado» aparecen después de validar saldo;
el panel de checks de NetSuite sigue siendo de solo lectura.
Las filas y cabeceras de órdenes caídas o con historia de finiquito se distinguen en rojo.

## Reutilización, API y bitácora

- `GET /formalization/orders/finiquito/overview?section=all&page=1`: cifras completas y página de25; no cuenta solo la página visible.
- `GET /formalization/orders/finiquito?source=...&id=...`: foto actual de las marcas.
- `POST /formalization/orders/finiquito`: acciones `balance_validated`, `sent`, `signed`, con `expectedVersion` y `operationId`.
- También admite `set_stage` para reconciliación manual, con `targetStage` obligatorio y `reason` opcional.
- Lectura: permiso efectivo existente `formalizacion.orders.read`. Escritura: también `formalizacion.orders.stage.update`.
  Sesión, CSRF y denegaciones siguen vigentes. No depende del permiso de Adéndum.
- La ficha existente ejecuta las marcas desde la lista del banner; no se duplica un motor de estados.
- `ContractTransitionRepository` resuelve nativa primero, legacy después y usa la misma transacción.
- `finiquito.storage.ts` limita las escrituras a las columnas propias; la bitácora central usa `formalizacion.finiquito`.
  Guarda anterior/nuevo, acción, versión, orden, actor y fecha. Si falla, revierte la marca incluso en destino legacy.
- Las consultas comerciales y Adéndum excluyen caídas y/o historia de finiquito. La exclusión persiste si ERP desmarca la caída;
  no borra la historia. Acciones comerciales y promoción automática de cuotas no avanzan esa rama.
- Los errores de consulta se muestran como «No disponible · Reintentar», nunca como cuatro ceros exitosos.

## Migración y rollback

`migrations/schema-only/202611120076_finiquito_workflow.ts` registra la076 nativa.
`applyLegacyFiniquitoWorkflow` es un DDL separado y explícito: el runner nativo no altera legacy automáticamente.
No ejecutado en producción. MySQL confirma DDL implícitamente: respaldo, revisión de ledger y coordinación de escritores son necesarios.
Ante aplicación parcial no repetir ALTER a ciegas; verificar columnas y restauración histórica antes de registrar éxito.

Después de respaldar columnas y bitácora, detener los escritores y retirar el código que las requiere.
`down` contiene el rollback nativo; el equivalente legacy es:

```sql
ALTER TABLE `crmdatabase-api`.ordenventa
  DROP COLUMN saldo_validado_ov, DROP COLUMN saldo_validado_por_ov, DROP COLUMN saldo_validado_fecha_ov,
  DROP COLUMN finiquito_enviado_ov, DROP COLUMN finiquito_enviado_por_ov, DROP COLUMN finiquito_enviado_fecha_ov,
  DROP COLUMN finiquito_recibido_ov, DROP COLUMN finiquito_recibido_por_ov, DROP COLUMN finiquito_recibido_fecha_ov;
```

No borrar el diario de auditoría al hacer rollback. Reinstalar columnas requiere restaurar también saldo validado desde respaldo,
pues la migración no puede asumir esa decisión financiera. Eliminar columnas sin respaldo pierde la proyección durable.

## Verificación y pendientes operativos

- Pruebas InnoDB aisladas: ambos destinos, marcas, actores/fechas, reserva obligatoria, contrato posterior al saldo,
  secuencia, UUID, concurrencia/CAS, rollback ante fallo de bitácora, historia y alias canónicos.
- Revisión adversarial independiente, propiedades generadas y entradas malformadas; fixture loopback, sin RDS.
- UI: confirmaciones, lectura sin escritura, contrato pendiente, conflicto, reintento UUID, historial anterior,
  contadores reales, errores sin cero ficticio, selección de sección y apertura de ficha.
- Los resultados finales de checks se informan separadamente; estos casos no certifican producción.
- Pendientes: aplicar075/076 y DDL legacy con aprobación de producción, publicar API/UI, actualizar librería209 en NetSuite
  por el operador y ejecutar resincronización exclusiva de reserva en ambiente autorizado. No se ha medido el backfill real.

Diagrama: [Flujo de finiquito](Flujo-Ventas-Caidas-Finiquito.md). Reserva ERP y backfill: [075](Reserva-Aplicada-075.md).

## Evidencia ejecutada

- MariaDB/InnoDB desechable: **12/12** pruebas de finiquito, incluidas las cuatro cifras después de cada marca en ambos destinos, espera de contrato, fechas/actores, conflictos, alias e historia; rollback076 y reinstalación en ambos esquemas.
- Regresión SQL de sincronización NetSuite: **53/53**, en una instancia nueva separada.
- Frontera HTTP y aprobación comercial: **33/33**, incluida denegación de lectura, filtros inválidos y bloqueo antes del ERP.
- Controles generados: 500 entradas de autoridad/versiones con semillas7612001/7612002, además de propiedades de la suite existente.
- Revisión independiente final: conformes identidad canónica, replay coherente, exclusión de aprobación antes del ERP y exclusión del contador bancario. No acredita aceptación visual ni producción.
- Los contenedores de prueba propios se eliminaron al terminar. Ningún cambio sobre RDS ni publicación en NetSuite.
- Chequeo API desde el comando raíz: formato, lint, TypeScript y build correctos; **8819** pruebas aprobadas y **300** opt-in omitidas (las65 SQL afectadas se ejecutaron aparte).
- Frontend: formato, lint, TypeScript y build correctos. La suite completa detecta fallos en Mercadeo con cambios locales preexistentes: `MarketingLeadCapturePage` inicia en `day` mientras sus fixtures conectados esperan `month`. Esos archivos no se cambiaron para resolver este flujo. No declarar el chequeo global en verde.
- Suite frontend final: **2113 aprobadas, 19 fallidas**, únicamente `test/home/marketing-capture-connected.spec.tsx`; los dos archivos de pruebas de finiquito aprobaron (23 casos). `pnpm check` frontend termina en exit1 por Mercadeo; `pnpm build` ejecutado por separado termina en exit0. Lint sin errores, con una advertencia de Fast Refresh por hook/componente colocados juntos. No se acredita chequeo global exit0 ni aceptación visual en navegador.

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

## Tabla de seguimiento: etapa y caída — 2026-11-12

Cambio posterior a las verificaciones anteriores: preparado en código y revisado estáticamente, SIN ejecutar pruebas por instrucción expresa.

- «Todas» incluye órdenes caídas con permiso de lectura de orden, tengan o no contrato/reserva y aunque estén inactivas. Se mantienen las exclusiones de borradas nativas y la autoridad nativa sobre el alias legacy.
- Las no caídas conservan exactamente la elegibilidad anterior. Proyectos, búsqueda, selección de bandejas, permisos y paginación siguen en la consulta existente.
- Las caídas conservan su última etapa comercial válida guardada. Si falta una etapa válida se usa «Sin etapa de Formalización»; no se inventa un avance por los checks actuales.
- En la tabla se muestra «<Etapa> / Caída», con fila y etiqueta rojas. El siguiente paso indica revisar reserva/saldo en vez de proponer una acción comercial.
- Seleccionar una bandeja comercial sigue excluyendo caídas; «Todas» permite consultarlas. Ningún otro banner ni serie de distribución comercial las incluye. Finiquito continúa exigiendo reserva.
- No se modificaron campos, BDs, transiciones de escritura ni sincronización con NetSuite en este cambio de presentación/lectura.

Archivos: `follow-up.query.ts`, `follow-up.repository.ts`, `legacy-follow-up.reader.ts`, `follow-up.contract.ts`; frontend `FormalizationFollowUpPreview.tsx`, `FormalizationStageChip.tsx`, `FormalizationHomePage.css`. Casos preparados en `follow-up-query.spec.ts`, `follow-up.spec.ts` y `formalization-follow-up.spec.tsx`.

Comandos para que el propietario ejecute desde PowerShell (no ejecutados por el agente):

```powershell
Set-Location -LiteralPath 'C:\Users\RobertoCarlosZuñigaA\Documents\ROCCA ARCHIVOS\Desarrollo\PROYECTOS DESAROLLOS\CRM VERION NESTJS'
pnpm --dir apps/api exec vitest run test/sales-orders/follow-up-query.spec.ts test/sales-orders/follow-up.spec.ts
pnpm --dir apps/frontend exec vitest run test/home/formalization-follow-up.spec.tsx
# Verificación global opcional:
.\check-all.cmd
```

Estos casos usan fixtures y dobles existentes, no hacen una edición real de NetSuite. La sincronización bidireccional adicional queda fuera de este cambio y no se declara verificada.


### Filtros compartidos desde el banner (2026-11-12)

Cada sección de «Ventas caídas · Gestión de finiquito» agrega una selección a
«Bandejas y subestados» y desplaza el foco visual a Pendientes de seguimiento.
No abre otra ventana ni navega. Conserva búsqueda, proyectos y selecciones previas;
varias bandejas se combinan con OR y mantienen la paginación del servidor.

| Sección | Filtro de seguimiento |
| --- | --- |
| Validación de saldo | `finiquito_validation` |
| Finiquito pendiente | `finiquito_pending` |
| Finiquito firmado | `finiquito_signed` |
| Formalizada | `finiquito_formalized` |

El API comparte la clasificación SQL con el resumen de finiquito. La lectura de
estas cuatro bandejas exige `formalizacion.orders.read` efectivo; un deny prevalece.
Las demás bandejas mantienen sus permisos y excluyen las caídas y el historial de
finiquito. No se agregan columnas ni migraciones por esta conexión.

Verificación de este ajuste: revisión estática independiente, formato, `git diff --check` y `pnpm typecheck` en API y frontend (exit 0). Pruebas preparadas sin ejecutarlas, conforme a la restricción del usuario. Pendiente comprobación funcional.
Comandos para ejecución por el usuario:

```powershell
cd apps/frontend
pnpm exec vitest run test/home/formalization-follow-up.spec.tsx test/home/formalization-filter-preferences.spec.ts
cd ../api
pnpm exec vitest run test/sales-orders/follow-up-query.spec.ts test/security/route-permission.http.spec.ts
```


### Selector de proyectos sin etiquetas duplicadas

En Pendientes de seguimiento, el selector agrupa los nombres de proyecto iguales
(ignorando mayúsculas y espacios repetidos) en una sola opción. Al elegirla envía
todos sus IDs nativos/legacy al filtro existente, sin modificar registros ni sus
relaciones. Quitar la opción elimina todos los IDs del grupo. Se mantiene el límite
de 50 IDs: se deshabilita una opción adicional si el grupo excedería ese límite.
Regresiones preparadas en `formalization-project-options.spec.ts`, sin ejecutarlas.


Corrección de interacción del banner: el contenido compartido de aprobación usa
`pointer-events: none` porque allí hay un botón superpuesto. Finiquito tiene
botones individuales, por lo que se restablece `pointer-events: auto` únicamente
en sus botones (incluido Reintentar). No cambia las acciones de otros banners.
Verificación funcional en navegador pendiente; no se ejecutaron pruebas.


### Corrección del reporte de validación (8 fallos, 2026-11-12)

El resumen comercial no debe considerar los permisos `finiquito_*` al decidir si
puede mostrar el agregado de duplicados excluidos: esos permisos pertenecen a otro
circuito. Se corrigió esa máscara; mantiene oculto el agregado si falta un permiso
comercial. Esto atiende los dos casos de rendimiento y el caso de resumen.

Las otras cinco expectativas se alinearon con los contratos vigentes: registro
local de la migración 077 (sin ejecutarla), cuatro permisos de bandeja falsos para
un usuario de contratos, lectura de finiquito sin conceder bandejas comerciales y
dos verificaciones del parámetro de autorización en el SQL actualizado.
Pruebas no ejecutadas por restricción del usuario; estos ocho casos deben
confirmarse al repetir `check-all.cmd`.


## Ajuste manual de órdenes antiguas — 12 de noviembre de 2026

Cambio local solicitado por el propietario: selector **Estado del finiquito**, motivo opcional,
**Guardar** y botón **Terminar finiquito**. No hay restricción por fecha de creación: aplica a toda
orden elegible que el usuario pueda editar. Los cuatro destinos son del finiquito; no son etapas comerciales.
Se permite avanzar directamente o volver atrás. Terminar selecciona Formalizada y exige la misma confirmación.

| Destino manual | targetStage | Saldo validado | Enviado | Recibido |
| --- | --- | --- | --- | --- |
| Validación de saldo | validation | No | No | No |
| Finiquito pendiente | pending_send | Sí | No | No |
| Finiquito firmado | waiting_signature | Sí | Sí | No |
| Formalizada | formalized | Sí | Sí | Sí |

El POST existente usa `status: set_stage`, `targetStage`, `reason` opcional (hasta 1000 caracteres),
`expectedVersion` y `operationId`. Conserva permiso efectivo stage.update, lectura de la orden,
elegibilidad por Venta caída y Reserva Aplicada, bloqueo de autoridad nativa/legacy y transacción única.
El ajuste histórico no exige Contrato firmado en NetSuite; los pasos ordinarios sí conservan esa validación.
El panel advierte que el registro manual ajusta las marcas y no envía correos ni confirma hechos externos.

Las marcas que permanecen en Sí conservan autor/fecha; las nuevas toman el usuario vivo y hora SQL.
Una reversa limpia la marca y sus columnas de autor/fecha actuales, conservando los eventos previos.
La bitácora agrega destino manual, motivo, anterior/nuevo, actor, fecha y versión. No se borra historial.
La misma operación solo se reproduce con idénticos actor, destino, motivo y versión; otro contenido es 409.
Conflictos bloquean la edición y piden actualizar; un fallo incierto conserva el cuerpo original para reintentar.

Las consultas de seguimiento y overview consideran la etapa manual del último evento del finiquito,
para ubicar correctamente órdenes antiguas con checks ERP incompletos. Una acción ordinaria posterior
vuelve a la clasificación ordinaria. No se toca la etapa comercial, NetSuite, Reserva Aplicada ni Venta caída.
No requiere migración nueva ni volver a publicar SuiteScript; requiere API y frontend actualizados.
No se han aplicado cambios a órdenes desde Codex ni se ha desplegado esta función.

Archivos principales: `finiquito.policy.ts`, `finiquito.storage.ts`, `finiquito-overview.query.ts`,
`follow-up.query.ts`, `contract-transition.repository.ts`, `contract-transition.controller.ts`;
frontend `finiquito-service.ts`, `FormalizationFiniquito.tsx`, `FormalizationFiniquitoStageEditor.tsx`
y `FormalizationFiniquito.css`. Se prepararon regresiones de políticas, servicio, persistencia y UI.

Verificación de esta revisión: pruebas automatizadas sin ejecutar por instrucción del usuario.
Quedan pendientes pruebas de ida/vuelta nativas y legacy en SQL aislado, concurrencia, fallo de auditoría,
colas y aceptación visual. No interpretar los tests con DummyDriver como prueba de atomicidad InnoDB.

Comandos focalizados para ejecutar manualmente desde la raíz del repositorio:

```powershell
Push-Location apps/api
pnpm exec vitest run test/sales-orders/finiquito.policy.spec.ts test/sales-orders/finiquito-balance.policy.spec.ts test/sales-orders/finiquito.service.spec.ts test/sales-orders/finiquito.repository.spec.ts test/sales-orders/follow-up-query.spec.ts test/security/finiquito.http.spec.ts
$apiExit = $LASTEXITCODE
Pop-Location
Push-Location apps/frontend
pnpm exec vitest run test/home/formalization-finiquito.spec.tsx test/home/formalization-finiquito-banner.spec.tsx
$frontendExit = $LASTEXITCODE
Pop-Location
Write-Output "API=$apiExit Frontend=$frontendExit"
```

Verificación completa posterior: `./check-all.cmd` desde la raíz. Las suites SQL solo deben
usar fixtures sintéticos y bases desechables. Compartir salida y códigos de salida; no ejecutar
pruebas contra producción ni generar órdenes reales para validar esta función.

Comprobaciones estáticas finales de este ajuste: tipos de API y frontend, lint de todos los archivos afectados y revisión de whitespace del diff con salida 0. Las pruebas preparadas no se ejecutaron.

El motivo manual se precarga con «Actualización manual del estado del finiquito.». Puede editarse o dejarse vacío: la API aplica ese mismo texto al omitirlo, vaciarlo o enviar espacios. No bloquea Guardar ni Terminar finiquito. La bitácora y el replay usan siempre el motivo normalizado.
