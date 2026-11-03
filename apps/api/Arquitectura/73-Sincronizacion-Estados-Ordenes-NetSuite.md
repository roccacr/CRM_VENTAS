# 73 — Sincronización de estados de Orden de Venta

## Estado vigente y precedencia — 2026-11-03

El escritor v2, su auditoría, cursor y resolución de autoridad ya están
implementados; v1 mantiene `persisted:false`. El marcador `crm_sync_projection=1`
habilita los campos ampliados confirmados en [75](75-Matriz-Campos-Ordenes-NetSuite.md):
montos, fecha canónica, número de transacción, cálculo de asesor, aprobaciones y
relaciones existentes. Moneda, cálculo corredor y `createdfrom` quedan preservados,
sin inferir nuevos mapeos. Líneas y aliases permanecen en el snapshot protegido.

El control temporal actual usa doble lectura completa y ventanas UTC no solapadas;
el hash compara contenido y no funciona como reloj. El reintento de transporte
mantiene UUID/cuerpo; el conflicto de observación409 requiere una nueva lectura/UUID.
[73](73-Sincronizacion-Estados-Ordenes-NetSuite.md) conserva la prueba real acotada
de diez indicadores; no acredita E2E de todos los campos ampliados ni despliegue.
059 fue aplicada con autorización según74/75; esta revisión no cambia su flag.

Existe una excepción posterior a la regla histórica «los indicadores no mueven
etapas»: `netsuite-paid-installments.handler.ts` puede avanzar visitas finales
existentes tras `edit`/`xedit`, con actividad/firma/aprobación de Formalización,
responsable conservado y auditoría atómica, según [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).
No retrocede ni crea órdenes/visitas históricas. Origen de fondos y campos de
adéndum pertenecen al CRM y no son sobrescritos por estos snapshots.

Fecha: 2026-11-02. Implementación local autorizada; no equivale a despliegue ni migración del servidor compartido.

## Contrato y alcance

POST /integrations/netsuite/local/order-events, Bearer exclusivo de integración, solo NODE_ENV=development y cuenta 4552704_SB1. Ngrok conserva la allowlist HTTPS *.ngrok-free.dev y el parámetro custscript_crm_event_url.

- v1 conserva recepción sin escrituras (persisted:false).
- v2 exige eventId UUID, sourceModifiedAt y observedAt ISO UTC. Los diez checkbox son obligatorios: boolean o T/F; ausente/null no se interpreta como falso.
- La respuesta persisted:true solo sale después del COMMIT de los diez indicadores y sus bitácoras; no implica que otros campos de cabecera o líneas se hayan proyectado a columnas comerciales. El snapshot completo, incluidas líneas y aliases, queda en payload JSON nativo.
- Los indicadores no cambian etapas del CRM, aprobaciones, propietarios, importes ni relaciones. pagadas_ov conserva su significado independiente.

## Mapeo de los diez campos

| NetSuite | Columna nativa | Columna legacy |
| --- | --- | --- |
| custbody90 | contract_signed_sales_order | contrado_frima_ov |
| custbody51 | commercial_closure_signed_sales_order | cierre_firmado_ov |
| custbody91 | unit_delivered_sales_order | unidad_entregada_ov |
| custbody105 | unit_transferred_sales_order | unidad_traspasada_ov |
| custbody43 | cancelled_sales_order | caida_ov |
| custbody103 | commission_approved_sales_order | comision_aprobada_ov |
| custbody_ix_comision_pagada | advisor_commission_paid_sales_order | comision_cancelada_ov |
| custbody_entrega_de_llaves | keys_delivered_sales_order | entrega_llaves_ov |
| custbody274 | trust_down_payment_validated_sales_order | validacion_fideicomiso_prima_ov |
| custbody_cuotas_pagadas | installments_fully_paid_sales_order | cuotas_pagadas_completo_ov |

Nativa: yes/no; legacy: 1/0. Los valores anteriores, incluido unknown/NULL, se conservan en el diff. No se requiere DDL legacy: las diez columnas se verificaron mediante metadata/consulta de solo lectura.

## Resolución, transacción y bitácoras

1. Bloqueo por cuenta + ID de NetSuite en int_netsuite_order_cursor.
2. Búsqueda nativa por referencia ERP. Referencias ambiguas/deshabilitadas o autoridad eliminada fallan cerradas.
3. Solo en ausencia nativa se consulta ordenventa por id_ov_netsuite; se vuelve a comprobar el alias nativo id_old_produccion_sales_order para no escribir una copia migrada.
4. Si no existe en ninguna: result=not_found en bitácora nativa, sin crear órdenes.
5. Se bloquea y actualiza una única autoridad. ENABLE_LEGACY_FALLBACK y ENABLE_LEGACY_WRITES siguen siendo obligatorios para legacy.
6. audit_record_event recibe actor de servicio capturado internamente, origen integration, claves comerciales canónicas y antes/después. La proyección del historial permite explícitamente los diez indicadores.
7. audit_netsuite_order_event conserva cuenta, NetSuite ID, eventId, destino, ID físico, resultado, diff, error, origen, payload íntegro y fecha UTC.

Ambos esquemas están en el mismo servidor y las tablas verificadas son InnoDB. Se usa la MISMA conexión/transacción para UPDATE legacy o native y ambas bitácoras nativas. Si cualquiera de ellas falla, se revierte todo el cambio comercial. No existe una confirmación parcial deliberada entre dos conexiones.

Tras rollback se intenta una transacción nueva para registrar el error y el diff intentado. Si la BD tampoco permite ese registro, se escribe netsuite_order_audit_failed en el log de aplicación con eventId, NetSuite ID, destino y hash; sin payload ni credenciales en consola. Se responde error, nunca éxito. Un fallo de conexión durante COMMIT puede tener resultado incierto: reenviar el mismo UUID/payload permite consultar la evidencia ya confirmada.

## Reenvíos y concurrencia

- Emisor: una llamada y, ante error de red o HTTP5xx, un solo reintento inmediato con el mismo cuerpo/UUID. No hay cola durable ni recuperación automática posterior a dos intentos.
- Receptor: serializa eventos de una orden; mismo UUID y hash devuelve el resultado previo sin nuevo UPDATE ni bitácora duplicada. UUID reutilizado con otro contenido devuelve409. Un error previo permite reintento.
- N/search consulta lastmodifieddate y los diez checkbox antes y después de record.load. Las dos lecturas y el snapshot deben coincidir; de lo contrario se bloquea el envío.
- N/format.parse respeta las preferencias del mismo contexto que produjo el texto; solo una Date finita se convierte a UTC. No se interpreta ese texto con Date.parse ni se impone UTC a una hora local.
- El cursor usa sourceModifiedAt y hash de los diez valores normalizados; observedAt es telemetría, no versión. Una versión anterior o igual con valores diferentes devuelve409 y no sobrescribe datos. Esto puede exigir nueva edición/consulta cuando el proveedor no distinga dos cambios dentro de su precisión temporal.
- El soporte, zona horaria y precisión efectivos de lastmodifieddate deben verificarse en Sandbox antes de activar la persistencia compartida. Las simulaciones offline no prueban ese comportamiento de Oracle.

## Archivos de implementación

| Archivo | Responsabilidad |
| --- | --- |
| src/integrations/netsuite/netsuite-order-event.contract.ts | Contratos v1/v2 y DTO Zod |
| src/integrations/netsuite/netsuite-order-event.mapper.ts | Diez conversiones y diff por columna |
| src/integrations/netsuite/netsuite-order-event.repository.ts | Autoridad, bloqueos, UPDATE y bitácoras atómicas |
| src/integrations/netsuite/netsuite-order-event.service.ts | Hash canónico, resultado durable y registro de errores |
| src/integrations/netsuite/netsuite-local-events.controller.ts | Recepción y delegación v2; compatibilidad v1 |
| src/integrations/netsuite/netsuite.module.ts | Registro DI y reutilización de AuditModule |
| src/modules/crm/audit/audit-actor.ts | Captura confiable de actor de integración |
| src/modules/crm/audit/record-audit.service.ts | Atribución service/integration; preserva usuarios existentes |
| src/modules/crm/sales/sales-orders/order-history.query.ts | Exposición explícita de los indicadores auditados |
| src/config/env.validation.ts y .env.example | NETSUITE_LOCAL_EVENTS_PERSIST=false por defecto |
| migrations/schema-only/202611020058_netsuite_order_events.ts | Dos tablas nativas de integración; sin DDL legacy |
| scripts/run-schema-migrations.ts | Registro de058 para ejecución dirigida |
| scripts/package-netsuite.mjs | Grafo AMD admite N/crypto/random y N/format |

SuiteScript a actualizar en Sandbox: lib/SS2_1_LIB_CRM_EnviarEvento.js, lib/SS2_1_LIB_CRM_Logs.js, modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_Campos.js y modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio.js. Versión2026.11.02.1. RESTlet GET/PUT conserva su contrato; la lectura añade custbody_cuotas_pagadas.

Pruebas nuevas: netsuite-order-event-mapper.spec.ts y netsuite-order-events.local-sql.spec.ts. Se actualizaron fixtures/contratos SuiteScript, HTTP v1, auditoría, configuración e inventario de migraciones afectados por el contrato/versionado.

## Activación y reversión

1. Revisar/aprobar058 si el destino es producción. No ejecutar el lote completo ni repetir057.
2. Desde apps/api: pnpm exec tsx scripts/run-schema-migrations.ts --only=202611020058_netsuite_order_events. Ya aplicada en esta entrega; no repetir el lote completo.
3. Verificar dos tablas/ledger, columnas057 existentes y permisos de transacción. Subir los cuatro JS a las rutas existentes de Sandbox, conservando copia anterior.
4. Mantener NETSUITE_LOCAL_EVENTS_ENABLED=true y NETSUITE_LOCAL_EVENTS_PERSIST=false hasta comprobar versión de origen. Iniciar túnel ngrok hacia3000 y verificar que el parámetro del despliegue usa ese host.
5. Activar NETSUITE_LOCAL_EVENTS_PERSIST=true únicamente para la prueba autorizada y verificar recibo v2, orden y ambas bitácoras. Desactivar el flag revierte la activación sin borrar tablas ni historia.
6. RDR678 (NetSuite12025125, legacy218) fue elegida por el propietario. Antes de editar, capturar estado de Sandbox y BD. Al terminar, revertir los cambios y verificar etapa CRM Por enviar. No inventar un evento de edición ni modificar directamente el estado para simular la prueba.

## Verificación ejecutada

- API: lint, typecheck y build aprobados. Suite completa: 6.979 aprobadas y172 omitidas (191 archivos aprobados,28 omitidos).
- SQL local:11 escenarios aprobados; incluye ruta HTTP con autenticación, ambas BD e historial central con los10 cambios visibles.
- check-all.cmd se detuvo por formato previo en lib/SS2_1_LIB_CRM_EjecutarAccion.js; ese archivo no fue modificado.
- Migración058 aplicada con autorización explícita del propietario el2026-11-02T18:47:21.965Z. Ledger y ambas tablas InnoDB verificados por lectura posterior. Ninguna otra migración fue ejecutada en esta fase.
- Ngrok fue iniciado por el propietario; https://nontransgressively-sequential-leif.ngrok-free.dev/health/live devolvió200. Iniciar el túnel desde el agente fue rechazado por política; no se intentó eludir el bloqueo.
- El propietario actualizó los JS de Sandbox. Se verificó después transporte v2 (UUID, sourceModifiedAt, acuse persisted:true y reintento) y NotificarCambio (doble lectura de fecha y diez flags). El agente no guardó ni sobrescribió esos archivos en NetSuite. El RESTlet GET real de RDR678 devolvió las diez casillas, incluida custbody_cuotas_pagadas=false.
- RDR678 tiene etapa CRM previa transfer_signed (secuencia7), no Por enviar; el propietario solicitó dejarla en Por enviar al terminar. No se alteró esa etapa ni los checkbox durante la preparación.

## Evidencia y límites

Se verificó por lectura que RDR678 no tiene autoridad nativa y existe en legacy218. No se cambió su contenido durante el análisis/preparación.

Las pruebas SQL opt-in usan exclusivamente loopback3309 y un datadir efímero propio netsuite-events-mariadb-20261102 (MariaDB10.4/InnoDB instalado). Nunca cargan .env ni conectan al RDS; rechazan otro datadir. Cubren HTTP autenticado con DB real, preferencia nativa, legacy, ausencia, diez flags/diff/historial visible, rollback por UPDATE o cualquiera de las dos bitácoras, duplicado concurrente, UUID conflictivo, revisión antigua y autoridad deshabilitada. No equivalen a ejecución MySQL8.4 ni a edición real de NetSuite.

Pendientes operativos: terminar la edición real controlada desde NetSuite y comprobar la revisión de origen; versión de origen real; activación explícita del escritor local; prueba y restauración de RDR678. No se desplegó código a producción ni se modificó el esquema legacy; únicamente se aplicó058 nativa autorizada.

### Conexión y prueba en curso

Persistencia local activada por configuración development después de058. El formulario de NetSuite no respondió a Guardar en la prueba; la consola mostró ReferenceError E7S is not defined y TypeError define is not a function (archivo de cliente3327877, ajeno a los cuatro JS de esta entrega). Se solicitó al propietario guardar manualmente. Al comprobar, no había evento para12025125 en la nueva bitácora y los diez valores legacy seguían iguales al preflight; no confundir la nota escrita en un formulario aún sin guardar con una edición recibida.

### Cierre de prueba real y restauración — 2026-11-02

El propietario guardó manualmente RDR678. El evento280ecb2b-1bc8-4c30-ba5d-824fbb0d16dd confirmó applied en legacy218: seis valores NULL pasaron a0; las diez casillas llegaron en el payload y se guardaron bitácoras en la BD nueva. Después de reponer la nota original «--», el segundo guardado manual generó d67e14b3-a9d6-43f8-9bbe-f41b38d70528, resultado unchanged, sin error. Se comprobó que todos los campos de la lectura NetSuite y sus líneas coincidían con el respaldo previo.

Por solicitud del propietario, los seis NULL originales se restauraron bajo bloqueo y transacción con auditoría central revert01M6EYMBBASZF8M2HHEZEDRC1F (secuencia11). La etapa se cambió mediante la interfaz autorizada del CRM de transfer_signed/secuencia7 a contract_pending_send/secuencia8, «Por enviar», como había pedido. La comprobación posterior encontró cero diferencias en las diez columnas legacy frente al respaldo. Se conservaron los eventos y bitácoras, sin borrar evidencia.

Las dos sourceModifiedAt observadas fueron20:14:00Z y20:17:00Z: precisión observada de un minuto en esta lectura de Sandbox. El control conservador existente puede rechazar cambios de flags distintos con la misma versión temporal; no se afirmó una garantía de orden más fina que la observada. La persistencia local queda habilitada y el túnel fue iniciado por el propietario. El problema del botón Guardar mediante automatización de navegador queda como límite de la prueba UI; no bloqueó los dos guardados manuales reales.
