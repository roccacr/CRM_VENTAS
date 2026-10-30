# 62 - Notas y avisos en tiempo real

## Corte de seguimiento y QA - 2026-10-29

La ampliación [66](66-Notas-Enterprise-Seguimiento.md) registra migraciones052/053,
responsable/vencimiento, recordatorio personal, Homes adicionales, búsqueda e
historial. Los avisos assigned/reminder/due se persisten antes de publicar en
vivo; sus fechas son UTC. El recordatorio de otra persona no se expone en el
workflow/historial del lector. Cerrar/archivar cancela programación pendiente;
revocar un participante retira su asignación y programación vinculada.

La entrega mantiene ACL vigente, leases/fencing e idempotencia. Los comandos
usan read committed para no conservar una membresía anterior a su revocación;
las lecturas paginadas conservan repeatable read. Solo deadlock MySQL1213 se
reintenta hasta tres intentos completos; un resultado de red incierto conserva
operationId y requiere recuperar el acuse, no inventar otro guardado.

QA consolidado: [67](67-Plan-QA-Regresiones-20261029.md), API6524 aprobadas/151
omitidas, frontend1233 aprobadas y32 SQL/socket separadas en esquemas temporales
eliminados. No es una reejecución realizada por esta edición documental. Las
correcciones de pruebas HTTP/navegación no modificaron permisos de producción.
Quedan sin verificar Redis multinodo, benchmark de carga/latencia y dos cuentas
reales en navegador. Los resultados y tiempos anteriores se conservan como
cortes históricos, no equivalen a esa aceptación.

## Notas de una orden entre módulos — 2026-10-28

La lista busca `sales_order + source + id` en todos los módulos de origen
permitidos. Conserva los hashes existentes, la autoría/invitación vigente y los
deny explícitos; no requiere migrar ni copiar notas. Las notas de vista siguen
separadas por módulo. La posición personal se guarda con el módulo de origen.

Compartir permite leer y responder la nota desde campana/Mis notas, pero no
concede acceso a la orden. Sin acceso al registro se devuelve `context: null`.
`NotesTarget` permite montar el contexto canónico en cualquier ficha autorizada;
también se reconoce `orderSource`/`orderId` en rutas de los módulos comerciales.
Nunca se usa el identificador ERP como identidad.

Límite actual: la ficha operativa y el autorizador disponibles siguen siendo los
de Formalización (permiso Ver orden de venta y rol efectivo). Este cambio no crea
fichas ni permisos de órdenes de Ventas/Mercadeo/Contabilidad. Cuando existan,
deben conectar su autorización real del registro y reutilizar el contexto
canónico; no conceder el permiso de Formalización para simular el acceso.


## Tarjetas y cuentas pendientes de activación — 28 de octubre de 2026

El propietario autorizó invitar también cuentas inactivas y pendientes para que accedan al activar su cuenta. El directorio paginado incluye nombres, IDs públicos y estado de todas las cuentas no eliminadas; excluye al propio autor. Los destinatarios activos conservan las validaciones de capacidad y denegaciones actuales, sin exigir acceso al módulo o registro de origen. Los inactivos/pendientes pueden recibir la relación de participante, pero no obtienen sesión, roles ni permisos por ello. El selector distingue Activo/Inactivo/Pendiente de activación y permite selección múltiple al crear y administrar participantes; las invitaciones pendientes siguen visibles para poder retirarlas.

El worker conserva un aviso no leído para un destinatario inactivo/pendiente únicamente si sigue siendo autor o participante explícito no revocado. No emite eventos socket a cuentas sin activar. Tras activar la cuenta, el snapshot autenticado de campana y bandejas revalida permisos y pertenencia: no se concede acceso al registro comercial vinculado. Revocar antes de activar suprime el aviso y evita que reaparezca al activar. No se activan cuentas ni se importa información legacy.

Todas las bandejas ofrecen completar, reabrir y archivar en las tarjetas cuando el API concede la capacidad al dueño. Comparten los mismos controles y guardado en segundo plano de «En esta vista»; los invitados no pueden gestionar el estado de una nota ajena. El filtro «Pendientes» corresponde al estado HTTP/BD `open`, sin crear un estado duplicado. Cada tarjeta identifica Pendiente/Completada/Archivada.

## Acciones de metadatos en segundo plano — 28 de octubre de 2026

Marcar un aviso o todos como leídos actualiza inmediatamente la campana y la lista sin deshabilitar filtros ni otras filas. La proyección de lectura se conserva frente a snapshots anteriores al acuse; la lectura masiva usa el observedAt original y no incluye avisos posteriores. Un error restaura la proyección y permite reintentar; no se afirma que el servidor rechazó una escritura cuyo resultado es incierto. Los contadores se reconcilian después de terminar los intentos pendientes.

Completar/reabrir/archivar notas, seguir/silenciar respuestas y retirar comentarios usan proyecciones locales con confirmación posterior. Solo se protege la acción pendiente sobre ese recurso contra clics duplicados; el resto del panel sigue disponible. Un fallo retira la proyección y muestra un reintento del mismo comando/UUID; conflictos o pérdida de acceso exigen revisar el estado actual. Las proyecciones no agregan permisos; la API conserva todas las validaciones y versiones. Crear o editar contenido, comentarios y participantes sigue esperando su acuse. Posiciones/PIN/tamaño usan las colas independientes documentadas en58. No se cambian esquemas ni contratos HTTP.

## Corrección de entrega tardía por interbloqueo — 28 de octubre de 2026

La consulta de metadatos de la invitación examinada confirmó72s entre encolado y entrega, con tres intentos; la publicación posterior tomó2s. El último interbloqueo de InnoDB coincidió con otra entrega: la toma de eventos de realtime retenía un bloqueo exclusivo en `sec_user` y esperaba `crm_note`, mientras la inserción del aviso retenía `crm_note` y esperaba `sec_user`. El `FOR UPDATE` del claim incluía los JOIN de usuario, nota y aviso; cada reintento de entrega añadía30s.

El claim ahora bloquea únicamente `crm_note_realtime_event`. Los identificadores asociados se recuperan mediante subconsultas de lectura sin cláusula de bloqueo. Se conserva la prioridad de avisos, espera de notificaciones pendientes, SKIP LOCKED, límites de intentos, lease/fencing y autorización vigente antes de emitir; no se cambian permisos ni se reenvían avisos históricos. Una regresión comprueba el alcance del bloqueo y una prueba MySQL aislada mantiene bloqueado el destinatario mientras reclama el evento. Se aprobaron las seis pruebas de ese esquema sintético y se eliminó el esquema al terminar. Esto verifica el caso de concurrencia, no sustituye aceptación con dos sesiones reales ni Redis multiinstancia.

## Corrección de mensajes durante el guardado — 28 de octubre de 2026

El editor personal mostraba «El guardado sigue pendiente de confirmación» desde el inicio de cualquier comando, porque su indicador de operación pendiente también permanece activo mientras la petición está en curso. El aviso de invitación sin confirmar tenía el mismo problema. Ahora, durante la petición solo se muestra «Guardando…»; los avisos y acciones de reintento aparecen cuando terminó el intento sin confirmación. Un acuse exitoso muestra «Guardado». Un error HTTP5xx conserva la misma clave y explica que el resultado no pudo confirmarse, sin afirmar que la nota no se guardó. No se agregan reintentos automáticos de escritura ni se modifica la idempotencia. Pruebas con creación e invitaciones demoradas reproducen el fallo anterior y comprueban su corrección; las pruebas existentes conservan el reintento de operaciones inciertas sin duplicar notas.

Estado implementado y verificado localmente el 28 de octubre de 2026. Sustituye las limitaciones de acceso y transporte descritas como estado inicial en los documentos 57–61. No activa copia legacy ni importa notas antiguas.

## Comportamiento

Invitar, mencionar y responder conserva primero el comando, auditoría y aviso duradero. Socket.IO actualiza la campana, bandejas y conversación mediante invalidaciones; el contenido se consulta por REST con autorización vigente. Abrir un hilo no marca avisos como leídos. La lectura explícita se sincroniza entre conexiones.

La nota pertenece al registro, no a su URL. Su dueño y personas invitadas pueden leerla aunque no tengan acceso al módulo del registro vinculado, siempre que tengan capacidad de notas en algún módulo y no exista una denegación explícita aplicable. Esto no concede acceso al registro: `context` se devuelve como `null` sin exponer enlaces o identificadores comerciales. Crear vínculos y consultar notas por un registro sigue requiriendo acceso al recurso. Solo el dueño modifica el contenido original; los participantes actúan según su acceso. Las respuestas conservan autoría y control de versión.

El hilo conserva borradores y versiones iniciales de edición frente a cambios remotos; una edición concurrente provoca conflicto en lugar de sobrescribir cambios ajenos. Si se leen mensajes antiguos, aparece “Nuevas respuestas”; solo se acompaña automáticamente el hilo cuando ya estaba al final. Revocar acceso limpia el contenido y cancela la suscripción.

## Transporte y seguridad

- Namespace `/notes`, ruta Socket.IO `/socket.io`, transporte exclusivamente WebSocket. Escrituras exclusivamente REST.
- Handshake con cookies HttpOnly de sesión y CSRF, `auth: { csrfToken }`, Origin exacto permitido y token CSRF vinculado a esa sesión. No se aceptan cookies duplicadas.
- Eventos del cliente `subscribe` y `unsubscribe`: `{ noteId }` con ULID y validación estricta. Acuse `{ ok, code? }`.
- Evento servidor `activity`: `schemaVersion`, `eventId`, `kind`, `occurredAt`, opcionalmente `noteId`, `notificationId`, `version`, `collaborationVersion`. Nunca título, cuerpo ni identificadores del registro comercial.
- Tipos: `notification.created`, `notifications.changed`, `note.changed`, `note.access_revoked`, `sync.required`.
- Revalidación de sesión y ACL antes de publicar, al suscribir y cada 10 segundos; desconexión al vencer la sesión. No se confía en pertenencia a rooms como permiso.
- Límites: 8 conexiones por usuario, 1.000 por proceso, 50 suscripciones por conexión, 60 mensajes por minuto y payload de 4 KiB.

## Persistencia y recuperación

Migración aditiva `202610280046_notes_realtime`, DDL [046](SQL/046_notes_realtime.sql): tabla `crm_note_realtime_event`, 14 columnas comentadas, tres FK nativas, estados `pending`, `processing`, `published`, `failed`. Se aplicó mediante el runner; no copia filas legacy ni modifica permisos existentes.

La intención de publicación y la mutación se guardan en la misma transacción. La creación, lectura o supresión de un aviso también conserva su intención atómica. El worker despierta después del commit y tiene un rescate cada segundo, lotes de 50, lease de 60 segundos, fencing por intento y hasta cinco intentos con espera de cinco segundos. `published` nunca significa leído ni visto. Los fallos definitivos requieren diagnóstico operativo; no se promete entrega exactamente una vez.

La publicación de cambios espera los avisos pendientes de la nota. Se comprueba que una notificación siga activa antes de emitirla; revocar y reinvitar no revive avisos suprimidos. El frontend deduplica hasta 512 identificadores, agrupa invalidaciones y recupera snapshots REST al conectar, reconectar o volver a la pestaña. No se usa replay automático de contenido por Socket.IO. Si está desconectado, conserva el borrador y utiliza respaldo REST cada 60 segundos.

## Configuración y operación

`NOTES_REALTIME_ENABLED=true` por defecto; `NOTES_REALTIME_TOPOLOGY=single` por defecto. No requiere Redis para un solo proceso. Deshabilitar realtime conserva comandos REST y notificaciones persistidas; no eliminar la tabla para revertir el transporte. Reiniciar los procesos después de cambiar configuración. El proxy debe permitir Upgrade WebSocket y las cookies/Origin de la aplicación.

Para varios procesos: `NOTES_REALTIME_TOPOLOGY=redis-streams` y `NOTES_REALTIME_REDIS_URL` autenticada con `rediss://`, red privada y credenciales propias. El adaptador usa stream `crm:notes:activity:v1` limitado a 10.000 entradas. Solo cruza metadatos; cada servidor reautoriza sus sesiones locales. No se serializa la cookie de sesión en Redis. Un fallo de inicialización cierra el transporte, conservando REST. No se provisionó Redis ni se modificó `.env`.

Dependencias fijadas: NestJS WebSockets/platform-socket.io 12.1.0; Socket.IO/client 4.8.4; Redis Streams adapter 0.3.1; redis 5.12.1. El cliente Socket.IO de API es dependencia de desarrollo para pruebas.

Código principal: `notes-realtime.*`, repositorios/servicios de notas y notificaciones, `NotesModule`; frontend `NotesRealtimeProvider`, `notes-realtime`, `useNotesRealtime`, `useThreadScroll`, campana e hilo. Reutiliza identidad, cookies, validación CSRF y autorización del dominio.

## Evidencia y límites

- Suite API completa: 6.091 pruebas aprobadas, 141 omitidas condicionadas; build aprobado.
- Suite frontend completa: 1.083 pruebas aprobadas; build aprobado con advertencia de tamaño de chunks.
- SQL aislado: cinco pruebas de outbox y ocho de colaboración aprobadas; una conecta SQL real con tres clientes Socket.IO para invitación, respuesta y revocación. Esquemas sintéticos temporales eliminados al terminar.
- Dos pruebas adicionales con Nest/Fastify y gateways reales comprueban sesiones independientes, destinatarios, logout y CSRF de otra sesión.
- Revisión independiente de acceso, transporte e interfaz, con correcciones de los hallazgos identificados. Pruebas específicas de borrador, edición concurrente, revocación y scroll.
- No son pruebas con usuarios reales ni despliegue productivo. Redis entre varios procesos queda sin aceptación de infraestructura por no haber servicio Redis de prueba. Revisión visual real pendiente: el navegador local no pudo contactar el servicio de identidad.

Antes de operar varios servidores, verificar Redis privado/TLS, proxy, reconexión y revocación entre instancias. Para aceptación funcional, abrir dos sesiones reales y comprobar invitación, mención, respuesta, lectura, cambio de módulo, pérdida de red y retirada de acceso.

### Revisión posterior de aceptación, 28 de octubre de 2026

El formato global de API y frontend ya pasa: se aplicó Prettier a los tres archivos de API señalados y a los 29 archivos que luego señaló el frontend, sin cambios de lógica. La API local responde al endpoint de identidad. Las pruebas focalizadas de notas y seguridad aprobaron 560 casos, con 22 pruebas condicionadas omitidas. La aceptación visual autenticada sigue esperando inicio de sesión del usuario en la pestaña de prueba.

Docker Desktop 4.59.0 está instalado, pero su arranque local termina con `initializing Inference manager` y un error al abrir/remover el socket `Docker/run/dockerInference`. No existe un Redis de prueba accesible. El intento de limpieza de ese socket fue rechazado por la política automática de ejecución; no se restableció Docker ni se borraron sus datos. Para ensayar varios servidores hace falta un motor Docker operativo o un Redis aislado, privado y con TLS. Una sola instancia de API sigue usando `single` y no necesita Redis.

La validación oficial se repitió. La primera ejecución aprobó la API y se detuvo por formato del frontend (ya corregido). La segunda encontró fallos de NetSuite mientras cambiaba su código de prueba; la repetición focalizada posterior aprobó sus 46 casos. Estos resultados no sustituyen la aceptación visual ni una prueba Redis multiinstancia. No se modificó `.env`, no hubo despliegue ni commit.

### Corrección de fallos observados en uso real

El 28 de octubre se reprodujeron errores de identidad/campana en el navegador autenticado. El registro del proceso mostró `connect ETIMEDOUT` de MySQL durante el preflight de auditoría, que terminaba el arranque; después de atender peticiones se observaron `ECONNRESET` intermitentes. No es un problema que requiera Redis en la topología single.

Cambios de recuperación:

- El preflight de auditoría conserva destino y migraciones obligatorios. Solo reintenta las lecturas de arranque hasta tres intentos totales, con pausas de uno y dos segundos, ante ETIMEDOUT/ECONNRESET/ECONNREFUSED/PROTOCOL_CONNECTION_LOST. Configuración, esquema y escrituras no se reintentan.
- El filtro global conserva cuerpos 4xx y errores sanitizados. Registra exclusivamente correlación, estado, clase y códigos técnicos de una lista cerrada. Los fallos conocidos de conexión se representan como503; jamás se registra el mensaje, SQL, stack o contenido de notas. Se confirmó ECONNRESET en peticiones reales además del ETIMEDOUT de arranque.
- El cliente reintenta un GET503 una sola vez después de500ms y comprueba que no haya cambiado la generación de sesión. No repite POST/PUT/PATCH/DELETE ni renueva sesiones por ese fallo. Una respuesta de escritura incierta conserva su clave para reintento explícito.
- La campana reutiliza el perfil vigente de esa petición y sigue verificando cada nota. El gateway valida las sesiones en paralelo con el límite existente de ocho conexiones por usuario, comparte la comprobación de un mismo token solo dentro de ese envío y comprueba la ACL de la nota antes de emitir. La revocación limpia todas las conexiones afectadas. No hay caché de permisos entre publicaciones.
- La conexión inicial se difiere a una microtarea cancelable: el montaje descartado por StrictMode no abre un WebSocket que cerraría inmediatamente. El hilo diferencia “Guardando…” de “Guardado. Actualizando conversación…” después del acuse exitoso de la API.

Verificación real: se observó handshake101, autorización del namespace y entrega de un evento desde la tabla de intenciones hasta el navegador, seguida de las lecturas de campana/notas con200 sin recargar. Para la prueba se generaron únicamente señales de actualización dirigidas al propio usuario; no se crearon notas, comentarios ni invitaciones ficticias. Las conexiones temporales de diagnóstico se cerraron y no quedó código de instrumentación en los workers.

La nota examinada tenía nueve respuestas persistidas. Las tres últimas correspondían a su propio autor: la regla de destinatarios excluye a quien realiza la acción, por lo que no producen una notificación propia. Para aceptación entre dos usuarios usar perfiles de navegador distintos o una ventana de incógnito; dos pestañas del mismo perfil comparten cookies. Una pérdida real de sesión debe pedir nuevo inicio de sesión, nunca omitirse para conservar el socket.

Evidencia posterior: API `pnpm check` aprobó6147 pruebas, con141 condicionadas omitidas, incluyendo lint/typecheck/build. Frontend aprobó145 pruebas de notas/cliente HTTP y72 de aplicación, además de lint/typecheck/build. La suite completa final de frontend aprobó1087 pruebas (81 archivos). Formato global API/frontend, lint, typecheck y compilaciones aprobados; Vite conserva su advertencia de tamaño de chunks. Revisión independiente de los cambios sin hallazgos P1/P2 en el alcance inspeccionado. Estos mecanismos toleran fallos transitorios; no reparan la conectividad a la BD ni demuestran infraestructura Redis multiinstancia. Sin commit, despliegue o importación legacy.
