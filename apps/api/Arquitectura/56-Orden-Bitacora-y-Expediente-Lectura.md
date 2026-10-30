# 56 - Bitácora de orden y expediente relacionado

Entrega autorizada: 2026-10-27. Solo lectura; no migraciones, importaciones, cambios de estado, escrituras ni llamadas ERP para estos paneles.

## Accesos

Desde la orden completa, `Ver bitácora de la orden` abre un panel lateral con línea temporal. `Proyecto · Unidad` abre el expediente de la unidad, con el mismo patrón de panel que el cliente. Los datos se consultan al abrir, con preload, error/reintento y descarte de respuestas obsoletas al cambiar de orden. Cerrar y volver a abrir vuelve a consultar la fuente.

## Autorización y autoridad

`GET /formalization/orders/:source/:id/history?cursor=...` requiere sesión, rol efectivo Formalización y permiso `formalizacion.home.stages.read`, respetando denies y alcance de propietario. Las órdenes pendientes de aprobación conservan el requisito adicional de lectura de aprobaciones. Reutiliza la resolución y comprobación de recurso de la consulta `/database`; no expone IDs arbitrarios de registros de auditoría.

Se busca primero el registro nativo por publicId o alias legacy. Un registro nativo inactivo/eliminado no permite retroceder a legacy. Solo una ausencia nativa permite resolver una identidad legacy en la BD antigua. Una orden nativa puede conservar historia antigua únicamente por su alias explícito `id_old_produccion_sales_order`; no se unen órdenes por número comercial, correo o cliente.

## Fuentes de la bitácora

- Auditoría general: `CRM_THINK_V2.audit_record` + `audit_record_event`, filtrados por entidad `sales_order`, esquema, tabla e ID exactos. Los escritores actuales conservan la identidad histórica legacy cuando la orden nativa tiene alias y registran el origen efectivo nativo en el evento.
- Etapas nativas: `audit_sales_order_state_event`.
- Aprobaciones nativas: `audit_sales_order_approval_event`.
- Etapas legacy: `crmdatabase-api.audit_sales_order_state_event`, únicamente cuando la conexión está habilitada y las tablas de etapas existen. La ausencia se declara en `coverage`, sin fabricar eventos.
- `bitacoras` legacy corresponde al lead y no se incorpora como historial de la orden. `oportunidades_historial_estado` tampoco es historial de la orden.

Una operación de etapa/aprobación registrada además en la auditoría central aparece una sola vez. Se compara el ID derivado SHA-256 que utilizan los escritores (`sales_order/state/operationId` o `sales_order/approval/type/operationId`), dentro de los registros auditados de esa misma orden. No se deduplica por coincidencia de fecha, actor o texto.

## Contrato

Respuesta: `schemaVersion`, `source` (origen autoritativo), `items`, `hasMore`, `nextCursor`, `coverage`. Cada evento contiene ID, origen de la evidencia, acción y etiqueta, motivo, actor conocido, fecha efectiva y fecha de registro separadas, etapas anterior/nueva y etiquetas, cobertura del snapshot y cambios de campos públicos. Cada cambio mantiene `beforeExists`, `afterExists`, `before`, `after` para distinguir un campo ausente de un valor null.

Se proyectan solo campos de negocio permitidos de la orden y el contrato de etapas/aprobaciones. Campos no autorizados no se publican y se informa su cantidad mediante `hiddenChanges`. Nunca se devuelven snapshots arbitrarios, IP, user-agent, credenciales ni metadatos privados. El panel no ejecuta HTML procedente de notas, motivos o planos.

Páginas de hasta 50 eventos, ordenadas por fecha efectiva o de registro y clave de evento, con cursor vinculado a la identidad autoritativa de la orden. Las consultas usan parámetros y un snapshot de solo lectura. No hay caché de datos entre peticiones ni persistencia en el navegador. `Cache-Control: no-store`.

## Expediente

Reutiliza `/database`, autorizado por la orden. La relación es nativa `unit_file_id_sales_order -> crm_unit_file.id_unit_file`; legacy `idExpediente_ov -> expedientes.ID_interno_expediente` (no la PK legacy). Las relaciones ausentes o ambiguas no seleccionan otra unidad.

La vista mapea explícitamente los 35 campos nativos / 30 campos legacy permitidos: identificación, proyecto, vivienda, áreas, precios/mantenimiento, planos y referencias/fechas. Conserva precisión y formatos; no inventa moneda ni equivalencias de estado. Si falta el proyecto propio del expediente muestra Sin dato: no toma prestado el proyecto del lead. Los datos no relacionados de la pantalla principal siguen sin mapear.

## Evidencia y límites

Inspección real de solo lectura: ambas BD contienen tablas de etapas y la nativa contiene auditoría central y eventos de aprobación. La orden legacy:208 devuelve cero eventos; el panel muestra vacío honesto. La consulta nativa se validó contra un ID inexistente para comprobar columnas/SQL sin crear fixtures; esto no acredita historial nativo poblado. Pruebas automatizadas cubren contrato, recursos, revocación, estados vacíos, unión por alias, proyección privada, deduplicación, paginación y respuestas obsoletas. Consultar el resultado de ejecución de la entrega para cifras actuales.

Los cambios externos a escritores auditados no se capturan automáticamente. Un snapshot parcial no permite restaurar toda la orden. Esta vista no habilita restauración ni modifica registros.


## Información primaria de NetSuite - 2026-10-27

Ampliación explícita de lectura solicitada por el propietario: mapear únicamente Información primaria y nueve indicadores del ERP. No modifica las etapas CRM, las aprobaciones persistidas, las BD ni el ERP. Los cinco datos clave y la trayectoria siguen procediendo de la BD autoritativa.

El adaptador frontend `netsuite-primary.ts` recibe el mismo resultado de `getNetsuiteOrder` que se registra en `[NetSuite: orden de venta]`. Desde ese resultado, la ruta de los campos es `data.data.fields`; los nombres resueltos están en `data`. En el JSON global completo del log las rutas exactas son `data.data.fields.initialtranid` y `data.cli`; no hay un nivel `data` adicional. Los nombres auxiliares son cadenas codificadas en JSON y se decodifican como texto; no se renderiza HTML ni se publican IDs internos como nombres.

| Campo visible | Origen relativo al resultado de getNetsuiteOrder |
| --- | --- |
| N.º de pedido | data.data.fields.initialtranid |
| Cliente | data.cli |
| Fecha | data.data.fields.trandate |
| Firma de contrato | data.data.fields.custbody68 |
| Moneda | data.data.fields.currencyname |
| Subsidiaria | data.Subsidaria (nombre exacto de la clave legacy del RESTlet) |
| Departamento | data.Departamento |
| Clase | data.Clase |
| Ubicación | data.Ubi |
| Nota | data.data.fields.memo |
| Estado de cuenta | Sin dato: no hay valor/acción confirmados en este contrato |
| Traspaso / entrega de llaves | Sin dato: no sustituir por shipdate o entrega estimada |
| Lectura del medidor de agua | Sin dato: campo de origen no confirmado en este payload |

Los indicadores de solo lectura se mapean: Contrato firmado=`custbody90`, Cierre firmado=`custbody51`, Unidad entregada=`custbody91`, Unidad traspasada=`custbody105`, Venta caída=`custbody43`, Comisión aprobada=`custbody103`, Comisión cancelada=`custbody_ix_comision_pagada`, Entrega de llaves=`custbody_entrega_de_llaves`, Validación de fideicomiso/prima=`custbody274`. T/F y true/false son Sí/No; un campo ausente o desconocido es Sin dato. Este fue el corte inicial; la ampliación de Información de ventas y Mezzanine se detalla a continuación.

La petición ya existente se reutiliza; no se agrega otra llamada por componente. Ahora alimenta la vista tanto en desarrollo como en build, siempre bajo el permiso existente; los console logs quedan exclusivamente en DEV. El estado de carga se vincula a identidad y versión de recarga: oculta datos anteriores, mantiene preload global, ignora respuestas tardías y no usa muestras ante errores. No hay caché compartida ni persistencia en navegador. Se rechaza un registro ERP de otra identidad o una respuesta inválida.

Verificación contra el JSON adjunto del propietario, sin una nueva llamada externa: RDR673, fecha 31/01/2025, firma 17/03/2025, US Dollar, 10 valores primarios disponibles y 3 sin fuente confirmada, dos checks marcados y siete desmarcados. Se prueban mapeo, checks ausentes, producción sin logs, recarga limpia y preservación de campos no autorizados.


Cierre de verificación de esta ampliación: 935 pruebas frontend aprobadas (69 archivos), lint/Prettier de archivos modificados, typecheck y build. La primera corrida completa detectó un timeout de carga fría en la prueba de navegación con perfil almacenado; la preparación ahora precarga FormalizationHomePage junto con RolesSecurityPage, preservando las aserciones y sin ampliar timeouts ni modificar autorización. Los dos casos aislados y la segunda corrida completa pasan. No se verificó la vista en una sesión autenticada del navegador ni se realizaron escrituras o una nueva petición externa de NetSuite para comprobar el archivo adjunto.


## Información de ventas - ampliación 2026-10-27

Se reutiliza la respuesta ya cargada y el preload global. `NetsuitePrimary.sales` expone solo los valores aprobados para el capítulo `sales`; en ese corte la autorización de venta seguía sin mapear; la ampliación posterior se describe a continuación. Los resúmenes monetarios siguen sin conectarse. Los importes decimales se agrupan como texto sin conversión a punto flotante, pérdida de precisión, moneda inventada ni ceros como sustituto de valores ausentes.

| Campo visible | Clave en data (RESTlet) / data.data.fields |
| --- | --- |
| Unidad expediente ligado VTA | data.Expediente |
| Motivo de compra | data.MOTIVO_COMPRA |
| Método de pago | data.METODO_PAGO |
| Fecha de vigencia de la venta | fields.saleseffectivedate |
| Campaña de marketing | data.CAMPANA |
| Oportunidad | data.Oportunidad |
| Creado desde | data.CREADO |
| Fondos de compra | data.FONDOS |
| Vigencia de garantía | fields.custbodytpv_vigencia_garantia |
| Representante de ventas | data.vendedor |
| Socio | data.socio |
| Motivo de cancelación de reserva o venta caída | data.MOTIVO_CANCE |
| Entrega estimada | fields.custbody114 |
| Fecha de entrega contractual | fields.custbody140 |
| Fecha adenda | Sin dato: identificador de origen no confirmado |
| Comentarios cancelación de reserva | fields.custbody116 |
| Precio de venta | fields.custbody_ix_total_amount |
| Monto cortesías | fields.custbody16, equivalencia confirmada por el propietario |
| Mezzanine (solo lectura) | fields.custbody_mezzanine_verifica, T/F/ausente = Sí/No/Sin dato |

El JSON adjunto devuelve precio 391,680.00, cortesías 2,000.00, vigencia de venta 31/01/2025 y ambas fechas de entrega 31/12/2026. Se muestra la fecha contractual real aunque el texto inicial del propietario la dejara vacía. Vigencia de garantía, socio y motivo de cancelación están vacíos/ausentes; fecha adenda no se infiere de otra fecha. Las cadenas resueltas conservan el texto suministrado por el proveedor, sin reconstruir caracteres dañados.

Verificado para esta ampliación: mapeo contra el JSON adjunto, 38 pruebas enfocadas, lint de archivos cambiados, typecheck y build. La suite completa de 935 pruebas del corte anterior es evidencia histórica; no se reejecutó completa para esta ampliación. No se hicieron escrituras, llamadas nuevas al ERP ni revisión visual autenticada.


Corrección de compatibilidad de presentación (2026-10-27): el resumen tolera capítulos/indicadores aún ausentes en snapshots retenidos durante Fast Refresh. Antes, un snapshot previo a `sales` provocaba TypeError al leer Unidad expediente ligado VTA. Las secciones ausentes muestran Sin dato; la lectura normal del proveedor sigue produciendo el contrato completo y no se relajó su validación. La prueba de regresión reprodujo el TypeError antes de la corrección; también se cubre la ausencia de fields/checks en la presentación. Recargar la orden obtiene el formato nuevo.


## Autorización de venta - ampliación 2026-10-27

Se agrega `NetsuitePrimary.authorization` al mismo resultado ya cargado. El capítulo autorización mantiene la tolerancia a snapshots anteriores: si la sección no existía aún en el estado retenido, presenta valores sin dato sin provocar TypeError. Se muestran valores del proveedor, sin recalcular comisiones, IVA, PVN, PVM ni diferencias; los importes conservan su precisión decimal y los porcentajes su texto.

| Campo | data.data.fields / texto resuelto |
| --- | --- |
| Precio de lista | custbody13 |
| Precio cálculo comisión corredor | custbody22 |
| % comisión del corredor | custbody14 |
| Monto de comisión de corredor | custbody15 |
| Monto total de cortesías | custbody16 |
| Descripción de cortesías | custbody35 |
| Monto extras sobre el precio de lista | custbody46 |
| Descripción de extras sobre el precio de lista | custbody47 |
| Cashback | custbodyix_salesorder_cashback |
| Precio de venta neto | custbody17 |
| Precio de venta mínimo | custbody18 |
| Diferencia entre PVN y PVM | custbody19, no custbody185 ni un cálculo local |
| Comisión del asesor % | custbody20 |
| Monto de comisión del asesor | custbody21 |
| Monto de comisión segundo asesor | custbody71 |
| Unidad expediente ligado | data.UNIDAD, referencia custbodyix_exp_ligado_num_unid; distinta de VTA/custbody38 |
| Tipo de cambio | exchangerate, no primarycurrencyfxrate |
| Cargos adicionales | custbody_ov_cargos_adicionales |

Checks de solo lectura: Aprobación jefe de ventas=`custbody_aprueba_jefe_ventas`, Formalización=`custbodyid_firma_rc`, Desarrolladora=`custbodyid_firma_rocca`, Cálculo asesor(auto)=`custbody74`, Cálculo corredor(auto)=`custbody73`, No paga traspaso S.A.=`custbody141`, No paga cesión de acciones=`custbody157`. T/F o booleanos son Sí/No, ausencia es Sin dato; no cambian permisos, estados CRM ni valores del ERP.

Decisión expresa del propietario: ocultar IVA corredor (13 %), Comentario de autorización de venta y Avisos importantes hasta confirmar sus IDs; no aparecen en la lista adicional suministrada ni se calcula un sustituto de IVA. No se copian campos técnicos privados del bloque de inspección del navegador a fixtures, documentos ni la UI.

El JSON del RESTlet adjunto trae custbody22=362680.00, mientras el bloque posterior de inspección del navegador trae 0.00. Se conserva el valor de cada respuesta actual; no se fuerza ninguno de los dos. Las pruebas cubren ambos casos, ceros reales, diferencias sin recalcular, vínculo de unidad distinto, checks y snapshots sin autorización. Verificación de esta ampliación: 43 pruebas enfocadas, lint, typecheck y build; no se reejecutó la suite completa ni se hicieron escrituras o cambios de entorno/proveedor.

### 2026-10-27 — Secciones adicionales de lectura de NetSuite

Después de Autorización de venta, la vista incluye únicamente Artículos, Reserva, Detalle de pago y OneDrive, en lugar del capítulo vacío de Información del sistema. Conserva el acceso a la bitácora de la orden. OneDrive contiene exclusivamente el encabezado `AQUI VA EL ONEDRIVE`, sin integración.

- Artículos: descuento directo `custbody132`, reserva `custbody52`, prima total `custbody39` y diferencia de extras `custbody185`.
- Reserva: medio de pago `custbody188` (catálogo confirmado del editor anterior: 1 Transferencia, 2 Efectivo, 3 Cheque, 4 Paypal, 5 Tarjeta de crédito, 6 Tarjeta de débito); transacción `custbody189`; monto/fecha aplicada `custbody207`/`custbody208`; monto/fecha prereserva `custbody191`/`custbody206`; observaciones `custbody190`. No se reutiliza el método de compra METODO_PAGO.
- Detalle de pago: monto prima `custbody_ix_salesorder_monto_prima`; hito 1 `custbodyix_salesorder_hito1`; hitos 2–6 `custbody_ix_salesorder_hito2` a `custbody_ix_salesorder_hito6`; monto total hitos `custbody_i_amount_hitos`; prima % `custbody60`; porcentajes H1–H6 `custbody62` a `custbody67`; prima neta `custbody211`; monto hitos total `custbody_total_hitos_amount`. Son campos distintos: prima total, monto prima y prima neta no se sustituyen entre sí.
- Cantidad de tractos, observaciones/fechas de prima, reserva y cashback del detalle de pago, fecha inicial, fecha proyectada/observaciones de hito 1 y monto hitos % permanecen sin dato hasta identificar sus claves. No se calculan ni se deducen de otros campos.

Se reutiliza la respuesta de NetSuite ya autorizada: no hay peticiones adicionales, escrituras en BD o ERP ni cambios de etapas. Los importes conservan negativos, ceros y precisión decimal del origen. La proyección admite snapshots anteriores sin los nuevos capítulos.

Verificación de este corte: 45 pruebas aprobadas en cuatro archivos (proyección, resumen, progreso y carga de NetSuite). No equivale a una ejecución de toda la suite ni a una comprobación en producción.

#### Navegación de detalles adicionales
Artículos, Reserva, Detalle de pago y OneDrive forman un menú independiente de pestañas debajo de Autorización de venta. Artículos es la selección inicial; únicamente el panel seleccionado queda visible. No aparecen como acordeones ni como enlaces del menú superior. El menú admite flechas izquierda/derecha e Inicio/Fin; las tres secciones anteriores y el acceso a bitácora mantienen su comportamiento. No se agregan consultas al cambiar de pestaña.

#### Resumen económico de NetSuite
El panel Resumen consume la misma proyección autorizada: Subtotal = `subtotal`, Total de impuesto = `taxtotal`, Certificado de regalo = `giftcertapplied`, Total = `total`, todos en `data.data.fields`. Conserva la precisión decimal del origen, incluidos los ceros. Si un dato falta, es inválido o pertenece a un snapshot anterior, muestra un guion; no calcula totales ni usa valores de muestra. No agrega peticiones ni modifica registros. Verificación focalizada: 31 pruebas aprobadas en proyección, resumen y carga de NetSuite.

#### Corrección de claves confirmadas por el usuario (2026-10-27)
Las capturas de NetSuite corresponden a sandbox y la conexión del CRM a producción: diferencias de valor entre entornos no demuestran un error de mapeo. Claves confirmadas: Precio cálculo comisión corredor `custbody22`; Fecha entrega contractual `custbody140`; Monto cortesías (Información de ventas) `custbody36`; Comentarios cancelación reserva `custbody116`; Certificado de regalo `giftcertapplied`; IVA corredor (13 %) `custbody219`. Este último ya se muestra; deja de ser un campo oculto sin clave. Monto total de cortesías en Autorización conserva `custbody16`: es distinto de `custbody36` y esta confirmación sustituye la equiparación anterior. No se fuerzan los valores de sandbox en producción. Pruebas focalizadas: 22 aprobadas.

#### Líneas de artículos
Sección independiente debajo de las pestañas, con siete columnas en este orden: Artículo (`item_display`), Fecha de pago proyectado (`custcolfecha_pago_proyectado`), Cantidad (`quantity`), Descripción (`description`), Precio unitario (`rate`), Importe lista (`amount`) e Imp. bruto (`grossamt`). Se leen de `data.data.sublists.item`, únicamente entradas `line N`, ordenadas numéricamente; se excluye `currentline`. No se calcula el importe ni se sustituye el nombre por el ID del artículo. Se reutiliza la respuesta autorizada existente sin consultas adicionales. Tabla de solo lectura con desplazamiento horizontal y estado vacío explícito; no se agregan otras columnas.
