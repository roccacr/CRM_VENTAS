# 61 - Plan de notas y avisos en tiempo real

## Estado del plan - 2026-10-29

El texto de etapas siguientes conserva el diseño aprobado y su secuencia; la
implementación ejecutada se consulta en [62](62-Notas-Tiempo-Real-Implementacion.md),
y las extensiones de seguimiento/ubicaciones en [66](66-Notas-Enterprise-Seguimiento.md).
Socket.IO, intención duradera de publicación, despertar postcommit y snapshots
REST están implementados. Publicar una invalidación no significa que una persona
la vio ni que el aviso fue marcado leído. Los fallos de transporte no revierten
una nota confirmada ni permiten restaurar acceso revocado.

[67](67-Plan-QA-Regresiones-20261029.md) documenta QA automatizado y SQL/socket
local del29. Configuración observada: single, sin Redis privado; no se comprobó
Redis entre dos procesos, carga/latencia ni aceptación visual con dos cuentas
reales. El objetivo de latencia del plan no es un SLA medido. Copia legacy,
imports y notificaciones externas no se activaron.

Fecha: 2026-10-28. Plan ejecutado: ver [62 - Implementación](62-Notas-Tiempo-Real-Implementacion.md) para el estado vigente, contratos y evidencia. Las observaciones iniciales siguientes se conservan como diagnóstico previo. Alcance: invitaciones, menciones, respuestas y actualización de notas/campana. Sin copiar datos legacy ni enviar mensajes externos.

## Estado inicial anterior a la implementación

- API NestJS sobre Fastify; React/Vite en frontend. No se encontraron paquetes o implementación Socket.IO/WebSocket/Redis en los manifiestos y rutas inspeccionados.
- En el corte inicial, NoteNotificationsWorker consultaba cada5segundos, hasta10 sobres por ciclo, con lease, reintentos y gate044. NoteNotificationsButton consultaba el contador cada30segundos y el hilo no tenía suscripción remota. La implementación62 sustituyó esa limitación por publicación duradera y reconciliación REST.
- Los comandos colaborativos guardan cambios, recibo, auditoría y outbox en la transacción. El worker crea sec_notification y marca el sobre entregado dentro de otra transacción. Es la base reutilizable; no convertirla en un emit anterior al commit.
- AuthGuard/CsrfGuard actuales son HTTP. Los sockets requieren una frontera específica que reutilice identidad, sesión, firma CSRF y autorización de dominio; no asumir que switchToHttp protege mensajes WebSocket.
- En el corte inicial estaba pendiente separar acceso a la nota y al registro: los destinatarios vinculados estaban filtrados por módulo/recurso. Esa limitación fue corregida por la implementación62; el plan la conserva para explicar por qué Socket.IO por sí solo no resolvía el bloqueo.

## Decisión de librerías

Socket.IO4.x y socket.io-client, con @nestjs/websockets y @nestjs/platform-socket.io compatibles con la versión instalada de NestJS. Fijar versiones compatibles en lockfile y validar integración con el mismo servidor HTTP/Fastify y proxy antes de activar. Socket.IO permite comunicación bidireccional y reconexión; no equivale a entrega persistente garantizada.

Para un único proceso local no se requiere Redis. Si existen varias instancias, usar @socket.io/redis-streams-adapter y un cliente Redis compatible, con servicio privado/autenticado/TLS y límites de retención. Revisar afinidad de sesiones si se mantiene long-polling; el adaptador no elimina esa necesidad. No instalar/provisionar Redis sin revisar primero la topología real. Redis no sustituye MySQL ni la política de autorización.

Fuentes oficiales consultadas:
- [Gateways NestJS](https://docs.nestjs.com/websockets/gateways)
- [Garantías de entrega Socket.IO](https://socket.io/docs/v4/delivery-guarantees/)
- [Recuperación de conexión](https://socket.io/docs/v4/connection-state-recovery/)
- [Redis Streams adapter](https://socket.io/docs/v4/redis-streams-adapter/)

## Resultado para la persona

1. Una invitación, mención o respuesta crea un aviso duradero para los destinatarios autorizados. La campana se actualiza sin recargar.
2. Si el hilo correspondiente está abierto, se anuncia la actividad y se actualiza la conversación sin cerrar el panel, borrar el borrador, cambiar la selección o sobrescribir una edición.
3. Si la persona está leyendo mensajes anteriores, no forzar scroll al final: mostrar Nuevas respuestas y permitir avanzar. Si ya está al final, acompañar el nuevo mensaje.
4. Abrir la campana o mantener abierto un hilo no marca automáticamente los avisos como leídos. La lectura explícita se sincroniza entre pestañas/dispositivos.
5. Sin conexión, mostrar Reconectando y conservar el texto. Al regresar, reconciliar campana, bandejas y versiones del hilo con la API.
6. Revocar acceso retira la nota del cliente y cancela la suscripción. No requiere recargar ni permite conservar acceso con una conexión antigua.

## Etapa1 - Separar identidad, acceso y ubicación de la nota

Prioridad anterior a activar la entrega entre módulos: seguir el comportamiento solicitado por el dueño. La nota tiene una ACL propia y una identidad por registro/origen/ID, independiente de la URL. Invitar a Ventas no concede permisos de Formalización ni de lectura de la orden.

El invitado podrá ver la nota y responder según su concesión, también en Home/Compartidas, aunque no pueda abrir la orden. La referencia al registro y la acción Abrir orden se presentan solo según su acceso vigente; no filtrar datos de la orden por la nota ni el socket. El autor debe poder compartir su contenido conscientemente con esa persona. Sin invitación, nadie obtiene acceso por tener permiso sobre la orden. Mantener deny y revocación de notas, autoría y permisos de respuesta propios. Advertir al compartir que se incluye el historial de la nota.

No confundir una nota cuyo acceso al registro se pierde con una invitación revocada: la primera puede seguir disponible en el espacio personal; la segunda debe desaparecer. Tests de ambos casos, múltiples roles y fuentes native/legacy. Implementar esta ampliación como cambio explícito de producto, no quitando validaciones de forma global.

## Etapa2 - Transporte autenticado

- Gateway acotado a notas/avisos en la API actual y un único cliente Socket.IO por sesión autenticada en el shell. Campana de escritorio/móvil y paneles consumen ese cliente; no abren conexiones adicionales por componente.
- Validar cookie HttpOnly crm_session mediante IdentityService. No copiar la sesión a localStorage ni inventar JWT paralelo o aceptar userId como prueba de identidad.
- Handshake y suscripciones con Origin permitido y comprobante CSRF ligado a la sesión mediante las utilidades actuales. No colocar tokens en query strings/logs. CORS solo no protege todos los handshakes WebSocket.
- Canal privado del usuario definido por el servidor. Suscripción a una nota solo después de validar actor, ACL y capacidad vigentes. Ignorar cualquier nombre de sala/destinatario propuesto como autoridad por el navegador.
- Revalidar sesión/permisos al conectar, reconectar, suscribir y publicar; expulsar al cerrar sesión, expirar sesión o revocar acceso. Revisión periódica de conexiones como respaldo para cambios externos. Ningún payload privado se emite confiando únicamente en la membresía antigua de una sala.
- Validar esquemas/versiones y limitar conexiones, suscripciones, tamaños y ritmo de mensajes. No exponer un protocolo de escritura que evite CSRF, recibos o auditoría.

Los comandos crear/editar/responder/compartir seguirán usando inicialmente el REST protegido e idempotente. Los sockets transportan actividad y sincronización; mover comandos a otro transporte no aporta valor al primer corte.

## Etapa3 - Publicación después del commit y recuperación duradera

Flujo: comando HTTP -> transacción de nota/recibo/auditoría/outbox -> commit -> aviso persistido para cada destinatario -> publicación en vivo -> cliente reconsulta recursos autorizados.

No conservar solo emit en memoria: si el proceso muere entre commit y emisión se perdería la actualización en vivo. Añadir una intención de publicación persistente con destino realtime y clave única por evento/destinatario, mediante migración aditiva revisada. Puede reutilizar int_event_outbox con un destino/agregado nuevos y tipados si se confirma que sus constraints/índices lo permiten; no reutilizar el estado delivered de notification como confirmación de un socket ni consumir eventos históricos/legacy_projection.

La creación de sec_notification y su intención de publicación deben ser atómicas. Las actividades sin nuevo aviso (editar/retirar respuesta, estado o participantes, lectura/supresión) también requieren una invalidación duradera adecuada. La recepción del propio autor sirve para sincronizar otras pestañas, sin generarle una notificación de su propia respuesta.

Tras el commit, despertar el despachador de forma inmediata como optimización. Mantener escaneo periódico de rescate, lease, fencing y reintentos acotados. Publicar y luego marcar la intención; un crash puede repetir una publicación, que el cliente deduplica por eventId/notificationId. Publicado no significa visto ni leído. Registrar fallos agotados y permitir reintento operativo autorizado con trazabilidad.

Objetivo inicial de experiencia: actualización normalmente inferior a1–2segundos desde el commit bajo carga de prueba. Medir p95 antes de convertirlo en compromiso; no prometer latencia absoluta bajo caída de red.

## Etapa4 - Contrato de eventos y orden visible

| Evento propuesto | Uso |
| --- | --- |
| notification.created | Invitación, respuesta o mención duradera propia |
| notification.read_changed | Sincronizar lectura/contador entre pestañas |
| notifications.invalidated | Reconsultar tras lectura masiva o supresión |
| note.changed | Invalidar la nota/hilo/bandejas por versión |
| note.access_revoked | Cerrar y purgar una nota que antes podía ver |
| sync.required | Reconciliar tras reconexión, hueco o sobrecarga |

Sobre tipado y pequeño: schemaVersion, eventId, notificationId cuando corresponda, noteId cuando el receptor esté autorizado, tipo, versiones de contenido/colaboración y fecha del servidor. No incluir cuerpos privados, datos comerciales ni credenciales. El servidor decide receptores, excluye actor de avisos propios y conserva la prioridad de mención sobre respuesta para evitar dos avisos del mismo evento al mismo destinatario.

Para la regla aviso antes de actualizar hilo: entregar una actividad coordinada que referencie el aviso ya persistido; el cliente primero incorpora/invalida campana y muestra el aviso y después actualiza el hilo correspondiente. No depender de dos trabajadores independientes o de relojes del navegador para ordenar estos pasos. Ordenar por versiones y descartar eventos ya procesados; no asumir orden total entre múltiples publicadores.

Al silenciar, conservar la regla actual de seguimiento: no mostrar avisos ordinarios de respuestas silenciadas, pero mantener la política explícita de menciones/invitaciones. Un hilo visible puede recibir invalidaciones para mostrar su estado vigente aunque no genere un aviso de respuesta. No activar sonido ni notificaciones del sistema operativo sin una preferencia específica.

## Etapa5 - React y desconexiones

NotesRealtimeProvider coordina conexión, actividad, deduplicación y suscripciones. Reutilizar las cargas existentes getNoteThread/getNoteNotifications/getNoteUnreadCount/getNoteInbox; la base sigue siendo la autoridad. Suscribir antes de obtener el snapshot y reconciliar eventos/versiones recibidos durante esa carga, para no perder un cambio entre GET y subscribe.

Al llegar una actividad autorizada: refrescar indicador/lista de campana y la bandeja afectada; actualizar el hilo visible sin recarga de página. Agrupar ráfagas y peticiones concurrentes por nota. Mantener borradores por separado; si existe edición pendiente y otra persona cambia la versión, mostrar conflicto y no sobrescribir. Conservar retry con el mismo operationId.

Al reconectar o volver del modo suspendido: sesión actual, suscripciones reautorizadas y snapshots actuales de avisos/contador/bandejas/hilo. Para el primer corte, reconciliar con snapshots REST en vez de depender de un cursor incremental basado solo en un ID autoincremental, que no necesariamente sigue el orden de commit entre transacciones. Los avisos continúan guardados y paginados aunque se pierda un paquete o se cierre el navegador.

No confiar en replay automático de paquetes privados o salas restauradas por Socket.IO. Si se habilita connectionStateRecovery para señales mínimas, usar duración limitada, skipMiddlewares=false y reautorizar todas las suscripciones; la recuperación no reemplaza el snapshot. Una sesión recuperada de transporte no acredita permisos actuales.

Mantener consulta periódica lenta y limitada solo como respaldo si no hay conexión/sincronización, con señal visible de estado. Eliminar el temporizador habitual de30segundos cuando la conexión está sana. Limpiar listeners y conexiones al desmontar/cerrar sesión/cambiar de cuenta, también en React StrictMode.

## Etapa6 - Operación y varias instancias

- Verificar proxy: ruta Socket.IO, Upgrade, timeouts, cookies, TLS/WSS, Origin y afinidad si aplica.
- Redis Streams solo cuando la topología lo requiera, con aislamiento y retención acotada. Fallo de Redis/socket no revierte una nota ya guardada ni impide consultar por REST.
- Medir conexiones, errores de autenticación, rechazos de suscripción, edad del outbox, reintentos/agotados, reconexiones, publicaciones duplicadas y latencia commit-aviso. Sin texto privado en logs.
- Compuerta de activación y rollback al comportamiento REST existente; detener publicadores/sockets sin borrar pendientes o historial. Activar progresivamente después de pruebas, no desplegar ni provisionar infraestructura por crear este plan.

## Etapa7 - Pruebas y aceptación

- Invitación/mención/respuesta con dos usuarios y dos sesiones reales; cambios visibles sin recargar campana e hilo. Tercero no invitado no recibe contenido o IDs privados.
- Usuario de Ventas invitado por Formalización: ve nota/aviso en Home, pero abrir orden respeta sus permisos propios.
- Hilo abierto: aviso de respuesta/mención, mensaje actualizado una sola vez, borrador y scroll conservados; no lectura automática.
- Edición/retirada, completar/archivar, cambiar participantes, revocar/reinvitar y lectura desde otra pestaña.
- Origin forjado, sesión expirada/revocada, CSRF incorrecto, room/usuario ajeno y mensajes malformados.
- Desconexión antes/después del commit y de publicar, ACK perdido, reinicio API, red lenta, pestaña suspendida y reconexión prolongada. Repetición no duplica nota, comentario, aviso ni toast.
- MySQL real en esquema sintético aislado para rollback/publicación durable y nunca fixtures en la BD comercial. Integración Socket.IO real, navegador y carga para latencia/memoria; una unidad con mocks no acredita todos esos puntos.
- Dos instancias y caída/reinicio de Redis si se activa esa topología; permisos vigentes durante recuperación.
- Lint/typecheck/tests/build y revisión del diff; separar fallos ajenos y pruebas omitidas de evidencia aprobada.

## Archivos a reutilizar o cambiar al implementar

API: notes.module.ts, note-collaboration.service/repository, notes-context/permissions, note-notifications.worker/repository/service, identidad/sesión/CSRF y outbox existentes. Nuevos gateway/contratos/publicador propios de notas solo cuando su responsabilidad no exista ya; migración schema-only para intención duradera y su documentación si es necesaria.

Frontend: PersonalNotesProvider en GlobalHomeShell, NoteNotifications, NotesInbox y el hook de NoteCollaborationDrawer, clientes tipados existentes. Añadir un único cliente/proveedor de tiempo real y tests bajo test/notes. No rediseñar las vistas ni introducir un store global/dependencias de interfaz solo para recibir eventos.

Orden recomendado: autorización independiente -> conexión protegida -> publicación duradera -> campana -> hilo/bandejas -> reconexión/múltiples pestañas -> pruebas/operación/activación. La copia compatible legacy continúa siendo una etapa distinta del plan56.
