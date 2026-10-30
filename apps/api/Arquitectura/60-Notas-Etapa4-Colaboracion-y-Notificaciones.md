# 60 - Notas colaborativas: participantes, conversación y campana

## Contrato vigente y extensiones - 2026-10-29

Este contrato incorpora las ampliaciones posteriores a la entrega inicial27.
Tiempo real y acceso entre módulos: [62](62-Notas-Tiempo-Real-Implementacion.md).
Tareas, recordatorios privados, Homes adicionales e historial: [66](66-Notas-Enterprise-Seguimiento.md).
Resultados QA y aceptación pendiente: [67](67-Plan-QA-Regresiones-20261029.md).
Los conteos de pruebas anteriores conservan su fecha; no son nuevas ejecuciones.

Fecha: 2026-10-27. Entrega de etapa4. La nueva BD es principal; no se escriben ni importan notas de la BD antigua. La proyección compatible sigue en etapa5.

## Comportamiento

Una nota se crea privada. El autor puede invitar usuarios activos, inactivos o pendientes con acceso de lectura o respuesta, al crearla o después. Las cuentas sin activar no reciben sesión, roles o permisos por la invitación; su acceso se revalida al activar. Compartir muestra que se concede acceso a toda la conversación anterior. Vincular a una vista u orden no invita a nadie. Compartir funciona entre módulos sin conceder acceso al módulo ni al registro. La nota vinculada también puede leerse desde Mis notas/campana por un invitado autorizado sin acceso a la orden: se devuelve context: null. Crear el vínculo, listar notas del registro y abrir su ficha sí exigen autorización sobre ese recurso.

Solo el autor modifica el contenido original y completa, reabre o archiva. Cada participante modifica o retira únicamente sus propios comentarios; el dueño no puede reescribir respuestas ajenas. Completar impide respuestas nuevas. Retirar un comentario conserva la trazabilidad y muestra un marcador. El PIN, tamaño y posición pertenecen a cada persona y no generan avisos.

El autor administra participantes. La revocación quita lectura, respuesta, menciones, acceso desde enlaces anteriores y avisos. También revoca las concesiones de cuentas inactivas o pendientes; el directorio las identifica por estado sin activarlas. Reinvitar no reactiva avisos antiguos.

La invitación no elude permisos de notas: el actor necesita capacidad vigente
para la acción en un módulo efectivo y se mantienen los deny aplicables, incluido
el origen. Ser autor es necesario para gestionar la nota original, pero no basta
sin su capacidad; tarea exige edit_own y ubicaciones/participantes share_own.
Un invitado read no responde por ser invitado; requiere concesión reply y permiso
actual de respuesta. Las cuentas inactive/pending conservan solo la relación
hasta su activación y reautorización, sin habilitar sesión por este contrato.

## Interfaz

El icono de notas junto a la campana abre Mis notas. Bandejas: Todas, En esta vista, Creadas por mí, Compartidas conmigo, Menciones y Asignadas; estados Pendientes/completadas/archivadas/todas. Pendientes corresponde a open en HTTP/BD, sin un estado adicional. Cada nota abre conversación, participantes y menciones. El editor conserva el vínculo opcional de etapa3, colores, prioridad y posición individual.

Buscar invitados consulta un directorio autorizado por el servidor; se guardan IDs públicos, nunca nombres como identidad. Las menciones seleccionan participantes existentes, no conceden acceso. La creación con invitados primero confirma la nota privada y luego comparte. Si falla compartir, conserva el ID creado y el mismo identificador de operación; reintentar no crea otra nota. El usuario puede conservar la nota y abrir su conversación para resolver el acceso.

La campana muestra avisos de invitación, respuesta, mención, asignación, recordatorio personal o vencimiento. Silenciar respuestas no silencia las asignaciones ni los vencimientos. Abrirla o abrir un hilo no los marca leídos; se requiere la acción explícita de marcar leído. Marcar todas usa el corte observado por el servidor, para no leer avisos nuevos posteriores. Seguir/silenciar afecta respuestas; no revoca acceso. Socket.IO invalida campana, bandejas e hilo mediante publicaciones duraderas; la lectura de contenido conserva REST y autorización vigente. El polling lento es respaldo/reconciliación, no la vía habitual con conexión sana. El escaneo de rescate de workers no es un acuse de entrega al navegador. No hay envío externo.

## API y autorización

Todas las rutas requieren sesión y las mutaciones CSRF ligado a esa sesión. El servidor obtiene actor y permisos reales. No acepta perfiles, autores o destinatarios de notificaciones suministrados como autoridad por el cliente. Respuestas de notas/avisos llevan no-store.

| Ruta | Uso |
| --- | --- |
| GET /note-collaboration/inbox | kind=all/created/shared/mentions/assigned; status, search, authorUserId, moduleCode, recordSource/recordId, createdFrom/createdTo y page/pageSize; filtros antes de paginar |
| GET /note-collaboration/inbox/authors | Opciones de autores derivadas de notas autorizadas, no solo de la página actual |
| GET /note-collaboration/eligible-users | Búsqueda de invitados para borrador, con módulo/contexto |
| GET /note-collaboration/notes/:id | Nota, participantes, menciones, página de respuestas y capacidades |
| GET /note-collaboration/notes/:id/eligible-users | Directorio paginado tras validar autor y share_own del actor; cuentas active/inactive/pending, sin exigir mismos permisos, módulo ni acceso comercial de origen |
| GET /note-collaboration/notes/:id/activity | Historial autorizado; preferencias/recordatorios personales se filtran por actor |
| GET /note-collaboration/notes/:id/locations | Homes actuales y disponibles para el autor |
| PUT /note-collaboration/notes/:id/locations | Reemplazo por el autor, con operationId y expectedCollaborationVersion, sin cambiar vínculo principal |
| GET /note-workflow/notes/:id | Tarea compartida y recordatorio exclusivamente propio |
| PUT /note-workflow/notes/:id/task | Autor con edit_own: responsable invitado/autor y vencimiento, con expectedVersion |
| PUT /note-workflow/notes/:id/reminder | Recordatorio propio: fecha UTC o null para cancelar, con operationId |
| GET /note-workflow/overview | Conteos autorizados de asignadas/vencidas/hoy, timeZone y truncated explícito |
| PUT /note-collaboration/notes/:id/participants | Reemplazo completo de participantes por el autor |
| PUT /note-collaboration/notes/:id/mentions | Menciones de la nota por el autor |
| POST /note-collaboration/notes/:id/replies | Nueva respuesta y menciones opcionales |
| PATCH /note-collaboration/notes/:id/replies/:replyId | Edición exclusiva del autor de esa respuesta |
| POST /note-collaboration/notes/:id/replies/:replyId/withdraw | Retirada lógica por su autor |
| PUT /note-collaboration/notes/:id/my-following | Preferencia personal de respuestas |
| GET /notifications | filter=all/unread/mentions; page/pageSize; observedAt |
| GET /notifications/unread-count | Contador exclusivamente propio, reautorizado |
| PUT /notifications/:id/read | Primera lectura propia, idempotente |
| PUT /notifications/read-all | Corte through obtenido de observedAt |

IDs de nota/respuesta/usuario/aviso son públicos. El contexto sigue diferenciando orden nativa ULID y legacy source=legacy,id=208; no se intercambian ni comparan solo por número. Los contratos Zod y clientes estrictos son la fuente de campos y límites. El cliente no obtiene contenido de notas revocadas como alternativa ante un fallo.

Cada comando lleva operationId. Participantes/menciones usan expectedCollaborationVersion; respuestas editadas/retiradas expectedVersion. El recibo se recupera después de comprobar acceso vigente del actor y antes de exigir estado/eligibilidad propios de una operación nueva: una respuesta confirmada puede recuperarse tras completar la nota, pero un actor revocado no puede recuperar contenido por un recibo.

## Seguimiento nativo y privacidad

Responsable y vencimiento son compartidos; el responsable debe ser el autor o
un invitado vigente y su asignación no le transfiere autoría ni edición ajena.
El recordatorio es exclusivo de quien lo programa: el contrato devuelve solo su
fecha/estado y el historial filtra esas preferencias privadas. `dueAt: null`
retira vencimiento; `remindAt: null` cancela el recordatorio propio. Completar o
archivar cancela programación pendiente. Revocar al responsable retira esa
asignación y reprograma el vencimiento al autor cuando procede.

La búsqueda de inbox examina título, texto, autor y comentarios no retirados;
los filtros/ACL se aplican antes de paginar. `recordId` requiere `recordSource`
y formato native/legacy válido. Las ubicaciones adicionales son Homes
registrados: no sustituyen el vínculo de orden ni conceden permiso de recurso.
Las opciones de autores provienen del conjunto autorizado, no de una sola página.

## Persistencia y entrega

044 añade colaboración versionada a crm_note y sec_notification, con FK nativas, índices, CHECK y COMMENT en todas las columnas. Crea20 definiciones (cinco módulos por share_own/reply/edit_reply_own/withdraw_reply_own), sin asignaciones a roles comerciales. La base self de perfiles se deriva de módulos efectivos existentes y respeta deny; no concede edición ajena. Los controladores de colaboración son authenticated y sus servicios aplican capacidad y ACL vigente de la nota en cada operación. El permiso del registro se valida para crear/listar su vínculo o presentar contexto comercial, no para bloquear una conversación explícitamente compartida.

Cambios, recibos, auditoría y outbox se confirman en una misma transacción. Los cuerpos privados viven en las tablas de notas/respuestas; auditoría y eventos guardan IDs/digest, no texto privado. collaboration_version_note es independiente de la versión de contenido y del layout; collaboration_updated_at_note es UTC.

El worker consume únicamente aggregate_type=note_collaboration,destination=notification de int_event_outbox. No consume eventos históricos de etapa2 ni legacy_projection. Revalida destinatario y capacidad/ACL de la nota antes de entregar; no exige permiso comercial del registro para recibir una nota compartida. Deduplica evento+destinatario y prioriza mención sobre invitación/respuesta. Los avisos colaborativos excluyen al actor; un recordatorio personal sí puede tener al propio actor como destinatario. Usa lease60segundos, fencing por intento, máximo5intentos y lotes10. Inicia solo con044 registrada y libera su temporizador al cerrar el módulo. Revocar suprime avisos anteriores y destinatarios aún pendientes/procesando. No hay correo, Graph ni WhatsApp.

## Operación y límites

Aplicada044 mediante el runner schema-only al destino nativo. No se crearon fixtures en CRM_THINK_V2 ni se modificaron notas antiguas. Si una ejecución parcial deja DDL sin ledger, el runner falla para revisión; no marcar la migración aplicada manualmente sin cotejar el esquema.

Listados/contadores autorizan metadatos de todos los candidatos (deduplicados por nota durante la petición) para obtener un total real. Su coste crece con el historial; antes de gran volumen conviene medir y optimizar sin devolver totales engañosos ni cachear permisos obsoletos. El directorio es paginado y ofrece cuentas active/inactive/pending según elegibilidad, excluyendo al autor; no filtra por acceso al registro comercial. Las cuentas activas requieren capacidad propia de notas vigente en algún módulo efectivo y ausencia de deny aplicable, no los mismos permisos del autor; invitar una cuenta inactiva/pendiente no la activa. La revocación se revalida en el siguiente REST/publicación y provoca invalidación/cierre del hilo por tiempo real; una conexión caída debe reconciliar al volver y no garantiza borrado instantáneo en un cliente desconectado.

La prueba automatizada con MySQL usa un esquema temporal exclusivo crm_notes_test_*, confirmación exacta y usuarios sintéticos; nunca ejecutarla contra la BD compartida. Su auditoría es un doble transaccional: no acredita un guardado autenticado en producción. La aceptación humana entre dos sesiones reales y la convivencia legacy siguen siendo comprobaciones distintas.

Sigue etapa5: copia compatible a crm_stick_notes, mapeos explícitos, revocación/privacidad y reintentos seguros antes de habilitar el escritor. Etapa6: aceptación integral y ensayo con legacy apagado.
## Evidencia histórica de cierre de etapa4 - 2026-10-27

- API completa:148 archivos aprobados,5962 pruebas aprobadas y135 omitidas por compuertas/entorno (173 archivos registrados). Las omitidas no se presentan como ejecutadas.
- Frontend completo:76 archivos y1055 pruebas aprobadas, con maxWorkers=2. La prueba de edición de comentario propio sin permiso de respuesta nueva pasó; las170 pruebas de App y Notas también pasaron en el corte focalizado.
- MySQL real:7 pruebas nuevas de colaboración aprobadas en esquema temporal exclusivo y eliminado; concesiones, respuestas, recibos, supresión tras revocar/reinvitar, propiedad/corte de lectura, rollback, retry/fencing y exclusión de eventos históricos. No sustituye sesión real ni auditoría de producción.
- 44 casos HTTP prueban las14 rutas nuevas: sesión, CSRF, forwarding autorizado y no-store. Revisión independiente cerró revocación de concesiones inactivas y replay de recibos tras cambios de estado/target; sin P1/P2 API restantes en esa revisión.
- TypeScript y build API/frontend aprobados; lint y formato del código de notas aprobados. Build frontend conserva aviso de chunks mayores a500KB.
- Revisión visual real del Drawer a1440px y390px mediante fixture local aislado; sin guardar datos comerciales. No se realizó aceptación humana con dos sesiones reales.
- Metadatos nativos postmigración:044 registrada1vez,13 columnas nuevas con comentario y20 definiciones esperadas. Solo lectura para el cotejo.
- check-all.cmd se detiene por formato en tres archivos API ajenos: migración038 y pruebas formalization-home-catalog/formalization-stage-permission. Lint global frontend conserva dos no-null assertions en test/home/formalization-order-progress.spec.tsx; format:check frontend también detecta archivos de otras áreas. Se preservaron esos cambios ajenos. Estas limitaciones no se ocultan como un chequeo global aprobado.

## Ajuste de bandejas - 2026-10-28

El panel abre Todas con estado Todas. Menú visible de botones: Todas, En esta vista, Creadas por mí, Compartidas conmigo y Menciones; selección indicada y accesible por teclado. El selector de ámbito personal/vista se muestra solo en En esta vista. Tras crear una nota, el estado vuelve a Todas.

kind=all es una consulta paginada del servidor que reúne autoría e invitaciones activas mediante EXISTS, sin duplicar filas ni mezclar páginas en el cliente. Conserva reautorización de cada nota/contexto antes de contenido y paginación; no concede nuevos permisos, cambia identidades ni requiere migración. Pruebas focalizadas:100 frontend y22 API aprobadas; lint de archivos modificados y compilaciones se comprueban para este corte.
## Corrección de respuesta poblada - 2026-10-28

El log de inbox mostraba HTTP200, pero las respuestas con notas omitían myPlacements. El cliente estricto reutiliza el contrato de nota y rechazaba esa omisión; la UI la presentaba como un error genérico de consulta/acceso. Los fixtures frontend incluían el campo y no revelaban la diferencia con el presentador real del servidor.

El presentador colaborativo ahora agrega las posiciones del actor autenticado mediante NotesRepository.placement, después de autorizar la nota y su contexto. Bandeja y conversación comparten el contrato corregido. Sin posiciones devuelve un array explícito vacío; no se sustituyen las posiciones existentes por valores ficticios ni se leen posiciones de otros participantes. Sin cambiar permisos, migraciones o datos comerciales.

Dos regresiones fallaron antes de corregir por myPlacements ausente; después pasan con posiciones existentes y con array vacío, incluyendo actor de consulta. Suite de notas API:144 aprobadas y16 omitidas por compuertas MySQL, sin ejecutar esas omitidas contra la BD compartida.
## Selector de invitados - 2026-10-28

El editor usa selección múltiple con nombres, opciones visibles al abrir y búsqueda local por nombre. Carga el directorio sin escribir un mínimo de caracteres, conserva seleccionados y sus permisos read/reply y permite quitar personas. Presenta carga, error y reintento; descarta respuestas de un contexto anterior. No usa nombres como claves ni guarda invitaciones antes de confirmar el comando.

Los endpoints eligible-users aceptan page de1a1000. Consultan100 candidatos activos por página y una fila adicional para hasMore; la elegibilidad se comprueba con la política actual de cada usuario. hasMore se calcula antes de filtrar, para continuar aunque una página no tenga invitados elegibles. El cliente recorre las páginas y deduplica por ID público, sin truncar silenciosamente en100. Si falla una página, muestra error en vez de una lista parcial. El máximo de participantes de una nota sigue siendo100. Las cuentas inactivas y los usuarios sin acceso requerido no se convierten en elegibles por aparecer un selector; el cambio de autorización entre módulos/registros sigue siendo una ampliación distinta.

Se actualizaron las etiquetas de privacidad/avisos del editor para no afirmar que una nota con invitados sea visible solo al dueño. Pruebas: seleccionar y quitar varias personas, carga inicial sin búsqueda, fallo/reintento, páginas posteriores, deduplicación y fallo parcial; frontend104 pruebas de notas aprobadas. Sin migraciones o datos importados.
## Corrección de capa del selector - 2026-10-28

Se reprodujo en navegador real con fixture aislado: las opciones existían, pero el popup se montaba fuera del Drawer con z-index1050 frente al panel1300; quedaba detrás de la máscara. No era un resultado vacío del directorio. NoteParticipantsPicker reutiliza getPopupContainer del selector de roles de Administración y aloja el desplegable dentro de .ant-drawer-body. El mismo componente se usa al crear y editar participantes; no cambia usuarios, autorización ni la API.

Dos pruebas nuevas dentro de un Drawer fallaron antes de corregir y pasaron después (borrador y nota existente). Suite frontend de notas:108 aprobadas. Navegador: opciones dentro del Drawer, comprobación de elemento visible en coordenadas del popup y selección de dos usuarios sintéticos sin guardar notas reales.

Actualización vigente 2026-10-28: [62 - Notas en tiempo real](62-Notas-Tiempo-Real-Implementacion.md). Socket.IO, migración046 aditiva aplicada, campana/hilo/bandejas, recuperación REST y acceso a notas independiente del registro vinculado. Esta actualización sustituye las limitaciones históricas de transporte y acceso de las etapas anteriores. Copia legacy inactiva; Redis multiinstancia y aceptación visual real pendientes.
