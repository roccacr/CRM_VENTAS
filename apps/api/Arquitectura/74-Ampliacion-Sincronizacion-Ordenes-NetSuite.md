# Ampliación de sincronización de OV — plan de ejecución

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

Alcance autorizado: ampliar los campos confirmados existentes en ambas BD sin sobrescribir identidades ni estados internos. El plan de cierre posterior exige las fases en orden: matriz/mapeo, aprobación y prueba de059, control de orden temporal, pruebas de caída y E2E real. La paridad de VENTA CAÍDA es solo a nivel OV; se excluyen pérdida del lead y cambios en calendarios, oportunidades o estimaciones.

Decisión explícita del propietario: envioReservaCaida indica cuándo se marcó la venta caída; registrar fecha en transición a marcada. No renovar mientras continúa marcada; conservar histórica al desmarcar. La versión anterior solo sincronizaba el checkbox y NO incluía esa fecha.

Plan mínimo inicial antes de modificar código (integrado después en las fases de cierre):
1. Reutilizar mapOrderFlags, autoridad native-first, transacción compartida y RecordAuditService.append.
2. Agregar handler de transición de caída, separado del mapper general; solo efecto de fecha. No tocar status_ov, actividad, unidad, cuotas, comisiones o etapa por caída.
3. Crear059 aditiva nativa con fecha calendario de Costa Rica; cero DDL legacy. Registrar en runner y tipos. No aplicar al RDS ni habilitar efectos hasta aprobación explícita.
4. Probar marcado, repetición, desmarcado, nuevo marcado y rollback en ambos destinos; auditar checkbox y fecha. Ejecutar lint, tipos, pruebas y build.
5. Continuar matriz completa con columnas internas/no mapeables explícitas, relaciones conciliadas y mapeo declarativo de campos confirmados. No declarar completada la ampliación por terminar únicamente caída.

Archivos a revisar/modificar: integrations/netsuite/{mapper,repository,service}, handler nuevo; config; sales-orders.tables y order-history.query; migración059 y runner; pruebas focalizadas/SQL aisladas; documentación. Se mantienen endpoint, autenticación, contratos de recepción y ausencia de importaciones.

Inventario real de solo lectura: 33 columnas nativas y40 legacy; archivo externo schema-inventory.json bajo artefactos sincronizacion-completa. No hay tabla comercial de líneas identificada. Hay48 rutinas legacy y no se observaron triggers legacy en information_schema con el usuario actual. El procedimiento11 pierde transacciones de un lead y queda expresamente fuera de alcance.

## Cierre fase1 — implementación local

La matriz [75](75-Matriz-Campos-Ordenes-NetSuite.md) clasifica73/73 columnas y presenta28 campos ERP confirmados. Se agregaron montos, fecha canónica, moneda ISO, número de transacción, cálculos de comisión, tres aprobaciones y relaciones conciliadas; se reutilizan autoridad única, transacción y auditoría existente. El GET SuiteScript conserva su contrato; la proyección ampliada solo sale en eventos con marcador explícito. No se han subido estos nuevos archivos a NetSuite.

Decisión posterior del propietario: si `namesubsi_ov`, `ubicacion` o `entity_cliente_ov` no estaban mapeados en la API vieja, no aplican a la sincronización. Se revisó el backend legado y no se encontró escritor de esas columnas; quedan preservadas, no pendientes de inventar un origen.

La revisión independiente detectó pérdida del diff intentado al fallar una relación; se corrigió y se comprobó rojo/verde en SQL aislado. La auditoría de error conserva el diff directo conocido y el payload completo; no se afirma que todas las relaciones posteriores al primer rechazo hayan podido resolverse.

Fase2: [propuesta059, impacto y rollback](76-Migracion-059-Revision-y-Rollback.md). La lectura de preflight verificó CRM_THINK_V2 en MySQL8.4.8, cero entrada059 y cero columna nueva. No se aplicó ni habilitó el handler. Tampoco se cambió el esquema compartido legacy ni se alteraron registros comerciales reales.

Fase3 sigue pendiente: la fecha de origen observada solo tiene precisión de minuto y la comprobación del productor aún compara diez casillas. No subir/habilitar la ampliación antes de resolver la consistencia de todo el snapshot y su orden, aunque el mapper y SQL aislado pasen.

## Actualizacion059 autorizada

Tras aprobacion explicita para QA y RDS si pasaba, se aplico primero en la instancia local aislada y despues solo059 en CRM_THINK_V2 del RDS (2026-11-03T03:35:55Z). Columna DATE NULL y ledger verificados; esquema legacy sin cambios. No se habilito el flag real ni se modificaron registros comerciales; quedan fase3, escenarios de caida y E2E ampliado.
