# 00 - Ley de Producto CRM TINK y P0

## Corte documental vigente - 2026-10-29

Las ampliaciones de notas solicitadas por el propietario estan implementadas en
el alcance de [66](66-Notas-Enterprise-Seguimiento.md): colaboracion privada por
invitacion, tiempo real, responsable opcional, vencimiento, recordatorios
personales, busqueda, historial y ubicaciones adicionales. Autor, participantes,
acceso al registro vinculado y ubicaciones visibles son controles independientes.
La identidad de una orden incluye origen e ID; el modulo o URL no crea otra nota.
La navegacion a una ficha conserva su autorizacion propia.

La copia compatible legacy sigue pendiente; no importar datos comerciales ni
activar adjuntos, correo externo o integraciones por inferencia documental.
El QA del 29 esta en [67](67-Plan-QA-Regresiones-20261029.md): distingue checks
aprobados, casos omitidos y aceptacion pendiente de Redis multinodo, latencia y
dos cuentas reales. Esta actualizacion no ejecuta migraciones ni operaciones.
Los cortes anteriores conservan su fecha y alcance historico.

## Gestión de Formalización por ambos roles - 2026-10-28

El propietario confirma que Formalización y Jefe de Formalizaciones gestionan
todas las órdenes del módulo con el permiso de la acción. Se elimina la
restricción por vendedor para esas operaciones y se mantienen denegaciones,
versiones, requisitos de negocio y auditoría. Aprobación y movimientos
excepcionales conservan permisos separados de supervisión. Contrato y límites:
[65](65-Formalizacion-Correcciones-Roles-y-Recuperacion.md).

## Aclaración autorizada: detalle de orden - 2026-10-28

El permiso independiente «Ver orden de venta» basta para abrir una ficha,
incluida la URL directa, sin permisos de banners. Los banners conservan el
control de listas y contadores; las escrituras mantienen sus permisos y alcances.
Contrato: [64](64-Formalizacion-Permiso-Ver-Orden.md).

Notas etapas1–4 implementadas2026-10-27: esquema039/040/044, API, interfaz personal y colaboración por invitación, respuestas/menciones y campana interna. Autorización vigente, autoría exclusiva, recibos y auditoría transaccional. Sin imports, correo ni escritura legacy. [Contrato60](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md); [secuencia56](56-Plan-Notas-Colaborativas-y-Convivencia-Legacy.md). La copia compatible y aceptación integral siguen en etapas5/6.

## Ampliacion autorizada: aprobacion de Formalizacion - 2026-10-28

El propietario autoriza conectar Aprobar Formalizacion con NetSuite, marcando solo custbodyid_firma_rc antes de guardar la aprobacion local en la fuente autoritativa (nativa primero, legacy si no existe). Permiso independiente, denegaciones, version y bitacora transaccional obligatorios. Autorizo tambien que la confirmacion del Sandbox actualmente configurado actualice la orden legacy productiva; la bitacora identifica ese entorno. No se ejecutan aprobaciones reales como pruebas ni se habilita un escritor NetSuite productivo por inferencia. Contrato y limites: [63](63-Aprobacion-Formalizacion-NetSuite.md).

## Lectura vigente y retiro autorizado - 2026-10-27

La revision [55](55-Revision-Documental-Integral-20261027.md) y el corte49
reconcilian implementacion y documentos sin ampliar por si mismos el producto.
El retiro solicitado de Eventos y citas elimina menu y permiso
`mercadeo.appointments.read` (038); mantiene Calendario y metricas.
Captacion conectada y transiciones/seguimiento de Formalizacion son ampliaciones
posteriores a los bloques historicos de maqueta o solo Home. Se aplican unicamente
los contratos y limites descritos en [53](53-Captacion-Leads-Reporte-Federado.md)
y [52](52-Etapas-Responsables-y-Tiempos.md). Nunca importar Leads legacy a nativo.
Esta revision documental no autoriza ejecutar migraciones o acciones comerciales.


## Ampliacion autorizada: Captacion conectada - 2026-10-26

El propietario aprueba conectar la vista de Captacion a ambas BD mediante
`GET /marketing/leads/report`. Esta ampliacion sustituye la restriccion de solo
maqueta para esa lectura: nativa primero y adaptador legacy opcional, un JSON
agregado protegido por `mercadeo.leads.read`, sin importar/copiar datos, crear
catalogos o migraciones. Conserva el alcance/deny existente y no cambia Inicio.
Las secciones UX anteriores son historicas. Contrato, fuentes y verificacion:
[53 - Reporte de Captacion](53-Captacion-Leads-Reporte-Federado.md).

## Ampliacion autorizada: trayectoria de Formalizacion - 2026-10-26

Se autoriza el mismo historial de etapas, actor, responsable y tiempos en
ambas fuentes, con autoridad nativa primero y auditoria central nativa.
Se registra el modulo existente de envio/reversion y la consulta de tiempos.
Ampliacion posterior confirmada: selector de cualquiera de las siete etapas
operativas cuando existen tres aprobaciones; retrocesos con motivo, permiso
independiente y auditoria. No habilitar escritores externos ni mover ordenes
reales para pruebas. Detalle vigente y configuracion operativa:
[52 - Etapas y tiempos](52-Etapas-Responsables-y-Tiempos.md).

## Captacion de leads: excepcion exclusivamente UX - 2026-10-26

Se autoriza una maqueta interactiva frontend en la ruta de Captacion de leads,
con muestra ficticia explicita y filtros/desgloses locales. Sin consultas a API
comercial o BD, migraciones, imports ni comandos. Mantener identidad y nombres
canonicos CRM, sin dependencia estructural de la BD antigua. No cambia el
alcance operativo de Leads ni el resumen real de Inicio. Detalle en la
[ley frontend](../../frontend/Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md).


## Corte consolidado vigente - 2026-10-23

[49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md) consolida las
ampliaciones autorizadas y distingue codigo, esquema, datos, historicos y pendientes.
Los bloques siguientes conservan cronologia: maqueta exclusiva de Mercadeo fue
sustituida SOLO para su resumen de leads/citas por las autorizaciones 46/48.
Esto no habilita calendario, campana, Outlook, CRUD general de Leads ni imports
comerciales. Las excepciones acotadas de perfiles/Ventas y esquema 034 permanecen.

## Mercadeo: Inicio real autorizado - 2026-10-23

El resumen `GET /marketing/home/summary` consulta primero CRM_THINK_V2 y despues
legacy opcional, en solo lectura, y publica un JSON canonico protegido por
`mercadeo.home.read` y sus alcances. Incluye captacion por fechas de creacion,
conversion de leads unicos con cita y volumen de citas por fecha de evento.
Cita se determina por el tipo del evento enlazado al lead; responsable/proyecto
se toman del lead, sin importar quien creo el evento. Completada no prueba
asistencia. No importar datos, conceder permisos nuevos ni activar agenda/Graph.

Esta ampliacion sustituye la maqueta y el corte sin citas SOLO para Inicio.
El calendario 034 conserva tablas vacias sin gestor operativo; otras opciones de
menu no implican vistas comerciales terminadas. Contratos: [46](46-Mercadeo-Resumen-Leads.md)
y [48](48-Mercadeo-Metricas-Citas.md). Estado y matriz de cobertura: [49](49-Estado-Actual-y-Cierre-Documental.md).

## Calendario: estructura nativa autorizada - 2026-10-23

El propietario autoriza crear y aplicar 034_calendar_domain solo en CRM_THINK_V2:
eventos por modulo original, participantes compartidos, referencias dinamicas,
notificaciones por usuario y preparacion de sincronizacion externa. Solo tablas
vacias e indices/FK/triggers, sin importar calendars, modificar legacy, crear
tipos ficticios, otorgar permisos, activar API/Graph/campana o enviar mensajes.
Los IDs publicos resuelven PK internas propias del CRM, nunca IDs ERP.
Reglas y limites en [47 - Calendario](47-Calendario-Compartido-Esquema.md).

## Usuarios por correo: excepcion autorizada - 2026-10-23

Crear un usuario por correo unico de `crmdatabase-api.admins` en `sec_user`:
nombre/correo, sin credenciales, roles, modulos o referencias ERP; existentes
intactos, activos anteriores pendientes de habilitacion e inactivos inactivos.
Auditoria nativa atomica y origen solo lectura. No autoriza importar Leads ni
historiales. Detalle en [45 - Usuarios](45-Usuarios-Por-Correo.md).

Ampliacion posterior: crear rol `ventas`, asociado al modulo Ventas sin permisos,
y asignarlo exclusivamente a los 43 perfiles creados en ese lote. Mantener sus
estados y metodos de acceso, sin asignar membresias individuales de modulo.

## Bitacora de Leads: consulta entre origenes sin importacion - 2026-10-23

El propietario aclara que la API debe consultar cada BD y adaptar las respuestas
a un JSON comun, sin copiar datos viejos a CRM_THINK_V2. El inicio de una copia
historica fue una interpretacion incorrecta del agente; fue detenido y sus datos
eliminados. No constituye una autorizacion de migracion de datos. Se conserva
la estructura nativa para sus operaciones propias. Estado y evidencia en
[44 - Bitacora](44-Bitacora-Legacy-y-Timeline.md).

## Leads: esquema nativo autorizado - 2026-10-23

El propietario autoriza construir y ejecutar exclusivamente la migracion nativa
`202610230031_leads_domain`: contacto, lead, referencias externas, catalogos de
etapas/origen/interes/motivos e historial repetible de etapas y perdidas.
Responsable por FK a `sec_user`; referencias externas mediante sistema e ID,
nunca por numero ERP suelto. Comentarios por columna y creacion/modificacion UTC.
Solo se inicializan las siete etapas aprobadas. No importar datos comerciales,
motivos legacy ni usuarios; no cambiar legacy, permisos, API ni frontend.
Detalle, limites y evidencia en [43 - Leads](43-Leads-Esquema-Nativo.md).
Esta ampliacion sustituye la prohibicion anterior de esquema de Leads solo
para este corte; no habilita comandos, lectores comerciales ni integraciones.

## Antecedente Mercadeo: maqueta de Inicio autorizada - 2026-10-23

El propietario solicita una propuesta visual con banners de leads/citas,
filtros y agrupaciones por proyecto, campana, anuncio y vendedor, siguiendo
Formalizacion. Se autoriza solo el frontend con muestra ficticia identificada
y estado local. Sin consultas comerciales, endpoints, modelos operativos,
permisos nuevos ni escrituras. No habilita Leads ni reportes reales. Detalle y
verificacion en continuidad frontend 25; las compuertas de negocio se conservan.

## Jerarquia modular autorizada - 2026-10-23

Correccion posterior: Owner administra modulos y permisos de Jefe General en
Roles y seguridad, Por rol. Plantilla persistida editable (migracion 030),
intersectada con los modulos asignados de cada empleado; no regenerar permisos
retirados. Owner sigue protegido/global y los denies prevalecen. No habilita
Administracion a General ni modifica usuarios, legacy o datos comerciales.

Jefe General obtiene permisos operativos solo en modulos seleccionados por el
administrador. Jefes de area quedan bajo su modulo; Owner conserva herencia
global y el deny individual prevalece. Reutilizar asignaciones existentes,
bitacora y versionado; migracion nativa aditiva 029 autorizada, sin legacy ni
datos comerciales. Esta regla sustituye las limitaciones anteriores de la
jerarquia; especificacion y evidencia: [42 - Jefaturas](42-Jefaturas-Modulos-y-Permisos.md).

## Mercadeo: roles y lectura por seccion - 2026-10-23

El propietario solicita crear los roles `mercadeo` (Mercadeo) y `jefe_mercadeo`
(Jefe de Mercadeo), como excepcion expresa a los ejemplos anteriores que evitaban
roles por area. Ambos comienzan con el mismo acceso de lectura: Inicio, Captacion
de leads, Eventos y citas, Calendario y los siete catalogos del contexto Mercadeo.
La migracion nativa dirigida `202610230028_marketing_roles` crea cuatro permisos
de seccion y reutiliza los siete permisos de lectura de catalogos existentes.
No asigna usuarios ni modulos, no concede escritura/aprobacion y no toca legacy.
Owner conserva su herencia efectiva y las denegaciones individuales prevalecen.
Solo Inicio y Catalogos conservan sus rutas existentes; las otras opciones siguen
visuales, sin vistas, consultas de leads/citas, exportaciones ni calendario operativo.
Detalle y evidencia: [28 - Roles y permisos](28-Matriz-Roles-Permisos-Areas-P0-S1.md).

## Owner: herencia por rol y deny individual - 2026-10-23

El propietario autoriza persistir mediante migracion la herencia de todos los
roles activos para Owner y confirma que los denies individuales prevalecen.
Se resuelven roles efectivos, no asignaciones fisicas masivas a cada usuario.
Los permisos activos Owner son base automatica; nunca un bypass de deny, recurso,
sesion o reglas de negocio. El resto mantiene asignaciones y permisos normales.
Lectura de banners de etapas: rol efectivo Formalizacion mas permiso efectivo
de cada categoría, según [63 - Lectura por banner](63-Formalizacion-Lectura-Por-Banner.md).
Desde el 2026-10-28 el permiso agregado `formalizacion.home.stages.read` queda
sustituido por seis permisos; la lectura incluye todos los vendedores dentro de
las categorías autorizadas. Los permisos de escritura conservan su alcance.
Se autoriza solo esta migracion nativa, sin modificar legacy ni datos comerciales.
Este apartado sustituye la exclusion anterior de Owner para la lectura, no
habilita bandejas/acciones. Plan y evidencia: [41 - Owner](41-Owner-Herencia-y-Denegaciones.md).

## Ampliacion autorizada: resumen agregado de etapas en Home - 2026-10-23

El propietario solicita conectar los cinco indicadores restantes y contratos a
un resumen real de ambas fuentes, sin ampliar el flujo operativo. Se implementa
un lector agregado `GET /formalization/home/summary`, exclusivo del rol activo
`formalizacion`; aprobaciones conserva su endpoint y permiso independiente.
Nativo prevalece sobre legacy por identidad, sin duplicados ni fallback por
inactividad de una fila nativa. Etapas posteriores se leen del ultimo evento
persistido, no de flags ERP ni escenarios locales.

No habilita listados, envio/reversion, transiciones posteriores, correos ni
mutaciones. No autoriza fixtures, DDL, cambios de credenciales ni carga de pruebas
en las BD compartidas. Conteos sin cache y pruebas sinteticas separadas de la
validacion MySQL real. El cierre anual es acumulativo por orden: un evento final
confirmado en ese anio cuenta una vez, aunque despues se reabra. No inventar
fechas al importar ni cerrar automaticamente; el usuario registra la finalizacion.
Plan y evidencia de este corte:
[40 - Home y rendimiento](40-Formalizacion-Home-Resumen-y-Rendimiento.md).

Este apartado prevalece para el nuevo alcance de lectura; las decisiones y
mediciones historicas siguientes conservan la fecha y limites de su corte.

## Correccion de alcance: solo Home habilitado - 2026-10-22

Instruccion mas reciente del propietario: retirar la bandeja real y los botones que se adelantaron. Se conserva unicamente el banner contractual conectado en Home, con rol formalizacion activo. Las vistas de ordenes vuelven a su estado vacio, sin consultar listados ni ofrecer cambios de estado. GET contracts/orders y POST contracts/send/revert se desregistran del AppModule; sus clases/pruebas pueden conservarse como trabajo preparado, no funcionalidad habilitada. ENABLE_LEGACY_WRITES=false de nuevo en .env local. No se borran tablas, permisos ni evidencia de las preparaciones ya aplicadas; no se cambia ningun estado comercial para revertir UI. Este apartado prevalece sobre el plan de ejecucion ampliada que sigue.

## Contratos: ejecucion progresiva autorizada - 2026-10-22

El propietario confirma implementar ahora resumen, etapas y comandos de envio/reversion. Toda orden activa, no caida y con tres aprobaciones completas entra por defecto en contract_pending_send si no existe una etapa CRM posterior; los flags historicos de firma no se usan para inventar el envio nuevo. Registrar envio pasa a contract_pending_signature sin correo ni ERP. Regla confirmada 2026-10-26: banco y etapas posteriores requieren firma observada (contrado_frima_ov=1 o contract_signed_sales_order='yes') y haber registrado el envio; no se puede saltar desde Por enviar. Esta entrega no modifica la firma ni NetSuite. Reversion exige motivo y permiso separado. Lectura exige rol formalizacion activo, envio exige formalizacion.contracts.send heredado por ese rol con deny directo prevaleciente; reversion formalizacion.contracts.revert no se concede automaticamente.

La etapa comercial se persiste solo en la fuente autoritativa: orden nativa si existe (incluso para decidir que una inactiva/borrada no puede recurrir a legacy), legacy si no. Crear las dos tablas aditivas legacy preparadas, sin alterar ordenventa. La evidencia central vive siempre en CRM_THINK_V2 y comparte transaccion/conexion con el cambio. Migradores futuros deben bloquear el padre legacy antes de promover una orden; no certificar concurrencia contra un migrador externo que ignore ese protocolo. No se mueven ordenes reales durante la entrega ni se ejecutan fixtures compartidos. Esta autorizacion sustituye el aplazamiento de implementacion anterior para este corte, no habilita otras etapas, Leads o automatizaciones.

Solo para los nuevos comandos de etapas contractuales, el opt-in ENABLE_LEGACY_WRITES=true y esquema exacto permite escritura aditiva desde el API local en desarrollo, con rol/permiso vivo y bitacora central obligatorios. Las compuertas production de los seis escritores de catalogos no se cambian. El pool legacy separado sigue READ ONLY; las etapas usan la transaccion nativa cualificada. No se otorgan privilegios adicionales a la cuenta compartida.

## Activacion local de bitacora y verificacion 024 - 2026-10-22

El propietario autoriza aplicar 024, validar privilegios y activar la bitacora con las credenciales actuales, manteniendo las operaciones normales del API. Ante la propuesta de una cuenta dedicada pide conservar capacidad CRUD; no se crean usuarios, no se cambian grants y no se retira acceso a la cuenta compartida. Esto no certifica inmutabilidad SQL: la cuenta actual conserva privilegios administrativos, incluidos UPDATE/DELETE.

024 aplicada exclusivamente en CRM_THINK_V2 y verificada por ledger, cinco columnas NO PAD e indices unicos completos. .env local (ignorado por Git) cambia ENABLE_RECORD_AUDIT=true y ENABLE_LEGACY_FALLBACK=true. Reiniciado exclusivamente el API local; health/live y health/ready aprobados. Conexion nativa y legacy comprobadas, esta ultima en READ ONLY. No se cambia NODE_ENV ni se eluden las compuertas productivas: escritura legacy sigue desactivada en desarrollo; no equivale a habilitar mutaciones de ordenes exclusivamente legacy.

El propietario pospone la operacion controlada: elegira despues una orden para moverla de estado. No se modifica ningun dato comercial ni se inserta evidencia ficticia en este avance. Detalle y limites en [38 - Activacion local](38-Ordenes-Venta-Estados-Auditoria.md#activacion-local-y-migracion-024-aplicada---2026-10-22). Sustituye las restricciones anteriores de no aplicar 024/no editar .env solo para esta activacion expresamente autorizada.

## Conexion de escritores autorizada, sin ejecutar BD - 2026-10-22

El propietario confirma implementar los escritores y probarlos solo con unidades/dobles; no crear otra instancia MySQL ni ejecutar fixtures, concurrencia real, migraciones o escrituras de validacion en las BD compartidas. Se conserva `.env` sin cambios. Las pruebas MySQL reales quedan pendientes, no aprobadas ni sustituidas por mocks.

Se conecta en codigo la bitacora central mediante `ENABLE_RECORD_AUDIT=false` por defecto: puente para los cambios administrativos existentes de siete catalogos, usuarios y roles; e historial interno de estados/aprobaciones de ordenes nativas. No se activa contra la BD actual. Habilitarla requiere esquema nativo 023/024 registrado; el servicio rechaza arranque/escritura sin ese prerequisito y no ejecuta DDL. Se mantienen las compuertas de escritura legacy y los permisos actuales; no se crean grants ni endpoints comerciales. El servicio de lectura de auditoria ahora comparte la politica del guard: deny de role.assign prevalece sobre Owner activo.

Los snapshots conectados son parciales y seguros, no imagenes integrales restaurables. Se conserva auditoria anterior y transaccion del cambio, sin enviar correo/ERP ni crear una orden nativa para auditar legacy. Alcance y limites actuales: [38 - Escritores y activacion](38-Ordenes-Venta-Estados-Auditoria.md#escritores-conectados-activacion-pendiente---2026-10-22). No habilita Leads, banner Contratos, ordenes exclusivamente legacy ni restauracion generica.

## Bitacora comercial central autorizada - 2026-10-22

El propietario amplia el corte anterior documental: crear la base de auditoria generica para registros nativos y legacy, sin habilitar todavia Contratos pendientes. Migracion aditiva `202610220023_record_audit` aplicada solo en `CRM_THINK_V2`: `audit_record` y `audit_record_event`. No altera tablas comerciales, permisos ni produccion. Diccionario, evidencia y limites en [38 - Ordenes/estados/auditoria](38-Ordenes-Venta-Estados-Auditoria.md#bitacora-central-de-registros---2026-10-22).

La autoridad de escritura comercial no cambia: nativo si existe, legacy si no. La nueva evidencia comercial se centralizara en nativo incluso para registros legacy, mediante referencia logica sin FK a la orden. Crear el expediente de auditoria no migra la orden ni modifica la seleccion de autoridad. Este corte crea estructura, no captura automatica, endpoints de restauracion ni integracion de todos los escritores. El historial existente se conserva.

## Contratos pendientes: decision documental y siguiente corte - 2026-10-22

El propietario confirma dos estados distintos: Por enviar (tres aprobaciones completas y envio no registrado) y Pendiente de firma (envio registrado, firma pendiente). Registrar envio solo cambia el estado CRM con confirmacion; no envia correos ni ejecuta operaciones ERP. Revertir a Por enviar exige motivo/nota y agrega un evento sin borrar historia. El rol Formalizacion heredara el permiso de registrar envio; una denegacion directa por persona prevalece. La reversion tendra permiso separado, sin inferir su asignacion por defecto.

El siguiente corte sera conectar el banner Contratos pendientes con un resumen API canonico de `CRM_THINK_V2` y `crmdatabase-api`, nativo primero y sin duplicados. Su visibilidad exige al menos el rol activo `formalizacion`; pertenencia al modulo o rol Jefe sin el rol base no bastan. Autorizar antes de consultar en backend y antes de montar el consumidor frontend. Esto no cambia el permiso independiente del banner Pendientes de aprobacion.

Instruccion de ese corte documental, anterior a la ampliacion de bitacora: guardar las reglas, no implementar todavia consultas, endpoints, mutaciones, grants, migraciones ni conexiones para Contratos. Detalle, JSON ilustrativo y criterios pendientes: [38 - Ordenes, estados y auditoria](38-Ordenes-Venta-Estados-Auditoria.md). Las aprobaciones completas no bastan para contar ordenes ya enviadas/firmadas en Por enviar; los dos subtotales deben ser excluyentes.

## Consolidacion de alcance aprobado - 2026-10-22

Este apartado reconcilia las ampliaciones solicitadas despues del corte inicial de identidad; no cambia retroactivamente versiones, firmas ni fechas anteriores. Las restricciones antiguas de runtime exclusivamente identidad se leen con estas excepciones: Administracion/catalogos, expedientes de unidades de lectura, persistencia interna de ordenes e historial y contador de aprobaciones de Formalizacion. No habilita Leads ni el flujo contractual completo.

El banner y `GET /formalization/approvals/summary` estan implementados con `formalizacion.home.approvals.read`; no ejecutan consulta sin permiso ni autorizan aprobar/devolver. Las mutaciones de etapas/aprobaciones y reconciliacion automatica siguen pendientes. Los otros seis indicadores son provisionales, no mediciones reales.

`CRM_THINK_V2` es desarrollo con datos preservables; `crmdatabase-api` es produccion. El lector legacy usa `ENABLE_LEGACY_FALLBACK`; los seis escritores de catalogos requieren ademas `ENABLE_LEGACY_WRITES`, `NODE_ENV=production` y destino legacy exacto. Las credenciales compartidas no estan certificadas como solo SELECT. No ejecutar fixtures, DDL ni scripts DBA para validar documentacion.

La [remediacion](Reauditoria-54-Plan-y-Resultados.md), [operacion](Operacion-Despliegue-Rollback.md) y [CI/MySQL](CI-MySQL-Pruebas.md) registran evidencia y limites actuales. Los apartados fechados siguientes conservan decisiones/evidencia de su fecha, no certificacion del runtime actual.

## Inicio por modulo y permiso de banner - 2026-10-20

El propietario sustituye el permiso de entrada formalizacion.home.read por
acceso a Inicio mediante pertenencia activa al modulo Formalizacion. La migracion
020 conserva el permiso anterior inactivo y sus relaciones historicas, sin borrar
historial ni copiar grants. Registra formalizacion.home.approvals.read, visible
en Pantalla de inicio como Banner pendiente de aprobación de Formalización.
Solo representa lectura del banner, no aprobar, devolver ni modificar checks.
No se conceden permisos automaticamente a Formalizacion ni a Jefe de
Formalizaciones. Las maquetas existentes de gestion, calendario y resumen
conservan su acceso local dentro del modulo; no autorizan API de negocio.
El banner y su contador ya estan implementados; las acciones reales de
aprobacion continuan pendientes de definicion e implementacion.

## Rol complementario Jefe de Formalizaciones - 2026-10-20

El propietario autoriza exclusivamente crear el rol activo `jefe_formalizaciones`,
nombre Jefe de Formalizaciones, mediante la migracion incremental 019 en
CRM_THINK_V2. No otorga permisos, asigna usuarios, crea modulos ni altera sesiones.
Es complementario a `formalizacion`, no una copia ni una herencia automatica.
Un jefe con funciones operativas requerira ambos roles, con asignacion explicita.
Las aprobaciones, supervision, alcance de cartera y reasignacion quedan pendientes
de definicion y autorizacion; el nombre del rol no habilita ninguna accion.
La creacion y su auditoria son atomicas; repetirla no duplica el rol y una
configuracion inactiva no se reactiva silenciosamente.

## Clave inicial manual con privilegio dedicado - 2026-10-13

El propietario autoriza un campo opcional de contrasena inicial en el alta de
usuarios, exclusivamente con permisos efectivos `user.create` y
`user.assign_password`. Solo aplica a acceso local; el backend valida y hashea
con Argon2id, nunca devuelve ni audita claves/hashes. Sin clave se conserva el
flujo pendiente de activacion. Con clave autorizada, pending se convierte en
active para permitir login; inactive explicito se conserva. No es password
temporal ni incluye cambio obligatorio, reset de usuarios existentes, envio de
correo o escrituras legacy. Migracion puntual 018 en CRM_THINK_V2, otorgada
inicialmente solo a Owner. El permiso es sensible y delegable por las reglas
administrativas existentes, no implicito en user.create.

## Formalizacion: perfil e Inicio autorizados - 2026-10-13

El propietario autoriza en esta conversacion agregar el rol `formalizacion`, su
modulo operativo existente y exclusivamente la seccion Inicio con permiso
`formalizacion.home.read`. Esta ampliacion de identidad permite crear usuarios
del perfil y asignar por defecto el modulo Formalizacion. No autoriza Resumen,
Expedientes, Contratos, Firmas, Catalogos, datos comerciales, jobs ni integraciones
para ese rol. El permiso Inicio no debe reutilizar `file.read` ni permisos de
catalogo. Owner conserva su politica actual. Migracion incremental 017 solamente
en CRM_THINK_V2; sin cuentas ficticias persistentes ni escrituras legacy. El
registro operativo y los requisitos para habilitar secciones futuras estan en
documento 36. La version 0.3.28 posterior sigue siendo el corte historico de
autenticacion; este addendum registra el alcance nuevo sin atribuir aprobacion
de despliegue ni firma productiva.

## Owner-Authorized Campaigns Parity - 2026-10-12

The owner explicitly extends the existing Projects exception to Campaigns in this
request. Campaigns owns `crm_campaign`, `crm_campaign_external_reference`, and
`src/modules/crm/campaigns/`; legacy SQL stays under
`src/integrations/legacy-crm/campaigns/`. Native-first merging excludes migrated
legacy IDs. Create, edit/promotion and status changes follow Projects through the
same `ENABLE_LEGACY_FALLBACK` gate and optional domain-owned port. Same-server
InnoDB transactions cover native data, legacy data and audit; no delete operation,
credential changes, business seeds or unrelated domains are authorized. The
separate legacy reader pool remains read-only. This scoped approval supersedes
older Campaigns read-only/shared-storage wording; it does not authorize deployment.
See document 35 for the exact schema, nullable legacy reference and verification.

## Corte de continuidad 2026-10-08

La cabecera 0.3.28 siguiente conserva el corte historico de autenticacion. Las instrucciones posteriores del propietario en la conversacion aprobaron usuarios administrativos, roles/permisos, auditoria y siete catalogos compartidos con permisos scoped por modulo. Este addendum registra ese alcance sin atribuir una nueva firma o aprobacion de produccion.

Regla actual de catalogos: contexto activo y permiso {modulo}.catalog_{entidad}.{accion}; datos nativos compartidos. La propuesta anterior de permisos globales queda sustituida. Owner no omite el permiso efectivo ni un deny; solo conserva la exencion de membresia de area. La UI oculta las acciones sin permiso y la API revalida cada operacion: [36 - Registro](36-Registro-Entrega-Administracion.md).

Prioridad: cerrar Administracion con QA real y pruebas; despues contrato NetSuite -> API para Leads. Legacy solo lectura; UI Leads, migracion de negocio y deploy siguen pendientes de su autorizacion. Los documentos de vision comercial no amplian el alcance ejecutable.

Estado, hallazgos, tareas, pruebas y preguntas vigentes: documento 34. No interpretar las menciones historicas a runtime minimo o pausas como ausencia del codigo administrativo ya construido.


| Campo | Valor |
| --- | --- |
| Version | `0.3.28` |
| Fecha | `2026-09-30` |
| Estado | Ley vigente firmada de producto y alcance; P0-S1A aprobado en base de datos, runtime minimo de identidad implementado en API y frontend, login local/Microsoft verificado localmente, bootstrap controlado del primer owner autorizado. |
| Dueno de producto | CRM TINK <soporte@roccacr.com> |
| Aprobado por | CRM TINK <soporte@roccacr.com> |
| Ultimo cambio | Cierra la fase de autenticacion local: login local, Microsoft OIDC con selector de cuenta, logout, refresh/CSRF, foto de perfil y shell autenticado quedan alineados entre API, frontend y documentacion. Produccion sigue condicionada por configuracion aprobada, usuarios reales faltantes y canal formal de activacion/reset. |

## Regla superior

Este documento se lee primero.

Si este documento contradice a `AGENTS.md`, skills, modelos de datos, mapas de implementacion, documentos largos o notas futuras, gana este documento hasta que el dueno del producto apruebe una nueva version.

Mientras este documento no apruebe ampliar runtime, esta prohibido crear API comercial, instalar dependencias fuera de identidad, agregar modulos comerciales, generar OpenAPI comercial o ampliar skills. Las unicas excepciones autorizadas por esta version son validar estructura de identidad, ejecutar el seed de catalogos S1A, construir el runtime minimo de identidad del API, conectar la compuerta frontend de identidad contra el BFF, implementar login local/refresh seguro, implementar Microsoft OIDC real dentro de `src/integrations/microsoft365`, preparar el wiring tecnico opcional de conexion legacy aislada para futura sync y crear el primer owner real por bootstrap controlado desde lectura minima de `crmdatabase-api.admins`, sin usuarios inventados, sin credenciales seed, sin datos reales de negocio fuera de identidad, sin dual-read y sin escritura sobre la base vieja.

## Gobierno documental

La respuesta a una duda no debe ser crear mas markdown por defecto.

Reglas:

- no se crea un documento nuevo sin retirar, fusionar o degradar otro documento existente;
- una correccion de alcance primero se aplica aqui;
- los documentos largos son soporte, no autoridad;
- los indices deben apuntar a lectura corta;
- si un documento repite esta ley y se desactualiza, pierde contra esta ley;
- ningun documento nuevo puede ampliar P0-S1A sin cambiar version, fecha y aprobacion en esta ley.

Regla de autoridad:

```txt
Fuente canonica de producto = este documento.
```

Frontend, API, SQL, skills y mapas de implementacion obedecen esta ley.

## Que estamos construyendo

Estamos construyendo un CRM interno para manejar el expediente comercial del cliente desde lead hasta contrato.

El CRM nuevo tendra datos propios, historial propio y reglas propias. NetSuite, Odoo u otros sistemas externos entran como proveedores conectados por integracion; no son el idioma del vendedor, no son el modelo de datos core y no aparecen en el frontend.

Las relaciones internas del CRM usan identidad propia del CRM. Ningun vendedor, lead, oportunidad, estimacion, orden o contrato debe relacionarse internamente usando ids de NetSuite, Odoo, legacy CRM u otro proveedor.

## Ley de aislamiento por modulo/proveedor

La separacion por carpeta es obligatoria. No es opcional ni estetica.

Regla:

```txt
Cada dominio, fuente de datos y proveedor externo vive en su propio modulo. Si se deja de usar, se desconecta o elimina ese modulo sin romper el core del CRM.
```

Separacion aprobada:

| Area | Carpeta obligatoria | Responsabilidad | Prohibido |
| --- | --- | --- | --- |
| CRM nuevo / `CRM_THINK_V2` | `src/database` + repositorios del modulo en `src/modules/crm/**` | Conexion Kysely, tipos DB, queries sobre datos propios del CRM nuevo. | Leer tablas del CRM viejo o mapear payloads de proveedores. |
| CRM viejo / legacy | `src/integrations/legacy-crm` | Lectura temporal, mapeo y extraccion controlada desde la base vieja. | Escribir reglas nuevas de negocio o contaminar contratos canonicos. |
| NetSuite | `src/integrations/netsuite` | Cliente, DTOs, mappers, errores y sincronizacion especifica de NetSuite. | Aparecer en frontend, tablas core o modulos comerciales como dependencia directa. |
| Odoo | `src/integrations/odoo` | Cliente, DTOs, mappers, errores y convivencia futura con Odoo. | Reemplazar nombres canonicos del CRM por nombres de Odoo. |
| Kapso / WhatsApp | `src/integrations/kapso` | Mensajeria, templates, webhooks y mappers de Kapso cuando se apruebe. | Ser llamado directo desde componentes React o desde reglas core de lead. |
| Microsoft 365 / Graph | `src/integrations/microsoft365` | Entra ID, Graph, calendario externo y adapters tecnicos aprobados. | Decidir reglas CRM de calendario o permisos. |
| Puertos de identidad | `src/modules/crm/identity/ports` | Interfaces estables que identidad conoce. | Implementaciones concretas de proveedor. |
| Configuracion global | `src/config`, `src/common`, `src/database` | Configuracion, seguridad, bootstrap, conexion a `CRM_THINK_V2` y utilidades transversales reales. | Reglas de negocio de leads, ERP, legacy, Kapso u Odoo. |

El core del CRM solo habla contratos canonicos y puertos. El core no importa adapters concretos.

Permitido:

- crear carpetas vacias de frontera para dejar clara la arquitectura;
- crear interfaces/ports cuando un caso de uso aprobado los necesite;
- agregar un proveedor nuevo creando su propio adapter, por ejemplo `src/integrations/<proveedor>`.

Prohibido:

- crear `netsuiteId`, `odooId`, `legacyId` o equivalentes como identidad principal en tablas core;
- importar `src/integrations/netsuite`, `src/integrations/odoo`, `src/integrations/legacy-crm` o `src/integrations/kapso` desde controllers o dominio core;
- mezclar queries del CRM viejo con repositories de `CRM_THINK_V2`;
- poner payloads de proveedor externo en DTOs publicos del frontend/API;
- crear carpetas genericas tipo `external`, `misc`, `helpers` o `providers` para tirar ahi todo.

Si manana se apaga el CRM viejo, solo debe retirarse `src/integrations/legacy-crm` y su wiring autorizado. Si se cambia NetSuite por Odoo, el core y el frontend no deben cambiar de idioma ni de identidad.

Regla de conexion legacy aprobada:

Owner-authorized exception, 2026-10-09: Projects supports editable legacy records and same-server transactional synchronization. Enabled creates write both databases; legacy-only edits promote into CRM_THINK_V2 and update the existing legacy row; linked native edits synchronize that row. Native-only edits do not create legacy rows. No deletes are allowed. All reads and writes use the single `legacy-crm-access.ts` gate; `ENABLE_LEGACY_FALLBACK=false` disables new legacy operations after API restart. The separate reader pool remains read-only. Shared credentials/grants must not change. This exception supersedes earlier blanket read-only/no-dual-write wording for Projects only; other entities retain their existing scope. See document 35 for transaction, validation and removal requirements.

```txt
DB_NAME siempre apunta a CRM_THINK_V2. La base vieja solo se nombra con LEGACY_CRM_DB_NAME dentro de src/integrations/legacy-crm.
```

Actualizacion autorizada por el propietario el 2026-10-09: el pool legacy independiente reutiliza `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` y `DB_SSL_CA`, cambiando solo el nombre a `crmdatabase-api`. Se autoriza lectura temporal Projects/Campaigns mediante el adapter aislado; Projects combina nativos y legacy no migrados por `id_old_produccion`, con precedencia nativa. Todas las consultas legacy se ejecutan dentro de transacciones de solo lectura, con `SET SESSION TRANSACTION READ ONLY` al abrir cada conexion. Esto no reduce los privilegios de la cuenta compartida y no autoriza DML/DDL legacy, cambios de credenciales/grants, sincronizacion ni importacion automatica. `ENABLE_LEGACY_FALLBACK=false` desactiva el adapter sin abrir pool; para retirar fisicamente la carpeta, eliminar primero su import/registro en `AppModule`. El core conserva su puerto opcional y funciona solo con CRM_THINK_V2.

## Ley de credenciales productivas compartidas

Esta regla nace por incidente operativo confirmado el `2026-09-25`: rotar la clave de un usuario master compartido corto servicios productivos que aun dependian de esa credencial.

Regla obligatoria:

```txt
Queda prohibido rotar, alterar, revocar o reemplazar credenciales productivas compartidas mientras existan servicios vivos que las usen.
```

Aplica especialmente a usuarios master/admin de RDS/MySQL como `usuario_master_compartido`.

Antes de tocar una credencial productiva compartida se debe cumplir todo:

- inventariar los servicios vivos que la usan, incluyendo CRM viejo, Kapso, jobs, scripts, PM2, Prisma, backend Node y cualquier proceso externo;
- crear usuarios dedicados por servicio con privilegios minimos;
- migrar cada servicio a su usuario dedicado y verificar arranque/conexion;
- confirmar que ningun servicio vivo usa ya la credencial compartida;
- aprobar una ventana operativa y un rollback explicito con el dueno;
- documentar el resultado sin guardar secretos.

Mientras esa lista no este cerrada, tareas tipo "rotar password master", "probar que la clave vieja no conecta" o "bloquear la clave anterior" quedan prohibidas. Lo correcto es preparar usuarios dedicados sin cortar el usuario compartido existente.

## Para quien

| Usuario | Que necesita en este CRM |
| --- | --- |
| Vendedor | Ver sus leads, entender que debe atender, registrar acciones y dejar evidencia. |
| Jefatura | Supervisar leads, equipos, motivos, perdidas, pausas y trazabilidad sin depender de explicaciones verbales. |
| Formalizacion | Entra despues del flujo comercial inicial, cuando el alcance lo apruebe. |
| Cobros | No opera en P0-S1. NetSuite sigue siendo el sistema principal de cobros. |
| Sistemas/soporte | Mantener integraciones y trazabilidad sin mezclar proveedores con reglas del CRM. |

## Que problema mata

El CRM actual no permite gobernar bien el proceso comercial porque:

- mezcla datos comerciales con nombres y estructuras del sistema viejo;
- mezcla reglas del CRM con NetSuite;
- no deja una bitacora completa, clara y confiable de todo lo que pasa con el lead;
- dificulta cambiar o convivir con otro ERP;
- obliga a entender tablas y codigos heredados para explicar decisiones comerciales.

El nuevo CRM debe resolver eso con un expediente comercial claro, auditable y propio.

## Que no somos

Este proyecto no es:

- HubSpot;
- Odoo;
- Salesforce Platform;
- Bitrix;
- marketing automation;
- ERP;
- plataforma generica de modulos;
- suite de calendario, chat, WhatsApp o documentos.

Si una idea empuja el proyecto hacia una suite completa antes de cerrar P0-S1, queda fuera.

## Ley de P0-S1

P0-S1 existe para cerrar el nucleo minimo del CRM en orden. Nada mas.

La primera compuerta de P0-S1 no es lead. Es identidad: usuarios, autenticacion, roles y permisos minimos.

No se debe avanzar a tablas, pantallas o endpoints de lead hasta cerrar quien entra al sistema, con que rol y con que permiso.

## Ley de P0-S1A Identidad

P0-S1A identidad queda cerrado como producto y base de datos inicial.

Esto significa:

- el SQL de identidad existente es un artefacto controlado de diseno y validacion;
- `SQL/001_identity_schema_p0_s1.sql` fue aplicado manualmente solo como validacion schema-only en `CRM_THINK_V2`, sin datos, sin seeds y sin runtime;
- esa aplicacion no equivale a migracion productiva registrada ni autoriza datos reales;
- `SQL/002_identity_seed_p0_s1.sql` fue autorizado y ejecutado solo como catalogos S1A;
- el API NestJS queda autorizado solo para el runtime minimo de identidad definido en esta version;
- no se abren mas documentos de vision para identidad salvo correccion de contradicciones.

Validacion SQL autorizada:

- se autoriza validar `SQL/001_identity_schema_p0_s1.sql` como migracion controlada de estructura;
- se autoriza crear un runner de migracion solo cuando sea necesario para validar estructura; esta regla no autoriza modulos comerciales, pero la version vigente `0.3.28` autoriza el runtime minimo de identidad descrito en este documento;
- se autoriza ejecutar `SQL/002_identity_seed_p0_s1.sql` una vez como seed de catalogos S1A, exclusivamente en `CRM_THINK_V2`;
- `SQL/002_identity_seed_p0_s1.sql` solo puede insertar catalogos de identidad: permisos, roles, matriz rol-permiso, areas, sistemas externos y eventos tecnicos de auditoria de seed;
- `SQL/002_identity_seed_p0_s1.sql` no puede crear usuarios, identidades de autenticacion, asignaciones de usuario, contrasenas, tokens, datos personales, datos de negocio ni datos del CRM viejo;
- el objetivo exclusivo es validar que el esquema compila contra un motor MySQL 8 real;
- la base `CRM_THINK_V2` usada para esta prueba no puede contener datos reales ni datos del CRM viejo;
- como excepcion unica de la version `0.3.4`, se regulariza la validacion schema-only ya ejecutada en el servidor `mysql_crm_ventas`, exclusivamente sobre la base nueva y vacia `CRM_THINK_V2`, sin tocar `crmdatabase-api`;
- esta excepcion no convierte `mysql_crm_ventas` en ambiente oficial del CRM nuevo y no autoriza datos reales, datos del CRM viejo, integraciones operativas ni runtime;
- sigue prohibido ejecutar estos SQL contra produccion, ambientes compartidos o bases con datos reales, salvo excepcion escrita en esta ley y limitada a una base vacia de validacion;
- esta autorizacion SQL no permite crear runtime API comercial, migraciones operativas de producto, OpenAPI comercial, jobs, integraciones reales ni pantallas;
- las credenciales nunca se guardan en documentos, codigo, commits, logs ni capturas; deben vivir solo en variables de entorno locales o gestor de secretos;
- las migraciones no deben ejecutarse automaticamente al iniciar NestJS; deben ejecutarse por comando explicito, revisable y separado del arranque de la aplicacion.

Conteos esperados de `SQL/002_identity_seed_p0_s1.sql` antes de migraciones incrementales:

| Tabla | Conteo esperado |
| --- | --- |
| `sec_permission` | 8 |
| `sec_role` | 5 |
| `sec_role_permission` | 24 |
| `sec_org_unit` | 6 |
| `int_external_system` | 3 |
| `audit_security_event` | 4 |
| `sec_user` | 0 |
| `sec_auth_identity` | 0 |
| `sec_user_role` | 0 |
| `sec_user_org_unit` | 0 |

Conteos adicionales esperados despues de `202610030007_crm_catalogs`:

| Tabla | Incremento esperado |
| --- | --- |
| `sec_org_unit` | +1 modulo visible `administration` |
| `sec_user_org_unit` | +1 vinculo `administration` para usuarios `owner` activos |
| `sec_permission` | +140 permisos scoped `modulo.catalog_*` |
| `sec_role_permission` | +140 permisos scoped para `owner` |
| `crm_catalog_item` | 0; los valores se crean desde la UI/API |
| `crm_catalog_item_external_reference` | 0; las referencias externas se agregan por valor |

Regla vigente: los valores de catalogo son compartidos en `crm_catalog_item`, pero la autorizacion no es global. El permiso debe incluir el modulo consumidor, por ejemplo `mercadeo.catalog_project.read` o `formalizacion.catalog_project.read`.

Regla de validacion:

```txt
Si cualquier conteo posterior a `SQL/002` o a una migracion incremental difiere del esperado para ese corte, se reporta como desviacion y no se ajusta el registro para esconderla.
```

## Runtime minimo de identidad autorizado

La version `0.3.28` mantiene autorizado el runtime minimo de identidad y autoriza el cierre local de la compuerta de autenticacion en API y frontend. Esto incluye login local, Microsoft OIDC, refresh seguro, CSRF, logout y shell autenticado para identidad. No autoriza modulos comerciales ni declara produccion lista.

Alcance permitido:

- bootstrap NestJS minimo dentro de `apps/api`, usando `pnpm`;
- conexion MySQL/Kysely a `CRM_THINK_V2`;
- configuracion segura de variables de entorno sin guardar secretos reales en documentos, codigo ni logs;
- modulo de identidad/autenticacion;
- patron BFF con cookies `HttpOnly`, `Secure` y `SameSite`;
- flujo Microsoft Entra ID / OIDC implementado en API y consumido por frontend de identidad, condicionado para produccion a Entra ID real, variables `MICROSOFT_*`, `SQL/004` aplicado y redirect URI oficial;
- login local preparado contra identidades locales activas existentes, con Argon2id, lockout persistente, rechazo local de claves comunes, sin passwords en seed y sin bootstrap inventado;
- endpoints minimos de identidad: sesion actual, usuario actual, sesiones activas, revocacion de sesion propia, logout, refresh, inicio/callback Microsoft y flujo local de invitacion/reset;
- calculo de permisos efectivos con rol, area/jerarquia, `allow` directo y `deny` directo;
- auditoria de seguridad para login, logout, refresh, errores relevantes y cambios sensibles de identidad;
- token de sesion opaco guardado solo como HMAC con `AUTH_TOKEN_HASH_SECRET`;
- refresh token opaco guardado solo como HMAC, con rotacion y deteccion de reuso;
- reuso de refresh token se trata como senal de robo y revoca todas las sesiones activas del usuario; esto no impide multiples sesiones normales;
- CSRF double-submit firmado con `COOKIE_SECRET` y ligado al token de sesion cuando exista;
- decision vigente de token: BFF opaco con cookies; no se entrega access token JWT al frontend en JSON ni se guarda token en memoria React en este corte;
- HMAC-SHA256 con `AUDIT_HASH_SECRET` dedicado para correlacionar identificadores sensibles en auditoria sin guardar PII cruda;
- rate limit local acotado para reset local y login local, con dos contadores independientes por endpoint: IP efectiva y HMAC del correo; se bloquea si cualquiera se excede; el limite por IP debe ser mas alto que el limite por correo para no castigar oficinas bajo NAT; en P0 es por proceso y se reinicia al arrancar;
- rate limit local acotado para completar reset local, con contador por IP efectiva y HMAC del token opaco de reset, sin almacenar token crudo;
- rate limit especifico para `/identity/refresh`, con contador por IP y por HMAC del refresh token, sin almacenar tokens crudos;
- logger estructurado JSON con redaccion de cookies, Authorization, CSRF, passwords, reset tokens y tokens de sesion/refresh;
- `OPENAPI_ENABLED` apagado por defecto hasta decision explicita de exposicion;
- `API_BIND_HOST` explicito, con `127.0.0.1` como default seguro;
- `TRUSTED_PROXY_IPS` opcional y explicito; queda prohibido confiar todos los proxies con `trustProxy: true`;
- contrato OpenAPI minimo o contrato equivalente solo para identidad, si se necesita para integrar frontend;
- pruebas minimas de sesion, permisos efectivos y auditoria;
- `SQL/003_identity_login_readiness_p0_s1.sql` fue aplicado y registrado por el runner idempotente `202609250003_identity_login_readiness` contra `CRM_THINK_V2`.
- `SQL/004_identity_microsoft_session_p0_s1.sql` queda autorizado como diseno schema-only para Microsoft OIDC/cache MSAL/foto/proveedor de sesion y registrado en el runner como `202609280004_identity_microsoft_session`; debe ejecutarse solo contra `CRM_THINK_V2` con usuario de migracion schema-only, nunca contra `crmdatabase-api`.
- bootstrap del primer owner real: se autoriza crear el usuario canonico de Roberto desde lectura minima del registro activo legacy, asignarlo como `owner` tecnico de `sistemas` con alcance `all_areas`, registrar referencias externas permitidas y dejar login local `pending` sin copiar passwords, hashes ni tokens del CRM viejo.
- crosswalk externo del owner Roberto: `netsuite:653055` queda como referencia externa activa; Odoo queda solo como sistema externo `pending` hasta tener un id real de Odoo; queda prohibido crear una fila falsa `odoo` en `int_user_external_identity`.
- Microsoft como proveedor de autenticacion: el token/codigo/claims de Microsoft se validan solamente en el flujo Microsoft OIDC (`start/callback`) dentro de `src/integrations/microsoft365`; al terminar ese flujo, el CRM emite su propia sesion BFF opaca. El login local normal no llama ni valida Microsoft.
- continuidad Microsoft: el API usa authorization code flow con PKCE, `state`, `nonce` y scope `offline_access`; persiste cache MSAL cifrado en servidor, particionado por la cuenta Microsoft estable, para poder hacer renovacion silenciosa desde backend sin entregar tokens Microsoft al frontend.
- vencimiento obligatorio: toda sesion BFF, local o Microsoft, tiene ventana absoluta maxima de 8 horas desde el login; `/identity/refresh` solo rota tokens opacos dentro de esa ventana y no puede extenderla. Vencidas las 8 horas, el API debe responder como no autenticado y exigir login nuevo para regenerar sesion, refresh, CSRF y cualquier estado Microsoft asociado.
- imagen de usuario: Microsoft Graph puede ser fuente de la foto del proveedor; el API debe cachearla o exponerla solo como referencia interna controlada por `profileImageUrl`, sin tokens Microsoft en frontend y sin depender de URLs temporales del proveedor.

Sigue prohibido:

- leads;
- oportunidades;
- estimaciones;
- ordenes de venta;
- calendarios;
- notas;
- dashboard comercial;
- ERP operativo;
- NetSuite/Odoo/Kapso operativos;
- dual-read con CRM viejo;
- usuarios reales inventados;
- correos ficticios;
- passwords o tokens en seeds;
- datos de negocio;
- datos reales de clientes;
- activar Microsoft OIDC productivo antes de tener app registration Entra ID, redirect URI oficial, variables `MICROSOFT_*`, llave `MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY`, `SQL/004` aplicado y validacion operacional aprobada;
- Microsoft OIDC real sin cache MSAL persistente cifrado en servidor, sin llave de cifrado dedicada o sin SQL/migracion aplicada para guardar el cache de proveedor;
- guardar access token, refresh token, ID token o cache Microsoft en frontend, cookies legibles, logs, documentos o tablas sin cifrado;
- pantallas frontend comerciales fuera de identidad;
- bootstrap de usuarios reales sin correo oficial aprobado; el owner Roberto queda autorizado por esta version, pero el `jefe_general` de negocio sigue pendiente y debe ser una persona separada salvo aprobacion expresa posterior;
- frontend comercial;
- OpenAPI comercial;
- jobs operativos;
- Redis;
- RabbitMQ;
- tocar `crmdatabase-api`.

Criterio de salida del runtime minimo de identidad:

```txt
El API puede decir quien soy, que roles/areas tengo, que permisos efectivos tengo, cerrar sesion y auditar eventos de seguridad, sin exponer tokens al frontend y sin crear ningun endpoint comercial.
```

P0-S1A identidad incluye:

- usuario interno del CRM;
- autenticacion Microsoft como principal;
- login local como alternativa controlada por invitacion/reset seguro;
- roles;
- areas/equipos y jerarquia;
- permiso efectivo basico;
- permiso directo por usuario tipo `allow`;
- denegacion directa por usuario tipo `deny`;
- auditoria de cambios de seguridad.

P0-S1A identidad no incluye:

- delegacion temporal avanzada;
- pantallas completas de administracion de usuarios;
- flujos de aprobacion complejos;
- permisos sobre leads;
- leads, calendarios, dashboard comercial, notas o integraciones reales.

Regla:

```txt
Permiso efectivo P0-S1A = rol + area/jerarquia + allow directo - deny directo.
```

Las delegaciones temporales quedan previstas para una fase posterior, pero no son obligatorias ni construibles en P0-S1A.

## Condiciones antes de activar login productivo

Antes de declarar la autenticacion productiva para usuarios finales, deben estar cerradas estas condiciones:

1. Token de sesion opaco: implementado en API como token aleatorio con hash HMAC; estructura `SQL/003` aplicada y validada contra MySQL.
2. Fechas en UTC para sesiones, refresh-token y vencimientos: implementado en API con fechas ISO/Date UTC; validado en flujo local.
3. Rotacion de refresh-token con deteccion de reuso y revocacion de familia: implementado en API y cubierto por tests; reuso real queda reservado a tokens `rotated`/`reused`.
4. CSRF double-submit firmado y atado a sesion: implementado en API.
5. Rate limit activo para login local y reset local: implementado en API.
6. Rate limit especifico para `/identity/refresh`: implementado en API; en multi-instancia requiere store compartido antes de equivaler a cuota global.
7. Account lockout persistente por usuario/identidad o politica equivalente ante abuso de password: implementado en API y estructura `SQL/003` aplicada; probado por suite automatizada.
8. Decision formal sobre reuso de refresh token con multiples sesiones: reuso revoca todas las sesiones activas del usuario; multiples sesiones normales siguen permitidas.
9. Logger estructurado con redaccion de secretos, tokens y PII antes de produccion: implementado con `nestjs-pino`/Pino.
10. Microsoft OIDC implementado solo dentro de `src/integrations/microsoft365`, detras de puertos del dominio en `src/modules/crm/identity/ports`; la validacion de Microsoft aplica al flujo Microsoft y a renovaciones controladas de sesiones creadas por Microsoft, no al login local ni a cada request normal del CRM.
11. Addendum frontend de identidad conectado: implementado para `/auth/login`, `/home/global`, login local, Microsoft, logout, foto/avatar y estados de verificacion.
12. Primer owner real definido y bootstrap autorizado para Roberto; correo oficial del primer `jefe_general` de negocio sigue pendiente. No se permiten usuarios inventados.
13. Politica de retencion de datos personales de auditoria, incluyendo IP y metadatos seudonimizados.
14. Revocacion de sesiones activas cuando una identidad de autenticacion quede `blocked`, `inactive` o eliminada logicamente.
15. Crear una sesion nueva en cada login exitoso para evitar fijacion de sesion.
16. Responder `409` cuando el `permissionVersion` de la sesion no coincida con la version actual del usuario; el cliente debe intentar un refresh single-flight y, si no obtiene sesion vigente, limpiar cache visual y obligar login nuevo. No se revalida con `/identity/me` porque ese endpoint usa la misma compuerta.
17. Cache MSAL persistente y cifrado para Microsoft real: implementado en API con cache cifrada en servidor y particion por `homeAccountId`/tenant; se usa para `acquireTokenSilent` antes de forzar login interactivo; si Microsoft requiere UI, revoca sesiones CRM creadas por Microsoft y pide reautenticacion.
18. Ventana absoluta de sesion de 8 horas: implementada en API para tokens CRM y validada localmente; la rotacion de refresh no puede extender el vencimiento absoluto de `sec_auth_session`.
19. Imagen/foto de usuario: SQL/004, adapter Graph y endpoint `/identity/me/photo` implementados; `/identity/session` y `/identity/me` pueden devolver `profileImageUrl` como referencia interna. El frontend no recibe tokens ni URLs temporales de Microsoft.

S1A debe ser flaco. Su primer valor visible para negocio es:

```txt
entrar -> saber quien soy -> ver rol/area/permisos efectivos -> saber que leads sigue bloqueado
```

Si S1A intenta construir administracion completa de usuarios, IAM empresarial, flujos complejos o pantallas comerciales, fallo el alcance.

| Numero | Si entra | Dueno principal |
| --- | --- | --- |
| 1 | Identidad, usuarios, autenticacion, roles y permisos minimos. | Sistemas / Jefatura |
| 2 | Contrato canonico minimo de lead. | Sistemas / API |
| 3 | Modelo minimo de contacto y lead. | Sistemas / API |
| 4 | Bitacora obligatoria para acciones del lead. | Vendedor / Jefatura |
| 5 | Timeline basico del lead. | Vendedor / Jefatura |
| 6 | Reglas minimas de lista y detalle conceptual del lead. | Vendedor |
| 7 | Reglas de auditoria basica para cambios sensibles. | Jefatura / Sistemas |

P0-S1 no autoriza programar todo el CRM. Identidad P0-S1A queda cerrada en base de datos; el siguiente paso permitido es continuar solo el runtime minimo de identidad definido en la version `0.3.28`, no abrir modulos comerciales ni mas vision.

## Prohibido ahora

Hasta que P0-S1 quede cerrado por producto, queda prohibido:

- programar API fuera del runtime minimo de identidad autorizado;
- recrear `package.json`, `src/`, migraciones de producto u OpenAPI fuera del alcance de identidad;
- instalar mas skills;
- crear nuevos modulos comerciales;
- agregar calendarios;
- agregar Kapso;
- agregar notas adhesivas;
- agregar delegaciones avanzadas;
- agregar dual-read con el CRM viejo;
- agregar sincronizacion real con ERP;
- agregar Redis, RabbitMQ o jobs operativos;
- crear leads antes de cerrar identidad/usuarios/roles;
- ampliar el alcance por parecer "enterprise".

## Definition of Done minima

En el runtime minimo de identidad autorizado, ninguna pieza se considera lista si no cumple estas reglas:

1. Todo endpoint mutable de negocio valida permiso efectivo en backend. Los endpoints propios de autenticacion/sesion (`/identity/session`, `/identity/logout`, `/identity/refresh`, Microsoft OIDC y reset local) se protegen con sesion, CSRF, cookies BFF, auditoria y reglas de autenticacion; no dependen de permisos CRM porque existen para crear, leer, renovar o cerrar identidad.
2. Ningun permiso se decide solo en frontend.
3. Toda accion sensible genera auditoria en la misma transaccion logica. El caso de uso de aplicacion decide que se audita; el repository solo puede registrar auditoria cuando la frontera transaccional lo exige para conservar atomicidad.
4. OpenAPI o contrato equivalente se actualiza antes de consumir desde frontend.
5. DTOs validan entrada con whitelist y rechazan propiedades no declaradas.
6. MySQL mantiene columnas comentadas, nombres canonicos y relaciones internas por IDs propios.
7. Kysely se usa para consultas SQL; no se aceptan strings SQL improvisados en controladores.
8. Los errores al usuario no exponen stack traces, SQL ni detalles internos.
9. Los comentarios de codigo explican reglas de negocio, seguridad o decisiones no obvias; no comentan obviedades.
10. Cada cambio trae verificacion minima: typecheck/build cuando exista runtime, prueba del caso principal y prueba del permiso/auditoria cuando aplique.
11. Cada archivo y funcion debe respetar SOLID practico: una responsabilidad clara, nombres entendibles, duplicacion evitada, constantes para valores repetidos y fail-fast ante configuracion critica.
12. Cuando una funcion empiece a mezclar concerns, se divide en funciones privadas enfocadas y la funcion publica queda como orquestador sin romper su contrato.

## Riesgos nombrados, no resueltos en P0-S1A

Estos temas no autorizan nueva implementacion ahora, pero deben estar visibles:

| Riesgo | Por que importa | Momento de decision |
| --- | --- | --- |
| Duplicados de lead | Un mismo cliente puede entrar por telefono, correo, campana o proyecto distinto. | Antes de P0-S1B leads. |
| PII y Ley 8968 Costa Rica | Telefonos, correos, cedula, WhatsApp y datos comerciales requieren retencion y consentimiento claros. | Antes de datos reales de leads. |
| Idempotencia al crear lead | Reintentos desde CRM, ERP o integracion no deben crear duplicados involuntarios. | Antes de crear lead. |
| IDOR | Un vendedor no debe ver registros de otro cambiando un `publicId`. | Primer endpoint real con recurso. |
| No-produccion | Usar la misma infraestructura del CRM viejo aumenta riesgo operativo. | Antes de ejecutar migraciones o pruebas con datos reales. |
| Convivencia y apagado del CRM viejo | El mayor riesgo de migracion es saber cuando se deja de usar el viejo. | Antes de P1 dual-read o migracion historica. |

## Orden obligatorio

El orden del proyecto es:

```txt
producto -> identidad/usuarios/roles -> contrato canonico minimo -> modelo MySQL minimo -> NestJS
```

Invertir el orden se considera volver a empujar codigo antes de entender el producto.

## Brokers Scoped Approval (2026-10-12)

The owner explicitly authorized Brokers parity with Projects, Campaigns, Classes,
Locations and Subsidiaries: dedicated native tables, API, legacy adapter and UI.
Only the four essential legacy `corredores` fields participate. No obsolete-field
import, seed, cleanup, deployment or actual legacy-write verification is included.
Authentication, scoped permissions, audit and the global legacy switch remain
mandatory. This approval does not extend to other business modules.

## Unit Files Scoped Approval (2026-10-12)

The owner authorized the migration plan, dedicated Unit Files native schema,
canonical project/provider resolution, read/search/detail/comparison API and
view. Legacy `expedientes` remains read-only. Preserve all source information;
do not fabricate unresolved project relationships. Only verified native project
identity preparation is included. Unit mutation, legacy writes, production
index changes, deployment and inventory migration require later approval.
See architecture 35 for the applied migrations and reconciliation blockers.

## Criterio de salida

Se puede avanzar al modelo MySQL minimo solo cuando:

- esta ley este aceptada;
- P0-S1A identidad este cerrado sin ambiguedades;
- cada "si" tenga dueno;
- cada "no" este escrito;
- el indice apunte a este documento como lectura cero;
- no existan documentos diciendo que el API comercial ya esta creado;
- quede claro que `SQL/001` fue aplicado solo como validacion schema-only, no como migracion productiva;
- quede claro que `conf_schema_migration` fue registrada por marca manual equivalente porque no existia `.env` seguro para probar el runner end-to-end;
- quede claro que `SQL/002` solo fue autorizado como seed de catalogos S1A, sin usuarios ni inserts de negocio;
- quede claro que solo el runtime minimo de identidad queda autorizado en la version `0.3.28`;
- quede claro que NestJS/API comercial sigue prohibido hasta aprobacion explicita posterior.


## Authorized Marketing Home read extension - 2026-10-23

The owner authorized real lead aggregates for Marketing Home through
`GET /marketing/home/summary?period=day|week|month|year`. Read native leads first,
then the optional legacy adapter, and produce one JSON without copying records.
Count all leads created in the interval regardless of current status. Preserve
permission scopes, canonical seller/project identities and local public-ID photos.
Appointment metrics are now authorized as read-only calendar queries: native events first, then legacy Cita events, attributed through the lead owner/project. No imports or calendar mutations. See `apps/api/Arquitectura/48-Mercadeo-Metricas-Citas.md` (repository-relative).
This scoped authorization supersedes historical mock-only restrictions for this
summary only; it authorizes no imports, business mutations, migrations or deployment.
API contract and verification: `apps/api/Arquitectura/46-Mercadeo-Resumen-Leads.md`
(relative to the repository root).


## Ampliación de lectura autorizada - 2026-10-27

El propietario autoriza el panel lateral de bitácora de la orden (etapas y auditoría de cambios disponible) y el expediente relacionado desde Proyecto · Unidad, bajo la lectura autorizada de esa orden. Sin importar, reconstruir historia ausente, restaurar registros ni modificar datos. Contrato y límites: [56](56-Orden-Bitacora-y-Expediente-Lectura.md).

### Notas personales, etapa3 autorizada27 octubre2026

[58](58-Notas-Etapa3-Interfaz-Personal.md) implementa icono junto a campana, editor lateral y layout personal en Home y orden nativa. Perfil con base self en modulos efectivos, sin revocar denies ni autoria. UI conectada; compartir/campanita implementados en etapa4 (contrato60), copia legacy pendiente. No se importan registros.

### Notas: relacion opcional

[59](59-Notas-Contexto-Opcional-y-Vistas.md) reemplaza la restriccion Home/native-only: crear personal desde cualquier pantalla y vincular opcionalmente vista u orden legacy/native, con acceso vigente y sin importacion. Compartir permanece separado.

Actualización vigente 2026-10-28: [62 - Notas en tiempo real](62-Notas-Tiempo-Real-Implementacion.md). Socket.IO, migración046 aditiva aplicada, campana/hilo/bandejas, recuperación REST y acceso a notas independiente del registro vinculado. Esta actualización sustituye las limitaciones históricas de transporte y acceso de las etapas anteriores. Copia legacy inactiva; Redis multiinstancia y aceptación visual real pendientes.
