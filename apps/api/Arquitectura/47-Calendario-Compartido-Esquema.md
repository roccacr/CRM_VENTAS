# 47 - Calendario compartido: esquema nativo

## Corte de lectura operativa - 2026-10-27

El calendario sigue teniendo esquema nativo sin editor/commands HTTP, RSVP,
notificaciones o Graph operativos. Esto no impide los SELECT de los reportes.
Ademas de Inicio48, [Captacion53](53-Captacion-Leads-Reporte-Federado.md) consulta
`crm_calendar_appointment` y vinculos `crm_calendar_event_link` de tipo `lead`,
une eventos no eliminados y reconoce el tipo por codigo `cita`/`appointment`
o nombre `cita`, normalizados. El detalle opcional no transforma una llamada
en cita. El vendedor de la metrica es el responsable del lead, aunque otra
persona haya creado el evento. Las copias no multiplican el conteo.

Captacion clasifica cada lead una sola vez: completada tiene prioridad sobre
programada; con solo canceladas queda sin cita vigente. Es una cohorte por fecha
de creacion del lead, no volumen de eventos, asistencia ni agenda por fecha de
visita. Inicio conserva su propio contrato de conversion/visitas; no sustituir
sus denominadores por los de Captacion.

El menu separado Eventos y citas y `mercadeo.appointments.read` se retiraron
mediante 038. Permanecen Calendario y estas metricas. La revision es de codigo,
sin conexion MySQL: las ocho tablas vacias y el catalogo sin tipos que se citan
abajo son snapshots historicos del 2026-10-23, no conteos al 2026-10-27.

Fecha: 2026-10-23. El propietario autoriza planificar y aplicar estructura nueva
en CRM_THINK_V2, sin copiar filas de calendars ni modificar la BD antigua.
Este documento prevalece sobre los ejemplos futuros de 17 para este corte.

La migracion 034 es solo estructura. La ampliacion posterior de
[48 - Metricas de citas](48-Mercadeo-Metricas-Citas.md) agrega SELECT al resumen
de Mercadeo, sin API operativa de calendario, comandos, RSVP, campana u Outlook.
Consolidacion: [49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md).

## Plan y alcance

1. Normalizar evento, tipos por modulo, participantes, relaciones y citas.
2. Separar campana individual y sincronizacion externa del evento CRM.
3. Agregar migracion 202610230034_calendar_domain y tipos Kysely, sin runtime.
4. Probar SQL y guardas, revisar, ejecutar exclusivamente esta migracion.
5. Verificar DDL, comentarios, FKs, indices, triggers y cero filas por tabla.

No se crean eventos, tipos ficticios, proveedores, permisos ni conexiones.
No se habilitan endpoints, jobs, Graph, envio de invitaciones o campana real.
No se cambia el importador de usuarios ni los permisos de los roles.

## Identidades y tablas

Se mantiene el patron real del CRM: PK BIGINT interna y ULID publico unico.
Las FK internas usan PK propias de sec_user/sec_org_unit, nunca numeros ERP.
La API futura recibe IDs publicos y resuelve la PK tras validar permisos.
Cambiar las FK existentes a texto no es necesario ni parte del alcance.

| Tabla | Responsabilidad |
| --- | --- |
| conf_calendar_event_type | Tipo, codigo y color por modulo; catalogo inicialmente vacio |
| crm_calendar_event | Evento unico, organizador, modulo original, horario UTC y estado |
| crm_calendar_participant | Muchos usuarios o invitados externos, copias y respuesta individual |
| crm_calendar_event_link | Relaciones con uno o mas registros por tipo y ULID publico |
| crm_calendar_appointment | Detalle opcional de lead/proyecto, secuencia y verificacion de cita |
| crm_calendar_notification | Campana por destinatario, lectura, descarte y vencimiento |
| int_calendar_connection | Proveedor/cuenta/calendario externo sin secretos |
| int_calendar_event_sync | Identidad remota, idempotencia, version, reintentos y estado por conexion |

## Reglas de visibilidad y gestion para implementar despues

- El calendario compartido es una consulta, no una copia de cada evento.
- Todo evento tiene un solo modulo de origen, inmutable mediante trigger.
- El tipo debe pertenecer al modulo original: FK compuesta.
- Un organizador o participante interno puede ver su evento desde los modulos
  a los que ya tenga acceso; esto no concede pertenencia al modulo del evento.
- La vista del modulo puede mostrar ademas eventos de ese modulo segun permisos
  y alcances efectivos. No basta tener muchos roles para leer todos los eventos.
- Editar titulo, horario, estado, participantes o vinculos exige contexto del
  modulo original y permiso efectivo de gestion, respetando denies y scopes.
- Un participante puede responder su propia invitacion desde otro modulo.
  Responder no equivale a editar el evento. Una persona copiada puede no requerir
  respuesta. El rol coorganizer no evita el requisito de modulo y permisos.
- Revocar participacion elimina visibilidad por esa participacion y oculta sus
  avisos pendientes, salvo otro fundamento de acceso; no elimina la historia.
- Ver un evento no concede lectura del lead, orden o registro relacionado.
  Cada vinculo se resuelve y autoriza separadamente en API para evitar IDOR.

Estas son reglas de la futura API de calendario; las tablas no autentican
peticiones ni comprueban roles. La entrega 034 no habilito endpoints. El resumen
posterior GET /marketing/home/summary usa su permiso y alcance de lectura,
sin implementar esta gestion ni conceder membresias o grants nuevos.

## Relaciones dinamicas

entity_type + entity_public_id permite lead, sales_order, project y las futuras
estimate/opportunity sin crear columnas ERP ni FK a tablas inexistentes.
El ULID tiene comprobacion de formato; existencia y acceso al destino deben
validarse mediante un registro cerrado de resolvers del servidor. No se permite
convertir el tipo recibido en un nombre SQL arbitrario. No hay FK polimorfica:
esta limitacion es explicita y requiere validacion transaccional futura.
La cita opcional usa ademas FK reales a crm_lead y crm_project. Si existen ambos
detalles y vinculos, el futuro comando debe comprobar que sean consistentes.

## Tiempo, respuestas y campana: contrato futuro

Los comportamientos de API, reprogramacion, RSVP y notificacion de esta seccion
son requisitos futuros; el DDL solo prepara campos y restricciones.

Inicio/fin son DATETIME(3) UTC, con fin exclusivo posterior al inicio. La zona
IANA es obligatoria; la API debe validar zonas y medianoches de eventos de dia
completo, incluidas transiciones DST. Sin recurrencia automatica en este corte.
Cada ocurrencia de una futura serie debe tener identidad propia antes de activar
sincronizacion recurrente; no importar masters como si fueran citas aisladas.

La respuesta accepted/tentative/declined incluye fecha y version de invitacion.
Una reprogramacion incrementa invitation_version y vuelve pendientes las
respuestas segun politica confirmada, conservando la anterior en bitacora.
La API usa version optimista y un solo cambio transaccional con su auditoria.

La notificacion es por usuario: read_at conserva cuando leyo y dismissed_at
cuando retiro el aviso. Ninguna modifica el evento, el RSVP ni a otros usuarios.
La futura campana consulta destinatario autenticado, read_at/dismissed_at null,
visible_at <= ahora y expires_at null o futuro, verificando visibilidad vigente.
La primera lectura se conserva con COALESCE, no se reescribe en cada consulta.

Para event_today se usa solapamiento con el dia local del destinatario:
start < finDia y end > inicioDia, excluyendo cancelados, eliminados y acceso
revocado. No se usa DATE() sobre columnas UTC indexadas. La clave dedupe es el
dia local y evita que un job vuelva a mostrar como pendiente un aviso ya leido.
El aviso vence al siguiente dia local. Zona del destinatario: futura preferencia
verificada; fallback explicito America/Costa_Rica. Esto aun no ejecuta ningun job.

## Outlook futuro

Sin fila de sync: evento solo CRM. Una o varias filas: destinos externos
identificados por proveedor, tenant, cuenta y calendario, no solo un ID global.
ID remoto sensible a mayusculas, UID, version/ETag y operation_id separados.
Las claves largas se indexan mediante SHA-256; el adapter debe comparar tambien
el texto completo y fallar ante una colision, nunca fusionar por digest solo.
No almacenar tokens, contrasenas, respuestas completas ni enlaces secretos.
Una sincronizacion correcta no demuestra que se haya enviado correo: el campo
invitation_sent_at solo se llena con evidencia del envio externo.

La documentacion oficial confirma que el ID de evento puede cambiar al moverlo,
que existe iCalUId y changeKey, y que las respuestas de asistentes son diferentes
de los recordatorios. La futura integracion debera usar IDs inmutables cuando
proceda, versionado, consentimiento y scopes Graph definidos aparte.
Fuente: https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0

## Mapeo conceptual de calendars, sin importar datos

| Campo anterior | Modelo nuevo |
| --- | --- |
| id_calendar | id/public_id_calendar_event propios; no conservar el ID como PK nativa |
| nombre/color/decrip_calendar | titulo, color opcional y descripcion del evento |
| id_admin | organizador sec_user mediante referencia externa conciliada; futura API recibe ID publico nativo; participantes separados |
| id_lead/id_oportunidad | vinculos por tipo y ULID; id_lead legacy referencia leads.idinterno_lead, no la PK nativa; cita nueva puede usar FK propia de lead |
| fechaIni/fechaFin/horaInicio/horaFinal/hora_calendar | inicio/fin UTC y zona; sin concatenar strings sin validar |
| estado_calendar/cancelado | estado textual y motivo de cancelacion, sin inferir numeros |
| tipo_calendar | tipo configurado por modulo; lector actual reconoce Cita, sin sembrar tipos nativos |
| accion_calendar | estado del evento; lector actual normaliza Pendiente/Completado/Cancelado (48), sin importar datos |
| noticia/mostrar_calendar | no equivalen a estado global: lectura y descarte por destinatario |
| fechCcomprador_calendar | customer_confirmed_at cuando se confirme su significado y fecha |
| cita_lead/citas_chek/masDeUnaCita_calendar | no clasifican tipo Cita; traducir a detalle/secuencia requiere confirmacion |
| supervisor_chek | verificador y fecha, no un booleano sin responsable |
| progreso_calendar | progreso textual opcional; sin asumir equivalencias numericas |
| id_proyecto/nombre_proyecto | FK crm_project; nombre se consulta, no se duplica |
| copiaJefe/NotificarCliente | participantes internos o externos/copias, no flags en el evento |
| correoEnviado | evidencia de envio del participante; no se toma como sincronizacion |
| idEventoProgramado/outlook_event_id | referencia externa en conexion + sync; no columnas del core |

## Auditoria y operacion

Reutilizar audit_record/audit_record_event para el agregado calendar_event;
no crear otra bitacora que compita con la central. La futura API debe admitir
este source/contrato de snapshots y registrar cambios, participantes, respuestas
y lectura cuando corresponda, atomicamente con actor y valores anteriores/nuevos.
Hoy no hay escritores conectados: los triggers solo mantienen UTC/origen,
no capturan el usuario autenticado ni generan auditoria por si solos.

DDL MySQL no es atomico entre tablas. Una interrupcion deja esquema parcial:
no reintentar adoptando tablas, no borrar automaticamente. Conciliar con DBA.
Reversion operativa: dejar tablas sin usar; no ejecutar down destructivo.
Solo se ejecuta --only=202610230034_calendar_domain mediante runner aprobado,
con MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2; no aplicar 033 ni otras tareas.

## Eventos y citas: regla aclarada - 2026-10-23

Un lead puede tener cero eventos, eventos no Cita y multiples eventos Cita.
El tipo del evento determina la clasificacion, no el flag obsoleto cita_lead,
participantes ni una etapa o cambio de etapa del lead. Contar eventos distintos
por identidad: una copia o participante adicional no agrega una cita. scheduled
no significa completed ni attended; cancelled permanece separado. El detalle
crm_calendar_appointment es opcional y no convierte por si solo otro tipo en Cita.
La clasificacion nativa queda pendiente de configuracion real: el catalogo
conf_calendar_event_type estaba vacio en la evidencia de 034. No se siembra un
tipo ni se decide un mapeo nuevo aqui. Los predicados del lector actual estan en 48.

El coordinador comunica nueva verificacion SELECT-only del 2026-10-23 a las
23:57:46Z: las ocho tablas siguen con cero filas y sus 106 columnas conservan
comentarios. El snapshot anterior de ledger (23:56:17Z) confirma 031/032/034 y
033 NO aplicada. Esos snapshots nativos se registran en 49; no verifican legacy,
comportamiento con citas reales, permisos efectivos ni ejecucion de comandos.

## Evidencia historica - 2026-10-23

El registro siguiente pertenece a la ejecucion original. Esta revision documental
no ejecuto migraciones, SELECT, pruebas ni verificaciones de infraestructura.

Migracion 202610230034_calendar_domain aplicada en CRM_THINK_V2, MySQL 8.0.45,
mediante seleccion --only. Segunda ejecucion omitida por el ledger: una fila.
Ocho tablas verificadas, todas con cero filas. 106 columnas, todas comentadas;
22 columnas de FK exclusivamente nativas, 27 CHECK con ENFORCED=YES, 40 indices
(incluidos PK y soporte automatico de FK), ocho triggers UTC y origen inmutable.
El indice de pendientes por destinatario existe fisicamente.

Conteos antes/despues sin cambio: sec_user 46, sec_user_role 46,
sec_permission 205, int_external_system 2, crm_lead 0, crm_sales_order 0.
El codigo de esta migracion no consulta ni modifica legacy; no se copio ningun
dato. La 033 pendiente no fue ejecutada. No se cambiaron configuracion ni grants.

Verificacion local: 55 pruebas focalizadas en calendar-domain,
schema-migration-runner e identity-schema-migration; todas pasan. Tambien
typecheck API, build API, ESLint y Prettier de los archivos tocados y diff-check
acotado pasan. Revision independiente sin bloqueos. No se ejecutaron todas las
pruebas del proyecto ni fixtures/concurrencia en las BD compartidas.

Las pruebas DummyDriver validan SQL/guardas; la consulta real de metadatos
confirma persistencia del esquema e instalacion de restricciones/triggers,
no acredita ejecucion de cada rechazo con datos ni rendimiento bajo carga.
No se crearon fixtures para probar CHECK/FK ni eventos de ejemplo. La edicion
con permisos, links polimorficos, RSVP, auditoria de calendario, jobs de campana
y Graph siguen pendientes de implementacion operativa deliberadamente.
