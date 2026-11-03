# Detalle de orden y cliente básico

## Adéndum: motivo y envío independientes de la etapa

La marca manual exige motivo de3..2000 caracteres. «Marcar adéndum como enviado» requiere lectura efectiva de la orden y del adéndum; no necesita permiso de completar/cancelar. La ficha muestra Condición y Motivo; enviado sigue distinto de completado y no mueve etapas. Un evento nuevo/conversión de tipo Adéndum usa su descripción como motivo obligatorio. Contrato, esquema072 y evidencia en [88 API](../../api/Arquitectura/88-Adendum-Motivo-y-Envio.md).

## Asignación bancaria — 2026-11-03

Con asignación vigente y permiso de edición, la sección incorpora «Cambiar banco» (reutiliza el panel con selección previa) y «Desvincular banco» (confirmación lateral y motivo obligatorio). Ambas revalidan perfil/usuario/sesión antes del POST y refrescan la sección al confirmar. Solo desvincula la relación con la orden; conserva catálogo, fila/versión e historial.071 nativa aplicada con aprobación; [contrato y evidencia87](../../api/Arquitectura/87-Orden-Asignacion-Bancaria.md).

«Ir a» incorpora «Banco y ejecutivo», con capítulo desplegable «Banco y ejecutivo asignado». Consulta banco, nombre/contacto/área del ejecutivo real; sin vínculo muestra estado vacío y sin permiso no muestra capítulo ni consulta. Reutiliza el GET central y se recarga al guardar la asignación, sin cambiar URL. Error/reintento y respuestas tardías entre órdenes están cubiertos por pruebas; detalle y evidencia en [87](../../api/Arquitectura/87-Orden-Asignacion-Bancaria.md).

`FormalizationRecordSummary` incorpora `FormAssignBank` junto a las acciones de adéndum/evento. Abre panel derecho en la misma URL; muestra bancos activos y ejecutivos del banco con búsqueda/paginación. Cambiar banco limpia ejecutivo; `Nuevo ejecutivo` reutiliza `BankFormDrawer` y selecciona el creado, sin asignarlo hasta `Guardar asignación`. Revalida sesión, roles, permisos de catálogo y lectura de orden. Sin bancos activos informa dónde crearlos. [Contrato87 y evidencia](../../api/Arquitectura/87-Orden-Asignacion-Bancaria.md).

## Presentación vigente — 03/11/2026

La ficha completa y el drawer reutilizan avance, acciones y lectura de cliente. El drawer apila «Ver orden completa», marcación manual, avance, editor de etapa, tarjeta Adéndum, Fondos de compra, borrador Outlook, contacto y seguimiento; conserva su pie anterior/siguiente. Las flechas del formulario en portal no cambian la orden de fondo. La ficha deriva el recorrido de ocho etapas; el drawer compacto las distribuye en dos filas de cuatro, sin conector entre final e inicio de fila. No se fija el recorrido en siete etapas.

`FormalizationClientContent` hace una lectura nueva por identidad/reintento, presenta esqueleto y error recuperable y no selecciona otro cliente ante relación ambigua. En el drawer de orden muestra solo Contacto; el de cliente conserva sus grupos. «Ver perfil del cliente» usa `lead.profile.read` y la identidad devuelta, con destino `/home/formalization/perfil?source=…&id=…`. `/perfil` permanece como alias dentro del workspace Formalización. La consulta completa combina secciones, historia paginada y órdenes por fuente mediante `/leads/profile`; no importa registros ni une por nombre/correo. Los paneles preparados no equivalen a nuevas escrituras.

«Ir a WhatsApp» requiere `formalizacion.orders.whatsapp` efectivo sin deny. Abre WhatsApp Web con un solo teléfono validado y no envía mensaje automáticamente. El número original y país permanecen separados del texto presentado: un número local costarricense válido se normaliza a 506; otro país conocido exige prefijo internacional. Extensiones, listas o texto no se limpian para fabricar destinatarios. Sin número válido la acción permanece deshabilitada con explicación. «Abrir Outlook», visible en Por enviar y con correo disponible, prepara únicamente un borrador; no registra envío ni cambia etapa.

### Perfil consolidado

Las pestañas son Bitácora, Lista de eventos, Oportunidades, Estimaciones, Información completa, Órdenes y OneDrive; flechas/Home/End cambian la selección y foco. Las cifras se presentan en el resumen del expediente, sin repetir contadores en las pestañas; cambiar de sección reinicia la página comercial/de órdenes a1. Eventos y OneDrive declaran En preparación sin filas ficticias. Información completa reorganiza todos los campos recibidos en base, contexto comercial y trazabilidad; los desconocidos se conservan en el último bloque. Ocultar vacíos mantiene visible cualquier diferencia legacy. La procedencia y un valor legacy distinto se muestran sin modificar el dato guardado.

La bitácora filtra/busca solo la página cargada; sus categorías textuales describen entradas de historia. Oportunidades y Estimaciones usan ahora `LeadProfileCommercial` y las páginas opcionales `opportunities`/`estimates` del DTO: registros reales con cabecera de número/estado/origen/fecha y hechos principales, motivo/fecha de inactivación cuando existen, campos desplegables y vacíos ocultos inicialmente con control para mostrarlos, total, página, `hasMore` y `available`. Una fuente no disponible se explica, sin inferir entidades desde la bitácora ni inventar cero; sus indicadores usan total o «—». El indicador de bitácora mantiene cantidad de la página y `+` cuando hay más historia. Fechas legacy conservan hora de origen. Órdenes reúne ambas fuentes, permite filtro local por origen y paginación con `hasMore`; muestra moneda solo si existe alguna, no la inventa y conserva códigos de estado desconocidos. Sus enlaces vuelven a Gestión con identidad exacta. La acción Agendar del perfil usa la orden vinculada más reciente por fecha recibida; sin orden no se ofrece. Correo abre borrador externo y Actualizar relee el perfil. La paginación mantiene estructura visible con estado de recarga; los fallos 400/403/404/409 se distinguen de indisponibilidad recuperable.

### Etapas y condiciones

Orden: Por enviar → Pendiente de firma → Gestión bancaria → Gestión bancaria en proceso → Pendiente de saldo → Traspaso pendiente → Traspaso firmado → Cerrado. La salida de Contratos requiere elección explícita del origen de fondos: propios conduce a saldo y financiamiento bancario a gestión bancaria en proceso. El siguiente destino elegible puede omitir etapas de traspaso según indicadores confirmados. Paso anterior y selección excepcional requieren permiso `formalizacion.orders.stage.skip`, permiso del destino y motivo; no eluden las condiciones del destino.

| Destino | Condición adicional confirmada en el DTO |
| --- | --- |
| Gestión bancaria o posterior | Contrato firmado `true`; las reglas del editor conservan además el envío previo en el avance normal |
| Traspaso pendiente | Cuotas canceladas `true`, unidad traspasada `false`, unidad entregada `false`; llaves no condiciona |
| Traspaso firmado | Cuotas canceladas `true`, unidad traspasada `true`, llaves entregadas `false`, unidad entregada `false` |
| Cerrado | Unidad entregada `true`; cuotas, traspaso y llaves no agregan condición de cierre |
| Volver a saldo desde traspaso o posterior | Prohibido |

`null`/ausente nunca satisface un No explícito. La API revalida; las restricciones visuales no sustituyen autorización. Los comandos mantienen versión/operación; resultado incierto conserva la edición y conflicto exige actualizar. La confirmación del cambio se distingue de un fallo posterior de recarga.

### Fondos de compra: tarjeta independiente

`FormalizationPurchaseFunds` se monta en ficha y drawer después de Adéndum; no se confunde con un campo ya colocado en el resumen superior. Presenta Fondos propios, Financiamiento bancario o Sin definir, sin asumir financiamiento cuando falta el dato. La edición recibe `canUpdateStage` del contenedor; sin autorización no ofrece editar ni consulta el token de edición. El control ocupa el ancho disponible y las acciones permiten salto de línea.

Editar consulta `GET /formalization/orders/:source/:id/purchase-funds` y valida origen nullable y secuencias enteras seguras no negativas. Guardar usa `POST /formalization/orders/purchase-funds` con origen elegido, `operationId`, `expectedSequence`, `expectedAuditSequence` y `expectedPurchaseFundsOrigin`; elimina únicamente el prefijo técnico `legacy:` del ID. No envía destino de etapa ni solicita un avance. La API conserva su autorización y validación independientes.

El guardado bloquea envíos simultáneos. Ante error de red/5xx conserva comando y selección para reintento idéntico, sin reintento automático ni cancelación alternativa; conflicto409 o401/403/404 exige actualizar. Confirmar éxito impide repetir la escritura, incluso si falla la recarga posterior. El componente se identifica por orden, versión y origen para aislar respuestas asíncronas entre órdenes. En ficha, el callback posterior relee el registro autorizado antes de actualizar su proyección y descarta respuesta si cambió la orden; el editor de etapa también se remonta al cambiar el origen de fondos. Las pruebas nuevas inspeccionadas cubren lectura sin edición, comando con token sin etapa, reintento idéntico incierto, conflicto y fallo de recarga tras éxito; esta revisión no las ejecutó. `funds-preview.temp.html` es un arnés temporal que sustituye fetch con una respuesta sintética y monta la tarjeta; no es ruta funcional ni evidencia de integración real.

### Marcador Adéndum

Hay un marcador por identidad de orden, independiente de la etapa y de los eventos. La tarjeta muestra Sin adéndum/Pendiente/Completado/Cancelado, nota y fecha local autorizadas. Requiere lectura de orden y `formalizacion.orders.addendum.read`; carecer de este último oculta únicamente información, badge y bandeja del marcador, sin ocultar una orden que el usuario sí puede leer.

«Marcar adéndum pendiente» requiere además `formalizacion.orders.addendum.mark_pending`, consulta versión y `canMarkPending` antes de guardar, no crea evento y acepta nota opcional de hasta 2000 caracteres. Completar/cancelar requiere `formalizacion.orders.addendum.update`, `canUpdate` del API y estado pendiente. Ninguna de estas acciones completa/cancela eventos del calendario.

Los grants predeterminados vigentes de marcación manual se definen en migración067 para Owner, Jefe General y Jefe de Formalizaciones; no para Formalización ordinaria. React consume grants efectivos y deny: no deduce autoridad del nombre del rol. El antecedente de marcación solo por jefatura no prevalece sobre esa ampliación; la excepción backend existente de Owner no se convierte en un bypass nuevo en UI. Un permiso configurado no acredita que una migración se haya aplicado.

Ambos comandos conservan `operationId`/versión al fallar de forma incierta, bloquean una edición alternativa y permiten el mismo reintento. Rechazos definidos 400/401/403/404/409 exigen releer. Tras éxito se actualiza marcador/orden/tablero; fallo de esa recarga no ofrece repetir una escritura confirmada. El banner de Home usa `formalizacion.home.addendum.read` separado; su contador no concede acceso a la bandeja ni a las órdenes. Gestión explica con ayudas los conteos, banco Sin iniciar/En proceso y el criterio de cada cola; «—» significa no recibido, no cero.

Fuentes: `FormalizationOrderDrawer.tsx`, `FormalizationRecordSummary.tsx`, `FormalizationStageEditor.tsx`, `FormalizationMarkAddendum.tsx`, `FormalizationOrderAddendum.tsx`, `order-addendum-permissions.ts`, `formalization-read-policy.ts` bajo `src/modules/home`; servicios `order-stage-service.ts`, `order-addendum-service.ts`, `order-client-service.ts`, `whatsapp-phone.ts` y `lead-profile-service.ts`. El contrato de calendario contextual y adéndum futuro se detalla en [Calendario global](Calendario-Global-Frontend.md).

## Antecedente del detalle y contrato DTO — 02/11/2026

El contrato y verificaciones siguientes conservan el corte inicial. El árbol actual ya no monta `FormalizationOrderDetails` en la ficha: ese lugar presenta la tarjeta Adéndum y conserva los capítulos NetSuite autorizados. El drawer muestra contacto/seguimiento y acciones descritos arriba. Mantener el DTO de consulta no prueba que todas sus secciones se rendericen hoy en esas dos superficies.

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


## Fondos de compra debajo de Adéndum — 03/11/2026

El panel compacto y la orden completa comparten `FormalizationPurchaseFunds`.
Muestra «Fondos propios», «Financiamiento bancario» o «Sin definir»; no interpreta
un nulo como financiamiento. Conserva el ancho del panel y las tarjetas existentes.
Editar requiere el permiso efectivo de actualización de etapa; guardar fondos no
cambia etapa, responsable, visitas ni sus tiempos. El editor obtiene una instantánea
actual y utiliza un comando independiente con versión de etapa, valor previo y
versión central de auditoría. El formulario bloquea la selección ante un resultado
incierto y reintenta la misma operación. Un conflicto requiere actualizar la orden.

Columnas existentes, sin migración: `CRM_THINK_V2.crm_sales_order.purchase_funds_origin_sales_order`
y `crmdatabase-api.ordenventa.origen_fondos_compra_ov`, ambas enum nullable
`own_funds`/`bank_financing`. No se rellenan registros existentes automáticamente.
Las rutas GET `formalization/orders/:source/:id/purchase-funds` y POST
`formalization/orders/purchase-funds` usan sesión, rol y permiso del servicio;
la mutación usa además CSRF global, auditoría transaccional y fuente autoritativa.
Ver el contrato API en [78](../../api/Arquitectura/78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).


Correccion posterior del mismo dia: el origen de fondos ahora tambien se actualiza
por sincronizacion NetSuite v2 desde custbody37 (1 Propios / 2 Financiado). La tarjeta
lee la columna de la fuente de la orden, ya incluida en FollowUpItem; no interpreta
etiquetas NetSuite como IDs. Conserva rojo para Sin definir y verde para un valor
definido. Publicacion/entrega real pendientes de los scripts configurados.
