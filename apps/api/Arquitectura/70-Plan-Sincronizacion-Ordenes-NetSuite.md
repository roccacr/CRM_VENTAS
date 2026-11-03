## Implementación local posterior — 2026-11-02

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

El contrato v2 ya implementa los diez checkbox, resolución nativa → legacy, transacción y bitácora central/nativa. v1 conserva persisted:false. 058 se aplicó con aprobación explícita y el túnel fue verificado; la activación y prueba real están pendientes; este bloque sustituye las descripciones de ausencia de escritor de los cortes históricos inferiores. Contrato, archivos, pruebas y límites: [73](73-Sincronizacion-Estados-Ordenes-NetSuite.md).

# 70 - Plan de sincronización de órdenes desde NetSuite

Fecha: 2026-10-30.
Estado: análisis y plan; persistencia de eventos todavía no implementada.

Revisión estática 2026-11-02: este archivo sigue siendo un plan local sin commit,
no un escritor registrado ni un compromiso ejecutado. El receptor actual continúa
devolviendo `persisted:false`; no hay inbox durable ni actor de integración nuevo.
El DDL057 y su CLI también son locales respecto a HEAD `fcbf0c2`. Sus pruebas y
aplicación históricas se conservan fechadas; no se repitió metadata ni ninguna
mutación durante la reconciliación documental. No avanzar casillas del plan por
tener columnas, módulos SuiteScript o un recibo HTTP200.

## Traspaso para retomar (2026-11-02)

El propietario cierra este chat y solicita conservar el contexto. **No está listo
el escritor automático de eventos NetSuite.** La siguiente entrega es implementar
este plan; no darlo por ejecutado por existir un recibo HTTP 200.

### Decisiones confirmadas por el propietario

1. Resolver la orden por su referencia NetSuite primero en CRM_THINK_V2.
2. Si existe allí, actualizar exclusivamente la nueva; nunca también la antigua.
3. Si no existe autoridad nativa, buscar en crmdatabase-api por id_ov_netsuite.
   Si tampoco existe, devolver no encontrada, sin crear ni importar la orden.
4. Sandbox también puede actualizar órdenes existentes en crmdatabase-api.
   Registrar cuenta y entorno reales; no presentar Sandbox como NetSuite producción.
5. Adaptar los campos a cada estructura y registrar una edición de origen NetSuite
   con antes/después en la bitácora central de CRM_THINK_V2. Cambio y evento
   deben confirmar o revertir juntos, incluso si la orden vive en legacy.
6. Conservar campos omitidos, distinguir desconocido de falso y evitar duplicados,
   eventos antiguos y escrituras en la copia incorrecta durante una migración.

### Qué existe y qué falta

| Pieza | Estado al cerrar |
| --- | --- |
| RESTlet CRM → NetSuite y aprobación de Formalización | Flujo separado existente; no es el receptor de cambios externos. |
| User Event afterSubmit y emisor de cambios | Preparados para la prueba de recepción; no prueban persistencia comercial. |
| POST integrations/netsuite/local/order-events | Código inspeccionado el 2026-11-02: valida y registra metadatos; devuelve received:true y persisted:false. No escribe órdenes. |
| Casillas adicionales, migración 057 | Aplicación en ambas BD verificada en la entrega del 2026-10-30; no se repitió consulta a BD al cerrar este chat. |
| Escritor nativo/legacy por ID NetSuite | Pendiente. |
| Actor confiable NetSuite y bitácora atómica de la recepción | Pendiente. |
| Identidad de evento, revisión de origen, deduplicación y control de antigüedad | Pendientes. observedAt no acredita por sí solo la revisión del registro. |
| Acuse de persistencia y compatibilidad del emisor | Pendiente. El emisor actual exige persisted:false. |
| Cola durable Map/Reduce en NetSuite | No construida; no confundirla con el control transaccional necesario en el receptor. |

### Evidencia y archivos para empezar

- Código actual: `src/integrations/netsuite/netsuite-local-events.controller.ts`.
- Autoridad/referencias: `src/integrations/netsuite/netsuite-order.repository.ts`;
  invertir la búsqueda para resolver desde ID NetSuite, sin asumir que su resolver
  actual ya lo hace.
- Auditoría: `src/modules/crm/audit/record-audit.service.ts` y `audit-actor.ts`.
- Patrón de bloqueo: `formalization-approval.repository.ts` y
  `contract-transition.repository.ts`, dentro de sales-orders.
- SuiteScript: `src/integrations/netsuite/suitescript/`, entrada
  `SS2_1_UE_CRM_CambiosRegistros.js`, librería `SS2_1_LIB_CRM_EnviarEvento.js`
  y módulo `modules/01_sales-orders/`. Avisar cuáles archivos cambian para que
  el propietario actualice los de NetSuite; cambiar archivos locales no los publica.
- Ejemplo recibido: `dist/diagnostics/netsuite-order-12135586.json`, 79 campos,
  16 aliases y 5 líneas. Es un snapshot histórico, no una autorización para
  reproducirlo contra datos actuales. Falta incluir custbody_cuotas_pagadas.
- DDL: `migrations/schema-only/202610300057_sales_order_operational_flags.ts`
  y `scripts/migrate-legacy-sales-order-flags.ts`.
- Evidencia histórica de esquema: `dist/diagnostics/sales-order-flags-before.json`
  y `dist/diagnostics/sales-order-flags-applied.json`. dist puede ser local/ignorado;
  no asumir que estos artefactos estarán en un clon limpio.

### Orden de continuación

1. Revisar el árbol y la documentación vigente: hay cambios locales ajenos.
2. Cerrar el contrato de evento/revisión/acuse y el mapeo de campos de abajo.
3. Implementar resolución y actualización de una sola autoridad, snapshot íntegro,
   actor de integración y bitácora bajo la misma transacción.
4. Probar ausencia/ambigüedad, precedencia nativa, rollback, duplicados y eventos
   desordenados. No usar fixtures sobre las BD compartidas.
5. Ejecutar pruebas focalizadas, lint, tipos y build; registrar limitaciones de
   MySQL y aceptación real sin convertir verificaciones con dobles en prueba SQL.
6. Informar archivos SuiteScript a subir y requisitos de configuración; verificar
   después una operación controlada sobre el registro elegido por el propietario.

No repetir automáticamente migraciones ya aplicadas, no ejecutar snapshots como
pruebas, no modificar credenciales compartidas y no hacer commit/push/despliegue
por el simple hecho de cerrar este chat. La documentación conserva autorización
y decisiones, pero no sustituye la verificación del estado al retomar.

## Alcance autorizado

Una edición de NetSuite debe actualizar únicamente la orden existente que sea
autoridad en el CRM. Buscar primero por referencia externa NetSuite en
CRM_THINK_V2; solo si no existe una autoridad nativa, buscar en
`crmdatabase-api.ordenventa.id_ov_netsuite`. No crear ni importar órdenes
automáticamente. No escribir ambas fuentes.

El propietario confirmó en este turno que el emisor Sandbox también puede
actualizar las órdenes existentes en crmdatabase-api. Esta autorización de
sincronización completa amplía la excepción anterior, limitada a la aprobación
de Formalización. La auditoría debe identificar siempre cuenta y entorno reales.
No cambiar credenciales compartidas, no desplegar y no reproducir fixtures contra
las bases compartidas para probar este plan.

## Estado comprobado y revisión paralela

- [x] Revisar receptor, contrato del emisor, resolución de referencias y auditoría.
- [x] Revisar con tres agentes independientes: mapeo, transacciones/auditoría,
  autenticación/contrato.
- [x] Confirmar que el receptor actual solo acusa recepción: `persisted:false`.
- [x] Identificar el ejemplo conservado localmente: 79 campos, 16 aliases y
  5 líneas para NetSuite 12135586. Es evidencia de recepción, no de persistencia.
- [x] Identificar que el emisor todavía omite `custbody_cuotas_pagadas`.
- [x] Confirmar en código que la auditoría actual exige un usuario capturado:
  falta atribución confiable a un servicio de integración.
- [x] Confirmar que la recepción actual no resuelve duplicados ni mensajes viejos.
- [ ] Implementar y verificar el flujo de escritura descrito debajo.

La migración 057 define siete banderas en ambas estructuras. Su ejecución y
verificación fueron registradas en la entrega anterior; esta revisión no volvió
a consultar ni modificar las bases. También deben incorporarse al mapeo de
lectura que todavía no las expone.

## Plan de implementación

### 1. Contrato y evidencia de origen

- [ ] Versionar conjuntamente el mensaje y su acuse; el emisor actual rechaza
  un recibo con `persisted:true`.
- [ ] Conservar la autenticación de máquina y la validación de cuenta,
  entorno, tipo de registro e identidad del snapshot. El JSON no elige la BD.
- [ ] Añadir identidad estable de entrega y evidencia de modificación del
  registro. Verificar qué fecha/revisión proporciona realmente NetSuite antes
  de utilizarla como orden comparable.
- [ ] Definir política conservadora para revisiones ausentes o ambiguas:
  no sobrescribir silenciosamente un estado más reciente.
- [ ] Añadir la casilla de cuotas al lector de campos reutilizado por los eventos.
  No copiar secretos, cookies o tokens en payloads, logs ni auditoría.

El envío seguirá usando el User Event y su módulo de orden de venta. Este corte
no construye la cola Map/Reduce previamente descartada. La deduplicación del
receptor sí es necesaria para no repetir cambios ya confirmados.

### 2. Resolver una única autoridad

- [ ] Buscar la referencia externa por proveedor NetSuite, cuenta/entorno
  autorizados e ID externo. Rechazar referencias ambiguas.
- [ ] Una coincidencia nativa impide cualquier escritura legacy. Una orden
  inactiva no se convierte en ausencia; una eliminada no se reactiva por inferencia.
- [ ] Si no hay referencia nativa, localizar legacy, bloquear su fila y volver
  a comprobar la autoridad nativa mediante lectura actual con bloqueo.
- [ ] Comprobar también `id_old_produccion_sales_order`: una orden migrada sin
  referencia coherente es un conflicto, no permiso para editar su copia antigua.
- [ ] Si no existe en ninguna fuente, responder no encontrada sin crear orden,
  lead, expediente ni identidad de auditoría.
- [ ] Reutilizar el protocolo de bloqueo del escritor de aprobación/transición;
  no reutilizar sus comandos humanos ni sus llamadas de vuelta al ERP.

La sincronización debe poder observar una venta caída y actualizar su bandera.
No aplicar el filtro de “orden activa y no caída” de la vista como condición
previa para recibir esa modificación. No reactivar órdenes ni mover etapas por
inferencias del tipo de evento.

### 3. Normalización explícita de campos

| NetSuite | Nueva BD | BD antigua |
| --- | --- | --- |
| custbody90 | contract_signed_sales_order | contrado_frima_ov |
| custbody51 | commercial_closure_signed_sales_order | cierre_firmado_ov |
| custbody91 | unit_delivered_sales_order | unidad_entregada_ov |
| custbody105 | unit_transferred_sales_order | unidad_traspasada_ov |
| custbody_entrega_de_llaves | keys_delivered_sales_order | entrega_llaves_ov |
| custbody274 | trust_down_payment_validated_sales_order | validacion_fideicomiso_prima_ov |
| custbody103 | commission_approved_sales_order | comision_aprobada_ov |
| custbody73 | broker_commission_calculated_sales_order | calculo_comision_corredor_ov |
| custbody_cuotas_pagadas | installments_fully_paid_sales_order | cuotas_pagadas_completo_ov |
| custbody74 | advisor_commission_calculated_sales_order | calculo_comision_asesor_ov |
| custbody_ix_comision_pagada | advisor_commission_paid_sales_order | comision_cancelada_ov |
| custbody43 | cancelled_sales_order | caida_ov |
| custbody_aprueba_jefe_ventas | aprobación sales_management | chekJefeVenta |
| custbodyid_firma_rc | aprobación formalization | aprobacion_forma_ov |
| custbodyid_firma_rocca | aprobación developer | aprobacion__rdr_ov |
| custbody13 | list_price_sales_order | pre_lista_ov |
| custbody17 | net_sale_price_sales_order | prec_ventaneto_ov |
| custbody_ix_total_amount | sale_price_sales_order | prec_venta_ov |
| custbody21 | advisor_commission_sales_order | comison_asesor_ov |
| trandate | transaction_date_sales_order | trandate_ov |

- [ ] Banderas nativas: yes/no/unknown; aprobaciones nativas:
  approved/not_approved/unknown; legacy: 1/0, conservando desconocidos.
- [ ] Ausente significa “no actualizar”. Null, vacío y textos marcadores no
  se convierten automáticamente a falso, cero ni borrado.
- [ ] Validar fechas de negocio y decimales sin perder precisión monetaria.
- [ ] Actualizar el número de transacción en su referencia/campo correspondiente,
  nunca como ID público o código nativo.
- [ ] Resolver relaciones por referencias reales antes de modificar FK.
  Los aliases de cliente, vendedor, subsidiaria o expediente son textos, no IDs.
- [ ] Conservar íntegros los campos, aliases y líneas restantes en un snapshot
  JSON protegido y versionado. No inventar un destino comercial para cada alias.
- [ ] Preparar almacenamiento aditivo para snapshots exclusivamente legacy:
  el existente nativo tiene FK obligatoria a una orden nativa y no puede usarse
  creando una orden artificial.
- [ ] No reinterpretar `pagadas_ov` como cuotas pagadas; usar el nuevo campo.
  No equiparar “comisión cancelada” histórica con cancelación de la venta.

### 4. Cambio y bitácora atómicos

- [ ] Reutilizar `RecordAuditService.append(tx, ...)`, ampliando la captura
  confiable de actor para NetSuite. No atribuir el evento a Owner ni aceptar
  un supuesto actor del cuerpo.
- [ ] Capturar antes real bajo bloqueo, aplicar patch y registrar después
  persistido, diferencias, origen integration, cuenta/entorno, ID externo,
  entidad, fuente física, operación y correlación.
- [ ] Si la orden vive en legacy, actualizarla allí y guardar la bitácora central
  en CRM_THINK_V2 usando la misma conexión/transacción.
- [ ] Registrar deduplicación/cursor/snapshot con el mismo commit. Acusar éxito
  de aplicación solo después de confirmar ese commit.
- [ ] Reintento idéntico: confirmar replay sin otra edición ni otro evento
  de cambio. Identidad reutilizada con contenido distinto: conflicto.
- [ ] Mensaje viejo: no reemplazar valores actuales. Ausencia de cambios:
  distinguir “sin cambios” de error y de edición aplicada.
- [ ] Exponer en la bitácora existente “Orden actualizada desde NetSuite”
  y los cambios autorizados; no publicar automáticamente el JSON crudo.

No modificar las etapas gestionadas por usuarios por recibir una observación.
Si la regla de lectura deriva Por enviar de las tres aprobaciones, mantener
esa regla; no inventar fecha de entrada, responsable ni transiciones históricas.
Si hay que proyectar estados por una nueva regla, debe especificarse aparte.

### 5. Archivos y reutilización previstos

Modificar:
- `src/integrations/netsuite/netsuite-local-events.controller.ts` y
  `netsuite.module.ts`: validación y delegación al nuevo escritor.
- Contratos/validación de entorno de integración: activación explícita y acuse.
- `src/modules/crm/audit/audit-actor.ts` y `record-audit.service.ts`:
  actor de servicio confiable, preservando controles existentes.
- `order-record.query.ts`, mapper legacy e historial: nuevas banderas y
  atribución pública controlada.
- SuiteScript `lib/SS2_1_LIB_CRM_EnviarEvento.js`, el esquema de campos y
  el notificador de órdenes: contrato compatible, evidencia y cuotas.

Añadir solo responsabilidades que faltan:
- Mapper explícito de entrada y escritor transaccional de sincronización.
- Migración aditiva mínima para recepción/snapshots/cursor compartidos por origen,
  después de comprobar que no existe una estructura reutilizable.
- Pruebas bajo `test/`, siguiendo las suites actuales.

No ampliar los escritores de transición para convertirlos en sincronizadores.
No cambiar la lectura RESTlet ni producir escrituras de vuelta a NetSuite por
recibir su evento: evitar bucles de sincronización.

## Criterios de aceptación

- [ ] Nativa y legacy contienen la orden: solo cambia nativa.
- [ ] Solo legacy: cambia legacy y queda su bitácora en la nueva.
- [ ] Ninguna: no encontrada y cero datos comerciales creados.
- [ ] Alias migrado, referencias duplicadas, fila eliminada: fallo explícito,
  nunca fallback silencioso.
- [ ] Las quince casillas, tres aprobaciones incluidas, usan el campo correcto.
- [ ] Campos omitidos y relaciones sin resolver no destruyen información.
- [ ] Fallo de auditoría o de commit revierte también el cambio comercial.
- [ ] Dos entregas concurrentes y un replay no duplican edición ni bitácora.
- [ ] Evento anterior no pisa una versión más nueva.
- [ ] Se conserva todo el snapshot sin exponerlo en logs generales.
- [ ] Lectura posterior muestra los nuevos valores e historial con origen NetSuite.
- [ ] Pruebas de contrato productor/receptor, unitarias, HTTP, lint, typecheck
  y build correctos. Concurrencia real solo en MySQL aislado autorizado.
- [ ] Prueba real controlada únicamente sobre la orden elegida por el propietario,
  verificando origen efectivo, antes/después y evento, sin fixtures compartidos.

## Evidencia de esta revisión

Los agentes hicieron análisis de solo lectura. El agente de contrato reportó
14 pruebas HTTP y 6 de entorno aprobadas, además de reproducir que el emisor
actual considera inválido `persisted:true`. Esto comprueba la recepción vigente,
no el escritor futuro. No se modificó código operativo, NetSuite ni la BD en
esta revisión. El siguiente corte es implementar las casillas y campos
confirmados, almacenamiento íntegro y auditoría bajo estas reglas.

