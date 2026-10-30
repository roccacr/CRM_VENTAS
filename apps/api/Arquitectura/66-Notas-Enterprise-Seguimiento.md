# 66 - Notas colaborativas y seguimiento operativo

Revision QA posterior: [67 - Plan y resultados del 29 de octubre](67-Plan-QA-Regresiones-20261029.md).
Los fallos globales citados en los cortes del 28 son evidencia historica; el
documento 67 registra reproduccion, correccion de pruebas y resultados actuales.

## Estado consolidado - 2026-10-29

Seguimiento, recordatorios, ubicaciones, historial, colaboracion, bandejas y
transporte single estan implementados en el alcance descrito abajo. En el QA
del 29 se actualizaron pruebas de inventario/permisos y navegacion obsoletas;
no se cambiaron permisos de negocio para hacerlas pasar.

API: 6524 pruebas aprobadas y 151 omitidas condicionales, con formato/lint/tipos
y build aprobados. Frontend: 1233 aprobadas y check completo aprobado. Ademas
se ejecutaron las 32 pruebas SQL/socket de notas en esquemas sinteticos que
se eliminaron al terminar. Las suites focalizadas se solapan con las generales;
no sumar sus cifras como casos unicos ni afirmar cobertura al 100 %.

El primer check-all del 29 conserva exit1 por un error de tipado en las pruebas
nuevas de frontend; la correccion y el pnpm check frontend posterior exit0 se
registran en67. Esa distincion evita convertir un log fallido en evidencia verde.
Pendientes: Redis multinodo, benchmark de latencia/carga, aceptacion visual con
dos cuentas reales y copia compatible legacy. Adjuntos no forman parte del alcance.
Esta reconciliacion documental no vuelve a ejecutar pruebas ni modifica datos.

## Alcance autorizado 2026-10-28

Implementar responsables opcionales, vencimiento compartido, recordatorios
personales con fecha/hora y posposición, avisos internos duraderos, bandeja de
asignadas, búsqueda en todas las páginas, filtros, historial visible y varias
ubicaciones de una misma nota. Excluidos los adjuntos, correo externo y copias
de registros legacy. La invitación no concede acceso al registro vinculado.

## Decisiones y aceptación

- Una nota tiene un autor inmutable; solo él cambia responsable, vencimiento,
  contenido, ubicaciones y participantes. Responsable e invitado son conceptos
  independientes: solo se asigna a alguien que ya puede leer la nota.
- El vencimiento pertenece al pendiente; cada lector puede elegir su propio
  recordatorio, posponerlo o cancelarlo sin modificar el vencimiento ajeno.
- Las fechas viajan como UTC ISO con zona explícita; la interfaz convierte la
  hora local. No usar temporizadores del navegador como fuente de entrega.
- Los avisos se persisten antes del socket y sobreviven a reinicios; reclamos
  concurrentes, reintentos y claves únicas evitan entregas duplicadas.
- Completar, archivar o retirar acceso cancela los avisos pendientes aplicables.
  Una sesión sin permiso vigente no recibe contenido privado por socket.
- El vínculo canónico conserva `tipo + origen + id`; ubicaciones adicionales
  son referencias visuales a Homes autorizados, nunca duplicados ni permisos.
- Buscar filtra en servidor antes de paginar, incluyendo comentarios vigentes;
  solo se cuentan y muestran las notas que la sesión aún puede consultar.
- Historial: actor, acción y fecha; no restaurar ni revelar contenido anterior.
- Agrupar avisos no borra eventos; cada aviso conserva su lectura y las menciones
  siguen siendo prioritarias. Silenciar respuestas no cancela recordatorios
  personales solicitados explícitamente.

## Implementación y verificación

Reutilizar NotesModule, repositorios nativos, auditoría central, recibos
idempotentes, campana interna y cola de eventos realtime. Migraciones aditivas
052 (ubicaciones) y 053 (seguimiento), con comentarios y sin lecturas legacy.
Aplicar individualmente con `pnpm migrate:identity:schema --only=<nombre>`.

Pruebas: contratos, permisos, concurrencia/versiones, aislamiento por usuario,
fechas, pendientes vencidos, recuperación, revocación y SQL real en esquema
temporal. Validación: pruebas de notas API/frontend, lint, typecheck, build y
`check-all.cmd`. Las limitaciones de infraestructura y recorridos visuales deben
registrarse con evidencia; una prueba unitaria no sustituye dos sesiones reales.


## Contratos operativos

| Ruta | Resultado y control |
| --- | --- |
| `GET /note-workflow/notes/:id` | Responsable, vencimiento, version inicial0 y recordatorio exclusivo del lector |
| `PUT /note-workflow/notes/:id/task` | Autor con `edit_own`, version y operationId; responsable ya invitado o autor |
| `PUT /note-workflow/notes/:id/reminder` | Hora UTC futura o null para cancelar; solo cambia el recordatorio propio |
| `GET /note-workflow/overview?timeZone=America/Costa_Rica` | Asignadas abiertas, vencen hoy y vencidas; zona IANA validada y truncamiento explicito |
| `GET /note-collaboration/inbox` | Busqueda de texto/comentarios/autores, modulo, autor, estado, origen+ID y fechas; conteo y pagina acotada en SQL |
| `GET /note-collaboration/inbox/authors` | Todos los autores de notas autorizadas, independiente de la pagina visible |
| `GET/PUT /note-collaboration/notes/:id/locations` | Referencias adicionales a Homes; modificar requiere version colaborativa, autor con share_own y permisos de destino |
| `GET /note-collaboration/notes/:id/activity?page=1` | Historial paginado sin texto historico; preferencias personales solo al actor |

Los avisos de asignacion y vencimiento son importantes y no se silencian con
Silenciar respuestas. Las respuestas comunes respetan seguimiento; menciones y
recordatorios personales mantienen su proposito. La agrupacion de la campana
reune avisos de una misma nota de la pagina cargada sin eliminar eventos.

Completar/archivar cancela pendientes, reabrir no resucita avisos viejos.
Retirar una invitacion suprime avisos pendientes y quita al responsable si era
esa persona. Las ubicaciones de destinos que el autor ya no puede administrar
se conservan al editar otras visibles. Un deadlock1213 puede reintentarse hasta
tres veces porque MySQL confirma rollback; no se repiten errores de red inciertos.

La colaboracion y los recordatorios no esperan resolver la orden enlazada.
Solo los enlaces de navegacion verifican acceso a la ficha implementada; hoy la
ficha operativa de orden sigue siendo Formalizacion. No se inventan rutas ni
permisos de orden para modulos que aun no tienen esa ficha.

## Evidencia de aplicacion

Migraciones052/053 aplicadas individualmente en CRM_THINK_V2. Verificacion
posterior: tres tablas nuevas vacias y todas sus columnas con comentario. No se
copio contenido legacy ni se crearon notas de negocio para comprobar la interfaz.
Pruebas SQL y sockets con identidades sinteticas en esquema temporal eliminado;
la auditoria de esa fixture usa almacenamiento sintetico, no es una prueba de
produccion del servicio central de auditoria.

La revision visual con la sesion disponible confirma bandejas, seguimiento,
fechas, Homes e historial. No se enviaron avisos a personas reales. La aceptacion
Redis entre procesos requiere el endpoint privado TLS/autenticado configurado;
las pruebas de sockets locales no equivalen a esa aceptacion de infraestructura.


### Cierre verificado 2026-10-28

- 226 pruebas focalizadas de API/notas y esquema aprobadas; 171 de interfaz.
- Suite MySQL/sockets:11 pruebas aprobadas en esquema aislado; recuperacion de
  deadlock real adicional aprobada. Revocacion con retorno del vencimiento al
  autor tambien comprobada en SQL aislado. Esquemas temporales eliminados.
- Lint y builds API/frontend aprobados; typecheck API completo aprobado.
- Inventario de migraciones:24 pruebas aprobadas; frontera HTTP de lectura y
  posicion personal entre modulos comprobada manteniendo deny de origen.
- Chequeo global ejecutado:22 fallos en inventario/fronteras HTTP de Calendario
  y actividad de Formalizacion, fuera de los comandos de notas. No se declara
  que todo el repositorio este verde.
- Configuracion observada:topologia single, sin endpoint Redis privado. No se
  modificaron credenciales ni configuracion para simular aceptacion multinodo.

Los datos nuevos permanecieron vacios al verificar la migracion; la prueba
visual fue de consulta. No se enviaron notas ni avisos a usuarios reales para
validar el desarrollo. Sin commit, publicacion o despliegue.


Regresion concurrente adicional: una respuesta iniciada antes de retirar la
invitacion reprodujo una lectura anterior de membresia en MySQL aislado. Los
tres comandos de notas usan ahora read committed y mantienen sus bloqueos y
recibos; las paginas de lectura conservan repeatable read. La misma regresion
ahora devuelve404 sin crear respuesta. Junto con base/transportes,32 casos de
SQL/sockets fueron comprobados en esquemas descartables eliminados. Los fallos
transitorios503 de autorizacion tampoco se convierten en supresion permanente
de recordatorios: llegan al reintento duradero.

### Revision individual sin agentes - 2026-10-28

Esta revision se ejecuto personalmente, sin agentes y sin crear notas ni avisos
para usuarios reales. No se modifico codigo de produccion.

- API/notas y esquema: 259 pruebas aprobadas. Las 32 pruebas SQL condicionadas
  se ejecutaron ademas por separado: 13 colaboracion, 10 repositorio base y
  9 transporte/notificaciones, todas aprobadas. Los esquemas temporales creados
  por los runners fueron eliminados al terminar.
- Interfaz de notas: 171 pruebas aprobadas. Fronteras HTTP de permisos de notas:
  46 aprobadas; el filtro omitio expresamente otros casos del inventario.
- Se agregaron 33 casos HTTP de autenticacion/CSRF para workflow, ubicaciones,
  actividad, autores y sesiones expiradas. La suite HTTP ahora tiene 77 casos.
- Cobertura unitaria de notas medida antes de los ultimos 11 casos de sesiones:
  83.23 % lineas y 69.32 % ramas. No incluye las suites SQL ejecutadas aparte;
  no equivale a cobertura completa ni a aceptacion de infraestructura.
- Lint de los tests modificados y typecheck API aprobados; formato, lint y
  typecheck generales de ambos proyectos aprobados durante sus checks.
  Builds API y frontend aprobados por separado.
- Check global API: 6468 aprobadas, 151 omitidas, 22 fallos en inventario y
  permisos de Calendario/actividad de Formalizacion. No hubo fallos de notas.
- Check frontend: 1160 aprobadas, 73 omitidas y una suite App interrumpida por
  timeout de beforeAll. Repeticion aislada de App: 69 aprobadas y 4 fallos al
  buscar el boton Resumen de Formalizacion. No se modificaron esos modulos.
- API activa: health/live 200; consultas anonimas de notas, autores y workflow
  rechazadas con 401. Redis multinodo sigue sin validarse: la configuracion
  disponible es single y no tiene endpoint Redis privado.

Evidencia de esta ejecucion: C:/codex-data/notes-solo-api-final.log,
notes-solo-ui.log, notes-solo-mysql.log, notes-solo-base.log,
notes-solo-transport.log, notes-solo-global-final.log,
notes-solo-frontend-check.log y notes-solo-app-recheck.log.
No se declara todo el repositorio aprobado. Sin commit ni despliegue.
