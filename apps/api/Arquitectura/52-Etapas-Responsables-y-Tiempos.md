# 52 - Seguimiento de etapas y tiempos en ambas bases

## Reglas de fondos y finalización en el árbol local — 2026-11-10

Las reglas actuales de [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md)
y el corte [90](90-Reconciliacion-API-20261110.md) prevalecen sobre los
predicados históricos de este documento. Estos cambios locales requieren
verificación separada antes de considerarlos publicados.

- Contratos exige la aprobación explícita de Formalización, actividad y ausencia
  de caída/borrado; no exige nuevamente las otras dos aprobaciones. Aprobar una
  orden mantiene sus prerrequisitos propios de Jefatura y Desarrolladora.
- Las ocho etapas incluyen `bank_management_in_progress`. Al salir de Contratos,
  con firma confirmada, `own_funds` conduce a `pending_balance` y `bank_financing`
  a `bank_management` (Sin iniciar). El inicio explícito pasa a
  `bank_management_in_progress`; sin origen no hay avance. Origen y etapa se
  guardan con la misma transacción y auditoría; el replay compara su elección histórica.
- La bandeja Traspasos pendientes exige contrato firmado, etapa
  `pending_transfer` y cuotas pagadas. La transición manual a esa etapa
  conserva sus comprobaciones de indicadores.
  Para registrar Traspaso firmado manualmente se exigen cuotas pagadas, llaves y unidad aún sin entregar. La conciliación automática desde NetSuite aplica las reglas de [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md#conciliación-automática-desde-netsuite). El registro manual desde Traspaso pendiente admite confirmación pendiente en NetSuite y muestra una advertencia.
  Unidad entregada sí habilita cierre aunque los otros tres sean desconocidos.
  NULL nunca sustituye un no confirmado. Se conservan firma, permisos y versión.
- El cierre anual prioriza la fecha de entrega de NetSuite sobre el cierre
  registrado en Habita, con el año de Costa Rica. La consulta conserva
  visibilidad autorizada en **Todas**; no se inventa un cambio durante GET.
- `counts.bankingInProgress` distingue banca en proceso del agregado Home
  `banking`; el seguimiento devuelve `counts.bankInProgress` y `bank` reúne
  los dos estados bancarios. Los cuatro indicadores son booleanos/NULL.
- Los eventos NetSuite `edit`/`xedit` pueden avanzar desde saldo/traspaso/firmado
  a un destino posterior confirmado, conservando responsable y actor integración.
  Flags, visita, auditorías y cursor comparten transacción. No revierten etapas
  ni permiten regresar a saldo una vez iniciado el traspaso.

Adéndum es una capacidad independiente: [83](83-Adendum-Migracion-065-y-Rollback.md)
y [84](84-Adendum-Manual-Migracion-066-y-Permisos.md). El permiso de banner solo da
conteo; `formalizacion.orders.addendum.read` controla bandeja, marca y evidencia.
La marca no cambia etapa/aprobaciones. Esta revisión no repite pruebas históricas,
no escribe en BD ni acredita edición real de NetSuite o despliegue.

## Gestión vigente por ambos roles - 2026-10-28

La confirmación posterior del propietario en [65](65-Formalizacion-Correcciones-Roles-y-Recuperacion.md)
sustituye las restricciones por vendedor de los alcances de escritura descritos
en cortes anteriores: ambos roles efectivos activos gestionan todas las órdenes
con el permiso de la acción. Se conservan denegaciones, requisitos, versiones y auditoría.

## Regla de lectura vigente - 2026-10-28

[63 - Lectura por banner](63-Formalizacion-Lectura-Por-Banner.md) sustituye el
alcance de lectura por vendedor y el permiso agregado de etapas: cada banner
autoriza su contador y lista para todos los vendedores. “Todas” reúne
solo categorías autorizadas. El detalle requiere el permiso independiente
[«Ver orden de venta»](64-Formalizacion-Permiso-Ver-Orden.md), sin exigir banners.
Las reglas de escritura de este documento no se amplían.

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


Lectura autorizada 2026-10-27: [56 - Bitácora de orden y expediente](56-Orden-Bitacora-y-Expediente-Lectura.md), paneles laterales, fuentes auditadas y límites de evidencia.

### 2026-10-27 — Permisos por destino de Formalización (042)
Aplicada únicamente en CRM_THINK_V2: permisos `formalizacion.orders.stage.<destino>` para pending_approval, contract_pending_send, contract_pending_signature, bank_management, pending_balance, pending_transfer, transfer_signed y closed. Asignados al rol activo formalizacion junto con stage.update, envío y reversión existentes. La vista de seguridad los agrupa en Formalización / Orden de venta y muestra nombres legibles. Denegaciones individuales intactas; versiones de permisos actualizadas y cambio registrado en audit_security_event. No cambia órdenes ni ERP ni legacy.
El comando set exige permiso general y permiso específico del destino; combina el alcance más restrictivo y conserva las denegaciones send/revert. Las reglas de aprobaciones, firma, motivo, versiones y auditoría siguen en el escritor existente. pending_approval queda catalogado sin habilitar transición: no se modifica el contrato de aprobaciones. No se agregan botones en este corte.

### 2026-10-27 — Avance secuencial y excepciones (043)
Plan ejecutado: reutilizar el editor transaccional, mostrar una sola acción siguiente debajo del avance en la orden completa y en su panel lateral, propagar permisos efectivos, restringir saltos en el escritor y probar ambos orígenes sin modificar órdenes reales.

Aplicada 043 únicamente en CRM_THINK_V2: `formalizacion.orders.stage.skip`, nombre visible «Saltar etapas de Formalización», sin concesión automática a Formalización. Owner lo obtiene por su política vigente, sujeto a deny. Se administra en Formalización / Orden de venta.

Flujo normal: un botón hacia el destino inmediato, condicionado al permiso general, permiso del destino, aprobaciones completas, versión y firma cuando corresponde. Confirmación antes de guardar. Tras guardar se recargan detalle y contadores; el nuevo estado muestra la acción siguiente. No se envían correos ni se escriben checks ERP.

Excepción: selector únicamente con permiso skip; salto o retroceso requiere motivo y permiso específico de destino. El servidor deriva skip del perfil vivo (no del body); el escritor compara secuencia bajo bloqueo y exige permiso excepcional y motivo para cualquier destino distinto del siguiente. Una firma confirmada permite omitir el requisito de haber registrado envío para un salto autorizado, pero nunca se omite la firma para banco y posteriores. Se conservan actividad, tres aprobaciones, concurrencia, idempotencia y auditoría atómica anterior/nuevo/actor/fecha/motivo en el origen correcto. No se inventan visitas intermedias. Regresar a pendientes de aprobación sigue fuera del comando: no se alteran aprobaciones.

Verificación focalizada: 110 pruebas API (servicio, repositorio con dobles nativo/legacy y HTTP), sin fixtures de MySQL ni cambios a órdenes reales. No representa una prueba de escritura en producción.

### 2026-10-27 — Primer cambio de etapa y restricción SQL
El intento real sobre la orden legacy 208/RDR673 devolvió HTTP 500 y la revisión de solo lectura encontró cero visitas en el historial legacy y cero eventos centrales de esa orden. La tabla existente exige `sequence=1 => from_state IS NULL`; el escritor enviaba el estado lógico previo incluso en la primera visita, violando esa condición. Corrección localizada: la primera visita usa predecessor NULL; desde la segunda conserva el estado anterior real. La auditoría central mantiene siempre el before/after lógico, actor y fecha. No se agregan visitas históricas ni se alteran CHECK, tablas de producción o datos de la orden para corregirlo. Las pruebas nuevas fallaron antes del cambio en nativo y legacy y luego verifican el primer predecessor, auditoría central y segunda visita. La confirmación final del guardado real requiere un nuevo intento del usuario.
Verificación del arreglo: 136 pruebas focalizadas aprobadas y lint de los archivos modificados correcto. Typecheck global reportó TS6133 en test/notes/note-notifications-service.spec.ts (variable user sin uso), ajeno a esta corrección; no se modificó esa prueba concurrente. No se ejecutaron escrituras de comprobación sobre la orden 208.

Actualización UX 2026-10-27: «Mover a otro estado» aparece al extremo derecho de la fila de acción únicamente con permiso skip. Abre el panel lateral estándar derecho; selector, motivo, guardado y errores se gestionan allí. Ya no se muestra el formulario excepcional desplegado en la página. La confirmación permanece centrada en la capa de diálogos; no cambia el API ni las reglas de negocio.

### 2026-10-27 — Revalidación parcial tras cambiar etapa
El éxito del editor ya no invoca la recarga completa de la transacción. Espera el POST validado y consulta el seguimiento autorizado con `recordId` exacto y `pageSize=1`; actualiza la orden en pantalla y los contadores desde el API. El contador de recarga completa/NetSuite no cambia, por lo que se conserva la proyección de datos del proveedor y no aparece el preload global. El botón manual Recargar transacción mantiene su recarga completa explícita. Si el POST confirmó guardado y falla la lectura posterior, el aviso distingue «guardado, sin poder verificar» de un fallo de escritura; no realiza otra mutación automática. Respuestas de órdenes cerradas o cambiadas de pantalla no reabren el registro anterior.

La revisión de solo lectura de legacy 208 confirmó dos visitas (`contract_pending_signature`, `bank_management`) y dos eventos centrales con before/after y versiones 0→1→2. «CRM nuevo» describe el origen de la acción registrada; el source_schema del evento continúa siendo crmdatabase-api. No implica migración de la orden. No se hicieron nuevas escrituras de estado para esta verificación.

Prueba de integración: guardar, revalidar, habilitar acción siguiente y conservar datos del proveedor sin incrementar lecturas /netsuite o /database. 63 pruebas focalizadas frontend aprobadas.

## Aprobación de Formalización: preparación autorizada — 2026-10-28

El propietario autoriza un permiso independiente `formalizacion.orders.approve`,
visible en Formalización / Orden de venta y concedido inicialmente solo a
`jefe_formalizaciones`. Otros roles o empleados pueden recibirlo mediante la
administración existente. La lectura `formalizacion.home.approvals.read` nunca
concede aprobación; las denegaciones individuales conservan prioridad, incluido Owner.

Migración específica: `202610280045_formalization_approval_permission`, solo en
CRM_THINK_V2. No concede el permiso al rol operativo formalizacion ni modifica
las órdenes, checks o permisos individuales. La política de Owner existente aplica.

Se registra `POST /formalization/orders/approve`, protegido por sesión, CSRF y
permiso declarativo; el servicio repite autorización e identidad/entrada estricta.
Esta fase está **bloqueada por diseño**: no tiene escritor de órdenes ni invoca ERP.
Para una solicitud válida autorizada responde 503; internamente usa el código
FORMALIZATION_APPROVAL_INTEGRATION_PENDING. El filtro HTTP global conserva la
respuesta pública genérica de 503 (no se cambió para exponer mensajes internos).
No consulta fuentes comerciales, no crea eventos de aprobación y no simula éxito.

En detalle completo y panel lateral aparece Aprobar Formalización únicamente
con allow sin deny y estando en pending_approval. Está deshabilitado con explicación
hasta conectar la función de NetSuite. No se implementa Devolver ni una cuarta aprobación.

### Continuación pendiente de la función NetSuite

La siguiente fase requiere validar orden activa/no caída, Jefatura y Desarrolladora
aprobadas, alcance de recurso y referencia ERP del lado servidor. Resolver nativo
primero (incluso alias legacy); ausencia real permite legacy, un error nunca permite
fallback de escritura. La integración confirmará aprobado o ya aprobado, sin
interpretar por ahora el número 2 como éxito por sí solo.

Solo después se escribirá formalization=approved en crm_sales_order_approval nativa
o aprobacion_forma_ov=1 en legacy, jamás ambas. Cambio local y bitácora central se
confirmarán en una transacción con actor y antes/después. La aprobación nativa ya
tiene escritor interno de historial; no queda expuesto por este endpoint bloqueado.
Faltan escritor equivalente legacy, bloqueo/versionado/concurrencia, reconciliación
ERP exitoso/commit local fallido y revalidación parcial de la UI después del éxito.
No hay atomicidad distribuida entre NetSuite y MySQL: esos resultados deben ser
reconciliables. No implementar ni probar mutaciones comerciales hasta esa fase.

Verificación de esta entrega (2026-10-28):045 aplicada con selección exacta en
CRM_THINK_V2; lectura posterior confirma permiso active, un único grant activo
para jefe_formalizaciones, ledger de045 y un evento de auditoría de migración.
No se ejecutaron cambios de órdenes ni llamadas NetSuite. Pruebas de API con
repositorios/identidad sustituidos, no fixtures en las BD compartidas.

Comprobaciones focalizadas finales:159 pruebas de aprobación/migración/transiciones
API y403 de seguridad/inventario HTTP aprobadas;86 de frontend aprobadas.
API: lint de archivos cambiados, formato, typecheck y build aprobados.
Revisión independiente del alcance no encontró incidencias concretas. Estos son
resultados locales con dobles, no una aprobación real en NetSuite ni una prueba
de concurrencia sobre las BD compartidas. La lectura de configuración de045 sí
se comprobó en la BD nativa después de aplicar la migración.

## Continuacion implementada: aprobacion confirmada en NetSuite (2026-10-28)

El bloqueo503 de preparacion descrito en el corte anterior queda sustituido por el flujo de [63 - Aprobacion Formalizacion](63-Aprobacion-Formalizacion-NetSuite.md): permiso independiente ya verificado en BD para jefe_formalizaciones; PUT Sandbox custbodyid_firma_rc; confirmacion exacta antes de guardar la aprobacion en la fuente autoritativa y su bitacora. El detalle local revalida estado sin recargar toda la proyeccion NetSuite. Despliegue del RESTlet y primera aprobacion real siguen pendientes; no confundir implementacion/pruebas con una operacion de proveedor ejecutada. Las demas reglas de secuencia, firma y permisos no cambian.

## Lectura de órdenes inactivas - 2026-11-11

La búsqueda exacta por número de orden en Formalización incluye ambas BDs,
incluso si la orden está inactiva o fuera de las bandejas activas. Conserva el
fallback exacto existente cuando los filtros no devuelven filas y exige
`formalizacion.orders.read`. No importa ni reactiva registros encontrados.

La ficha directa (`/record`), los datos de BD, tiempos, historial, adéndum y
asignación bancaria permiten leer inactivas. La autoridad nativa prevalece sobre
su alias legacy; las nativas borradas lógicamente siguen ocultas y nunca provocan
fallback a legacy. Los permisos, denies y validaciones de identidad se conservan.

Los banners y la distribución por proyecto usan la proyección activa anterior,
independiente de los candidatos históricos de la búsqueda. Las validaciones de
escritura, cambios de etapa, sincronización y asignaciones no se amplían.
Esto corrige el caso RDR611: encontrada en legacy con `status_ov=0`, notificada
como completada por la cola, pero rechazada antes al abrir su detalle.
No requiere migraciones ni cambios de estado en la BD.


Verificación del cambio local: las consultas compiladas de ficha y búsqueda
se ejecutaron contra producción dentro de una transacción de solo lectura:
devolvieron `legacy:85 / RDR611`, con una coincidencia de búsqueda y cero
coincidencias en su portafolio activo. No se modificaron filas ni se desplegó.
Las propiedades y fuzz de identidad/permisos usan `fast-check`, 100 casos por
propiedad y semilla `20261111` en `order-record-read.spec.ts`.
La revisión adversarial independiente sobre `509f217 + diff local` ejecutó
81 pruebas HTTP/autorización y resolución sin hallazgos bloqueantes; sus
fixtures son sintéticos, no una prueba visual en producción.
