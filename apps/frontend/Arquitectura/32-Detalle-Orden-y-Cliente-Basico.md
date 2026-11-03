# Detalle de orden y cliente básico

Cambio local solicitado y aprobado el 2026-11-02. Conserva tarjetas, filas, acciones, navegación y permisos actuales; no modifica esquemas ni datos.

## Causa y alcance

FormalizationOrderDrawer mostraba el resumen FollowUpItem de la bandeja. El endpoint existente GET /formalization/orders/:source/:id/database ya leía snapshots autorizados, pero su allowlist no incluía todos los indicadores comerciales recientes. Se reutiliza ese endpoint y se añade detail al envelope anterior; los consumidores existentes conservan sus datos.

## Secciones aprobadas

- Datos generales: número, fecha, estado, proyecto, unidad, subsidiaria y vendedor de la orden.
- Cliente básico: nombre, identificación, teléfono, correo y asesor del cliente; perfil completo bajo su permiso independiente.
- Montos y condiciones: moneda, precio de lista, neto, venta y comisión; validación de prima en fideicomiso y cuotas totalmente pagadas como indicadores, sin inventar importes.
- Aprobaciones: Jefatura de Ventas, Desarrolladora y Formalización.
- Contrato y comisiones: firma de contrato/cierre comercial, aprobación, cálculo y pago de comisiones.
- Entrega y traspaso: unidad entregada/traspasada y llaves entregadas.
- Cancelación: venta caída y fecha de cancelación.
- Documentos: Ver expediente, usando ExpedienteLink.
- Seguimiento: etapa, tiempo, responsable y siguiente paso existentes.
- Registro secundario: origen y datos de creación/actualización disponibles; el autor del último cambio de etapa conserva su evidencia de seguimiento.

Vacíos: —, con filas/secciones presentes. Unknown no se convierte en No. No se supone moneda de orden legacy a partir del lead. Fechas y montos inválidos conservan su texto de origen; no se inventan conversiones.

## Mapeos de origen

La matriz API75 sigue siendo la referencia completa para indicadores y equivalencias NetSuite. Todos los nombres en esta tabla son físicos, no textos públicos.

| Dato | Nueva CRM_THINK_V2 | Vieja crmdatabase-api |
| --- | --- | --- |
| Número comercial | crm_sales_order_external_reference.transaction_number_sales_order_external_reference | ordenventa.id_ov_tranid |
| Fecha | crm_sales_order.transaction_date_sales_order | ordenventa.trandate_ov |
| Precio lista | crm_sales_order.list_price_sales_order | ordenventa.pre_lista_ov |
| Precio neto | crm_sales_order.net_sale_price_sales_order | ordenventa.prec_ventaneto_ov |
| Precio venta | crm_sales_order.sale_price_sales_order | ordenventa.prec_venta_ov |
| Comisión asesor | crm_sales_order.advisor_commission_sales_order | ordenventa.comison_asesor_ov |
| Moneda de orden | crm_sales_order.currency_code_sales_order | Sin columna equivalente confirmada |
| Relación con cliente | crm_sales_order.lead_id_sales_order → crm_lead.id_lead → primary_contact_id_lead → crm_contact.id_contact | ordenventa.id_ov_lead → leads.idinterno_lead |
| Nombre | crm_contact.full_name_contact | leads.nombre_lead |
| Teléfono | crm_contact.phone_contact | leads.telefono_lead |
| Correo | crm_contact.email_contact | leads.email_lead |
| Identificación | Sin columna equivalente en crm_contact/crm_lead; solo vínculo explícito verificado a legacy | info_extra_lead.cedula_lead; id_lead_fk → leads.idinterno_lead, con unicidad |
| Unidad | crm_sales_order.unit_file_id_sales_order → crm_unit_file.id_unit_file | ordenventa.idExpediente_ov → expedientes.ID_interno_expediente |
| Expediente URL | crm_unit_file.unit_plans_unit_file | expedientes.planosDeUnidad_exp |
| Aprobaciones | crm_sales_order_approval por type_code | ordenventa.chekJefeVenta / aprobacion__rdr_ov / aprobacion_forma_ov |

No se copian IDs externos a claves internas. No se vinculan clientes por nombre o correo. Una relación ausente/ambigua se informa y no se reemplaza con otro cliente.

## Límites de la evidencia inicial

Consulta de solo lectura del 2026-11-02: 467 órdenes legacy, cero órdenes y cero leads nativos. RDR673 corresponde a id_ov 208, tiene un cliente legacy único y no tiene identificación en info_extra_lead. No se insertan datos reales para simular una orden nativa.

## Implementación y resolución entre fuentes

El DTO detail contiene sections, currency, client y warnings; cada campo incluye code, label, kind y value:string|null. La lista anterior de snapshots permanece compatible. El frontend valida el DTO antes de renderizarlo.

La orden conserva su fuente autoritativa. Para el cliente se aceptan referencias NetSuite activas o vínculos históricos explícitos con unicidad recíproca. Si la orden legacy referencia un cliente que solo queda en la base nueva, se exige una referencia ERP única y se rechazan otros vínculos legacy competidores. Los contactos enriquecidos eliminados no se muestran. No se unen por nombre, correo o igualdad accidental de PK.

Cuando ambos sistemas contienen el mismo cliente con vínculo probado, los datos nativos informados prevalecen y se conservan los valores legacy complementarios; la identificación se lee de la relación extra legacy única. El DTO advierte las fuentes vinculadas. La etiqueta de origen utiliza la respuesta autoritativa, no el resumen viejo de la bandeja. Si la fuente cambia, el autor del resumen previo no se atribuye a la orden resuelta.

El detalle se vuelve a consultar al cambiar la versión de la orden para actualizar aprobaciones y campos persistidos. Los capítulos NetSuite existentes de la ficha completa se conservan; el nuevo bloque identifica los datos guardados de CRM/Sistema anterior.

## Archivos de esta ampliación

- API: src/modules/crm/sales/sales-orders/order-detail.query.ts (nuevo), order-record.query.ts; src/integrations/netsuite/netsuite-order.repository.ts.
- UI: src/modules/home/FormalizationOrderDetails.tsx (nuevo), FormalizationOrderDrawer.tsx, FormalizationOrderPreview.tsx; src/services/formalization/database-order-service.ts.
- Pruebas: API test/sales-orders/order-detail.spec.ts; frontend test/home/formalization-order-details.spec.tsx, database-order-service.spec.ts, formalization-order-progress.spec.tsx y formalization-follow-up.spec.tsx.

## Evidencia de verificación

- Lectura real del nuevo readOrderRecord para RDR673 en transacción READ ONLY: ocho secciones, 32 campos; precio neto/venta, enlace, nombre/correo del cliente y origen coinciden con el snapshot fuente. Moneda legacy null, identificación ausente null, sin warnings. Tras agrupar prima/cuotas en Montos y condiciones se mantienen los mismos campos.
- Pruebas focalizadas backend: 15/15 aprobadas; cubren nativa/legacy, vacíos, montos exactos, flags, vínculos, ambigüedades y números comerciales conflictivos.
- Pruebas frontend: seis suites relacionadas 81/81 aprobadas; después se añadieron pruebas de integración del panel y de origen autoritativo, con 44/44 aprobadas en las dos suites finales afectadas.
- Typecheck API y frontend aprobados; build de ambas aplicaciones aprobado.
- Checks generales: check-all detuvo format:check API por cinco archivos ajenos de Calendario/SuiteScript/scripts. El lint general API/frontend también encontró errores ajenos; se comprueban por separado los archivos de esta ampliación.
- Suite API completa: 7054 aprobadas, 196 omitidas condicionales y 1 fallida ajena en netsuite-suitescript/contract.spec.mjs: el payload agrega snapshotReadStartedAt/snapshotReadCompletedAt y la expectativa de claves no los incluye. Suite frontend completa: 1323 aprobadas y 4 fallidas ajenas (tres en calendar-global-types.spec.tsx por expectativas anteriores de tipos/eventos y una en personal-notes.spec.tsx por posición esperada 70px/observada 60px). La ejecución cubrió 96 archivos y duró 375.91s.

No se realizaron escrituras BD, migraciones, commit, push o despliegue. No se acredita navegación autenticada extremo a extremo con una orden nativa real: no existen órdenes nativas en la base consultada.
