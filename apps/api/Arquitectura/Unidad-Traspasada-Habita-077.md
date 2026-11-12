# Flujo para Unidad traspasada desde Habita

Revisión local del 12 de noviembre de 2026. Migración 077 aplicada y verificada en CRM_THINK_V2 con autorización. La corrección del botón descrita aquí no tiene pruebas ejecutadas ni despliegue confirmado.

## Entrada y contrato

El botón **Cerrar formalización** de `apps/frontend/src/modules/home/FormalizationStageEditor.tsx`
envía `POST /formalization/orders/stage`, acción `set`, destino `closed`.
Solo cuando la etapa autoritativa anterior es `transfer_signed` se ejecuta el nuevo flujo.
La misma condición cubre el selector excepcional **Mover a otro estado**.
Se conservan permisos vivos, alcance, versión, aprobaciones y contrato firmado. Desde transfer_signed se permite solicitar closed sin Unidad entregada previa: el workflow se ejecuta antes de guardar. Los cierres desde otras etapas conservan su requisito de Unidad entregada.
No se modifican otros saltos permitidos ni se ejecutan workflows desde el receptor de eventos.

El puerto `UnitTransferWorkflow` mantiene la dependencia del dominio sin nombres de proveedor.
El adaptador NetSuite resuelve la referencia nativa única o usa el lector legacy existente.
El cliente comparte OAuth PUT, límite de respuesta, timeout de 15 segundos y ausencia de reintentos
con la aprobación existente. Valida orden, acción, workflow, estado e instancia exactos.

El SuiteScript agrega `PUT { module: 'salesOrders', action: 'transferUnit', id }`.
Ejecuta `N/workflow.trigger` con `customworkflow220 / workflowstate2780`, verifica instancia positiva
y relee orden no caída y aprobación de Formalización. Esta acción no exige ni escribe Unidad entregada (`custbody91`).
No escribe casillas directamente. Una instancia acredita la llamada aceptada; no demuestra por sí
sola que todas las acciones configuradas del workflow hayan producido su efecto de negocio.
Eso requiere aceptación en Sandbox con la definición real de 220.

`customworkflow219` conserva `N/workflow.initiate` sin stateId ni actionId, sus prerrequisitos,
idempotencia por aprobación, relectura y respuestas. `workflowstate2778` sigue siendo diagnóstico.
La función interna compartida selecciona initiate o trigger según la definición recibida.
Referencia de Oracle: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4344892270.html

## Persistencia y recuperación

Migración **077**: `int_order_workflow_execution`, aplicada con selección exclusiva y verificada en CRM_THINK_V2 el 12 de noviembre. No se ejecutaron workflows ni se modificaron órdenes al aplicarla. Registra acción, referencia externa, entorno, operación,
correlación, usuario solicitante, fechas y resultado técnico. No guarda errores crudos ni secretos.

La reserva durable se confirma en otra conexión del mismo pool canónico antes de enviar el PUT,
mientras la transición conserva el bloqueo del padre. No tiene FK al padre bloqueado.
El índice único `(entorno, referencia externa, acción)` impide otro envío incluso con otro operationId
o después de reiniciar el proceso. La protección es una ejecución por orden/entorno/acción;
una reapertura posterior no vuelve a disparar el workflow.

- `pending`: reserva hecha; proceso en curso o interrumpido. No repetir automáticamente.
- `confirmed`: resultado persistido. Un reintento autorizado puede guardar el cierre local usando
  esa evidencia sin otro PUT. El solicitante original permanece en el recibo; la bitácora de cierre
  atribuye al usuario que finalmente guarda la etapa.
- `unknown`: error/rechazo/timeout/confirmación inválida. Se conserva el estado CRM y se exige conciliación.
  Incluso un rechazo explícito se bloquea conservadoramente para impedir repeticiones accidentales.

La etapa, actor, fecha y bitácora central comparten el commit habitual. El snapshot central incorpora
`workflowResult` con el resultado externo y el identificador de ejecución sin alterar el motivo usado para validar replay.
Si falla el commit local, la evidencia externa persiste y no se vuelve a enviar el flujo.
Una reserva pendiente también bloquea si el proceso murió antes del PUT; privilegiamos no duplicar
por encima de reintentar automáticamente. No existe garantía de transacción distribuida con NetSuite.

Conciliación manual pendiente de operación autorizada: revisar el historial real de la instancia
NetSuite y el recibo; no borrar ni resetear recibos para reintentar sin comprobar ausencia de efectos.
No se incluye un endpoint para editar recibos. Conservar evidencia del resultado conciliado.

La interfaz distingue fallo externo, referencia ausente, reserva no disponible y commit local no
confirmado. Bloquea guardar y no muestra la recomendación genérica de repetir el cambio.

## Archivos de esta entrega

Rutas relativas al repositorio:

- `apps/api/src/modules/crm/sales/sales-orders/contract-transition.repository.ts`
- `apps/api/src/modules/crm/sales/sales-orders/unit-transfer-workflow.port.ts` (nuevo)
- `apps/api/src/integrations/netsuite/netsuite-unit-transfer.workflow.ts` (nuevo)
- `apps/api/src/integrations/netsuite/netsuite-restlet.client.ts`
- `apps/api/src/integrations/netsuite/netsuite.module.ts`
- `apps/api/src/integrations/netsuite/suitescript/SS2_1_LIB_CRM_habita.js` (2026.11.12.4)
- `apps/api/migrations/schema-only/202611120077_order_workflow_execution.ts` (nuevo)
- `apps/api/scripts/run-schema-migrations.ts` (solo registrar 077)
- `apps/frontend/src/modules/home/FormalizationStageEditor.tsx`
- `apps/api/test/integrations/netsuite-unit-transfer.spec.ts` (nuevo)
- `apps/api/test/integrations/netsuite-unified-approval.spec.ts`
- `apps/api/test/integrations/netsuite-order.spec.ts`
- `apps/api/test/sales-orders/contract-transition.repository.spec.ts`
- `apps/api/test/sales-orders/contract-transition.local-sql.spec.ts` (adaptar constructor)
- `apps/api/test/sales-orders/finiquito.local-sql.spec.ts` (adaptar constructor)
- `apps/api/test/sales-orders/finiquito.repository.spec.ts` (adaptar constructor)
- `apps/frontend/test/home/formalization-stage-editor.spec.tsx`
- Este documento.

## Verificación pendiente y comandos para el usuario

Verificación estática de esta entrega: `pnpm typecheck` en API y frontend, lint de los
archivos afectados y `git diff --check`, todos con salida 0. Se corrigieron los avisos
iniciales de lint antes de repetir las comprobaciones. No se ejecutaron tests ni build.

No ejecutar estas pruebas contra producción. Las suites focalizadas usan dobles sintéticos;
no despliegan ni llaman NetSuite real. Las propiedades usan semilla `2202780`.
Los dobles de SQL no acreditan atomicidad ni concurrencia InnoDB.

PowerShell, desde el repositorio:

```powershell
Set-Location 'C:\Users\RobertoCarlosZuñigaA\Documents\ROCCA ARCHIVOS\Desarrollo\PROYECTOS DESAROLLOS\CRM VERION NESTJS'
Push-Location apps/api
pnpm exec vitest run test/integrations/netsuite-unit-transfer.spec.ts test/integrations/netsuite-unified-approval.spec.ts test/integrations/netsuite-order.spec.ts test/integrations/netsuite-restlet.spec.ts test/sales-orders/contract-transition.repository.spec.ts test/sales-orders/contract-transition.service.spec.ts test/sales-orders/contract-transition.http.spec.ts test/sales-orders/formalization-approval.repository.spec.ts
$apiExit = $LASTEXITCODE
Pop-Location
Push-Location apps/frontend
pnpm exec vitest run test/home/formalization-stage-editor.spec.tsx test/home/formalization-order-stage-service.spec.ts
$frontendExit = $LASTEXITCODE
Pop-Location
Write-Output "API=$apiExit Frontend=$frontendExit"
```

Después, validación oficial completa desde la raíz:

```powershell
.\check-all.cmd
$fullExit = $LASTEXITCODE
Write-Output "check-all=$fullExit"
```

Compartir salida completa, códigos de salida y, si falla una propiedad, semilla/path/caso mínimo.
Antes de integrar quedan pendientes revisión adversarial independiente, pruebas InnoDB desechables
con dos peticiones concurrentes, reinicio tras reserva, fallo tras PUT/antes de commit y saturación
del pool (el flujo necesita una conexión adicional mientras mantiene la transacción de la orden).
También queda pendiente aceptación Sandbox del estado 2780, sus efectos y permisos del rol real.
El SuiteScript **sí requiere despliegue** coordinado; no se ha publicado en Sandbox ni producción.
La API y el frontend requieren su despliegue posterior autorizado. No se generó un ZIP con secretos.

## Corrección del botón deshabilitado

La captura mostró que Unidad entregada bloqueaba el paso firmado → cerrado. Se permite esa transición específica sin entrega previa tanto en UI como API y acción SuiteScript. Continúan los permisos, contrato firmado, aprobaciones, control de versión, protección de duplicados y confirmación externa antes de guardar. No se alteran los cierres de otras etapas ni customworkflow219. Se requiere volver a publicar la biblioteca 2026.11.12.4; no se desplegó desde Codex. Pruebas nuevas preparadas, sin ejecutar por instrucción del usuario.
