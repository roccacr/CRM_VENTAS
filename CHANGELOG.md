# Changelog

## Notas, calendario y QA consolidado - 2026-10-29

- Notas: responsables opcionales, vencimientos y recordatorios personales con
  fecha/hora y posposición; bandeja de asignadas, búsqueda/filtros en servidor,
  historial y ubicaciones adicionales a Homes. Migraciones052/053 documentadas
  en [66](apps/api/Arquitectura/66-Notas-Enterprise-Seguimiento.md), sin importación
  de registros. Esta actualización documental no ejecuta migraciones.
- Colaboración: invitaciones múltiples independientes del módulo del invitado,
  respuestas y menciones, seguimiento/silencio y avisos agrupados. El autor
  administra la nota; responder no concede edición de contenido ajeno.
- Notas y avisos persisten antes del socket; colas con reintentos, deduplicación
  y revocación. Posición/lectura usan guardado en segundo plano; crear/editar
  esperan confirmación. Vínculo por registro y origen, no por URL; invitar no
  concede permisos sobre la orden. Copia legacy, adjuntos y correo no activados.
- Calendario compartido registrado: lectura autorizada y creación/edición nativa
  con versión y bitácora; reemplaza el estado histórico de solo esquema.
  [Contrato](apps/api/Arquitectura/64-Calendario-Global-API-y-Contexto.md).
- QA: corregidas expectativas de inventario/rutas y permisos de Calendario y
  actividad reciente; agregados23 negativos HTTP. Pruebas de sesión/menú ahora
  comprueban la navegación vigente sin Resumen y separan precarga de acciones.
  No se cambiaron permisos de producción para satisfacer pruebas obsoletas.
- Evidencia fechada: API6524 aprobadas/151 omitidas; frontend1233 aprobadas;
  SQL/sockets32 aprobadas aparte en esquemas temporales eliminados. Formato,
  lint, tipos y builds aprobados. Primer check raíz terminó exit1 por tipado de
  aserciones; corrección y check frontend completo posterior terminaron exit0.
  [67 - Plan, logs y límites](apps/api/Arquitectura/67-Plan-QA-Regresiones-20261029.md).
- Pendientes de aceptación: Redis entre procesos, medición de carga/latencia y
  dos cuentas reales en navegador. Las cifras no acreditan CI remoto ni despliegue.

Los cortes inferiores conservan la historia de cada etapa; sus pendientes y
conteos no sustituyen el estado vigente anterior.

## Formalización: roles, recuperación y recorrido - 2026-10-28

- Formalización y Jefe de Formalizaciones gestionan todas las órdenes con el
  permiso correspondiente; se conservan denegaciones, requisitos y auditoría.
- Migración049 nativa provisiona permisos faltantes de los roles, sin reactivar
  configuraciones deshabilitadas ni tocar excepciones individuales o datos legacy.
- La ficha se revalida por identidad después de guardar, sin depender de banners.
  401/403 bloquean comandos; las respuestas inciertas conservan operación y contenido.
- Cierre explícito, etapas anteriores neutrales y textos de movimiento precisos;
  recuperación de errores de URL con reintento y regreso. Contrato y límites en65.

## Notas colaborativas: etapa4 - 2026-10-27

- API protegida de participantes, respuestas propias, menciones y seguimiento.
- Campana interna y bandejas; revocación suprime acceso y avisos históricos.
- 044 aplicada sin imports ni grants comerciales; outbox de colaboración con reintentos y deduplicación.
- UI de invitación al crear/después y conversación; creación confirmada no se duplica si compartir falla.
- Copia legacy y aceptación integral siguen en etapas5/6. Contrato60.

## Notas: corregir ID de presentacion legacy - 2026-10-27

- Consulta y creacion convierten legacy:208 a source=legacy,id=208; los IDs publicos nativos se mantienen intactos.
- URL y detalle usan la misma identidad para conservar el borrador. Sin modificar IDs de BD, permisos o relaciones.

## Notas: contexto opcional - 2026-10-27

- Creacion desde cualquier pantalla: nota personal por defecto, checkbox para vincular la vista actual y mostrar tipo/destino.
- Ordenes nativas y legacy con origen/ID separados; vistas registradas con permiso vigente y Home compatible con hash previo.
- Migracion041 solo registra legacy_crm como sistema de referencia; sin importar ordenes ni activar copia legacy.
- Selector personal/vista, reintentos conservan destino; autoria/ACL y compartir en etapa4 siguen vigentes. Documento59.

## Notas colaborativas: etapa3 - 2026-10-27

- Icono Mis notas junto a la campana, escritorio/movil; editor lateral conectado al API nativo.
- Home y orden nativa de Formalizacion: crear/editar/completar/reabrir/archivar; posicion, tamano y PIN personales con teclado/puntero y layouts por dispositivo.
- Acceso personal self en modulos efectivos existentes; permisos activos, deny y autoria conservados. Sin grants masivos ni migraciones.
- Reintento manual de guardados inciertos conserva operationId/payload; contexto aislado,409 explicito y contenido como texto plano.
- Campanita de notas, compartir y copia legacy siguen pendientes. Contrato: documento58.

## Notas colaborativas: etapa2 - 2026-10-27

- API de notas propias: crear, leer, editar, completar/reabrir/archivar y posicion personal.
- Permisos por modulo, autoria exclusiva, contexto autorizado, CSRF y versiones.
- Migracion040 aplicada:25 permisos sin grants comerciales, recibos y outbox transaccional inerte; todos los campos comentados.
- Sin importar registros, interfaz, campanita ni copia legacy. Contrato: apps/api/Arquitectura/57-Notas-Etapa2-API.md.

## Notas colaborativas: etapa1 - 2026-10-27

- Migracion039: siete tablas nativas vacias,91 columnas comentadas,24 FK y15 CHECK.
- Recuperacion explicita tras rechazo de triggers SUPER/binlog: cotejo completo
  y registro en ledger sin borrar tablas, bajar seguridad o copiar datos.
- Sin API/UI, permisos, notificaciones o escrituras legacy; avance en plan56.
- API5734 pruebas aprobadas/119 omitidas; build/typecheck y formato tocado aprobados.

## Revision documental integral - 2026-10-27

- Revision con tres agentes y coordinacion contra codigo del checkout compartido.
- Reconciliados Captacion conectada, seguimiento/transiciones de Formalizacion,
  consulta NetSuite, periodos y graficos actuales, y retiro de Eventos y citas/038.
- Inventario y limites en [55](apps/api/Arquitectura/55-Revision-Documental-Integral-20261027.md).
  Se conservan snapshots y pruebas historicos; no se presentan como ejecuciones nuevas.
- Ambos typechecks aprobados; check-all detenido por formato previo en API.
  Sin modificar runtime/configuracion/BD o ejecutar migraciones durante la revision.

## Consolidacion documental integral - 2026-10-23

- Revision paralela de frontend, arquitectura API, identidad/Formalizacion y
  Mercadeo/calendario, contrastada con codigo y SELECT nativo de metadatos/conteos.
- [49 - Estado actual](apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md)
  consolida alcance, fuentes, verificacion, cobertura y pendientes. Informes
  historicos conservan sus fechas; no se ejecuta un nuevo gate de aplicacion.
- Plan aplicado sobre 97 Markdown: contratos de timeline nativo, servicio interno
  de historial sin caller comercial, multiseleccion/fotos/precarga de Mercadeo,
  fechas de cohorte frente a eventos, asistencia y limites de calendario.
- Snapshot nativo de solo lectura a las 17:56-17:57 Costa Rica: ledger 031/032/034,
  033 ausente, ocho tablas calendario vacias y 106 columnas comentadas. No son
  fixtures ni prueba de transiciones comerciales. Enlaces/anchors revisados.
- Resultado documental: 32 archivos corregidos, 65 conservados tras revision y
  564 enlaces locales/anclas comprobados sin referencias rotas. Revision cruzada
  final del consolidado y README completada.
- Solo documentacion: sin cambios de runtime, configuracion, datos, integraciones,
  commits, push o despliegue durante este cierre.

## Calendario compartido: esquema vacio - 2026-10-23

- 034 aplicada exclusivamente en CRM_THINK_V2: ocho tablas vacias para tipos por
  modulo, evento, participantes, vinculos, detalle de cita, campana y sync externo.
- Origen de modulo inmutable, FK internas, ULID publicos, UTC y respuestas/lectura
  individuales. Sin importacion de calendars, tipos ficticios, permisos ni Graph.
- 55 pruebas focalizadas y verificaciones de esquema anteriores documentadas en
  [47](apps/api/Arquitectura/47-Calendario-Compartido-Esquema.md), no reejecutadas por este cierre.

## Usuarios por correo y rol base Ventas - 2026-10-23

- 43 perfiles creados desde correo/nombre de admins, uno existente omitido.
  Sin passwords/tokens/referencias ERP ni importacion de roles antiguos.
- Posteriormente se creo rol Ventas sin permisos y se asigno a esos 43 perfiles;
  estados pending/inactive y acceso sin habilitar conservados, con bitacora nativa.
- [45 - Evidencia](apps/api/Arquitectura/45-Usuarios-Por-Correo.md).

## Mercadeo: resumen real y agregados de citas - 2026-10-23

- GET /marketing/home/summary registrado con permiso, alcance, precedencia nativa
  y adapter legacy de lectura; no copia datos ni habilita CRUD comercial.
- Tipos de citas, conteo unico por lead/evento, estados y asistencia se distinguen;
  leer agregados no convierte la estructura 034 en calendario operativo.
- Contratos y limites en [46](apps/api/Arquitectura/46-Mercadeo-Resumen-Leads.md)
  y [48](apps/api/Arquitectura/48-Mercadeo-Metricas-Citas.md).

## Jefe General administrable por Owner - 2026-10-23

- Plantilla de General editable en Por rol: modulos y permisos en un unico
  guardado auditado. Owner permanece protegido y los denies prevalecen.
- Migracion nativa 030 aplicada: cuatro modulos y 140 permisos operativos
  actuales persistidos, sin asignar empleados ni modificar legacy/ordenes.
- Acceso por empleado limitado a la interseccion con la plantilla; los permisos
  retirados dejan de regenerarse. Verificacion y limites en arquitectura 42.

## Jefaturas por modulos seleccionados - 2026-10-23

- Migracion nativa 029 aplicada: relacion rol-modulo y politica de Jefe General,
  sin asignar empleados ni modificar datos comerciales o BD legacy.
- Perfil y servicios limitan permisos al modulo efectivo; denies individuales
  prevalecen y no se concede administracion por ser Jefe General.
- Selectores de modulos por empleado, previsualizacion por rol de origen y
  bitacora con politica y modulos anteriores/nuevos. Owner conserva herencia global.
- Plan, evidencia de BD y limites de verificacion en
  [42 - Jefaturas](apps/api/Arquitectura/42-Jefaturas-Modulos-y-Permisos.md).

## Mercadeo: roles y permisos por seccion - 2026-10-23

- Migracion nativa dirigida 028 para Mercadeo y Jefe de Mercadeo: cuatro permisos
  nuevos de lectura de seccion y siete de catalogos reutilizados por rol.
- Menu y catalogo de seguridad alineados con Inicio, Captacion de leads, Eventos
  y citas, Calendario y Catalogos. Las tres vistas nuevas siguen sin implementar.
- Auditoria atomica y versiones de permisos, incluidos titulares Owner; sin
  asignaciones de empleados, escrituras comerciales, legacy ni permisos de edicion.
- 028 aplicada solo en CRM_THINK_V2; lectura real del repositorio confirma ambos
  roles activos, 11 grants por rol, cero empleados asignados, ledger y dos eventos.
  Check-all aprobado: API 5252/113 MySQL omitidas y frontend 602. Evidencia y
  limites en arquitectura API 28; no certifica navegador autenticado ni despliegue.

## Owner: herencia efectiva y denies - 2026-10-23

- Migracion nativa 027 aplicada: Owner hereda roles activos sin asignarlos
  fisicamente a usuarios. Los permisos activos siguen concedidos por defecto.
- Las denegaciones individuales ya no se descartan para Owner. El editor refleja
  su base de permisos activos; el resto de roles conserva sus reglas habituales.
- Banners de etapas requieren rol efectivo y permiso de lectura, en API y React.
  Sin cambios a ordenes ni BD legacy. Evidencia y limites en
  [41 - Owner](apps/api/Arquitectura/41-Owner-Herencia-y-Denegaciones.md).

## Home: resumen agregado de etapas - 2026-10-23

- Un endpoint para contratos y cinco etapas posteriores; rol activo Formalizacion
  antes de consultar y de montar banners. Aprobaciones conserva su permiso.
- Agregacion SQL acotada a dos SELECT, snapshot de lectura, autoridad nativa y
  ultima secuencia de historial. Sin cache de contadores ni dependencias nuevas.
- Preload por numero y relectura al entrar/recuperar foco, con aislamiento de
  usuario/sesion y descarte de respuestas obsoletas. No habilita list/send/revert.
- Cierre anual acumulativo por orden con evento final en el anio: cierres repetidos
  no duplican y una reapertura no borra el hito. No cierra ordenes automaticamente.
- Lectura real y EXPLAIN sin escrituras: 186 por enviar, firma y demas etapas 0
  en esa observacion; indices existentes utilizados. Simulacion y evidencia
  automatizada se detallan por separado en [40 - Home y rendimiento](apps/api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md).

## Remediacion de auditoria F01-F13 - 2026-10-23

- Logging HTTP sin query/fragmentos OIDC; frontera del quinto fallo local y validacion estricta de detail.
- Retirada Microsoft efectiva sin relink por correo, subject/historial preservados y revocacion con actor administrativo. MFA no verificado en vez de inferido por proveedor.
- Perfil/consumidores revalidados por contexto; respuestas y operaciones antiguas no restauran ni usan una sesion nueva. Filtros/hash conservados y ciclo de foco movil, incluido resize.
- Migracion 021 rechaza adopcion silenciosa de tablas previas; sin ejecutar DDL real. Infraestructura de pruebas sin wrappers acumulados ni dependencia de salida animada; concurrencia frontend acotada a dos workers.
- Runbook e inventario actualizados. [Plan y evidencia](apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md#plan-central-f01-f13---2026-10-23): check-all aprobado, API 5194/113 omitidas y frontend 507 por cinco corridas mas cobertura. Persistencia MySQL real y despliegue siguen pendientes; Home-only conservado, sin cambios en BD, dependencias ni .env.

## Dos contadores de Home - 2026-10-22

- Contratos mantiene etiquetas y muestra un preload en lugar de cada numero durante carga/reintento; respuestas correctas conservan sus valores reales.
- Evitadas peticiones duplicadas de efectos y lecturas de banners ocultos al entrar a una bandeja vacia. Permisos/rol y colas vacias se conservan.
- Aprobaciones comparte instantanea de solo lectura entre ambas BD y la exclusion nativa. Paginas cortas evitan una consulta adicional en ambos resumenes.
- Indice compuesto aditivo aplicado solo para elegibilidad de formalizacion legacy; DDL y EXPLAIN documentados en SQL/026 y arquitectura API 38. Sin cambios de datos, estados, correo o ERP.

## Correccion de alcance: solo Home - 2026-10-22

- Retirados bandeja contractual real y botones adelantados; se conserva el contador de Home por rol formalizacion.
- Rutas orders/send/revert desregistradas; escritura legacy local apagada. Estructura y pruebas preparadas se conservan, sin borrar BD ni modificar estados comerciales.

## Contratos por fuente - 2026-10-22

- Resumen contractual real en ambas BD, snapshot de lectura compartido y exclusividad de subtotales; prioridad nativa por ID migrado y visibilidad estricta por rol formalizacion.
- Tablas aditivas de etapas legacy aplicadas sin modificar ordenventa; permiso025 nativo asigna solo registrar envio al rol base. Comandos send/revert con permiso exacto, version, idempotencia y bitacora central en la transaccion del cambio.
- Banner conectado con preload/error y log agregado DEV; sin lista/botones operativos, correos, ERP o movimientos reales de ordenes durante la entrega. Opt-in legacy contractual local no modifica las compuertas productivas de catalogos.

## Activacion local de auditoria - 2026-10-22

- Aplicada y verificada la migracion nativa 024: cinco columnas NO PAD e indices unicos conservados; reejecucion omitida por ledger.
- Activados ENABLE_RECORD_AUDIT y fallback legacy solo en configuracion local ignorada por Git; API local reiniciado, liveness/readiness aprobados y conexiones verificadas.
- Sin cambios de credenciales/grants ni datos comerciales. Escritura legacy sigue bloqueada en desarrollo; operacion controlada pospuesta por el propietario. No se certifica inmutabilidad SQL con la cuenta administrativa compartida.
- 82 pruebas focalizadas aprobadas sin conexion. No despliegue remoto ni commits/push.

## Unreleased - Escritores de auditoria preparados - 2026-10-22

- RecordAuditService y puente para los cambios existentes de siete catalogos, usuarios y roles; lifecycle interno de ordenes agrega evidencia central en la misma transaccion, sin borrar sus historiales especializados. Snapshots partial, actores y contexto capturados del servidor, validacion JSON acotada e idempotencia por registro.
- ENABLE_RECORD_AUDIT=false por defecto; arranque/escritura activa exigen ledger nativo 023/024. No se ejecutan migraciones, fixtures ni conexiones de validacion MySQL y no se edita .env. No hay endpoints nuevos de ordenes/restore ni captura automatica del API viejo/ERP.
- Guard y AuditReadService comparten politica: un deny de role.assign prevalece incluso sobre Owner. Permisos existentes y compuertas legacy conservados.

## Unreleased - Base de bitacora comercial - 2026-10-22

- Revision independiente con tres subagentes: CLI de migraciones endurecido contra argumentos mal escritos; pruebas adversariales de preflight, ejecucion diferida y fallos parciales, sin BD. El fallo de cierre ya no oculta el error original de migracion. Correccion 024 de collation de identidad preparada, no aplicada. Aprobacion limitada a esquema inactivo, no a captura/restauracion operativas.
- Migracion nativa aditiva 023: audit_record y audit_record_event para identificar registros de ambas fuentes sin FK comercial, conservar antes/despues, actor, versiones, motivo e idempotencia. Aplicada solo en CRM_THINK_V2, sin datos de prueba ni cambios productivos.
- Contrato y diccionario en documento API 38. No hay captura automatica de todos los escritores, restauracion ejecutable ni conexion del banner Contratos por esta entrega.

## Unreleased - Continuidad de auditoria - 2026-10-22

- Fastify fijado en 5.12.6 tanto directo como dentro del adapter Nest; override acotado de ip-address 10.7.4 en rate-limit. Sin actualizacion masiva de dependencias.
- RequirePermission agrega comprobacion declarativa antes de handlers protegidos; se conservan validaciones condicionales, de pertenencia, recurso y transaccion en servicios. Evidencia y limites en el informe de reauditoria.
- Regla confirmada de Formalizacion: tres aprobaciones completas inician Contratos pendientes / Por enviar; si la orden existe en nativo se gestiona solo alli, de lo contrario en legacy. Regla documentada, sin escrituras ni flujo operativo implementado por esta entrega.
- Cache entre peticiones queda como candidata a medir, no defecto automatico. CI remoto, MySQL aislado y transiciones posteriores mantienen sus prerequisitos.

## Unreleased - Consolidacion verificada - 2026-10-22

- Compuertas independientes de lectura/escritura legacy; escritura bloqueada fuera de produccion o con destino distinto de `crmdatabase-api`.
- Autenticacion global default-deny e inventario de rutas, perfil reutilizado solo dentro de la peticion y limites de lectura por usuario/IP. La clasificacion de permiso no sustituye controles concretos de servicio.
- Recuperacion de clave deshabilitada con 503 uniforme hasta configurar correo; salud live/ready y errores 5xx sanitizados.
- Historial de navegador, rutas diferidas y recuperacion de errores por ruta; retiradas las esperas artificiales y los ejemplos de seguimiento del Home.
- Ordenes: persistencia normalizada, referencias multiproveedor e historial; contador de aprobaciones real sujeto a permiso. Sin API de aprobacion/cambio de etapa ni despliegue legacy acreditado.
- CI, cobertura y auditoria de dependencias preparados; corte `f2dc4f1` verificado mediante clon limpio. MySQL completo y CI remoto pendientes.
- Documentacion reconciliada con [resultados y limites](apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md). No anuncia despliegue ni nueva corrida de pruebas.

## Unreleased - Continuidad de sesion local y cambios de acceso - 2026-10-13

- Los cambios de acceso invalidan la autorizacion anterior mediante la version
  de permisos, sin cerrar una identidad todavia activa. El refresh valida los
  estados vigentes y la siguiente lectura obtiene los permisos actuales.
- Se conservan el vencimiento absoluto, la rotacion y las revocaciones por
  logout, bloqueo, desactivacion o reutilizacion de tokens. No se rehabilitan
  sesiones ya revocadas bajo la regla anterior.
- Regresiones de login local, recarga, errores de red y renovacion de permisos;
  pruebas HTTP con MySQL y cookie jar aislado, usando rollback.
- Solo un refresh rechazado con 401 produce anonimato. Errores de red, servidor
  o CSRF conservan la URL y muestran el problema de acceso sin forzar login ni
  repetir automaticamente el POST de rotacion.

## Unreleased - Avisos de acceso dentro del layout - 2026-10-13

- Una sesion valida conserva cabecera y menu ante una vista sin permiso o una
  URL inexistente; el aviso aparece exclusivamente dentro del contenido.
- El aviso no cierra sesion ni solicita iniciar sesion nuevamente. El retorno
  utiliza una ruta permitida del perfil, sin montar la pagina protegida.
- La autorizacion de rutas reutiliza el menu filtrado por permisos efectivos;
  las validaciones del API y el tratamiento de sesiones expiradas se conservan.
- Sin modificaciones de la linea grafica del menu, permisos persistidos o DB.

## Unreleased - Acciones de catalogos por permiso - 2026-10-13

- Cabecera, tabla y detalle ocultan las acciones sin permiso efectivo scoped;
  lectura no concede alta, edicion o cambio de estado. Reactivar usa update;
  inactivar usa inactivate. Revalidacion al abrir/enviar y ante foco.
- Formularios vinculados a su modulo/catalogo; se descartan al cambiar de
  contexto. Volver a paginas cacheadas no consulta perfil ni listado nuevamente.
- API exige grant exacto incluso para Owner, conservando solo su exencion de
  membresia. Deny prevalece; rutas compartidas y dedicadas cubiertas por HTTP.
- Sin cambios de estilos/menu, grants persistidos, migraciones o datos legacy.

## Unreleased - Autorizacion de Usuarios y Roles - 2026-10-13

- Controles de Usuarios y Roles dependen de permisos efectivos, sin conceder
  acciones por nombre de rol ni datos de demostracion ante errores de carga.
- Alta con roles requiere `user.create` y `role.assign`; editar datos requiere
  `user.update` y cambiar roles/modulos requiere tambien `role.assign`.
- Activar exige `user.activate`; bloquear/inactivar exige `user.deactivate`.
  Se preservan las restricciones de autoedicion y proteccion de Owner.
- Regresiones de interfaz, servicios y HTTP con servicios reales verifican
  rechazos y ausencia de escrituras no autorizadas. Evidencia y limites en API 36.

## Unreleased - Clave inicial privilegiada - 2026-10-13

- Alta de usuario admite clave inicial manual opcional con privilegio sensible
  `user.assign_password` ademas de `user.create`, solo para acceso local.
- Argon2id y activacion local transaccional; password/hash no se devuelven ni
  entran al snapshot auditable. Sin clave se conserva el flujo pendiente.
- Migracion 018 registra el permiso, lo concede inicialmente solo a Owner y
  versiona sus perfiles para revalidacion. No modifica claves existentes ni
  implementa claves temporales/cambio obligatorio.

## Unreleased - Formalizacion Inicio - 2026-10-13

- Rol `formalizacion` y permiso exclusivo `formalizacion.home.read`, agrupado
  bajo Formalizacion / Inicio. Migracion puntual 017 transaccional y auditable,
  sin altas de usuarios, cambios legacy ni grants de secciones operativas.
- Alta de perfil con modulo Formalizacion por defecto si no se especifica area;
  Inicio separado de permisos de Expedientes/Resumen y sin datos comerciales.
- Regresiones de navegacion, alta, catalogo de permisos, denegacion de inventario
  y catalogos; MySQL opt-in rollback-only para idempotencia, grants y auditoria.
- Requisitos de habilitacion futura documentados en API 36 y frontend 27. No
  habilita contratos, expedientes, catalogos, integraciones o despliegue.

## Unreleased - Consolidacion 2026-10-13

### Implementado

- Campanas, Clases, Ubicaciones, Subsidiarias y Corredores adoptan el patron dedicado de Proyectos: carpeta de dominio, referencias multiproveedor, lazy promotion y sincronizacion legacy autorizada. Corredores excluye columnas obsoletas.
- Catalogos pasan a paginas acotadas con cache local, sin Cargar mas; Expedientes usa criterios previos, cursor, facetas del alcance completo y detalle bajo demanda.
- Expedientes conserva 27 valores de negocio y FK al proyecto CRM; comparacion visual por campo, semaforo/flechas y enlace seguro a Planos. Lectura solamente, sin importacion masiva ni escrituras de inventario.
- Roles y seguridad usa selectores modulo/seccion y pestanas de catalogo, tanto por rol como por empleado.
- Auditoria incorpora snapshots seguros antes/despues, diferencias, actor/roles historicos, contexto y registro, consulta paginada y textos comprensibles.
- Cliente API deja de repetir conflictos 409 de negocio; conserva un reintento para sesion de permisos obsoleta, protecciones Owner y CSRF. Errores de red no repiten mutaciones y advierten resultado incierto. Notification usa title.

### Documentacion y limites

- Registro integral API 36, contrato de auditoria 37 y guia frontend 27 enlazan solicitudes, codigo, pruebas, reglas, decisiones y pendientes. README e indices actualizados; entradas anteriores permanecen como evidencia historica.
- Ultima evidencia anterior a esta consolidacion: frontend check con 257 pruebas y 13 pruebas API de acceso aprobadas. Check global bloqueado por formato preexistente en unit-files-search.spec.ts; reset de conexion no reproducido. No son resultados de una ejecucion documental nueva.
- Pendientes: aceptacion manual, reconciliacion externa, relaciones ambiguas e importacion de inventario, optimizacion medida de indices, conectores ERP y despliegue. No se hicieron cambios productivos por documentar.

## Unreleased - 2026-10-09

### Added

- Guarded, checksum-pinned recovery of Roberto's original Owner identity without other users, business seeds or session/token restoration; owner-only seed policy documented.

- Administration catalog API, typed Kysely persistence, scoped permissions and atomic security audit for seven catalogs.
- Incremental catalog schema and Administration Owner-linkage repair migrations, preserving prior history.
- Independent project aggregate and provider-reference tables, with targeted empty-schema migration and rollback-only MySQL tests.
- Catalog detail Drawer matching users, separate provider sections and explicit unassigned values.
- Opt-in rollback-only MySQL regressions for catalog persistence, access replacement and Administration repair.

### Changed

- Projects legacy records are editable with lazy native promotion and atomic same-server synchronization, gated together with reads by one global legacy switch. Creates retain generated legacy IDs; native-only edits do not create legacy counterparts. Existing permissions/audit remain mandatory and no delete route is introduced.

- Projects now owns its Nest controller/service/repository and fallback in a dedicated feature folder. Legacy Projects and Campaigns own separate readers and mappers; shared pools, permission policy and existing HTTP contracts are preserved without schema/data changes.

- Legacy reads now reuse DB credentials in an isolated read-only transaction pool; Projects append unmigrated legacy rows with native precedence and native-first pagination. The optional adapter remains removable and local fallback is explicitly enabled.

- Removed the unrestricted legacy administrator importer. Active security configuration remains separate from business catalog seeds.

- Projects persistence now uses dedicated tables; shared tables reject project records and remain for the other six domains. Retired bulk importer and obsolete importer tests removed. API contracts and audit transactions preserved.

- Catalog listing supports offset and authoritative filtered totals. Shared screens reuse users SearchPanes, isolated saved state and incremental loading.
- Responsive navigation, authorization-aware routes, user/role management and audit views are included in the Administration delivery.

### Fixed

- Reference editing retains unchanged identities, archives/removes/restores references without changing ownership and returns controlled uniqueness conflicts.
- Empty optional Odoo IDs no longer block unrelated edits; non-empty IDs still require an active provider.
- Access replacement explicitly revokes sessions and refresh tokens with atomic audit rollback.
- SearchPanes initialize with loaded data and escaped textual labels instead of React DOM objects.

### Verification and Limits

- Recorded baseline: API 227 passing tests, frontend 120, seven separate MySQL catalog regressions; formatting, lint, typecheck and builds passed. See document 34 for coverage evidence.
- Filters apply to loaded rows; offset pagination is not a concurrent-write snapshot. Uniqueness is per catalog/provider/identifier, including archived ownership, not global across catalogs.
- Full ETL is pending subsidiary 63 naming, broker identifier selection and Files domain mapping. Negative campaign identifiers must be preserved; the project mapper is not a universal importer.
- No deployment, automatic production migration or complete Owner acceptance is implied.

Notas realtime, 2026-10-28: [contrato, configuración y evidencia](apps/api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md). Transporte Socket.IO protegido, persistencia nativa046 y actualización de campana/conversación; sin copia legacy ni despliegue. Redis multiinstancia y aceptación visual real pendientes.
