# Matriz de columnas de OV — cierre de alcance

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
No retrocede ni crea órdenes/visitas históricas. Los campos de adéndum pertenecen
al CRM y no son sobrescritos por estos snapshots. Corrección confirmada el03/11:
Fondos de Compra usa custbody37, ID1 Propios / ID2 Financiado, y sí actualiza
las columnas existentes de origen de fondos en el destino autoritativo. Ver78.

Inventario de solo lectura: 33 columnas de CRM_THINK_V2.crm_sales_order y 40 de crmdatabase-api.ordenventa. Cobertura: 73/73 clasificadas; no significa 73 campos ERP. No se modifica ningun maestro relacionado. No existe una tabla comercial de lineas identificada en el esquema consultado; las lineas permanecen en el payload de auditoria.

## Contrato y verificacion

- Productor: proyeccion crm_sync_projection=1 dentro de fields, solo para eventos; GET conserva su forma y textos regionales. Fecha separada YYYY-MM-DD; moneda excluida de la persistencia por no tener mapper legado confirmado. [Oracle Currency](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N3201267.html).
- Declaracion: src/integrations/netsuite/netsuite-order-event.mapper.ts (orderFlagMappings, orderFieldMappings, orderApprovalMappings, orderRelationMappings, orderNumberMapping, orderCurrencyMapping).
- Persistencia: NetsuiteOrderEventRepository.planChanges/planRelations/update/updateRelated; misma transaccion con ambas bitacoras nativas. Las FK nativas se resuelven por referencia NetSuite activa existente; no se copian IDs externos a PK internas y no se crean maestros.
- Aprobaciones nativas: tres filas por tipo sales_management/developer/formalization; control de version e historial de aprobaciones, sin cambiar etapa CRM. Referencia comercial tranid se guarda en crm_sales_order_external_reference; no en native_code_sales_order.
- Eventos v2 anteriores sin marcador conservan diez indicadores; no se interpretan sus fechas/montos regionales como datos canonicos nuevos. Hash de contenido incluye campos normalizados y relaciones, pero el conflicto de minuto sigue pendiente de fase 3.
- No se han subido estos nuevos SuiteScripts ni probado esta ampliacion en NetSuite. Pruebas actuales: mapper unitario y SQL aislado sintetico (ambos destinos).
- Fuentes legacy: src/models/ordenVenta/ordenVenta.js:470-500 (creacion y relaciones); Downloads/salesorders.js:142-180 solo referencia historica de estados, cuatro montos y fecha, contrastada con columnas reales. No se copia su conversion defectuosa value === T.
- Exclusion confirmada por el propietario: namesubsi_ov, ubicacion y entity_cliente_ov no se sincronizan si no tenian mapeo en API vieja. No se encontro escritor de esos campos en el backend legado revisado.

## Cobertura fisica 1 a 1

| BD | Columna | Tipo / nulos | Origen | Tratamiento |
|---|---|---|---|---|
| Nueva | id_sales_order | bigint unsigned / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | public_id_sales_order | char(26) / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | native_code_sales_order | varchar(140) / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | id_old_produccion_sales_order | int / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | unit_file_id_sales_order | bigint unsigned / YES | custbody38 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | subsidiary_id_sales_order | bigint unsigned / YES | subsidiary | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | owner_user_id_sales_order | bigint unsigned / YES | salesteam[0].employee | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | status_sales_order | enum('active','inactive','unknown') / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | cancelled_sales_order | enum('yes','no','unknown') / NO | custbody43 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | currency_code_sales_order | char(3) / YES | currency.symbol -> crm_currency_iso | Excluido del evento de edicion: sin mapper legado equivalente confirmado; preservar |
| Nueva | transaction_date_sales_order | date / YES | trandate -> crm_transaction_date | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | list_price_sales_order | decimal(19,4) / YES | custbody13 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | net_sale_price_sales_order | decimal(19,4) / YES | custbody17 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | sale_price_sales_order | decimal(19,4) / YES | custbody_ix_total_amount | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | advisor_commission_sales_order | decimal(19,4) / YES | custbody21 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | contract_signed_sales_order | enum('yes','no','unknown') / NO | custbody90 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | commercial_closure_signed_sales_order | enum('yes','no','unknown') / NO | custbody51 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | advisor_commission_calculated_sales_order | enum('yes','no','unknown') / NO | custbody74 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | advisor_commission_paid_sales_order | enum('yes','no','unknown') / NO | custbody_ix_comision_pagada | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | source_created_at_sales_order | datetime(3) / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | created_at_sales_order | datetime(3) / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | created_by_user_id_sales_order | bigint unsigned / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | updated_at_sales_order | datetime(3) / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | updated_by_user_id_sales_order | bigint unsigned / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | deleted_at_sales_order | datetime(3) / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Nueva | lead_id_sales_order | bigint unsigned / YES | entity | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | unit_delivered_sales_order | enum('yes','no','unknown') / NO | custbody91 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | unit_transferred_sales_order | enum('yes','no','unknown') / NO | custbody105 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | keys_delivered_sales_order | enum('yes','no','unknown') / NO | custbody_entrega_de_llaves | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | trust_down_payment_validated_sales_order | enum('yes','no','unknown') / NO | custbody274 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | commission_approved_sales_order | enum('yes','no','unknown') / NO | custbody103 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Nueva | broker_commission_calculated_sales_order | enum('yes','no','unknown') / NO | custbody73 | Excluido del evento de edicion: sin mapper legado equivalente confirmado; preservar |
| Nueva | installments_fully_paid_sales_order | enum('yes','no','unknown') / NO | custbody_cuotas_pagadas | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | id_ov | int / NO | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | id_ov_tranid | varchar(50) / YES | tranid -> initialtranid | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | id_ov_netsuite | int / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | id_ov_est | int / YES | createdfrom | Excluido del evento de edicion: sin mapper legado equivalente confirmado; preservar |
| Vieja | id_ov_opt | int / YES | opportunity | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | id_ov_admin | int / YES | salesteam[0].employee | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | id_ov_lead | int / YES | entity | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | idExpediente_ov | int / YES | custbody38 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | idsubsidiaria_ov | int / YES | subsidiary | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | namesubsi_ov | varchar(250) / YES | — | Excluido: sin mapeo encontrado en API vieja; decision del propietario 2026-11-02 |
| Vieja | chek_ov | int / YES | — | Preservado: sin origen NetSuite ni escritor legacy confirmado |
| Vieja | contrado_frima_ov | int / YES | custbody90 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | cierre_firmado_ov | int / YES | custbody51 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | aprobacion_forma_ov | int / YES | custbodyid_firma_rc | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | aprobacion__rdr_ov | int / YES | custbodyid_firma_rocca | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | calculo_comision_asesor_ov | int / YES | custbody74 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | comision_cancelada_ov | int / NO | custbody_ix_comision_pagada | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | status_ov | int / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | creado_ov | timestamp / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | caida_ov | int / YES | custbody43 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | reserva_ov | int / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | pre_lista_ov | varchar(250) / YES | custbody13 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | trandate_ov | varchar(200) / YES | trandate -> crm_transaction_date | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | prec_ventaneto_ov | varchar(220) / YES | custbody17 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | prec_venta_ov | varchar(200) / YES | custbody_ix_total_amount | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | comison_asesor_ov | varchar(220) / YES | custbody21 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | ubicacion | varchar(250) / YES | — | Excluido: sin mapeo encontrado en API vieja; decision del propietario 2026-11-02 |
| Vieja | entity_cliente_ov | text / YES | — | Excluido: sin mapeo encontrado en API vieja; decision del propietario 2026-11-02 |
| Vieja | envioReserva | varchar(100) / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | envioReservaCaida | varchar(100) / YES | Derivado de transicion custbody43 | 059 aplicada; pendiente habilitar y probar efectos |
| Vieja | fechaClienteComprobante_ov | varchar(100) / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | pagadas_ov | int / YES | — | Interno/identidad/control CRM: no sobrescribir con payload |
| Vieja | chekJefeVenta | int / YES | custbody_aprueba_jefe_ventas | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | unidad_entregada_ov | tinyint unsigned / YES | custbody91 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | unidad_traspasada_ov | tinyint unsigned / YES | custbody105 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | entrega_llaves_ov | tinyint unsigned / YES | custbody_entrega_de_llaves | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | validacion_fideicomiso_prima_ov | tinyint unsigned / YES | custbody274 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | comision_aprobada_ov | tinyint unsigned / YES | custbody103 | Mapeado local; prueba SQL aislada; no E2E ampliado |
| Vieja | calculo_comision_corredor_ov | tinyint unsigned / YES | custbody73 | Excluido del evento de edicion: sin mapper legado equivalente confirmado; preservar |
| Vieja | cuotas_pagadas_completo_ov | tinyint unsigned / YES | custbody_cuotas_pagadas | Mapeado local; prueba SQL aislada; no E2E ampliado |

## Tablas relacionadas

crm_sales_order_approval.status_sales_order_approval se mapea desde las tres casillas, con type_code como discriminador. Sus PK, version, timestamps y usuario se generan internamente. crm_sales_order_external_reference.transaction_number_sales_order_external_reference recibe tranid; identidad externa y estado de referencia son controles CRM.

La cobertura de todas las columnas relacionadas consultadas (incluidos maestros, eventos y snapshots) esta en el CSV de evidencia externo: C:\codex-data\visualizations\2026\11\02\01a19d4c-e647-7f03-a3ce-6e6372aa9366\sincronizacion-completa\matriz-columnas-completa.csv. No se afirma haber leido todos los registros ni que todas las columnas deban escribirse desde una OV.

## Fecha de venta caida y limites

envioReservaCaida se preserva hasta habilitar los efectos autorizados tras 059. Nueva columna creada mediante059: cancellation_marked_on_sales_order DATE NULL. No backfill ni DDL legacy. Fecha de Costa Rica al pasar a marcada; no renovar ya marcada; conservar al desmarcar. La fecha real historica de filas ya caidas no puede inventarse.

Pendientes de cierre: aprobacion y prueba de 059; precision/orden de eventos dentro del minuto; pruebas de caida en ambas BD; publicacion Sandbox y E2E ampliado/restauracion. No hay autorizacion para aplicar 059 en RDS ni produccion.

## Matriz de mapeo consolidada

| Campo NetSuite | Columna BD nueva | Columna BD vieja | Conversion | Script envia | API mapea |
|---|---|---|---|---|---|
| custbody38 | crm_sales_order.unit_file_id_sales_order | ordenventa.idExpediente_ov | ID ERP; resolver referencia existente para FK nativa; INT legacy | Si, local sin subir | Si, SQL aislado |
| subsidiary | crm_sales_order.subsidiary_id_sales_order | ordenventa.idsubsidiaria_ov | ID ERP; resolver referencia existente para FK nativa; INT legacy | Si, local sin subir | Si, SQL aislado |
| salesteam[0].employee -> crm_owner_employee | crm_sales_order.owner_user_id_sales_order | ordenventa.id_ov_admin | ID ERP; resolver referencia existente para FK nativa; INT legacy | Si, local sin subir | Si, SQL aislado |
| custbody43 | crm_sales_order.cancelled_sales_order | ordenventa.caida_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| trandate -> crm_transaction_date | crm_sales_order.transaction_date_sales_order | ordenventa.trandate_ov | DATE YYYY-MM-DD; no texto regional | Si, local sin subir | Si, SQL aislado |
| custbody13 | crm_sales_order.list_price_sales_order | ordenventa.pre_lista_ov | Decimal canonico 19,4; vacio explicito = NULL | Si, local sin subir | Si, SQL aislado |
| custbody17 | crm_sales_order.net_sale_price_sales_order | ordenventa.prec_ventaneto_ov | Decimal canonico 19,4; vacio explicito = NULL | Si, local sin subir | Si, SQL aislado |
| custbody_ix_total_amount | crm_sales_order.sale_price_sales_order | ordenventa.prec_venta_ov | Decimal canonico 19,4; vacio explicito = NULL | Si, local sin subir | Si, SQL aislado |
| custbody21 | crm_sales_order.advisor_commission_sales_order | ordenventa.comison_asesor_ov | Decimal canonico 19,4; vacio explicito = NULL | Si, local sin subir | Si, SQL aislado |
| custbody90 | crm_sales_order.contract_signed_sales_order | ordenventa.contrado_frima_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody51 | crm_sales_order.commercial_closure_signed_sales_order | ordenventa.cierre_firmado_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody74 | crm_sales_order.advisor_commission_calculated_sales_order | ordenventa.calculo_comision_asesor_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody_ix_comision_pagada | crm_sales_order.advisor_commission_paid_sales_order | ordenventa.comision_cancelada_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| entity | crm_sales_order.lead_id_sales_order | ordenventa.id_ov_lead | ID ERP; resolver referencia existente para FK nativa; INT legacy | Si, local sin subir | Si, SQL aislado |
| custbody91 | crm_sales_order.unit_delivered_sales_order | ordenventa.unidad_entregada_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody105 | crm_sales_order.unit_transferred_sales_order | ordenventa.unidad_traspasada_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody_entrega_de_llaves | crm_sales_order.keys_delivered_sales_order | ordenventa.entrega_llaves_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody274 | crm_sales_order.trust_down_payment_validated_sales_order | ordenventa.validacion_fideicomiso_prima_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody103 | crm_sales_order.commission_approved_sales_order | ordenventa.comision_aprobada_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| custbody_cuotas_pagadas | crm_sales_order.installments_fully_paid_sales_order | ordenventa.cuotas_pagadas_completo_ov | true/T -> yes o 1; false/F -> no o 0 | Si, local sin subir | Si, SQL aislado |
| tranid -> initialtranid | crm_sales_order_external_reference.transaction_number_sales_order_external_reference | ordenventa.id_ov_tranid | Texto; max 180 nativa / 50 legacy | Si, local sin subir | Si, SQL aislado |
| opportunity | — | ordenventa.id_ov_opt | ID ERP; resolver referencia existente para FK nativa; INT legacy | Si, local sin subir | Si, SQL aislado |
| custbodyid_firma_rc | crm_sales_order_approval.status_sales_order_approval (formalization) | ordenventa.aprobacion_forma_ov | true/T -> approved o 1; false/F -> not_approved o 0 | Si, local sin subir | Si, SQL aislado |
| custbodyid_firma_rocca | crm_sales_order_approval.status_sales_order_approval (developer) | ordenventa.aprobacion__rdr_ov | true/T -> approved o 1; false/F -> not_approved o 0 | Si, local sin subir | Si, SQL aislado |
| custbody_aprueba_jefe_ventas | crm_sales_order_approval.status_sales_order_approval (sales_management) | ordenventa.chekJefeVenta | true/T -> approved o 1; false/F -> not_approved o 0 | Si, local sin subir | Si, SQL aislado |
| Transicion custbody43 | cancellation_marked_on_sales_order (059 aplicada) | ordenventa.envioReservaCaida | Fecha Costa Rica de sourceModifiedAt; conservar al desmarcar | Fuente de cambio si | Handler preparado, apagado; no probado SQL |

Criterio de cobertura: las filas internas y excluidas de la tabla fisica no representan mapeos pendientes. Los 25 campos origen vigentes incluyen cinco relaciones; oportunidad solo tiene destino legacy. El efecto de fecha es derivado, no una casilla adicional.

Fuentes de campos preservados: backend legado `src/models/ordenVenta/ordenVenta.js:450` cambia `pagadas_ov` por comando CRM; `:888` registra `reserva_ov`, `envioReserva` y `fechaClienteComprobante_ov` en su flujo propio. `chek_ov` no tiene origen NetSuite confirmado y se conserva. El CSV consolidado incluye 421 columnas de tablas/relaciones consultadas, sin copiar sus maestros.

Actualizacion autorizada: 059 aplicada en QA y RDS (2026-11-03T03:35:55Z), con ledger y DATE NULL verificados. El handler sigue deshabilitado en la configuracion real. La consistencia temporal, los escenarios SQL de caida y el E2E ampliado siguen pendientes; esta tabla no certifica esos pasos.

## Correccion posterior por fuente legacy real

La matriz inicial incluyo tres incorporaciones que el propietario descarta si no existian en el mapper viejo. Se retiraron moneda, calculo de comision corredor (custbody73) y createdfrom→id_ov_est de la persistencia. Se mantienen columnas y valores existentes sin DDL ni backfill. id_ov_est procede del argumento idEstimacion en creacion; no hay fuente equivalente confirmada en una edicion de NetSuite.

El asesor usa ahora salesteam[0].employee (crm_owner_employee en el evento), no salesrep. Evidencia: produccion/src/store/ordenVenta/thunkOrdenVenta.js:65–78 y CRM_VENTAS BACKEND/src/models/ordenVenta/ordenVenta.js:497–500. Numero, cliente, expediente, subsidiaria y oportunidad se manejaban en creacion; no se afirma que el viejo backend los actualizara en cada edicion. Los cuatro montos, fecha, calculo asesor y aprobaciones constan en la referencia Downloads/salesorders.js:140–180, sin afirmar despliegue vigente. Los10 checkbox y la fecha de caida conservan autorizacion explicita posterior del propietario.

Control temporal actual: doble lectura completa identica + ventana UTC; hash de contenido no se usa como reloj. API serializa por orden, rechaza ventanas anteriores/solapadas y SuiteScript relee ante409 con un UUID de observacion nuevo. El reintento de red mantiene UUID y cuerpo. No agrega DDL. Pruebas SQL aisladas: dos ediciones distintas mismo minuto, duplicado, atraso y fecha de caida en ambos destinos. Falta verificacion real antes de certificar publicacion.
