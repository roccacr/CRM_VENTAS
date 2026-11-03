# Ordenes de venta: esquema y trayectoria - 20/10/2026

## Corte vigente contrastado — 2026-11-03

Revisión documental del árbol de trabajo de `temp/crm-tink-api-frontend-inicial`,
con base en HEAD `4d446ed`. Incluye cambios locales; no acredita publicación.

- NetSuite v2 dispone de escritor transaccional nativo primero y legacy solo en
  ausencia de autoridad nativa, recibos/cursor, snapshot y auditoría. v1 mantiene
  `persisted:false`. La ampliación de campos está en [75](75-Matriz-Campos-Ordenes-NetSuite.md)
  y la evidencia real acotada de diez indicadores en [73](73-Sincronizacion-Estados-Ordenes-NetSuite.md).
- Contratos usa aprobación de Formalización; la acción que otorga esa aprobación
  conserva sus prerrequisitos independientes. Origen de fondos, ocho etapas y
  combinaciones confirmadas de cierre están en [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).
  Eventos NetSuite `edit`/`xedit` pueden avanzar visitas finales existentes según
  esos indicadores; no hay retroceso automático ni etapas inventadas al consultar.
- Microsoft 365 tiene adaptador y endpoints conectados para agenda propia,
  disponibilidad, salas, invitaciones y Teams, condicionados a sesión Microsoft,
  permisos CRM y consentimiento: [64](64-Calendario-Global-API-y-Contexto.md).
  Implementación no equivale a aceptación externa con cuenta real.
- El adéndum es un marcador independiente de la etapa, con versión y nota manual;
  calendario conserva orden/cliente fijos y bloquea otro adéndum futuro.
  Contratos funcionales/esquema: [83](83-Adendum-Migracion-065-y-Rollback.md) y
  [84](84-Adendum-Manual-Migracion-066-y-Permisos.md), incluida la corrección067.

Los cortes inferiores conservan cronología y resultados de su fecha. Este corte
prevalece para inventario actual; no autoriza migraciones, escrituras, cambios de
credenciales, publicación ni despliegue. No se vuelven a ejecutar suites por editar documentación.

## Alcance contrastado - 2026-11-02

Los contratos de lectura por banner, ficha independiente y gestión para ambos
roles están en63/64/65 de Formalización; sustituyen las colas vacías del corte22.
El código local añade siete indicadores operativos057 y sus tipos, documentados
en [39](39-Diccionario-Ordenes-Venta.md). Son hechos independientes con estado
desconocido explícito, no etapas ni evidencia de firma/entrega inferida.

El receptor local de eventos NetSuite responde `persisted:false`: la presencia
de esos campos no habilita el escritor de sincronización del
[plan70](70-Plan-Sincronizacion-Ordenes-NetSuite.md). Tampoco implementa edición
general de orden/cliente/unidad, asignación de cartera, firma documental ni
validación conjunta de saldo/traspaso/llaves. Los antecedentes siguientes conservan
evidencia fechada y no son una consulta actual de BD o permisos.

Actualizacion 2026-10-26: ContractTransitionModule ya esta registrado, junto a
la consulta paginada de tiempos. La autorizacion local posterior de escrituras
legacy y sus gates se documenta en52; no extrapolar los flags del corte historico. Ver [52](52-Etapas-Responsables-y-Tiempos.md). El listado de
contratos independiente sigue pausado. Los apartados de
configuracion/ejecucion siguientes son cortes fechados, no lectura actual de
`.env`, MySQL o produccion. Metadatos actuales: [49](49-Estado-Actual-y-Cierre-Documental.md).

## Ampliacion Home: seis banners de etapas - 2026-10-23

Nuevo corte de lectura solicitado: [40 - Resumen y rendimiento](40-Formalizacion-Home-Resumen-y-Rendimiento.md).
Contratos y los cinco indicadores posteriores comparten un agregado por rol
activo Formalizacion, con etapa actual por secuencia y autoridad nativa sobre
legacy. El cierre anual acumula una vez cada orden con finalizacion efectiva en
el anio, incluso si despues se reabre; no es solo la etapa actual. Aprobaciones
no cambia. No habilitar listas ni comandos por conectar
estos contadores. Consultar 40 para resultados actuales, acumulado anual por
orden finalizada y limites de las pruebas sinteticas; los apartados siguientes
conservan la evidencia fechada de los cortes anteriores.

## Verificacion acotada de los dos banners Home - 2026-10-22

- Solo Pendientes de aprobacion y Contratos pendientes. Bandejas vacias; no se habilitan comandos ni otros estados.
- Ambos resumenes autorizan antes de consultar y leen ambas fuentes/exclusiones dentro de una transaccion REPEATABLE READ de solo lectura. Un alias nativo siempre prevalece sobre legacy, incluso inactivo o borrado. Evita mezclar momentos durante una migracion; no equivale a una prueba de concurrencia con escrituras.
- Lectores keyset comparten SALES_ORDER_SUMMARY_PAGE_SIZE=500. Una pagina corta evita la consulta vacia final; una completa continua. MAX_EXECUTION_TIME(1500) limita SELECT de elegibilidad, no el tiempo global HTTP o del pool.
- Indices nativos verificados: idx_so_valid, idx_so_approval_pending, uq_so_legacy y uq_so_state_sequence; este ultimo tambien existe en historial legacy.
- Aplicado indice aditivo idx_ov_formalization_summary en crmdatabase-api.ordenventa: status_ov, caida_ov, chekJefeVenta, aprobacion__rdr_ov, aprobacion_forma_ov, id_ov. SQL/026_legacy_formalization_summary_index.sql contiene el DDL de una sola ejecucion. ALGORITHM=INPLACE, LOCK=NONE, lock_wait_timeout=5; ejecucion observada 123 ms. No cambia valores ni estados.
- EXPLAIN anterior: recorrido PRIMARY, estimacion 401 filas para ambos filtros. Despues: range sobre indice nuevo, Using index, estimaciones 2 y 186 filas. No se fuerza el plan.
- Lectura real sin fixtures/DML: aprobaciones 2 (nativo 0, legacy 2); contratos Por enviar 186 y Pendientes de firma 0 (nativo 0, legacy 186/0); duplicados 0. Agregacion legacy independiente confirma 2 y 186. Observacion temporal del 22/10/2026, no constantes del frontend.
- Cinco muestras locales por caso de uso con identidad sustituida solo para medir negocio: aprobaciones calientes 452-464 ms; contratos 451-465 ms; primera lectura fria de aprobaciones 973 ms. Excluyen autenticacion HTTP y no son prueba de carga. Contratos antes: 543-546 ms; aprobaciones antes: 302-304 ms pero sin instantanea. La mejora de consistencia no se presenta como menor latencia de aprobaciones.
- Frontend comparte promesa solo dentro del montaje autorizado; sin cache global entre usuarios. Carga/reintento sustituyen cada numero por su preload; al resolver se muestran conteos reales. Fallos no generan totales parciales ni ceros falsos desde el API y el cliente distingue valores sin verificar.
- QA visual del componente aislado con respuestas sustituidas: una peticion por resumen en StrictMode, valores 2 y 186/0, sin desbordamiento observado en escritorio y viewport reducido. El navegador QA no tiene sesion autenticada; no certifica experiencia HTTP de una cuenta real.
- check-all.cmd: API 5138 pruebas correctas / 113 MySQL omitidas deliberadamente, frontend 472 correctas; formato, lint, tipos y ambos builds correctos. Flags de fixtures/auditoria/fallback desactivados solo en el proceso de pruebas, sin cambiar .env. Advertencia existente de bundle antd >500 kB. HTTP local: health/live 200, resumenes sin sesion 401, orders/send/revert 404. Los fixtures/concurrencia destructiva en BD compartida no se ejecutaron.

## Alcance final corregido: solo Home - 2026-10-22

El propietario detiene el adelanto de la bandeja y sus acciones: restaurar vacio, solo Home por ahora. Resultado vigente en ese corte historico (sustituido parcialmente por52):

- GET /formalization/contracts/summary permanece registrado; desde 027 exige rol efectivo formalizacion y formalizacion.home.stages.read, sin deny; banner conectado.
- Bandeja/listado real y botones envio/reversion retirados del frontend; volver a una cola no dispara consulta de ordenes ni muestra registros cargados.
- GET /formalization/contracts/orders y POST /formalization/contracts/send/revert NO registrados en el grafo AppModule. El inventario de 50 handlers corresponde al corte 2026-10-22, anterior a nuevos resumenes/timeline; no es el total vigente. Prueba explicita impide reintroducir esas tres rutas como si ya estuvieran aprobadas para runtime.
- ENABLE_LEGACY_WRITES=false local; fallback y bitacora permanecen activos. Las clases internas/DTO/pruebas preparadas de comandos y listado no equivalen a endpoints habilitados.
- Se conservan las tablas legacy y permiso025 ya aplicados; deshacer una pantalla no justifica borrar estructura ni historial. No se ejecutan nuevas mutaciones de BD durante esta correccion.

Los apartados siguientes documentan preparacion e historia de la entrega. Sus descripciones de comandos/listado no anuncian disponibilidad publica hasta una autorizacion posterior.

## Contratos: resumen y transiciones por fuente - 2026-10-22

Este corte sustituye la condicion provisional de ceros y aclara que el envio contractual es un hecho NUEVO del CRM, no un campo ERP faltante. Reglas autorizadas:

| Condicion/accion | Resultado |
| --- | --- |
| Orden activa, no caida, tres aprobaciones completas y sin etapa CRM posterior | Por enviar, derivado sin insertar un evento durante GET |
| Registrar envio con confirmacion en el cliente | contract_pending_send -> contract_pending_signature; sin correo ni ERP |
| Revertir envio con motivo | contract_pending_signature -> contract_pending_send; nuevo evento, nunca borrar el anterior |
| Cualquier otra etapa posterior registrada | No vuelve automaticamente a estas dos colas |
| Firma historica ERP | No se usa para inferir el envio ni alterar el punto de partida del nuevo circuito |

### Fuentes y almacenamiento

- Nativo primero por identidad local; id_old_produccion_sales_order excluye su equivalente legacy incluso si la fila nativa ya esta inactiva, borrada o no cumple aprobaciones.
- Las ordenes exclusivamente legacy conservan sus etapas en crmdatabase-api.audit_sales_order_state_event; lookup conf_sales_order_state. Las dos tablas aditivas existentes en SQL/021 fueron aplicadas con los statements revisados de migracion021, sin reproducir otras migraciones ni modificar ordenventa. Verificados dos motores InnoDB, nueve codigos y cero eventos; fingerprint SHOW CREATE TABLE ordenventa conservado.
- Para solicitudes con ID legacy: sondeo de alias nativo; si existe, bloqueo/gestion nativa sin depender de legacy habilitado. Si no existe, bloqueo del padre legacy y nueva consulta nativa FOR UPDATE antes de decidir donde escribir. No se crean ordenes nativas ni se promocionan por mover una etapa.
- La mutacion y sus historiales especializados/centrales usan una sola conexion nativa y Transaction con SQL legacy cualificado. RecordAuditService debe estar habilitado; un fallo aborta todo el cambio. Evidencia central siempre en CRM_THINK_V2, con identidad original legacy y procedencia efectiva nativa para filas migradas.
- expectedSequence rechaza pantallas desactualizadas. operationId ULID/UUID permite reintento del mismo contenido/actor, sin duplicar eventos; reutilizarlo con contenido distinto devuelve conflicto. Cada reversion conserva motivo, actor, fecha UTC y antes/despues. El primer envio guarda el estado derivado previo en la evidencia central, sin inventar fecha historica de entrada a Por enviar.
- Futuros migradores deben bloquear el padre legacy y copiar/reconciliar la trayectoria en la MISMA promocion antes de hacer autoritativa la fila nativa. Este corte no implementa el migrador ni certifica una migracion externa que ignore el protocolo; importar solo la fila y olvidar sus etapas no es una migracion completa.

### API y autorizacion

| Ruta | Regla |
| --- | --- |
| GET /formalization/contracts/summary | Rol activo formalizacion; Owner/Jefatura/modulo/permiso de aprobaciones no lo sustituyen |
| POST /formalization/contracts/send | Rol activo formalizacion y formalizacion.contracts.send efectivo; deny directo prevalece |
| POST /formalization/contracts/revert | Rol activo formalizacion y formalizacion.contracts.revert efectivo; motivo obligatorio |

Sesion BFF y controles globales CSRF para comandos. Servicios revalidan antes de consultar ambas fuentes; DTO prohibe actores/propiedades adicionales. Respuestas no-store. Los comandos reciben source (native/legacy), id (ULID nativo/id_ov decimal), expectedSequence, operationId y reason opcional solo para enviar. Devuelven source/id autoritativos, state, sequence y replayed. Un reintento no crea una nueva fecha de accion. El repositorio sigue siendo un colaborador interno, no una autorizacion alternativa.

025_contract_permissions aplicada solo en nativo: registra ambos permisos, asigna send solo al rol formalizacion, conserva overrides individuales y no asigna revert por defecto. Incrementa versiones de permisos de titulares y registra el cambio de seguridad. No amplia grants SQL ni altera credenciales.

El JSON de resumen contiene schemaVersion=1, observedAt UTC, total, toSend, pendingSignature y sources con subtotales nativo/legacy, legacyEnabled y duplicatesExcluded. Una transaccion READ ONLY / REPEATABLE READ abarca conteo nativo, paginas legacy de 500 y exclusion de IDs migrados. No devuelve totales parciales si falla una fuente configurada. Se puede retirar legacy de forma explicita apagando fallback.

Lectura real de verificacion: nativo 0/0, legacy 186/0, duplicados 0; total 186 Por enviar y 0 Pendientes de firma. Es una observacion puntual, no semilla ni garantia de conteo futuro. No hubo mutaciones de ordenes ni fixtures compartidos.

### Configuracion y limites de entrega

ENABLE_RECORD_AUDIT=true, ENABLE_LEGACY_FALLBACK=true y ENABLE_LEGACY_WRITES=true en .env local ignorado; NODE_ENV permanece development. El opt-in contractual permite etapas legacy desde el nuevo API local con permiso; los seis escritores de catalogos conservan su restriccion production. El pool legacy de SELECT sigue READ ONLY, separado del escritor transaccional cualificado.

Frontend: banner montado/consultado solo con rol activo formalizacion, preload, error distinto de cero y log DEV [Formalization API: contracts/summary] Incoming aggregate limitado a campos agregados validados. El log provisional anterior se retiro. Las mutaciones HTTP quedan preparadas, pero la lista operativa de ordenes y sus botones de envio/reversion no se agregan a las previews vacias en este corte. No se debe presentar una accion simulada como persistida.

Pruebas de comandos/consultas/autorizacion usan dobles; la lectura real comprueba conectividad/SQL, no atomicidad bajo fallos, restricciones de insercion o concurrencia MySQL real. El propietario sigue reservando la prueba de mover una orden real para una accion posterior elegida. No se ejecutaron correos/ERP ni cambios comerciales de ejemplo.

## Activacion local y migracion 024 aplicada - 2026-10-22

Evidencia nueva, posterior a los apartados historicos siguientes:

- Autorizada y aplicada solo 202610220024_record_audit_identifier_collation en CRM_THINK_V2 con el runner --only y doble confirmacion. Ledger registra 2026-10-22 22:24:47.978 segun el valor devuelto por el driver; no usar esa representacion como una conversion horaria nueva del ledger.
- Cinco columnas verificadas en utf8mb4_0900_bin / NO PAD: cuatro claves de audit_record y operation_id_record_event. Indices uq_audit_record_identity (cuatro columnas) y uq_audit_record_event_operation (dos columnas) conservados completos, unicos y sin prefijos. Segunda ejecucion del runner omitio la migracion ya aplicada.
- Ambas BD son accesibles en el mismo servidor MySQL 8.0.45. audit_record, audit_record_event, crm_project, proyectos y ordenventa son InnoDB. No se altero ninguna tabla legacy.
- SHOW GRANTS de la cuenta configurada confirma privilegios amplios CRUD y DDL sobre ambos esquemas. No se crean usuarios, cambian passwords ni modifican grants compartidos. El propietario pide conservar las operaciones normales. Auditoria append-only es una disciplina del codigo actual, NO una garantia de inmutabilidad SQL ante esa cuenta administrativa.
- .env local ignorado por Git: ENABLE_RECORD_AUDIT=true y ENABLE_LEGACY_FALLBACK=true; NODE_ENV permanece development y no se activa ENABLE_LEGACY_WRITES. Es configuracion local, no despliegue remoto.
- Reiniciado unicamente el watch del API de este checkout. GET http://127.0.0.1:3000/health/live devolvio status ok y /health/ready status ready. Con la configuracion validada del .env, RecordAuditService.onModuleInit aprobo el preflight, enabled fue true, la conexion nativa devolvio CRM_THINK_V2 y el pool legacy devolvio crmdatabase-api con session.transaction_read_only=1.
- La compuerta de escritores legacy sigue false en desarrollo. No se cambia NODE_ENV para sortearla y no se implementan aqui las mutaciones de ordenes exclusivamente legacy ni el endpoint de estados. Las escrituras de catalogo existentes usan la transaccion nativa con SQL cualificado cuando su opt-in productivo este activo; el pool legacy de lectura no se convierte en escribible.
- El propietario pospone la operacion controlada hasta elegir una orden y su cambio de estado. No hubo DML comercial, fixtures ni eventos artificiales. Conteos tras 024: audit_record=0 y audit_record_event=0. No certificar commit/rollback ni concurrencia real con esa evidencia.
- Cuatro suites focalizadas sin conexion aprobadas: 82 pruebas (identificadores/preflight/escritor/puente). No se repitio check-all por cambios de codigo: este avance solo modifica configuracion local y documentacion, ademas de ejecutar la migracion existente. Los resultados generales anteriores conservan su fecha y alcance.

Rollback local de activacion: ENABLE_RECORD_AUDIT=false y reiniciar el API. No elimina eventos ni revierte DDL. La 024 conserva datos y no tiene rollback automatico; cualquier reconciliacion posterior debe ser explicita. No se certifica una restauracion de respaldo mediante este avance.

## Escritores conectados, activacion pendiente - 2026-10-22

Decision posterior a la revision con tres subagentes: implementar y verificar mediante pruebas unitarias, sin otra instancia ni fixtures/escrituras de validacion contra las BD actuales. Este apartado sustituye el estado anterior de solo esquema para los escritores enumerados abajo. La evidencia de aplicacion 023 permanece historica; 024 continua preparada, no aplicada. No hubo conexion MySQL, migraciones, cambios de grants ni edicion de `.env` en este avance.

### Alcance implementado en codigo

| Escritor | Conexion y limites |
| --- | --- |
| Proyectos, campanas, clases, ubicaciones, subsidiarias, corredores y expedientes de catalogo | El puente de SecurityAuditService registra el changeset en las tablas centrales dentro de la misma Transaction ya usada por cada repositorio; conserva audit_security_event y los adaptadores legacy existentes |
| Usuarios y roles administrativos | Mismo puente para altas/ediciones/estado/accesos/permisos que ya producen buildAuditChangeSet; no registra passwords, hashes, sesiones ni tokens como campos comerciales |
| Estados y aprobaciones internas de ordenes nativas | SalesOrderLifecycleRepository agrega el evento central en la transaccion de su proyeccion e historiales especializados, con actor obtenido de BD antes del cambio. Reintentos especializados existentes no duplican ni inventan historial central anterior |
| Orden nativa correlacionada con id_ov | Usa identidad canonica legacy en el expediente y PK nativa como procedencia efectiva; no crea ordenes ni escribe en ordenventa. El registro de auditoria no cambia autoridad comercial |
| Orden exclusivamente legacy, API viejo, ERP y SQL directo | No se agrego un escritor comercial ni captura externa automatica. No afirmar cobertura de esos cambios; el modelo central permite su referencia cuando se implemente el adaptador autorizado |

La compuerta nueva `ENABLE_RECORD_AUDIT` es booleana validada y vale false por defecto. Se documenta en `.env.example`; no se activa en `.env`. Con false, el escritor central no se invoca y se mantiene el historial anterior. No es una habilitacion automatica de escritura legacy. El provider RecordAuditService se registra en AuditModule y se inyecta explicitamente; los constructores manuales anteriores conservan la ruta desactivada por defecto.

### Garantias del escritor y pruebas sin BD

- append exige la Transaction del cambio; no inicia otra transaccion ni abre un pool. Se rechaza una llamada standalone. Si falla la auditoria, el error se propaga y el caller debe revertir el cambio completo; no hay catch que confirme solo el dato comercial.
- El arranque con flag activo y cada append verifican DATABASE() nativa y ledger 023/024. Si faltan, se rechaza sin emitir DDL. El ledger no reemplaza una inspeccion de drift ni certifica privilegios; la 024 pendiente impide activar hoy este avance.
- Los actores y roles se capturan del servidor antes del cambio. Una marca privada en memoria distingue esa captura de JSON/lookalikes; se conserva una copia separada para que la mutacion posterior de un objeto no cambie la autoria historica. Los snapshots comerciales requieren changesets construidos en el servidor y conservan tambien entidad, ID y accion capturados, no valores expuestos que despues se alteraron.
- El puente resuelve la PK real con un registro cerrado de tablas/columnas nativas y CAST a texto, bajo bloqueo; no copia el formato del ID recibido ni usa nombres SQL del cliente. La tabla audit_record no crea ni promueve registros comerciales.
- Se bloquean expediente y ultimo evento con FOR UPDATE, se asigna secuencia por registro y se comprueba version esperada cuando se proporciona. Una operacion repetida exige igual contenido/actor estable; nunca reescribe el evento. Las claves centrales de ordenes usan SHA-256 con namespace para separar estados y tipos independientes de aprobacion.
- Los callers actuales bloquean primero el padre comercial. La creacion concurrente de un expediente sigue dependiendo de ese acuerdo comun; un error UNIQUE/deadlock aborta la transaccion y requiere reintento completo, no un reintento local que oculte un cambio parcial. No se certificaron carreras reales ni bloqueo compartido con un migrador futuro mediante estas pruebas.
- El contrato JSON conserva orden de arrays, diferencia ausencia de NULL y genera cambios por ruta JSON Pointer. Rechaza objetos no JSON, getters, ciclos, claves sensibles/prototipo, numeros no seguros, profundidad mayor a 16 y payload final mayor a 256 KiB. No trunca snapshots. El helper administrativo anterior conserva su comparacion de colecciones como conjuntos para no cambiar su API; la evidencia comercial conserva una copia segura separada y se marca partial.
- No se expone restore ni snapshots full. Las acciones genericas no admiten restore; referencias/documentos/relaciones excluidas no se pueden recuperar de una copia parcial. Una futura reversion requiere motivo y su regla comercial propia.

Los IDs administrativos de operacion/correlacion se enlazan al ULID del evento de seguridad generado por esa llamada. No se inventa idempotencia HTTP del request ni una correlacion global entre multiples llamadas anteriores; las ordenes conservan operationId/correlationId del contexto interno con namespace central. Los eventos de login/logout y otros hechos de seguridad sin changeset permanecen solo en audit_security_event.

### Permisos y condicion de activacion

AuditReadService y el guard reutilizan canReadAudit: role.assign deny siempre prevalece, incluso con Owner activo y grants duplicados. Se conservan permisos concretos de catalogo/usuario/rol y sus controles de recurso; no se agrega un bypass por activar logging. La lectura central de audit_record_event y las mutaciones publicas de ordenes todavia no tienen endpoints/permisos nuevos; el repositorio de lifecycle sigue interno y no autoriza por si mismo una peticion HTTP.

Para activar despues: aprobar respaldo/ventana de esquema, aplicar y comprobar 024 exclusivamente en nativo con el procedimiento existente, verificar InnoDB y misma conexion para los escritores nativo/legacy existentes, preparar privilegios dedicados SELECT/INSERT para evidencia sin UPDATE/DELETE, y entonces configurar explicitamente ENABLE_RECORD_AUDIT=true. No se altera una credencial compartida para lograrlo. Restauracion integral, captura externa y pruebas MySQL de FK/CHECK/rollback/concurrencia permanecen pendientes; el usuario no autoriza usar las BD con datos como fixtures. Unidades y SQL compilado son evidencia del flujo de codigo, no sustitutos de esas pruebas.

### Verificacion de esta entrega

Revision cruzada con Tesla, Lagrange y Mencius: se corrigieron la procedencia mutable del changeset, la inyeccion del provider en pruebas y la atribucion del lifecycle al modulo registrado formalizacion. Se conservaron las auditorias y contratos anteriores; no se agregaron permisos, endpoints ni correos.

Resultado final de check-all.cmd: salida 0; formato, lint, typecheck, pruebas y build aprobados en API y frontend. API: 5033 pruebas aprobadas y 113 omitidas (21 suites MySQL). Frontend: 428 aprobadas. Se deshabilitaron en el proceso las 24 banderas de fixtures MySQL, fallback/escritura legacy y ENABLE_RECORD_AUDIT, sin editar .env. Las pruebas del escritor habilitado usan dobles en memoria, no conexiones reales. Documentos modificados parseados y git diff --check aprobado. Persiste la advertencia no bloqueante del chunk vendor frontend mayor a 500 kB. Sin medicion nueva de cobertura, commits, push ni certificacion de CI remoto.

## Bitacora central de registros - 2026-10-22

Decision vigente del propietario: una bitacora comercial central en `CRM_THINK_V2`, preparada para `sales_order`, `lead` y otras entidades. No habilita funcionalidades de Leads. Una orden que solo vive en `crmdatabase-api.ordenventa` se identifica por ese esquema, tabla e `id_ov`, sin crear `crm_sales_order` ni FK contra la orden. Esto sustituye la propuesta anterior de exigir que el nuevo historial viva en la misma fuente que el registro. La autoridad del dato comercial sigue siendo nativo si existe; legacy en caso contrario.

Estado implementado: migracion `202610220023_record_audit` y SQL revisable [023_record_audit.sql](SQL/023_record_audit.sql). Aplicada exclusivamente en la BD nueva. Dos tablas InnoDB, 32 columnas con COMMENT, tres claves unicas adicionales, doce CHECK y dos FK internas de auditoria. Verificacion posterior de metadatos y ledger aprobada; ambas tablas vacias. No se insertaron fixtures, no se altero ninguna tabla comercial ni se abrio conexion a produccion en este corte.

Verificacion inicial de creacion, anterior a la revision con subagentes: ocho pruebas nuevas sin conexion, incluidas rechazo de esquema productivo y rechazo de tablas existentes sin ledger; 22 aprobadas junto al inventario de migraciones. `check-all.cmd` completo aprobado: formato, lint, typecheck, tests y builds; API 4874 aprobadas y 113 omitidas, frontend 428 aprobadas. Las 24 banderas de fixtures MySQL se deshabilitaron en el proceso de verificacion, junto con lectura/escritura legacy; no se modifico `.env`. En MySQL real solo se ejecuto esta migracion nativa y consultas de metadatos/conteo, no casos de insercion/restauracion ni pruebas de concurrencia. Build frontend conserva advertencia de chunk vendor mayor a 500 kB; no se cambio UI ni dependencias en este corte.

**Limite importante:** esto es la estructura, no un interceptor que ya registra cada operacion. Los escritores actuales conservan sus auditorias existentes; todavia no escriben en estas tablas nuevas. No hay endpoint nuevo, lectura de historial comercial, restauracion ejecutable ni banner de Contratos conectado. SQL/021 legacy permanece como artefacto historico pendiente de DBA; no se ejecuto ni se necesita para crear esta bitacora central. No borrar ni copiar masivamente eventos existentes al nuevo modelo sin un plan separado.

### Revision independiente con tres subagentes - 2026-10-22

Alcance: Newton revisa integridad SQL/identidades, Ampere seguridad/fidelidad/restauracion y Jason prueba preflight/errores sin conexion. El coordinador revisa el CLI, integra cambios y verifica el conjunto. Son revisiones del mismo producto con responsabilidades separadas; la coincidencia entre revisores no sustituye pruebas ni certifica produccion. Ningun revisor ejecuto conexiones o fixtures MySQL en esta revision.

Evidencia focalizada final: cinco suites y 92 pruebas aprobadas (8 estructura, 18 preflight, 30 identificadores, 23 parser/inventario y 13 orquestador). La prueba de doble fallo reprodujo el error ocultado antes de corregirlo. Los revisores vuelven a contrastar el parche integrado; la aplicacion 023 y el estado de tablas corresponden a la evidencia de creacion anterior, no a una nueva lectura de BD en esta revision.

Validacion general final del arbol local: `check-all.cmd` aprobado tras el ultimo ajuste; API 4944 aprobadas/113 omitidas y frontend 428 aprobadas, con formato, lint, typecheck y builds aprobados. Una corrida intermedia rechazo throw dentro de finally (no-unsafe-finally); se corrigio conservando el error en un contenedor y propagandolo despues de finally, sin desactivar la regla. Advertencia no bloqueante vigente: chunk vendor frontend mayor a 500 kB. Se mantuvieron deshabilitadas las 24 banderas de fixtures y ambos accesos legacy en el proceso, sin editar `.env`. No se ejecuto DDL ni se reabrieron conexiones MySQL en esta revision. No se midio cobertura nueva ni se certifica CI remoto o clon limpio; no se realizaron commits/push.

| Punto cuestionado | Decision y evidencia |
| --- | --- |
| CLI con --only mal escrito podia seleccionar todas las migraciones | Corregido: parser estricto antes de configurar conexion. Acepta cero argumentos (comportamiento general anterior) o exactamente --only=nombre aprobado; rechaza errores, opciones duplicadas y desconocidas. Pruebas unitarias y CLI real con dotenv deshabilitado y esquema deliberadamente no autorizado |
| Comparacion exacta de IDs | Hallazgo confirmado: utf8mb4_bin tiene PAD SPACE, por lo que abc y abc seguido de espacio no son identidades distintas para UNIQUE. Correccion aditiva 024 preparada para NO PAD; NO aplicada en esta revision. La 023 aplicada se conserva intacta |
| Auditoria completa de todos los escritores | No implementada: no hay referencias runtime a las tablas nuevas en src. No aprobar como captura comercial operativa; conservar las auditorias anteriores hasta instrumentar cada escritor |
| Inmutabilidad | Condicional a privilegios dedicados y contrato del escritor; no certificada por el DDL ni por la existencia de FK. No se modifican grants compartidos |
| Restauracion | No habilitada: la FK solo prueba mismo registro y version anterior. No prueba elegibilidad del snapshot objetivo ni compatibilidad comercial; requiere validacion transaccional propia |
| Restricciones MySQL y concurrencia reales | Pendientes de instancia desechable autorizada. DummyDriver y aserciones de SQL no ejecutan CHECK, FK ni bloqueos de MySQL |
| Fallos del runner completo tras DDL parcial | Se agregan trece pruebas del orquestador real con driver en memoria: ledger solo tras resolver up asincrono, sin ledger ni siguiente migracion ante fallo, liberacion/cierre en errores y salto de entradas ya aplicadas. Se reprodujo y corrigio que un fallo de destroy ocultaba el error original; ahora se conserva ese error con aviso generico de limpieza, y un fallo de cierre aislado sigue fallando. Comprueban el flujo y la llamada a destroy; no prueban una conexion MySQL ni atomicidad del DDL real |

Fundamento de la correccion de comparacion: [manual oficial MySQL, collation binaria y atributo PAD](https://dev.mysql.com/doc/mysql-g11n-excerpt/8.0/en/charset-binary-collations.html). La 024 debe verificar soporte de utf8mb4_0900_bin con NO PAD y compatibilidad de columnas antes de ALTER; solo cambia las claves VARCHAR de identidad/idempotencia, sin modificar PK/FK ASCII ni tablas comerciales. No se autoriza ejecutarla contra produccion ni se aplica automaticamente al arrancar.

La 024 esta registrada para ejecucion manual seleccionada, no aplicada en esta revision. Tras aprobar una ventana de esquema nativo y su respaldo, usar `pnpm migrate:identity:schema --only=202610220024_record_audit_identifier_collation` con la confirmacion de esquema habitual. Son dos ALTER independientes; si falla uno, detenerse y reconciliar estado/ledger con DBA, sin reintento ciego ni rollback destructivo. Puede bloquear o reconstruir indices: no anunciar cero downtime. Las columnas de procedencia de cada evento conservan su collation anterior; relacionar eventos por su FK ASCII record_id, no unir por textos de origen con comparaciones implicitas diferentes.

Decision de liberacion: aceptar exclusivamente como base de esquema inactiva; no anunciar captura completa, historia inmutable certificada ni restauracion ejecutable. Antes de activarla, cerrar captura/actor confiable, contratos de snapshots sin secretos, autorizacion por recurso, atomicidad comercial+auditoria, conciliacion de identidades y concurrencia, privilegios dedicados y pruebas MySQL aisladas. Un contador de lectura no necesita fingir que estas escrituras ya existen.

### Identidad del registro: audit_record

Separa el expediente de auditoria de la existencia del registro comercial. Conserva identidad incluso si se borra el registro o se migra. Su fila sirve tambien como bloqueo por registro para el futuro escritor transaccional; no se usa un contador global.

| Columna | Tipo | Proposito |
| --- | --- | --- |
| `id_record` | CHAR(26), PK | ULID del expediente, independiente del ID comercial |
| `source_schema_record` | VARCHAR(64) | Esquema original, por ejemplo crmdatabase-api |
| `entity_type_record` | VARCHAR(64) | Tipo canonico, por ejemplo sales_order o lead |
| `source_table_record` | VARCHAR(64) | Tabla fisica original, por ejemplo ordenventa |
| `source_id_record` | VARCHAR(191) | PK original como texto, por ejemplo id_ov; no ID NetSuite/Odoo |
| `created_at_record` | DATETIME(3) UTC | Cuando se creo el expediente, no una fecha comercial inventada |

La tupla esquema/tipo/tabla/ID es unica y en la 023 usa utf8mb4_bin, sensible a mayusculas pero con PAD SPACE; no prometer distincion de espacios finales mientras no se aplique la correccion 024. El escritor debe obtener la PK canonica del registro realmente resuelto, no copiar la representacion recibida del cliente: 001 y 1 no crean expedientes distintos para una PK entera. No recortar arbitrariamente claves textuales legitimas. Una futura migracion debe resolver el mismo expediente por el `id_ov` preservado antes de generar una nueva identidad; el expediente mantiene su origen y cada evento registra el destino efectivo. La conciliacion de identidades entre fuentes aun no esta implementada. No interpretar una fila de audit_record como prueba de que la orden ya existe en nativo.

### Eventos inmutables: audit_record_event

| Columna | Tipo | Proposito |
| --- | --- | --- |
| `id_record_event` | CHAR(26), PK | ID estable del evento |
| `record_id_record_event` | CHAR(26), FK interna | Expediente auditado, nunca FK comercial |
| `sequence_record_event` | INT UNSIGNED | Version consecutiva por registro; inicia en 1 |
| `action_record_event` | VARCHAR(32) | create, update, delete, state_change, approval_change, revert, restore, import_snapshot o annotation |
| `module_record_event` | VARCHAR(64) | Modulo que genero la accion |
| `origin_record_event` | VARCHAR(32) | crm, integration, migration o job |
| `source_schema_record_event` | VARCHAR(64) | Esquema realmente afectado u observado |
| `source_table_record_event` | VARCHAR(64) | Tabla afectada en ese momento |
| `source_id_record_event` | VARCHAR(191) | PK afectada en ese momento, como texto |
| `actor_kind_record_event` | VARCHAR(16) | user, service o unknown; unknown solo para evidencia importada |
| `actor_reference_record_event` | VARCHAR(191), nullable | Identidad estable del actor, sin FK que borre evidencia |
| `actor_snapshot_record_event` | JSON objeto | Nombre/roles del actor o identidad del servicio al actuar |
| `occurred_at_record_event` | DATETIME(3), nullable | Momento efectivo UTC; desconocido solo al importar |
| `recorded_at_record_event` | DATETIME(3) UTC | Momento en que MySQL registro la evidencia |
| `operation_id_record_event` | VARCHAR(100) | Clave idempotente por registro |
| `correlation_id_record_event` | VARCHAR(100) | Agrupa eventos de una peticion/proceso |
| `reason_record_event` | VARCHAR(1000), nullable | Motivo; obligatorio para revert o restore |
| `snapshot_version_record_event` | INT UNSIGNED | Version del contrato de snapshots de la entidad |
| `snapshot_scope_record_event` | VARCHAR(16) | full, partial u observation, sin promesa automatica de restauracion |
| `before_record_event` | JSON objeto, nullable | Valores completos permitidos antes del cambio |
| `after_record_event` | JSON objeto, nullable | Valores completos permitidos despues del cambio |
| `changes_record_event` | JSON array | Diferencias por ruta; valores y presencia anterior/nueva |
| `restored_sequence_record_event` | INT UNSIGNED, nullable | Version anterior del mismo expediente restaurada; FK compuesta |
| `request_id_record_event` | VARCHAR(100), nullable | Peticion interna, sin cuerpos ni headers |
| `ip_address_record_event` | VARCHAR(80), nullable | IP si la politica de privacidad lo permite |
| `user_agent_record_event` | VARCHAR(500), nullable | Contexto de cliente acotado, no identidad confiable |

Cada creacion exige after y ausencia de before; cada borrado exige before y ausencia de after; update, transicion, aprobacion, reversion y restauracion exigen ambos. Un import_snapshot solo registra after observado, sin inventar pasado, con cobertura observation. Una anotacion no sustituye un evento de cambio. Los campos JSON deben ser objetos, salvo changes que es una lista. No se usa JSON null como sustituto ambiguo de SQL NULL.

### Contrato del futuro escritor y de las versiones

1. Autorizar la accion, el recurso y el alcance en el servidor antes de leer/mutar datos. Lectura de historial y restauracion requeriran permisos separados; no se conceden aqui.
2. Resolver autoridad y correlacion sin crear orden nativa para auditar legacy. Compartir exclusion con el importador/migrador; no elegir fuente con una consulta desbloqueada y escribir despues.
3. Dentro de la misma transaccion, obtener o crear audit_record y bloquear su fila con FOR UPDATE. Leer el ultimo evento con lectura actual bloqueante, validar version esperada del cliente, estado comercial y snapshot before actual. El bloqueo y la consecutividad son responsabilidad del escritor; UNIQUE evita duplicados pero no demuestra por si solo una secuencia sin saltos.
4. Aplicar el cambio comercial y registrar evento/snapshots del agregado, incluidas relaciones relevantes, atomicos. Si falla auditoria, debe fallar el cambio. Para legacy + auditoria nativa esto requiere tablas InnoDB, mismo servidor y misma conexion/transaccion con esquemas cruzados; dos pools/transacciones independientes no bastan. Si no se dispone de esa garantia, bloquear la operacion o disenar outbox/reconciliacion explicitamente antes de habilitarla.
5. La clave de operacion unica evita duplicar por reintento. Comparar actor, accion, objetivo, motivo y contenido: misma clave con distinto contenido es conflicto, no exito. No deducir orden del ULID ni de fechas; usar sequence.
6. Usar contratos allowlist versionados por entidad, no req.body ni SELECT * serializado sin revision. full significa todos los campos comerciales restaurables declarados, no passwords, hashes, tokens, sesiones o payloads personales innecesarios. El contrato debe declarar exclusiones y cobertura; partial no es suficiente para restaurar todo un agregado.
7. Mantener orden de arrays y distinguir campo ausente de NULL: cada diferencia contiene path, beforeExists, afterExists, before y after. Importes DECIMAL y BIGINT se serializan como texto cuando corresponda para no perder precision; fechas UTC ISO. Conservar versiones/referencias inmutables de documentos y relaciones; el JSON no recupera archivos eliminados.

La captura debe instrumentarse en cada escritor autorizado y adaptador que se habilite. No se acredita captura de cambios hechos directamente en SQL, en el API viejo o por un ERP externo sin integracion/CDC; una observacion posterior no demuestra quien hizo el cambio ni cuando. Las lecturas, fallos de acceso y eventos de seguridad continuan en sus registros propios; esta tabla representa hechos comerciales confirmados, no peticiones que luego hicieron rollback.

### Restaurar no es borrar historial

Ejemplo: v1 Por enviar, v2 Pendiente de firma y v3 reversion a Por enviar con actor y motivo. v2 permanece intacta. Si se restaura el agregado a los valores after de v1, el futuro evento restore debe contener before actual, after validado, motivo y restored_sequence=1. La FK exige que el objetivo pertenezca al mismo expediente y CHECK que sea una version anterior.

Antes de habilitar restauracion: presentar diferencias, exigir permiso/confirmacion/motivo, comprobar version actual y contrato compatible, validar reglas comerciales y relaciones, y ejecutar una nueva mutacion transaccional. Bajo el mismo bloqueo se debe verificar que el evento objetivo tenga after no nulo, cobertura full real y contrato compatible; no basta marcar full el evento nuevo. Rechazar objetivos delete, annotation sin snapshot, import_snapshot/observation o partial como copia integral. No copiar ciegamente PK, IDs externos, columnas calculadas, credenciales ni aprobaciones que requieran revalidacion. Tampoco se puede reconstruir pasado anterior al primer evento observado.

No deshacer automaticamente correos, cobros, firmas, acciones ERP ni archivos externos. Una compensacion externa requiere su propio flujo aprobado. Mantener snapshots y bitacora no reemplaza backups/PITR ni permite recuperacion garantizada ante perdida de BD o manipulacion por administradores.

### Integridad, acceso y operacion

Append-only es el contrato del escritor: no agregar update/delete de eventos ni cascadas. Las FK usan restriccion, no borrado en cascada. Este DDL no impide por si solo a una credencial privilegiada modificar eventos. La cuenta runtime debera tener SELECT/INSERT en estas tablas y no UPDATE/DELETE; DBA debe validar privilegios dedicados, backups, acceso a datos personales y retencion antes de certificar inmutabilidad. No se cambiaron grants ni credenciales compartidas.

Indices: historial por expediente/secuencia, idempotencia por expediente/operacion, consultas por fecha, actor y correlacion. Para analisis de duracion entre estados conservar codigos/fechas en snapshots y usar los eventos especializados del dominio cuando se conecten; no interpretar toda edicion como transicion de etapa. Los reportes deben distinguir tiempo efectivo conocido del momento de importacion.

Aplicacion exacta usada desde apps/api, con `.env` nativo y confirmacion de esquema en el entorno:

```powershell
pnpm migrate:identity:schema --only=202610220023_record_audit
```

No ejecutar toda la cadena para este corte ni activar fixtures. El runner exige MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2; la migracion verifica DATABASE() antes de DDL y rechaza tablas objetivo existentes sin ledger, evitando ocultar drift. DDL MySQL no es una transaccion: si se crea solo una tabla y falla la segunda, conservar evidencia y reconciliar con DBA, no borrar datos para reintentar. Reversion operativa: no conectar nuevos escritores; conservar tablas y evidencia, sin DROP automatico.

## Contratos pendientes: reglas confirmadas y proximo trabajo - 2026-10-22

Alcance del corte de Contratos registrado en este apartado: documentacion unicamente. El propietario pide guardar la idea y define como siguiente entrega conectar el banner al API y a las dos fuentes; no ejecutar todavia esa implementacion. La ampliacion posterior de bitacora esta descrita arriba y no conecta Contratos. No existe por este registro un nuevo endpoint, DTO, permiso aplicado ni contador conectado. Los ceros actuales siguen siendo provisionales.

### Estados distintos dentro de un mismo banner

| Estado CRM existente | Etiqueta | Poblacion |
| --- | --- | --- |
| `contract_pending_send` | Por enviar | Orden valida con las tres aprobaciones completas y sin registro de envio del contrato |
| `contract_pending_signature` | Pendientes de firma | Envio registrado y firma aun pendiente; no vuelve a contarse como Por enviar |

La cantidad es un conteo, no el codigo del estado. Tres aprobaciones completas habilitan el ingreso a Por enviar, no prueban que el contrato siga sin enviar despues. Una orden solo puede estar en uno de estos dos estados actuales; las firmadas o avanzadas no se suman a ninguno por conservar sus checks aprobados. No inferir etapa historica ni fecha de envio/firma que no se pueda demostrar.

Requisitos de aprobacion para el ingreso:

| Verificacion | Legacy `ordenventa` | Valor normalizado nativo |
| --- | --- | --- |
| Jefe de Ventas | `chekJefeVenta = 1` | `sales_management = approved` |
| Formalizacion | `aprobacion_forma_ov = 1` | `formalization = approved` |
| Desarrolladora | `aprobacion__rdr_ov = 1` | `developer = approved` |

Se mantienen las condiciones previas de orden valida: legacy `status_ov = 1` y `caida_ov = 0`; nativo activo, no caido y no eliminado. Unknown no equivale a approved. Antes de conectar el contador se debe contrastar como representa cada fuente el envio, la firma y la etapa actual; no inventar columnas ni deducir envio desde un check de aprobacion. No crear otro modelo de estados si los dos codigos ya existentes cubren este corte.

### Acciones futuras y permisos

- Registrar envio: boton y confirmacion, sin nota obligatoria; agrega el evento y mueve Por enviar a Pendiente de firma. No manda correo, no llama a un ERP y no verifica entrega del mensaje: el envio real se realiza en otro sistema.
- El rol activo `formalizacion` heredara Registrar envio de contrato. Deshabilitarlo para una persona requiere un deny directo, que vence al allow heredado. Eliminar ese override restablece la herencia del rol, no conserva la denegacion. No aplicar grants ni asignar usuarios en esta entrega documental.
- Revertir registro de envio sera un permiso independiente. Pendiente de firma puede volver a Por enviar con motivo obligatorio guardado como nota ligada al evento. La asignacion por defecto de este permiso separado no se presume.
- La reversion agrega una nueva transicion; no borra ni reescribe la anterior. No autoriza retroceder desde firma u otras etapas no definidas.
- El CRM no gestiona reenvios de correo; que otro sistema reenvie no crea automaticamente evento ni estado aqui. Este corte no agrega una accion Reenviar ni integracion de mensajeria.

Por cada transicion, conservar identidad de la orden y de la fuente, identificador del evento, actor, fecha/hora del servidor, accion, estado anterior y nuevo, valores anteriores/nuevos de los campos afectados, motivo si aplica, secuencia/version y referencias de operacion/correlacion. Reutilizar el historial y sus garantias de idempotencia existentes; la nota de reversion debe ser atomica con el cambio. No copiar secretos ni payloads completos de proveedor a la bitacora publica.

### Lectura global del banner: siguiente entrega, no implementada

- Consultar nativo y legacy mediante los puertos/adapters existentes y producir un solo JSON canonico para ambos subtotales. El frontend no une consultas de BD ni conoce nombres de columnas legacy.
- Toda identidad nativa correlacionada mediante el `id_ov` antiguo suprime su equivalente legacy antes de aplicar filtros/conteos, incluso si la fila nativa ya no cumple condiciones. Nunca sumar dos veces ni mezclar aprobaciones de una copia con la etapa de otra.
- La eleccion de autoridad para futuras mutaciones sigue igual: nativo si existe; legacy si no existe; nunca ambas. Estas lecturas no migran ni cambian estados. La mutacion futura exige coordinacion entre migracion y escrituras, bloqueo comun y pruebas de concurrencia aisladas; una transaccion sin ese acuerdo no resuelve la carrera.
- Respetar el flag de lectura legacy. Si esta apagado, indicar explicitamente `legacyEnabled = false`; no presentar el resultado como combinacion verificada de ambas BD. Si una fuente habilitada falla, responder indisponibilidad, no cero ni total parcial aparente. No activar flags para esta revision.
- Entregar solo cantidades y procedencia necesaria, no todas las ordenes ni sus datos personales. El listado de detalle, si se autoriza despues, debe tener contrato propio y paginacion.

Visibilidad confirmada especificamente para Contratos pendientes: sesion valida, contexto Formalizacion y al menos rol activo `formalizacion`. Pertenencia al modulo sola, permisos directos sin ese rol o rol `jefe_formalizaciones` solo no sustituyen este minimo. Jefatura puede verlo cuando tambien tiene el rol base. No extender automaticamente excepciones administrativas de Owner. El backend debe rechazar sin leer ninguna BD de negocio y el frontend no debe montar/consultar el banner mientras no tenga el rol resuelto. Ver este banner no concede registrar envio, revertir ni aprobar.

El banner Pendientes de aprobacion conserva su permiso `formalizacion.home.approvals.read`; no se reemplaza por esta regla de rol. La lectura de Contratos pendientes no exige heredar ese permiso de aprobaciones.

Propuesta ilustrativa de respuesta global, no contrato HTTP implementado ni resultado real:

```json
{
  "schemaVersion": 1,
  "observedAt": "2026-10-22T18:00:00.000Z",
  "totals": { "pendingSend": 0, "pendingSignature": 0, "total": 0 },
  "sources": {
    "native": { "pendingSend": 0, "pendingSignature": 0 },
    "legacy": { "pendingSend": 0, "pendingSignature": 0 },
    "legacyEnabled": true,
    "duplicatesExcluded": 0
  }
}
```

`totals.total` sera la suma de los dos subtotales excluyentes despues de deduplicar. `observedAt` indica la respuesta, no un snapshot atomico entre BD. Los nombres exactos del DTO/ruta se decidiran al implementar, reutilizando el resumen de aprobaciones sin cambiar su contrato vigente.

Criterios para esa entrega: sin rol no hay consulta y hay rechazo API; las tres aprobaciones son necesarias; enviado no cuenta como Por enviar; firmado no cuenta como Pendiente de firma; identidad nativa oculta legacy; fuente fallida no aparenta cero; lectura sin escrituras. Las acciones de envio/reversion se desarrollaran aparte, con pruebas de deny por persona, confirmacion, motivo obligatorio al revertir, auditoria atomica y concurrencia. No se ejecutan fixtures contra las BD compartidas para comprobar estos criterios.

## Regla funcional confirmada por el propietario - 2026-10-22

- Con Aprobacion Jefe de Ventas, Aprobacion Formalizacion y Aprobacion Desarrolladora aprobadas, la orden inicia el ciclo CRM en Contratos pendientes / Por enviar. Este cambio de etapa es interno del CRM: no ordena actualizar un check del ERP.
- La existencia de la identidad de orden en `CRM_THINK_V2` decide la autoridad de gestion. Si existe, gestionar exclusivamente en nativo; no modificar su contraparte en `crmdatabase-api`. Si no existe, la gestion comercial permanece en legacy. La ampliacion de bitacora central de este documento separa la ubicacion de evidencia de la autoridad comercial. No es escritura comercial simultanea a ambas BD ni promocion automatica obligatoria.
- Correlacionar con la identidad legacy `id_ov` conservada en la referencia de migracion; los IDs o numeros de NetSuite/Odoo no sustituyen esa correspondencia. Una identidad nativa existente no debe volver a legacy por error de lectura, estado inactivo o error de escritura. Ante indisponibilidad no inferir ausencia ni usar fallback de escritura.
- Conservar auditoria de actor, origen, momento y transicion. La propuesta inicial de ubicarla siempre en la fuente autoritativa queda sustituida para eventos nuevos por la bitacora central descrita arriba; no mover ni borrar historial existente. No inventar trayectoria anterior al estado observado. La aplicacion concreta requiere controlar concurrencia entre migracion y mutaciones para no escribir datos comerciales en ambas fuentes.

Esta confirmacion define el ingreso y la autoridad de escritura; no acredita endpoints, cambios de checks, SQL/021 aplicado en legacy ni operaciones productivas ejecutadas. Las compuertas actuales siguen vigentes. Las reglas posteriores de firma, banco, saldo, llaves y cierre siguen pendientes de confirmacion. El contador de pendientes de aprobacion conserva su criterio anterior: Jefatura/Desarrolladora aprobadas y Formalizacion sin aprobar.

Estado documental 2026-10-22: nueve tablas de lifecycle/auditoria/referencias y persistencia interna, sin rutas HTTP de mutacion. Existe el contador real `GET /formalization/approvals/summary` descrito al final; sustituye el escenario local solo para ese indicador. Las aprobaciones son independientes de las etapas. Conteos, ejecuciones de migraciones, errores de conexion y pruebas fechadas son evidencia historica; SQL/021 no se ejecuto en esta revision. Ver [36 - Registro vigente](36-Registro-Entrega-Administracion.md) y [reauditoria](Reauditoria-54-Plan-y-Resultados.md).

## Resultado historico de la entrega 2026-10-20

- Nueva estructura aplicada en CRM_THINK_V2 mediante migraciones 202610200021 y 202610200022.
- Nueve tablas nuevas, nueve estados de referencia y tres tipos de aprobacion.
- Produccion crmdatabase-api: NO aplicada. Conexion existente crm_think_v2_legacy_reader rechaza CREATE/INSERT/UPDATE (1142/42000).
- El usuario eligio que un DBA ejecute Arquitectura/SQL/021_legacy_sales_order_state_additive.sql.
- No se modifica, renombra, elimina ni rellena ordenventa; sin triggers ni cambios al API viejo.
- Lectura antes/despues: 460 ordenes; 2 cumplen el criterio de pendientes de aprobacion.
- Ninguna orden real importada. Pruebas de persistencia usan rollback y dejan cero ordenes/eventos nuevos.
- El banner y la UI siguen con escenarios locales; no representan el conteo real.
- Este corte autoriza esquema y persistencia interna. No expone endpoints comerciales ni otorga permisos de aprobar.

## Evidencia del mapeo

Fuente leida: archivo salesorders.js entregado por el usuario (Estados_Aprobaciones).
Solo se inspecciono; no se ejecutaron llamadas a NetSuite ni escrituras del archivo.
Desarrolladora = aprobacion__rdr_ov = custbodyid_firma_rocca.
Jefatura = chekJefeVenta = custbody_aprueba_jefe_ventas.
Formalizacion = aprobacion_forma_ov = custbodyid_firma_rc.
El archivo viejo convierte todo lo distinto a T en cero. El nuevo mapper no hereda
esa perdida: valores desconocidos son unknown, nunca una aprobacion implicita.

## Estructura

crm_sales_order solo contiene identidad y hechos comerciales confirmados.
No almacena el estado actual de formalizacion como columna editable duplicada.
crm_sales_order_external_reference permite varios proveedores simultaneos y
evita duplicados por sistema/id. int_external_system identifica una cuenta de
proveedor: registrar cuentas distintas como sistemas diferentes si sus IDs colisionan.
Las relaciones internas usan PK propias. El id de produccion es un alias unico nullable.

crm_sales_order_approval proyecta el resultado actual de cada una de las tres
aprobaciones. audit_sales_order_approval_event conserva cada antes/despues y actor.
audit_sales_order_state_event es el recorrido de la orden; estado actual = ultimo
numero de secuencia de esa orden, no ultima fecha arbitraria.
audit_sales_order_change queda disponible para auditoria de campos comerciales.
int_sales_order_source_snapshot retiene los campos sin interpretar y la evidencia
original de importacion. No reemplaza columnas normalizadas ni debe exponerse
completo al frontend: contiene referencias/datos de cliente.

## Estados y limites

| Codigo | Nombre |
|---|---|
| unclassified | Sin etapa confirmada |
| pending_approval | Pendientes de aprobacion |
| contract_pending_send | Contrato por enviar |
| contract_pending_signature | Contrato pendiente de firma |
| bank_management | Gestion bancaria |
| pending_balance | Pendientes de saldo |
| pending_transfer | Traspasos pendientes |
| transfer_signed | Traspaso firmado |
| closed | Formalizacion cerrada |

El orden del catalogo es de presentacion, no una matriz autorizada de transiciones.
Gestion bancaria conserva la distincion futura sin iniciar/en proceso para definir
en el siguiente contrato operativo. No se crean fechas de hitos sin evidencia.
Firma de contrato no equivale a firma de traspaso. Cierre requiere validar las
reglas de saldo/traspaso/llaves antes de habilitar endpoints de operacion.
Si no puede demostrarse una etapa, importar unclassified. La regla confirmada
permite el ingreso a Por enviar con las tres aprobaciones; no demuestra si ya
hubo envio/firma ni autoriza inferir etapas posteriores desde checks o maquetas.
El candidato pending_approval requiere active, cancelled=no, developer=approved,
sales_management=approved y formalization=not_approved.

## Trayectoria, idempotencia y tiempo

Cada visita tiene secuencia propia, anterior/nuevo, actor, nombre/roles capturados,
motivo, origen, operationId y correlationId. Un regreso a una etapa agrega evento.
La persistencia bloquea la orden con SELECT FOR UPDATE y compara expectedSequence
o expectedVersion. Un reintento con el mismo operationId y contenido no duplica;
reutilizarlo con otro contenido genera conflicto.
La aprobacion actual y su auditoria se escriben en una misma transaccion.
Los historiales no tienen metodos update/delete en el repositorio. El bloqueo
append-only a nivel de privilegios DB queda como hardening: un administrador SQL
con permisos amplios puede modificar tablas; no se afirma inmutabilidad criptografica.

effective_at = fecha real conocida; recorded_at = cuando se guardo evidencia.
Snapshot inicial sin pasado: effective_at=null, actor=null, event_kind=import_snapshot.
No calcular duracion del pasado desconocido usando recorded_at de importacion.
Nuevas acciones CRM toman la hora UTC del servidor; no del navegador.
El servidor usa America/Guatemala (UTC-6). Se verifico y corrigio a
DEFAULT (UTC_TIMESTAMP(3)) en columnas nuevas, sin alterar zona global ni tablas viejas.
La fecha comercial DATE no tiene conversion de zona.

## Contrato JSON de observacion

Ejemplo sintetico, no una orden extraida de produccion:

```json
{
  "schemaVersion": 1,
  "identity": { "legacyId": 24, "nativeCode": "LEGACY-OV-24" },
  "externalReferences": [
    { "systemCode": "provider_a", "externalId": "900", "transactionNumber": "OV-24" },
    { "systemCode": "provider_b", "externalId": "SO-44", "transactionNumber": "VENTA-44" }
  ],
  "commercial": { "status": "active", "cancelled": "no", "currencyCode": null },
  "approvals": {
    "sales_management": "approved",
    "developer": "approved",
    "formalization": "not_approved"
  },
  "observedState": { "code": "pending_approval", "effectiveAt": null, "actor": null },
  "provenance": {
    "systemCode": "legacy_crm",
    "sourceRecordId": "24",
    "observedAt": "2026-10-20T20:00:00Z",
    "originalRecord": { "id_ov": 24 }
  }
}
```

El mapper incluye ademas los importes, fecha comercial y marcas normalizadas
documentadas abajo; el ejemplo abrevia esos campos y el snapshot para lectura.

mapLegacySalesOrder produce schemaVersion, identity, externalReferences, commercial,
approvals, observedState y provenance. provenance.originalRecord conserva TODAS
las columnas originales, incluso futuras columnas extra. El mapeo es una
transformacion pura, no un importador masivo ni un endpoint.
Un sobre de escritura posterior debe agregar operationId/correlationId y resolver
actores desde sesion confiable. No aceptar actor/roles/fechas del navegador.
Cada adaptador convierte el contrato al modelo destino. En produccion solo se
prepara almacenamiento de estado; no existe dual-write automatico en este corte.
Para sincronizar dos BD se requieren outbox, reintentos y conciliacion. Una
transaccion local no hace atomica una escritura en ambas bases.

## Mapeo completo de ordenventa

| Campo legado | Destino o tratamiento | Regla |
|---|---|---|
| id_ov | id_old_produccion_sales_order | Referencia unica; PK nueva independiente |
| id_ov_netsuite | external_id_sales_order_external_reference | Texto y sistema registrado; no FK comercial |
| id_ov_tranid | transaction_number_sales_order_external_reference | Numero visible por proveedor |
| id_ov_est | snapshot original: id_ov_est | Relacion de estimacion aun no conciliada; no usar como id nuevo |
| id_ov_opt | snapshot original: id_ov_opt | Relacion de oportunidad; confirmar semantica de fk_opt antes de conciliar |
| id_ov_admin | snapshot original: id_ov_admin | No asumir que corresponde a sec_user sin mapa de identidad |
| id_ov_lead | snapshot original: id_ov_lead | Lead legado; su dominio no se crea en este corte |
| idExpediente_ov | unit_file_id_sales_order tras conciliacion | No copiar numero externo como FK propia; conservar original en snapshot |
| idsubsidiaria_ov | subsidiary_id_sales_order tras conciliacion | Conciliar con crm_subsidiary |
| namesubsi_ov | snapshot original; nombre desde catalogo propio | Evitar duplicar nombre canonico |
| chek_ov | snapshot original: chek_ov | Semantica no demostrada por salesorders.js; no reinterpretar |
| contrado_frima_ov | contract_signed_sales_order | custbody90: yes/no/unknown; firma de contrato |
| cierre_firmado_ov | commercial_closure_signed_sales_order | custbody51: no se equipara automaticamente a traspaso ni cierre formalizacion |
| aprobacion_forma_ov | aprobacion tipo formalization | custbodyid_firma_rc; approved/not_approved/unknown |
| aprobacion__rdr_ov | aprobacion tipo developer | custbodyid_firma_rocca; no existe una cuarta aprobacion RDR |
| calculo_comision_asesor_ov | advisor_commission_calculated_sales_order | custbody74: yes/no/unknown |
| comision_cancelada_ov | advisor_commission_paid_sales_order | custbody_ix_comision_pagada en archivo recibido; yes/no/unknown |
| status_ov | status_sales_order | 1 active; 0 inactive; otros o null unknown |
| creado_ov | source_created_at_sales_order + snapshot original | Fecha del registro viejo; no se convierte sin zona horaria confirmada ni se confunde con creacion en ERP |
| caida_ov | cancelled_sales_order | 1 yes; 0 no; null/otros unknown |
| reserva_ov | snapshot original: reserva_ov | Pendiente confirmar semantica y todos sus valores |
| pre_lista_ov | list_price_sales_order | custbody13; DECIMAL(19,4) o null si ambiguo |
| trandate_ov | transaction_date_sales_order | Archivo transforma fecha comercial a ISO; validar calendario; 0 no es fecha |
| prec_ventaneto_ov | net_sale_price_sales_order | custbody17; no seguir conversion booleana ajena a este dato |
| prec_venta_ov | sale_price_sales_order | custbody_ix_total_amount; moneda no se deduce |
| comison_asesor_ov | advisor_commission_sales_order | custbody21; confirmar unidad comercial antes de importacion definitiva |
| ubicacion | snapshot original: ubicacion | Conciliar con ubicacion propia; no asumir que texto es FK |
| entity_cliente_ov | snapshot original: entity_cliente_ov | Cliente externo original; no inventar crm_customer |
| envioReserva | snapshot original: envioReserva | Pendiente conocer formato y si es marca, fecha o resultado |
| envioReservaCaida | snapshot original: envioReservaCaida | Pendiente conocer formato y significado |
| fechaClienteComprobante_ov | snapshot original: fechaClienteComprobante_ov | Fecha textual sin formato ni zona confirmados |
| pagadas_ov | snapshot original: pagadas_ov | No se considera saldo monetario ni aprobacion financiera |
| chekJefeVenta | aprobacion tipo sales_management | custbody_aprueba_jefe_ventas: approved/not_approved/unknown |

Las relaciones de Lead/Oportunidad/Estimacion/Cliente aun no tienen dominios
propios activos en este corte. Sus IDs se preservan en snapshot, no como FKs
falsas ni como tablas vacias especulativas. La moneda y campos ambiguos deben
conciliarse antes de importar. Precio invalido no se reemplaza por cero.

## Ejecucion y reversibilidad

Nueva BD: pnpm migrate:identity:schema --only=202610200021_sales_orders;
luego --only=202610200022_sales_order_utc_defaults.
Las migraciones usan lock/ledger existentes y verifican CRM_THINK_V2.
DDL MySQL hace commit implicito; si falla parcialmente, inspeccionar las tablas
antes de reintentar. IF NOT EXISTS no corrige una tabla preexistente incompatible.

DBA produccion:
1. Confirmar base/host y permisos; obtener backup/DDL de ordenventa.
2. Verificar que conf_sales_order_state y audit_sales_order_state_event no existen
   con estructuras incompatibles. El script solo usa CREATE IF NOT EXISTS y seed
   idempotente del catalogo; nunca corrige una tabla incompatible silenciosamente.
3. Ejecutar el script aditivo en una ventana aprobada.
4. Comparar SHOW CREATE TABLE ordenventa y conteo de registros antes/despues;
   verificar nueve estados y cero eventos de orden tras aplicar.
5. No otorgar privilegios nuevos al usuario legacy_reader ni activar triggers.
6. El historial legado no tiene FK a ordenventa: se retiene aunque la aplicacion
   vieja borre una orden; no se altera el comportamiento de borrado legacy.

Reversion operativa segura: no usar las tablas nuevas y conservarlas, sin borrar
datos ni ejecutar DROP. Si se necesitara retirada fisica, requiere aprobacion
independiente, backup y comprobacion de referencias; no hay down destructivo.

## Verificacion y pendientes

Resultado de verificacion del avance: 4441 pruebas generales API aprobadas
(113 omitidas por sus flags). Reejecucion con 4 workers y timeout 30s tras
un timeout de infraestructura en lint/module-import-boundary y actualizacion
del inventario esperado de migraciones. La suite especifica tiene 16 pruebas,
incluidas 6 pruebas MySQL reales habilitadas explicitamente con rollback.
Typecheck y build aprobados. Lint/formato de archivos tocados aprobados.
Los checks globales no estan limpios: formato previo en
test/unit-files/unit-files-search.spec.ts y JSDoc previo en cinco clases de
catalogs/projects. No se corrigieron archivos ajenos para ocultar esos fallos.

La reconfirmacion de conectividad al finalizar devolvio ETIMEDOUT dos veces.
Las migraciones y pruebas MySQL anteriores si concluyeron; no se presenta
esta ultima consulta como verificacion exitosa de disponibilidad actual.

Pruebas MySQL con SALES_ORDER_MYSQL_TESTS=1: reingreso, reintento, conflictos,
actor, estados separados, aprobaciones antes/despues, rollback de auditoria,
snapshot sin fecha inventada, fechas UTC, orden inactiva/caida y unicidad de
referencias por proveedor. Pruebas unitarias: mapper y limites de esquema.
Todas las columnas nuevas verificadas con COMMENT. No se ejecutaron fixtures
contra produccion; sus lecturas fueron solo agregados y DDL.

Pendiente: ejecucion DBA, importar/conciliar ordenes reales, catalogos y relaciones;
montar servicio/DTO/guard/endpoints de escritura con permisos exactos, reglas de transicion y
scope de acceso; conectar tabla y demas indicadores, registrar auditoria comercial en cada
mutacion, integrar adaptadores, outbox y reportes. La persistencia interna no esta
registrada como ruta ni habilita aprobar por tener permiso de lectura del banner.

## Contador de pendientes conectado

Se habilita exclusivamente GET /formalization/approvals/summary para el banner.
Exige sesion valida y permiso efectivo formalizacion.home.approvals.read;
una denegacion explicita prevalece. No concede permisos de aprobacion.

Regla: orden activa, no caida, Jefatura y Desarrolladora aprobadas y
Formalizacion explicitamente no aprobada. Los valores desconocidos no cuentan.
La BD nueva se consulta con estados textuales; el adaptador legado exige
status_ov=1, caida_ov=0, chekJefeVenta=1, aprobacion__rdr_ov=1 y
aprobacion_forma_ov=0. No se usa la etapa del pipeline para inferir aprobaciones.

El pool legado y ENABLE_LEGACY_FALLBACK son los mismos de catalogos. El fallback local permanece deshabilitado segun el registro de remediacion; este contrato no acredita una lectura actual de produccion. La lectura del contador no requiere ni habilita ENABLE_LEGACY_WRITES.
Las identidades candidatas legadas se leen en paginas de 500, sin datos personales.
Una fila nativa con id_old_produccion_sales_order suprime la fila legada,
incluso si la nativa esta inactiva, eliminada o ya aprobada. Al migrar siempre
debe conservarse esa referencia; IDs de proveedores diferentes no se confunden.

Contrato JSON (numeros ilustrativos, no conteo de produccion):

```json
{
  "schemaVersion": 1,
  "observedAt": "2026-10-21T12:00:00.000Z",
  "total": 3,
  "sources": {
    "native": 2,
    "legacy": 1,
    "legacyEnabled": true,
    "duplicatesExcluded": 1
  }
}
```

sources.legacy es el aporte tras excluir duplicados, no el total crudo.
Si falla una fuente habilitada se devuelve 503, nunca un total parcial.
El banner inicia sin numero y muestra No disponible si falla la lectura.
Sin permiso no se monta el contador ni se solicita el endpoint.
Al apagar el fallback se lee solo la BD nueva y legacyEnabled=false.
El lector actual comparte una transaccion READ ONLY / REPEATABLE READ entre
fuentes del mismo servidor InnoDB; no es una transaccion distribuida.
`observedAt` marca la observacion de la respuesta, no una prueba de concurrencia.
No se escribe, importa ni sincroniza. La ampliacion 40 conecta los otros seis
banners de etapas: ya no son ceros provisionales. Solo `closedThisYear` usa
limite anual. La lista y los comandos siguen sin rutas registradas.

La comprobacion historica de esta conexion devolvio ETIMEDOUT; tampoco respondio
la conexion de lectura de produccion. No hay conteo actual confirmado.
