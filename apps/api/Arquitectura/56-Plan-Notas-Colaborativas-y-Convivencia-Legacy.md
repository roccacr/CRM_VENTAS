# 56 - Plan de notas colaborativas y convivencia legacy

## Avance vigente - 2026-10-29

Las etapas1–4 y la ampliación nativa de tiempo real/seguimiento están implementadas.
[62](62-Notas-Tiempo-Real-Implementacion.md) registra Socket.IO, recuperación y
controles; [66](66-Notas-Enterprise-Seguimiento.md) responsable, vencimiento,
recordatorio personal, Homes adicionales, filtros e historial (052/053).
Compartir funciona entre módulos con identidad nativa de usuario; se pueden
invitar cuentas inactive/pending sin darles sesión ni permisos. La autorización
sobre la nota no exige autorización sobre el registro; sin esta última el
contexto se oculta y la invitación no permite abrir la orden.

Etapa5 continúa pendiente: ninguna copia compatible legacy está activada ni se
importaron notas históricas. Etapa6 tiene QA automatizado local documentado en
[67](67-Plan-QA-Regresiones-20261029.md), pero no aceptación integral: faltan
Redis multinodo, carga/latencia y dos cuentas reales en navegador. Los estados
Completada/Implementada de la secuencia original no equivalen a esas aceptaciones.
No se activan adjuntos ni correo externo.

Fecha: 2026-10-27. Estado: ejecucion por etapas; etapas1,2,3 y4 implementadas.
La investigacion inicial fue de solo lectura. La autorizacion posterior habilito
las etapas1/2 nativas,3 de interfaz y4 de colaboración y avisos internos; no modifica legacy, env ni envía correo.

## Entregas por etapas - ejecucion autorizada

1. **Completada27:** esquema039 nativo, siete tablas vacias, comentarios/FK/
   indices/CHECK. [Diccionario y evidencia](Diccionario-Datos/12-Notas-Colaborativas.md).
2. **Implementada27:** API de notas con sesion, permisos/ACL, autoria exclusiva, fechas UTC,
   versiones/idempotencia y auditoría; base outbox. [Contrato57](57-Notas-Etapa2-API.md).
   Etapa4 activa solo avisos internos nuevos; compatibilidad legacy pendiente.
3. **Implementada27:** UI personal desde cualquier pantalla, con vinculo opcional a vista/orden native o legacy, mover/redimensionar/PIN y layout
   individual, guardado y errores. [Entrega58](58-Notas-Etapa3-Interfaz-Personal.md). Sin dependencias nuevas.
4. **Implementada27:** compartir, respuestas/menciones y campanita con lectura individual;
   esquema044 y despachador con autorización vigente. [Contrato60](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md).
5. Pendiente: copia legacy compatible y adaptacion de la app vieja, referencias,
   revocacion y fallos/reintentos; sin escribir legacy hasta ese corte validado.
6. Pendiente: aceptacion integral y ensayo con legacy deshabilitado. No declarar
   sistema completo ni activar captura real sin cerrar las reglas de compatibilidad.

La migracion039 no crea permisos. La040 agrega definiciones por modulo sin asignarlas a roles comerciales; la API aplica autorizacion vigente. La incidencia
SUPER/binlog se resolvio sin cambiar seguridad: defaults UTC y actualizacion
explicita por API de etapa2; cotejo completo del esquema vacio antes de ledger.
Los apartados de propuesta siguientes describen el objetivo completo, no
funciones que ya estan operando.

## Objetivo y alcance

Capacidad transversal del CRM para notas privadas/compartidas, hilos, menciones,
estado, posicion personal e inbox. Disponible inicialmente en Home y detalles
reales de entidades existentes; cada modulo habilita contextos registrados.
Ventas, Mercadeo, Formalizacion, Contabilidad y Administracion comparten el
motor, pero una vista o entidad futura no se presume implementada por anotarla.
Se mantienen fuentes, permisos efectivos, denies, auditoria y nomenclatura
canonicos. No se importan Leads, usuarios, ordenes ni trayectorias antiguas.

La UI de un post-it no es el dominio. El modelo nuevo debe funcionar sin la BD
vieja. Este plan distingue construir el esquema nativo, escribir notas nuevas,
leer notas legacy, proyectar compatibilidad y migrar notas historicas.

## Evidencia inspeccionada

- Legacy `SHOW CREATE TABLE crmdatabase-api.crm_stick_notes`:22 columnas,
  PK id_sticknote, indices idinterno_lead y transaction_type/transaction_id;
  no FK, version ni relacion de respuestas/lecturas por destinatario en esa tabla.
- Snapshot SELECT27:13 notas;11 ordersale,1 event,1 lead.10 estado1/visible1,
  3 estado0/visible0;1 privada.4 tienen destinatarios CSV multiples,1 sin
  destinatario.11 notificado1;0pin y0recordatorios. El flag notificado NO
  acredita entrega de correo. Se omitieron titulos, cuerpos y datos personales.
- Los13 creadores coinciden univocamente con admins.idnetsuite_admin y ninguno
  con admins.id_admin. Las11 ordenes coinciden con ordenventa.id_ov_netsuite,
  no con id_ov; el evento coincide con calendars.id_calendar. Los13 enlaces
  idinterno_lead encuentran leads.idinterno_lead. Solo evidencia de esos registros.
- Consulta metadata por nombre stick/notific/mention/coment en legacy encontro
  solo crm_stick_notes; no se hallaron rutinas/triggers asociados en metadata
  visible. Esto no descarta otra infraestructura fuera de la conexion inspeccionada.
- Metadata nativa consultada en transaccion READ ONLY y rollback: no tablas de
  notas u outbox; existe crm_calendar_notification. Sus FK/kinds son de evento
  de calendario: no reutilizar un event_id falso para notificar una nota.
- Codigo legacy real en el checkout hermano CRM VENTAS: modelo
  CRM_VENTAS BACKEND/src/models/sticknotes/sticknotes.js, routes/idpRoutes.js;
  frontend produccion/src/components/sticknotes/ y store/sticknotes/.
  Lectura por transaccion permite creador o asignado si privado0; privado0 NO
  significa publica para todos. Usuarios se representan por referencia ERP.
- El modelo legacy actualiza/elimina por id sin predicado de propiedad en esas
  consultas. La UI oculta editar/eliminar para terceros: eso no es autorizacion
  de servidor. Verificar y corregir cadena completa antes de habilitar escritura;
  no se realizaron peticiones de explotacion ni auditoria integral de ese backend.
- El frontend legacy aplica position fixed si pin y absolute si no. Coordenadas
  y pin son globales por nota; no por persona. La eliminacion legacy usa DELETE.
- Modelo nuevo: docs18/API y16/frontend son blueprint, no tablas implementadas;
  campanita GlobalHomeShell inicial no constituía un inbox funcional; etapa4 conecta el inbox interno (contrato60).

## Reglas de producto propuestas

| Accion | Autor | Destinatario autorizado | Otros |
| --- | --- | --- | --- |
| Leer | Si, sujeto al alcance vigente de entidades | Si, acceso a nota y entidad | No |
| Editar titulo/cuerpo/color/prioridad | Solo autor con permiso | No | No |
| Compartir/revocar participantes/relacionar | Solo autor con permiso y limites de entidad | No | No |
| Responder | Si, nota abierta y permiso | Si, nota abierta y permiso | No |
| Editar/retirar respuesta | Solo autor de ESA respuesta | Solo si es su respuesta | No |
| Completar/reabrir/archivar nota | Solo autor con permiso | Puede solicitarlo mediante respuesta | No |
| Mover/fijar/minimizar/ocultar | Su propia presentacion | Su propia presentacion | No |
| Marcar aviso leido/silenciar hilo | Solo sus avisos/preferencias | Solo sus avisos/preferencias | No |

Ni Owner recibe edicion de cuerpo ajeno por defecto: no crear notes.edit_any o
notes.delete_any. Una futura intervencion administrativa seria ocultamiento
excepcional separado, con motivo/auditoria, nunca suplantacion del autor.
Cambio de vendedor, responsable o modulo no cambia al autor de la nota.
No permitir cambiar authorUserId desde el request. Usuario desactivado conserva
atribucion historica; no crear accesos ni reasignar autoria automaticamente.

Estados globales: open, completed y archived. Completar retira del tablero activo
pero conserva hilo/historial; reabrir es explicito. Archivar no es destruir.
Ocultar individualmente no completa ni archiva para los demas. No usar borrado
fisico como accion normal. Si una nota completada necesita otra respuesta,
reabrir primero; la politica puede flexibilizarse tras revisar UX.

## Contextos, relaciones y permisos

Crear desde Home no exige lead, cliente o transaccion. El usuario puede despues
relacionar la nota a lead/contacto/orden/evento o dejarla como nota personal.
Una nota puede tener varios enlaces, sin duplicar el texto; un enlace principal
sirve de destino al abrirla. No mezclar un cliente del CRM con un usuario interno:
contactos/clientes son contexto, usuarios de sec_user son participantes.
No notificar clientes externos por etiquetarlos como entidad.

Todo enlace se resuelve en backend mediante un registro cerrado de tipos y
adaptadores, no tablas/URLs arbitrarias enviadas por frontend. Persistir referencias
nativas con FK donde corresponda; para origen legacy usar identidad de fuente,
tipo e ID validado. Nunca un entero desnudo para dos proveedores.
Las entidades futuras se activan cuando exista resolucion/autorizacion real.

Privada por defecto; compartir es explicito y lista a las personas que veran
TODO el hilo. Mencionar no concede acceso a la transaccion automaticamente.
El selector solo ofrece usuarios activos elegibles; si no tienen acceso, se bloquea
el compartir y se muestra el motivo sin filtrar datos. En notas con varios enlaces
se usa la restriccion mas estricta: todos los contextos protegidos deben autorizarse,
o se debe separar la conversacion. No revelar enlaces/titulos inaccesibles.
Revocar acceso oculta nota, respuestas, busqueda y avisos pendientes; una URL o
notificacion antigua vuelve a autorizar. No crear bypass por jefatura o correo.

Permisos propuestos por accion: notes.read, notes.create, notes.edit_own,
notes.share_own, notes.reply, notes.resolve_own, notes.archive_own,
notes.history.read, notifications.read_own y notifications.update_own.
Mover/fijar exige lectura de la nota y solo permite escribir preferencias propias.
El scope combina permiso efectivo, deny, ACL y acceso actual a entidades; UI
consume capabilities canEdit/canReply/canShare/canResolve y el API las comprueba.
Asignar roles concretos se define al implementar, sin grants globales implicitos.

## Interaccion visual y PIN

Dos modos independientes del contenido: anclada al contexto (se mueve con la vista)
y fija a la pantalla (no cambia al hacer scroll). Fijar conserva posicion respecto
al viewport util, descontando header/menu, no significa completar ni poner primera.
Si se necesita orden destacado es otra preferencia, no reutilizar pin.
Posicion/tamano/minimizada/fija se guardan por nota+usuario+contexto+clase de pantalla.
Mover una nota compartida no la mueve en las pantallas de otros usuarios.

Guardar al terminar drag/resize, no en cada pixel; debounce de guardado de texto
con estado Guardando/Guardado/Error y recuperacion de borrador. Movimiento no
actualiza fecha de contenido ni genera campanita. Versionar layout por separado.
Coordenadas relativas al contenedor o proporcionales, restauradas con clamp al
ancho/alto actuales: nunca dejar una nota fuera de pantalla. Si cambia resolucion
se recoloca; en movil se usa panel/lista, no post-its que tapen controles.
Botones/teclado para recolocar, foco visible y opcion Restablecer posiciones.

La recomendacion previa react-rnd sigue limitada a movimiento/redimensionamiento:
construir NoteCard con el estilo/Ant Design del CRM. Editor MVP con texto/menciones
normalizadas; Tiptap es alternativa de rich text ya contemplada en18, no dependencia
aprobada. No agregar Zustand/TanStack ni pizarra completa por este plan.
Probar React instalado, StrictMode, scroll, portals, z-index, touch y teclado antes
de fijar libreria/version; no confundir peerDependencies con compatibilidad probada.

## Respuestas, menciones e inbox

Hilo lineal con referencias a respuesta opcionales, sin arbol de profundidad ilimitada.
Autor de respuesta propio, fechas y marca Editada, cambios trazables. El autor de
la nota no puede reescribir respuestas ajenas. Compartir una nota existente comparte
el hilo completo; advertirlo antes de añadir participantes. Quitar una mencion no
revoca un acceso compartido: revocar es otra accion explicita.

Menciones persistidas por ID de sec_user, no por coincidencia de nombre/email.
Crear nota/responder/compartir produce eventos. Avisar al autor y seguidores
pertinentes, sin autoavisos por defecto, una vez por persona y evento aunque
aparezca como mencionado+participante. Solo nuevas menciones en una edicion
producen su aviso; no reenviar por mover/color o cada autosave.

Campanita: Todas, No leidas, Menciones y Recordatorios; contador propio, paginacion,
marcar una/todas como leidas con limite temporal para no consumir avisos futuros.
Click abre exactamente nota/hilo/contexto autorizado; leido es individual y NO
significa aceptado/completado. No marcar todo leido al abrir la campana.
Silenciar y posponer afectan al usuario, no al resto. Centro Mis notas: creadas,
compartidas conmigo, menciones, activas, completadas/archivadas y busqueda.
Fotos/avatares de usuarios por identidad nativa con fallback, sin usar nombre como ID.

Entrega interna duradera desde el primer corte; actualizacion por polling moderado
inicial y SSE despues si volumen/UX lo justifican. Outbox transaccional para los
canales externos y proyecciones: idempotencia, reintentos, backoff y fallo visible.
El evento guarda IDs/contexto/version, sin volcar texto privado a logs. Reautorizar
antes de despachar, cancelar entregas revocadas. Email/Teams/WhatsApp son canales
posteriores opt-in, no se activan ni se reutiliza el transporte incrustado legacy.

## Modelo nativo propuesto, no DDL aplicado

Reutilizar sec_user, int_external_system/int_user_external_identity, dominios
existentes y auditoria central. No crear nuevo sistema de usuarios ni logs paralelos
que dupliquen audit_record_event. Agregar revisiones de contenido solo si el
contrato de auditoria existente no permite restitucion segura y autorizada.

| Tabla propuesta | Datos/responsabilidad |
| --- | --- |
| crm_note | PK propia, publicId ULID, autor FK sec_user, titulo/cuerpo versionado, texto para busqueda, color/prioridad, visibilidad/estado, version, creado/modificado/completado/archivado y actores |
| crm_note_reply | Nota FK, autor FK, cuerpo/version, respuesta citada opcional, creado/modificado/retirado; no duplica nota |
| crm_note_participant | Nota+usuario unicos, acceso read/reply, seguimiento/silencio, concedido/revocado por y fechas; autor sigue en nota |
| crm_note_mention | Nota/respuesta y usuario FK, version/evento de origen; menciones estructuradas |
| crm_note_link | Nota y contexto validado: vista o entidad nativa/externa, tipo/fuente, enlace principal; FK real en destinos nativos soportados y validacion de consistencia |
| crm_note_placement | Nota+usuario+contexto+clase pantalla unicos, x/y/width/height, anchorMode, collapsed/hidden, version/layoutUpdatedAt |
| int_note_external_reference | Nota nativa y sistema/ID externo unicos; autoridad/proyeccion, version/syncStatus/ultimo error; no coloca nombres de proveedores en el core |
| crm_notification | Evento, destinatario FK sec_user, tipo, nota/respuesta/contexto, dedupeKey, disponible/leido/descartado/creado; no requiere event_id de calendario |
| int_notification_outbox | Evento y canal/destino/idempotencyKey, intentos/proximo intento/estado; envio desacoplado y sin envios duplicados |

Son responsabilidades minimas del alcance completo, no requisito de crear todo
antes de un prototipo. Si se usa outbox tambien para replicacion, nombrarlo de
forma canonica general (int_event_outbox) en el diccionario definitivo, sin dos
colas equivalentes. Notificaciones calendario existentes pueden exponerse mediante
un lector agregado de campanita; no migrarlas ni duplicarlas implicitamente.

Todo campo con COMMENT espanol, nombres/sufijos segun26, UTC datetime(3),
publicIds externos y FK internas a PK propias; fechas representadas en Costa Rica
solo en UI. Legacy usa timestamps/datetime con sesion observada America/Guatemala;
no convertir horas a ciegas sin revisar conexion real del adaptador y campo.
Indices por ACL/usuario+estado/fecha, contexto, nota+secuencia y destinatario+lectura;
parametros/paginacion, EXPLAIN y limites de cuerpo/cantidad por vista al implementar.
Contenido validado, enlaces seguros, sanitizacion y limites; sin HTML arbitrario,
imagenes remotas ni adjuntos en MVP. Auditoria de acciones de negocio y revisiones
restringidas por ACL; no publicar cuerpos privados en timeline global.

## Contrato de lectura y comandos propuestos

Una API de notas para React y un contrato estable con id, author, content,
status, participants, mentions, links, myPlacement, capabilities, version y
source/syncStatus de diagnostico. No exponer columnas legacy ni IDs ERP como
autoridad del navegador. Un solo modelo de respuesta, no necesariamente un solo
GET enorme: paginar notas y cargar respuestas/historia bajo demanda.

Propuesta endpoints: GET/POST /notes; GET/PATCH /notes/:id;
POST /notes/:id/replies; PATCH /notes/:id/replies/:replyId;
PUT/DELETE /notes/:id/participants/:userId;
POST /notes/:id/complete|reopen|archive;
PUT /notes/:id/my-placement; GET /notes/:id/history;
GET /notifications y PATCH /notifications/:id/read.
Son contratos por disenar, NO rutas registradas. IDs creados/actor se resuelven
server-side, CSRF/session/gates existentes, idempotencyKey en creacion, version
optimista con409 para conflicto y guards por recurso. No autosave silencioso que
sobrescriba otra pestana; aviso de version nueva en hilo.

## Convivencia de fuentes: decision confirmada - 2026-10-27

El propietario eligio: **Nueva BD principal y copia compatible en la vieja**.
Se cierra la alternativa de escritura por origen para NOTAS NUEVAS. La decision
fija la arquitectura del plan; no constituye ejecucion de migraciones/imports.

CRM_THINK_V2 es la fuente de verdad de nuevas notas, hilos, participantes,
menciones y estado. Legacy recibe una proyeccion compatible, identificada por
referencia unica; nunca una segunda nota independiente. Crear/editar/compartir/
completar una nota nativa genera, en la misma transaccion, su evento de sincronizacion.
La copia se aplica idempotentemente por adaptador, con orden/version y estado
pending/synced/failed visible. Un fallo legacy no borra la nota nativa ni permite
mostrar falsamente sincronizacion completa. Reintentar nunca crea otra copia.

Las escrituras sobre copias desde la app vieja deben pasar por la API principal
o quedar readonly; no hay edicion bidireccional libre ni ultima fecha gana.
Posiciones personales, lectura y respuestas siguen en el modelo nuevo cuando
la tabla vieja no puede representarlas. Sin ampliar compatibilidad, una nota Home
no puede copiarse honestamente: requiere la adaptacion descrita abajo, no IDs0.
El retiro futuro del adaptador no afecta las notas principales nativas.

Las13 notas legacy observadas son un caso separado: esta eleccion no autoriza
importarlas ni cambiar su autoria automaticamente. Su lectura actual puede
seguir federada; antes de editar una de ellas mediante el nuevo motor se debe
cerrar la politica de promocion explicita y alias, o mantener el flujo legacy
existente. No importar contenido para listar. La conservacion de su historia
al retirar legacy requiere una migracion/archivo independiente aprobado.

1. Leer nativo primero y legacy autorizado despues; alias identifica una misma
   nota para no duplicarla. No deduplicar por titulo/texto/fechas.
2. Resolver usuarios solo con alias de sistema+ID univoco para escrituras. No
   inferir autoria por nombre o correo ni dar acceso al usuario parecido.
3. LegacyWriter solo admite notas con relaciones y autor/destinatarios mapeables,
   aplica autorizacion nueva y gates. Las rutas antiguas tambien deben impedir
   saltarse autoria/privacidad; no basta el frontend nuevo.
4. La tabla vieja NO puede guardar Home sin lead/transaccion por NOT NULL. Para
   presencia universal en ambas se requiere una ampliacion legacy aprobada:
   contexto vista y referencias opcionales/identidad nativa, ajustando su lector.
   Alternativa: Home solo nativo hasta ese cambio. Nunca usar lead0/transaccion0.
5. Una proyeccion de texto/destinatarios no representa respuestas, leido por
   persona, archivo/estado detallado o posicion personal. No simular equivalencia.
   Funciones nuevas viven en nativo y pueden mostrarse en el CRM viejo si este
   consume la API nueva. No crear otro sistema completo CSV en legacy.
6. Para cada campo elegir autoridad. Si ambas apps editan libremente el mismo
   cuerpo, hay conflicto: mejor enrutar las mutaciones de la app vieja por API
   nueva para notas proyectadas, o dejarlas readonly alli. No usar ultima fecha
   gana. Cambios externos de notas originadas en legacy requieren detectar version.
7. Nativo+auditoria+evento se guardan atomicos. Proyeccion eventual con outbox y
   estado pending/synced/failed; nunca decir guardada en ambas si una fallo.
   Si se exige atomicidad entre esquemas, evaluar una transaccion misma conexion
   y servidor con gates; no usar transacciones separadas como si fueran atomicas.
8. Compartir/revocar, completar/archivar y borrar requieren orden/version; un
   reintento viejo no debe resucitar un acceso o nota. Si ambas UIs no pueden
   aplicar una revocacion de forma segura, detener esa accion compartida o
   deshabilitar lectura legacy de la proyeccion; no dejar secretos expuestos.
9. Retirar legacy debe dejar CRUD/notificacion/layout nativos operativos sin
   hacer consultas ni depender de ids antiguos. Importar historia de NOTAS seria
   una migracion separada, con permiso, ensayo/reconciliacion y rollback.
   Si nunca se copia/archiva historia de notas de forma independiente, al apagar
   legacy ya no sera posible leer esas notas viejas. Esta restriccion es real.

### Mapeo de campos legacy

| Legacy | Tratamiento nuevo |
| --- | --- |
| id_sticknote | Referencia de fuente; no PK nativa ni publicId global |
| idinterno_lead | Enlace validado de origen/proveedor, opcional para Home |
| transaction_type/transaction_id | Registro de tipos (ordersale->sales_order) y referencia con fuente; no entero universal |
| titulo/mensaje | Contenido canónico y revision; texto plano compatible para legacy |
| color_hex/prioridad/categoria | Valores validados; categoria solo si tiene uso real, no catalogos especulativos |
| pos_x/pos_y/pin/visible | Preferencias por persona; legacy tiene una sola posicion, no proyectar movimientos personales globalmente |
| estado | Interpretacion conservadora de active/inactive; no inventar fecha de completado historica |
| privado | private/shared segun reglas reales de creador/asignados, nunca publicEveryone |
| id_usuario_creador | sec_user mediante int_user_external_identity+sistema/ID; conservar atribucion no resuelta sin adivinar |
| id_usuario_asignado/email_usuario_asignado | Normalizar participantes por usuario; CSV/emails solo compatibilidad, no ACL nativa |
| notificado | Flag historico de correo; no convertir a todos leidos o entregados |
| fecha_recordatorio | Recordatorio con zona revisada, audiencia definida y canal; no envio retroactivo automatico |
| creado_en/actualizado_en | Preservar origen; separar cambio de contenido de layout y avisos |

## Funciones de valor posteriores

P1: Recordatorios personales, posponer, checklist, solicitud de confirmacion
explicita separada de leido, favoritas, filtros por entidad/autor/estado y busqueda
con ACL. Suscribirse/dejar de seguir; borradores recuperables y aviso de guardado.
P2: convertir una nota en tarea o cita CON confirmacion, manteniendo enlace y sin
duplicar historial; plantillas de entrega entre ventas/formalizacion; entrega de
pendientes con responsable separado de autor. No asignar due dates como si fueran
agenda por existir una nota.
P3: adjuntos con controles propios, correo/Teams segun preferencias, resumen de
hilo con evidencia; IA no cambia estado, permisos o datos comerciales por si sola.

## Secuencia de entrega y aceptacion

0. Decision cerrada: nativo principal y copia legacy compatible. Definir semantica autoria/cierre/pin y
   contextos reales, matriz de capacidad legacy y permisos de cada rol.
1. Diccionario/contrato con FK, COMMENT de todos los campos, indices, revisiones,
   auditoria y pruebas de migracion en destino aislado. Esquema vacio, sin importar.
2. Backend nativo propio: ACL, autoria, relaciones soportadas, auditoria,
   outbox inerte, versiones e idempotencia; pruebas negativas. Implementado:57.
3. UI personal Home y un detalle real de Formalizacion: panel/notas/fijo/movil,
   carga/error/reintento, guardado y posicion individual. Sin campanita aun.
4. Compartir, respuestas y menciones; campanita con lectura individual y
   despachador de notificaciones con autorizacion vigente y sin duplicados.
5. Adaptador y copia legacy compatible: gates, privacidad, referencias,
   proyeccion por outbox, revocacion, fallos/reintentos y controles en app vieja.
6. Aceptacion integral: concurrencia409, red/reintentos, teclado/touch/zoom/scroll,
   rendimiento y cutover con legacy apagado. No tocar env ni integraciones sin
   autorizacion. La historia externa solo se conserva si se aprueba su almacen.

Casos obligatorios: tercero no edita/borrar ni por API directa; respuesta no cambia
nota original; lectura de uno no afecta otro; menciones multiples sin duplicados;
compartir no concede transaccion; autor pierde alcance; usuario desactivado;
pin fijo al scroll; mover no notifica ni mueve la vista de otro; completar oculta
sin destruir; fallo de proyeccion visible; IDs colisionados entre fuentes; Home
sin lead0; no reenvios historicos; respuestas y busqueda respetan revocacion;
legacy apagado sin errores en notas nativas.

## Fuentes empresariales consultadas el27

- [Salesforce Notes](https://help.salesforce.com/s/articleView?id=sales.notes_admin_overview.htm&language=en_US&type=5): notas enriquecidas y relaciones multiples.
- [Microsoft menciones en Notes](https://learn.microsoft.com/en-us/power-apps/user/use-%40mentions): mencion, permiso para compartir y campanita que abre registro.
- [Jira watchers/comments](https://support.atlassian.com/jira-software-cloud/docs/watch-share-and-comment-on-a-work-item/): seguimiento del hilo, menciones y respuestas.
- [Jira notificaciones](https://support.atlassian.com/jira-cloud-administration/docs/configure-notification-schemes/): destinatarios autorizados, preferencias y autoavisos.

Los patrones anteriores orientan esta propuesta; no se afirma que los productos
usen este esquema fisico o tengan las mismas reglas de autoria. Reutilizacion
local: [18](18-Notas-Adhesivas-y-Anotaciones.md), [16 frontend](../../frontend/Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md),
[26 nombres](26-Estandar-Nombres-Base-Datos.md), [47 calendario](47-Calendario-Compartido-Esquema.md)
y [55 estado](55-Revision-Documental-Integral-20261027.md).


Correccion de etapa3: [59](59-Notas-Contexto-Opcional-y-Vistas.md). Vincular es opcional; no concede visibilidad a terceros ni activa la copia de etapa5.
