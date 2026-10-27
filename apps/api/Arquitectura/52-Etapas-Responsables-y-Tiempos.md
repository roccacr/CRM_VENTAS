# 52 - Seguimiento de etapas y tiempos en ambas bases

## Reconciliacion documental - 2026-10-27

Se revisaron las migraciones 035-037, `sales-order-stage-duration.sql.ts`,
`scripts/migrate-legacy-sales-order-stage-tracking.ts`, controlador de transicion,
repositorios/lectores de seguimiento y las pruebas relacionadas. No se ejecuto
SQL ni se volvio a verificar aplicacion, flags `.env`, readiness o transiciones
reales. Los metadatos y resultados de pruebas siguientes conservan su fecha del 26 de octubre.

035 agrega `lead_id_sales_order BIGINT UNSIGNED NULL`, comentario, indice y FK
`crm_sales_order -> crm_lead.id_lead`, con RESTRICT en update/delete. Verifica
tipo/default/comentario/indices/FK existentes y falla ante drift; no vincula
registros por inferencia. 036 agrega responsable nativo y snapshot JSON por
visita con COMMENT, FK a `sec_user`, vista INVOKER y catalogos tecnicos acotados.
037 agrega el permiso del selector sin asignarlo a roles de negocio.

El runner nativo no accede al esquema viejo. El runner separado legacy exige
exactamente `--plan` o `--apply=crmdatabase-api`, usa TLS y validacion de destino,
mutex propio y preflight de metadata; no agrega FK a sec_user ni copia ordenes.
`--plan` abre una conexion de inspeccion y no es una simulacion sin BD. La
existencia de `--apply` no autoriza ejecutarlo durante una revision documental.

La habilitacion `ENABLE_LEGACY_WRITES=true` descrita abajo es evidencia local
del 26 de octubre, no confirmacion del valor de hoy ni de otro despliegue. La firma comercial
se lee de la fuente autoritativa; el selector no firma, envia correos ni cambia
NetSuite. Las lecturas de inspeccion NetSuite tampoco persisten su respuesta.

Corte verificado: 2026-10-26. Autorizacion: conservar el mismo patron de
responsabilidad, trayectoria y duraciones mientras las ordenes viven en legacy
o en nativo. No autoriza mover ordenes reales para pruebas ni integrar escritores
externos.

## Persistencia y autoridad

- Aplicada migracion nativa 036 en CRM_THINK_V2: responsable nativo y snapshot
  del responsable por visita. Se restauraron nueve estados y tres tipos de
  aprobacion tecnicos vaciados durante la limpieza; no se restauraron negocios.
- Aplicado runner aditivo separado en crmdatabase-api: snapshot del actor,
  referencia de responsable con sistema y snapshot del responsable.
- Ambas bases tienen la vista SQL SECURITY INVOKER
  audit_sales_order_state_duration. No se alteran los checks de ordenventa.
- Si existe alias nativo, solo nativo es autoridad, incluso si esta inactivo.
  De lo contrario se registra la etapa en legacy y la auditoria central en
  CRM_THINK_V2, usando la misma conexion/transaccion.
- La migracion no copia trayectoria antigua a una orden nativa. Cualquier
  futura promocion debe conservar esa evidencia explicitamente.

## Personas y fechas

El vendedor asignado al lead es seller. responsible identifica al responsable
de la visita; changedBy identifica al autor del cambio. Al registrar una
transicion nueva, el usuario autenticado toma la responsabilidad inicial y se
captura su nombre historico. No hay una pantalla nueva de reasignacion.

Cada entrada conserva estado anterior/nuevo, secuencia, actor, responsable,
fecha efectiva, fecha de registro, motivo, operacion y correlacion. Los
retrocesos crean otra visita; no borran ni sobrescriben la anterior.
leftAt es nulo mientras la visita sigue abierta. La duracion usa la siguiente
entrada o el instante actual; el total termina en el cierre actual. Si se
reabre, el proceso vuelve a estar abierto. Los datos desconocidos, futuros o
inconsistentes no se convierten en duraciones inventadas.

Las tres aprobaciones completas permiten mostrar Por enviar sin crear una
fecha historica falsa. Si no existe evidencia de entrada, esa fecha y el
inicio total permanecen desconocidos. No hay backfill de las 186 ordenes.

## API y permisos

Ampliacion confirmada 2026-10-26: el detalle real de cada orden incorpora
selector y Guardar. Con las tres aprobaciones completas se permite saltar a
las etapas operativas respetando el requisito de firma descrito abajo; volver a una anterior exige motivo.
POST /formalization/orders/stage usa el escritor transaccional existente,
version de estado y operationId. Exige formalizacion.orders.stage.update y
rol efectivo; migracion nativa 037 crea la definicion independiente, sin
asignarla automaticamente a los roles de negocio. Owner la hereda por su
politica existente. No se modifican checks de aprobacion, correo ni ERP.
Una denegacion explicita de contracts.send o contracts.revert tambien bloquea
el destino equivalente del selector; no se exigen grants antiguos adicionales.
La tabla retorna contractSigned, stateVersion y approvalsComplete para presentar el editor;
el API vuelve a validar ambos y captura al actor autenticado al guardar.
Tras guardar, lista y banners se consultan otra vez; los historiales se
conservan en la fuente autoritativa y la auditoria central en la base nueva.

Correccion 2026-10-26: Todas en Pendientes de seguimiento es la union de las
bandejas de los banners, no todas las ordenes activas. Se filtra antes de
buscar, paginar y obtener proyectos, usando el constructor comun para ambas
bases. Una orden sin etapa ni condiciones de banner se excluye. Los cierres
del ano siguen siendo acumulativos y una orden que se reabre se cuenta una
sola vez en Todas. Se conservan las restricciones de permisos y propiedad.

GET /formalization/orders/:source/:id/timing devuelve visitas paginadas,
responsables, autores y resumen de tiempos. Native usa public ID; legacy usa
ID CRM antiguo. pageSize maximo 100. Consulta sin cache, con sesion y permiso
de lectura de etapas, rol Formalizacion/Owner conforme a politica vigente,
alcance por recurso y permiso de aprobaciones cuando corresponde.
Se reutiliza la politica vigente de Home: self/assigned limita al vendedor del
lead; own_area/own_area_and_children/all_areas permite consulta en el modulo.
Estos alcances de area no son un filtro territorial o por proyecto. No se
introduce una politica geografica nueva en este corte.

ContractTransitionModule queda registrado: los comandos existentes send/revert
requieren permiso independiente, sesion, CSRF, control de version e idempotencia.
El alcance se deriva de la identidad en el servidor y se comprueba en la
transaccion antes de repetir una operacion o escribir; no procede del cliente.
Revertir exige motivo. No envian correo ni modifican el ERP. El selector
posterior descrito arriba amplia este corte a las siete etapas operativas.

Actualizacion autorizada 2026-10-26: ENABLE_LEGACY_WRITES=true en el .env local
del API, con ENABLE_RECORD_AUDIT=true y fallback legacy habilitado. Se reinicia
el API local para cargar la configuracion. Se conservan los controles de
permisos, alcance, estado, version, idempotencia y transaccion auditada; no se
ejecutan transiciones sobre ordenes reales como prueba. Los escritores legacy
de catalogos conservan su requisito adicional NODE_ENV=production. Esta
habilitacion local no configura un despliegue remoto.
Verificacion posterior: configuracion validada con escritura, fallback y
auditoria habilitados; 86 pruebas focalizadas aprobadas y readiness HTTP 200
del proceso reiniciado. No se ejecuto una escritura sobre una orden real.
Los cambios efectuados por SQL u otro sistema no se capturan
automaticamente ni se les atribuye un usuario del CRM.

## Verificacion y limites

Metadatos reales: columnas y vistas presentes en ambas bases; 46 usuarios,
cero ordenes nativas y 270 ordenes legacy activas/no caidas. Ambos historiales
tienen cero eventos: no se ha realizado una transicion real para probar.

Pruebas focalizadas verifican permisos, autoridad nativa, rollback logico,
idempotencia, registro de actor/responsable, paginacion y rutas.
MySQL ejecuto una consulta de solo lectura con ocho visitas derivadas:
duraciones de dos dias y un dia, retroceso, visita abierta sin salida,
snapshot sin fecha, cierre con total congelado y rechazo de tramo negativo.
No se insertaron fixtures ni se movieron ordenes reales. Esa consulta no
sustituye una prueba de concurrencia/persistencia de escrituras en un servidor
aislado. No se certifica integracion de escritores del sistema viejo.

Comprobaciones ejecutadas: API completo 5585 pruebas aprobadas y 118 omitidas;
frontend focalizado 31 aprobadas. Typecheck y build API/frontend aprobados.
API format:check aprobado. El lint global frontend tiene seis errores en
lead-capture-journey.model.ts y lead-capture-preview.model.ts de Mercadeo,
fuera del alcance. No se declaran esos errores corregidos ni MySQL aislado
validado. Readiness local devolvio status ready.


### Outlook desde Por enviar
El detalle muestra Abrir Outlook solo en contract_pending_send. El JSON federado incluye clientEmail desde crm_contact.email_contact (nativo) o leads.email_lead (legacy), usando las relaciones y permisos de seguimiento existentes. Correos vacios o invalidos son null. El enlace abre Outlook web con destinatario precargado; no envia mensajes, no registra un envio ni cambia la etapa. Sin correo valido se muestra Correo del cliente no disponible. El log DEV omite clientEmail.

### Mensajes del selector
Por enviar presupone tres aprobaciones completas y ningun envio registrado. La version 0 permite la primera transicion y no exige historial previo. El selector diferencia falta de permiso, aprobaciones pendientes y datos no recibidos; en este ultimo caso ofrece Actualizar orden. Guardar permanece deshabilitado mientras el destino sea igual al estado actual.

### Ver orden completa en el CRM
El panel ofrece Ver orden completa y abre una ficha interna con la identidad real. Por solicitud del producto (2026-10-26), esta ficha conserva la identidad (ruta y titulo) y agrega unicamente el avance por etapa. El enlace Ordenes de venta regresa al listado conservando filtros y pagina. No muestra cliente, secciones, estado, Outlook ni editor en esta ficha. El panel lateral, los banners, sus consultas y los datos de ambas BD se conservan.

### Avance visual de la orden (2026-10-26)
Escala por posicion actual: Pendientes de aprobacion 0%, Por enviar 17%, Pendiente de firma 33%, Gestion bancaria 50%, Pendiente de saldo 67%, Traspaso pendiente 83% y Traspaso firmado 100%. Son seis intervalos iguales redondeados; Cerrada conserva 100% y no agrega otro hito. Las posiciones previas se pintan como alcanzadas, la actual se destaca y las siguientes son grises. Esta escala no certifica visitas historicas ni duraciones; permite saltos de etapa segun la regla vigente. Estados desconocidos no reciben un porcentaje inventado. No agrega consultas ni escrituras y no modifica banners.

Presentacion del avance: linea continua compacta con iconos pequenos por etapa; segmentos alcanzados en verde, actual destacada en azul oscuro y siguientes en gris. Conserva etiquetas accesibles y aria-current; en pantallas estrechas se desplaza horizontalmente manteniendo el recorrido. Sin tarjetas individuales ni barra visual duplicada. Reutiliza iconos instalados; sin cambio de calculo, consultas ni escrituras.

El panel lateral reutiliza FormalizationRecordProgress inmediatamente despues de Ver orden completa. Su variante compacta adapta los siete hitos al ancho del drawer con la misma escala, estado actual y semantica accesible; no agrega consultas.

## Requisito de contrato firmado antes de banco (2026-10-26)
La firma observada se lee como contractSigned: contrado_frima_ov=1 en legacy y contract_signed_sales_order='yes' en nativo. Ausente, null, no o unknown no habilitan el avance.
El envio registrado permite Por enviar -> Pendiente de firma. Desde Pendiente de firma, Marcar como firmado completa esa etapa y pasa a Gestion bancaria solamente cuando la firma ya este confirmada en la fuente autoritativa. No se permite saltar desde Por enviar a banco ni mas adelante aunque exista firma.
Gestion bancaria, saldo, traspaso, traspaso firmado y cierre exigen firma confirmada. Se verifica dentro de la transaccion, leyendo la orden con bloqueo; un rechazo no agrega eventos ni auditoria. Las correcciones hacia las etapas de contrato siguen permitidas con los controles existentes.
Los contadores y bandejas posteriores a contratos tambien filtran por la firma confirmada; los contratos mantienen las tres aprobaciones y sus estados CRM. El acumulado de cierres conserva su filtro anual.
No hay escritura sobre custbody90/contrado_frima_ov/contract_signed_sales_order ni llamada a NetSuite en esta entrega. La integracion para marcar la firma en NetSuite se hara en un corte posterior. Sin firma confirmada el boton y las opciones de destinos posteriores quedan bloqueados; la UI no interpreta este conflicto de negocio como una version obsoleta.

## Inspeccion NetSuite por URL
Implementacion de lectura en src/integrations/netsuite (ver su README). GET /formalization/orders/:source/:id/netsuite valida permisos y propiedad, resuelve native-first y llama al RESTlet salesordersExtraer con la referencia NetSuite autorizada. El cliente de desarrollo conserva orderSource/orderId y el netsuiteId resuelto en URL y muestra el JSON solo en consola. No popula campos, no altera flags/etapas ni persiste el resultado. La consulta externa ocurre despues de cerrar el snapshot de BD.
