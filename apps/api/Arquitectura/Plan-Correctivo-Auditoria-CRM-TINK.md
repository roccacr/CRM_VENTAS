# Plan correctivo de auditoria CRM TINK

## Continuidad documental - 2026-10-23

El [corte consolidado 49](49-Estado-Actual-y-Cierre-Documental.md) actualiza el
producto despues de estos planes: roles/modulos, 43 perfiles/Ventas, esquemas
Leads/calendario y lecturas de Home Formalizacion/Mercadeo. Este trabajo solo
documental no marca casillas tecnicas como resueltas, no genera nota nueva ni
repite los checks historicos. Q05, CI remoto y validacion operacional siguen
requiriendo evidencia propia. Los resultados posteriores F01-F13 conservan
su fuente y fecha en la reauditoria; no mezclar sus IDs con los de este plan.

Estado: remediacion parcial verificada al 2026-10-22. Ver el informe de esta
entrega en [Reauditoria-54-Plan-y-Resultados.md](Reauditoria-54-Plan-y-Resultados.md).
Una casilla pendiente no representa
una correccion terminada; las casillas cerradas tienen evidencia al final.

Revision documental 2026-10-22: el corte `f2dc4f1` ya cuenta con commits locales separados y clon limpio verificado; activacion CI remota y Q05 siguen pendientes. S01 esta cerrado solo por recuperacion deshabilitada, no por correo real. Las secciones de comprobacion inicial/corridas intermedias conservan sus resultados historicos y no sustituyen la [matriz de cierre actual](Reauditoria-54-Plan-y-Resultados.md).
Fuente: auditoria entregada por el usuario. La nota 56/100 y sus mediciones son
del auditor, no una nueva certificacion de este documento.

## Alcance y reglas

- API NestJS y frontend React del checkout CRM VERION NESTJS.
- Primero estabilizar y proteger lo existente; despues avanzar Formalizacion.
- Conservar contratos, permisos, sesiones y migracion progresiva salvo cambios
  explicitamente especificados y cubiertos por pruebas de regresion.
- No cambiar produccion, credenciales, grants, integraciones ni ejecutar DDL.
  Preparar migraciones aditivas y reversibles operativamente para aprobacion.
- MySQL directo de pruebas, sin Docker; nunca ejecutar fixtures en produccion.
- No borrar ni renombrar ordenventa. La BD nueva es la autoridad de filas migradas.
- No agregar Redis, proveedores de correo u otras dependencias sin justificar
  su necesidad y acordar infraestructura.
- Cada tarea pasa por reproduccion, prueba fallida, cambio acotado, revision
  del diff y verificaciones. Una tarea pendiente no es un defecto confirmado.

## Comprobacion inicial historica

Confirmado al iniciar el plan, antes de las entregas siguientes:
- requestLocalReset registra auditoria y devuelve accepted sin emitir token.
- issueLocalResetToken aparece definido, sin llamada encontrada en src.
- UnitFilesService.authorize retorna por rol owner antes de revisar denegaciones.
- Antes de Q03, module-import-boundary ejecutaba ESLint tipado con timeout de
  15 segundos. Ahora comprueba la regla real sin arrancar el programa TypeScript.
- El frontend mantiene espera minima de sesion de 900 ms y helper replaceState.
  Aun debe trazarse toda la navegacion antes de modificar el historial.

Los demas hallazgos requieren reproducir su alcance. Los totales de pruebas,
tiempos, cobertura y disponibilidad MySQL se volveran a medir al ejecutar.

## Fase 1: linea base de calidad

- [x] Q01. Reejecutar typecheck, lint, formato, tests y build en ambos proyectos;
  registrar comando, duracion, errores y tests omitidos sin ocultar resultados.
- [x] Q02. Corregir los cinco JSDoc de catalogs/projects y los errores de formato
  confirmados, sin reformatear archivos ajenos.
- [x] Q03. Aislar la prueba de frontera del arranque completo de ESLint tipado;
  mantener una comprobacion de la regla real y una comprobacion de cableado.
  No resolverlo solo aumentando el timeout o quitando la asercion.
- [ ] Q04. Incorporar CI equivalente a pnpm check, con versiones y lockfile
  existentes. No configurar despliegue automatico.
- [ ] Q05. Ejecutar las suites MySQL contra una instancia exclusivamente de
  pruebas, habilitando sus flags explicitamente; verificar rollback, concurrencia
  y migraciones. Fallar si el trabajo requerido omite todas las pruebas reales.
  Sin instancia aprobada, CI ejecuta las otras verificaciones y este gate queda
  BLOQUEADO POR INFRAESTRUCTURA, nunca verde por omision. No cerrar cambios de
  persistencia ni la verificacion integral de autorizacion sin la evidencia requerida.
- [ ] Q06. Configurar cobertura de src y publicar resultados; fijar umbrales
  razonados despues de medir, no inventar porcentajes objetivo.
- [ ] Q07. Reducir costo de tests frontend y fixtures repetidos manteniendo
  aislamiento y limpieza de timers, mocks, storage y sesiones.
- [x] Q08. Antes de introducir el guard, enumerar las rutas registradas y exigir
  clasificacion explicita: publica, autenticada o con permiso especifico. Probar
  excepciones, metodos y rutas nuevas; no exigir permiso comercial a toda ruta.

Salida: checks reproducibles, sin flaky conocido; MySQL verificado o bloqueo
de infraestructura explicitamente registrado, nunca presentado como aprobado.

## Fase 2: seguridad funcional y autorizacion

- [x] S01. Reset/activacion real: acordar proveedor y remitente; reutilizar tokens
  opacos y almacenamiento hash, vencimiento, uso unico, revocacion y auditoria.
  Envio asincrono con reintentos limitados, sin revelar existencia de correos.
  Si no existe infraestructura, deshabilitar honestamente la capacidad en UI
  y API conservando respuesta antienumeracion; no anunciar correo enviado.
- [ ] S02. Reproducir lockout dirigido y corregirlo con limites combinados por
  cuenta, origen y sistema, enfriamiento progresivo y recuperacion segura.
  No sustituirlo solo por cuenta+IP: rotar IP no debe permitir fuerza bruta.
  Coordinar con S01 y definir recuperacion manual con user.activate, auditoria y
  procedimiento de ultimo administrador antes de modificar el bloqueo.
- [x] S03. Inventariar rutas publicas y privadas; introducir autenticacion global
  de denegacion por defecto con excepciones publicas explicitas.
  Cubrir login, callbacks, CSRF, refresh y recuperacion sin romper sus contratos.
- [x] S04. Metadatos de permisos/guard y politica reutilizable, implantados por
  modulo. Conservar validaciones de dominio, de fila y de transaccion en servicio.
  Probar acceso directo HTTP; ocultar UI no sustituye autorizacion del backend.
  Continuidad: los 49 handlers permission llevan RequirePermission; el guard
  rechaza falta de descriptor, grant incorrecto y deny antes del handler.
  Scopes usuario/proyecto siguen en S05, no quedan cerrados por este cambio.
- [ ] S05. Expedientes: retirar bypass implicito owner, respetar deny y definir
  scopes reales por proyecto/area/asignacion. Aplicar los mismos filtros a lista,
  detalle, opciones, facetas y ambas fuentes; no inventar relaciones inexistentes.
- [ ] S06. Revisar claves debiles y filtradas sin reglas arbitrarias de simbolos;
  permitir frases largas, proteger el chequeo de filtraciones y no enviar claves
  completas a terceros. Revisar asignacion inicial por administrador y activacion.
- [ ] S07. Microsoft: comprobar validacion actual de issuer, audience, tenant y
  nonce en MSAL. El tenant ya se valida y las identidades existentes se buscan
  por provider_subject; el enlace inicial usa correo. Diagnosticar vinculos
  existentes solo en lectura y probar cambio/reasignacion de correo.
  No migrar cuentas por defecto: cualquier conflicto confirmado exige reporte,
  script revisado, respaldo, rollback y aprobacion antes de cambiar datos.
- [ ] S08. Definir inactividad y expiracion absoluta coherentes con refresh,
  revocacion y multiples pestanas; no ampliar silenciosamente las ocho horas.
- [x] S09. Limites para lecturas autenticadas de catalogos, expedientes, auditoria
  y contadores; claves por usuario/origen, ventanas y excepciones documentadas.
- [ ] S10. Antes de varias instancias, elegir almacenamiento compartido de limites
  y estrategia de fallo seguro; probar concurrencia, reinicio y saturacion.
- [ ] S11. Inspeccionar CSP y otras cabeceras en las respuestas reales del host
  frontend; Helmet en el API no prueba proteccion del frontend. Revisar rotacion
  y limpieza del CSRF en memoria, que no es una vulnerabilidad por si mismo.
- [x] S12. Auditar dependencias de ambos proyectos con pnpm audit; validar alcance
  y explotabilidad antes de actualizar. No aplicar upgrades masivos automaticos.
- [ ] S13. Pruebas dinamicas en entorno de pruebas: DTOs malformados y limites,
  IDOR en detalle/lista/facetas de expedientes y aislamiento entre usuarios/areas.

Salida: sin sesion 401; sin permiso 403 antes de SQL; deny prevalece; scopes
impiden acceso cruzado incluso por URL; reset funcional o explicitamente no disponible.

## Fase 3: persistencia e integracion legacy

- [ ] D01. Escapar comodines LIKE de forma consistente para busquedas literales;
  definir si se admiten comodines antes de cambiar comportamiento y cubrir %/_/escape.
- [ ] D02. Inventariar escrituras legacy de los seis writers y su transaccion real.
  Una transaccion en el mismo servidor puede ser atomica: no asumir escrituras
  parciales sin reproducir commit, rollback, permisos y motor de las tablas.
- [ ] D03. Sustituir nombres de esquema incrustados por identificadores configurados
  y validados; nunca interpolar identificadores procedentes del usuario.
- [ ] D04. Especificar autoridad, idempotencia, reintento, conciliacion y retirada
  de doble escritura. Elegir atomicidad local o outbox segun la topologia real,
  no introducir ambas estrategias sin necesidad.
- [ ] D05. Probar union/paginacion de Expedientes y contador de aprobaciones:
  duplicados, ultima fila, fuente vacia/caida y fila nativa inactiva o eliminada.
  No devolver un total parcial como si ambas fuentes hubieran respondido.
- [ ] D06. Sustituir carga completa de proyectos por consultas acotadas a IDs y
  scopes; verificar planes e indices en datos representativos.
- [ ] D07. Configurar presupuestos de conexion/consulta y manejo de timeout;
  dimensionar el pool por carga, capacidad MySQL y numero de instancias.
  D06-D08: responsable tecnico backend con revision DBA; generar datos sinteticos
  con volumen/distribucion registrados o usar un volcado anonimizado autorizado.
  Registrar consultas por request, latencias p50/p95/p99, saturacion del pool,
  errores y planes SQL antes/despues. No usar produccion para pruebas de carga.
- [ ] D08. Medir OFFSET con EXPLAIN y volumen antes de migrar catalogos a cursor;
  conservar orden estable, filtros y contratos de paginacion.

Salida: fallos de una fuente controlados, autoridad inequívoca y sin alteraciones
no autorizadas al CRM viejo. Pruebas reales solo en BD de pruebas.

## Fase 4: frontend y rendimiento de sesion

- [x] F01. Separar navegacion normal con pushState de redirecciones de seguridad
  con replaceState; escuchar popstate y probar Atras/Adelante y enlaces profundos.
  Conservar replaceState para filtros y correcciones de acceso cuando corresponda.
- [x] F02. ErrorBoundary en limites de aplicacion/ruta con recuperacion y errores
  sanitizados; cubrir tambien fallos de carga de chunks.
- [x] F03. React.lazy por rutas con fallback estable, permisos previos y manejo
  de errores; medir bundles antes/despues sin afirmar mejora sin evidencia.
  Depende de F02: fallo de chunk debe ofrecer recuperacion sin bucle de recarga.
- [x] F04. Retirar retrasos artificiales de sesion; mostrar loader solo durante
  trabajo real, sin parpadeo ni carreras de autenticacion.
- [ ] F05. Mantener spinner/error/numero en indicadores reales y cero provisional
  en los aun no conectados; no presentar DEMO como dato de negocio.
- [ ] F06. Evaluar costo de DataTables junto a Ant Design; retirar dependencia
  solo tras verificar funcionalidad equivalente, accesibilidad y regresiones.
- [ ] F07. Medir consultas por request y comenzar reutilizando perfil dentro de
  la misma peticion. Cache entre peticiones solo con invalidacion comprobada por
  permissionVersion, bloqueo, logout, revocacion y aislamiento entre usuarios.
  La primera parte puede adelantarse si se demuestra duplicacion dentro de una
  misma peticion; no reutilizar perfiles entre usuarios ni convertirlo en cache global.
- [ ] F08. Logs de depuracion solicitados por el usuario: mantenerlos opt-in y
  solo desarrollo, con payload minimo y sin datos personales/tokens.
  Su retirada definitiva requiere distinguir diagnostico solicitado de ruido.

## Fase 5: mantenibilidad sin reescritura

- [ ] A01. Comparar contratos de los seis catalogos y extraer solo duplicacion
  estable; piloto con dos, pruebas HTTP completas y despues los restantes.
  No eliminar treinta archivos por una cifra objetivo ni perder reglas particulares.
- [ ] A02. Reutilizar componentes/hooks de catalogos frontend con el mismo criterio.
- [ ] A03. Descomponer responsabilidades concretas en repositorios de identidad,
  shell, roles, contratos y pruebas grandes, preservando contratos externos.
  Definir limites antes de tocar seguridad; no mezclar refactor estructural con
  S04/F07 ni partir archivos preventivamente sin una responsabilidad demostrada.
- [ ] A04. Separar CSS por componentes/ownership realmente reutilizable; verificar
  cascada, desktop/movil y ausencia de diferencias visuales involuntarias.
- [ ] A05. Revisar cada supresion complexity/max-params; retirar una a una mediante
  mejoras locales. Tamano de archivo no obliga a crear abstracciones innecesarias.
- [ ] A06. Expandir logica densa en identity/unit-files para legibilidad y pruebas;
  no cambiar reglas mientras se hace el refactor.
- [ ] A07. README de producto, arranque, arquitectura, migracion y decisiones
  vigentes; separar documentacion historica y skills sin borrar material util.

## Fase 6: operacion y producto

- [x] O01. Liveness sin dependencia externa y readiness con comprobaciones
  acotadas; definir si legacy temporal es requisito para cada capacidad, sin
  exponer configuracion ni reiniciar procesos saludables por una caida externa.
- [x] O02. Revisar serializacion global de errores y agregar filtro solo donde
  haga falta; respetar 4xx, sanitizar 5xx, correlacion y redaccion de logs.
- [x] O03. Documentar operacion sin Docker: configuracion, build, supervisor,
  observabilidad, backup, despliegue aprobado y rollback.
- [ ] P01. Matriz de alcance real: implementado, demo, pendiente y fuera de fase.
  Falta de leads no es automaticamente defecto del modulo Formalizacion.
- [ ] P02. Priorizar orden de venta real y aprobaciones con permisos de accion
  separados de lectura; historial de actor/fechas/antes-despues y concurrencia.
- [ ] P03. Conectar contratos, banco, saldo, traspaso, llaves y cierre por etapas,
  con reglas confirmadas en reunion y evidencia; retirar DEMO por pantalla.
- [ ] P04. Definir notificaciones, reportes y dashboards con fuentes reales y
  criterios de aceptacion; no conservar botones que prometan acciones inexistentes.
- [ ] P05. Leads/clientes/oportunidades/cotizaciones solo despues de acordar
  prioridad y alcance comercial; backlog separado, no mezclar con remediacion.

## Orden de ejecucion y cierre

1. Q01-Q03: base verificable y checks estables.
2. Q04-Q05: CI y MySQL de pruebas. Si falta infraestructura, continuar los checks
   independientes y registrar el gate bloqueado, sin declarar aprobacion integral.
3. Q08: inventario y pruebas de clasificacion de rutas antes del guard.
4. S01/S02/S05: recuperacion coordinada, desbloqueo y modelo de alcances.
5. S03/S04: autorizacion global con la red de pruebas anterior.
6. F01 con pruebas Atras/Adelante; F02 antes de F03; F04 carga real.
7. S07 con diagnostico solo lectura previo, sin migracion automatica.
8. S06/S08-S13, D01-D08, Q06-Q07, F05-F08 y operacion segun dependencias.
9. A01-A07 en entregas separadas; P01-P03 define el avance funcional y P04-P05
   el backlog acordado. F07 intrapeticion puede adelantarse sin cache global.

Ninguna fase se cierra solo por tests unitarios. Ejecutar en cada proyecto
pnpm format:check, pnpm lint, pnpm typecheck, pnpm test y pnpm build; ejecutar
pruebas MySQL habilitadas cuando el cambio toque persistencia.
Registrar verificacion HTTP, navegacion/teclado y desktop/movil cuando aplique.
Cada entrega incluye archivos cambiados, prueba de aceptacion, riesgos,
rollback y pendientes. No afirmar una nueva nota global sin una nueva auditoria.

## Decisiones necesarias antes de implementaciones dependientes

- Proveedor de correo y responsable de configuracion para reset/activacion.
- BD MySQL dedicada para pruebas y plataforma de CI autorizada.
- Modelo de alcance de Expedientes por proyecto/area/asignacion.
- Topologia de despliegue prevista y presupuesto de inactividad de sesion.
- Compatibilidad requerida de escrituras catalogo hacia legacy.
- Responsable del host frontend para inspeccion de cabeceras reales.
- Responsables backend/DBA para dataset y mediciones de rendimiento.
- Procedimiento autorizado para recuperar el ultimo administrador.

## Revision de recover:owner (solo lectura)

package.json ejecuta scripts/restore-owner-from-backup.ts. El script restaura
una identidad Owner especifica desde un respaldo fijado por SHA-256; exige
confirmacion explicita, ruta al respaldo y destino CRM_THINK_V2. Comprueba vacias
sec_user, sec_auth_identity, sec_role, sec_permission y sec_org_unit, inserta
identidad/configuracion seleccionadas y asigna rol/permisos/modulos en transaccion.
No es un desbloqueo general de una instalacion poblada y no sustituye user.activate.
Puede ejecutarlo quien tenga acceso al proceso, respaldo aprobado y credenciales
con escritura; no usa una sesion HTTP para autorizarse. No se ejecuto.
Falta validar el runbook de recuperacion de un Owner ya existente y sus pruebas.

Estas decisiones no bloquean comenzar Q01-Q03. No pedir secretos en el chat.

## Evidencia de la primera entrega

Al inicio se reprodujeron cinco errores jsdoc/require-jsdoc y formato pendiente
en test/unit-files/unit-files-search.spec.ts y FormalizationStatusPill.tsx.
Se corrigieron con comentarios de responsabilidad y formato mecanico, sin
cambiar comportamiento, reglas, APIs ni configuracion de autorizacion.

La prueba de frontera aislada previa paso en 9,04 s. Despues de Q03 se mantienen
el timeout de 15 s y la asercion de prohibicion; se agregan un caso permitido
y la comprobacion de que la frontera no se aplica a adapters externos.
Tres casos pasaron en 2,57 s y 2,78 s en dos ejecuciones aisladas.
El test usa calculateConfigForFile para obtener la regla real y lintText para
ejecutarla sin typed linting; pnpm lint conserva el analisis tipado completo.
Ya no crea archivos temporales dentro de src.

recover:owner fue leido, no ejecutado. No se cambiaron credenciales, permisos,
datos, migraciones ni produccion. CI y MySQL de pruebas siguen pendientes.

Validacion oficial ejecutada desde raiz: .\check-all.cmd, codigo de salida 0.

| Verificacion | API | Frontend |
| --- | --- | --- |
| Formato | Aprobado | Aprobado |
| ESLint | Aprobado | Aprobado |
| TypeScript | Aprobado | Aprobado |
| Pruebas habilitadas | 4453 aprobadas, 66 archivos | 426 aprobadas, 29 archivos |
| Build | Aprobado | Aprobado |
| MySQL real | 113 pruebas omitidas, 21 archivos | No aplica |

No se habilitaron suites MySQL sin confirmar una BD dedicada autorizada.
El check local aprobado no equivale a persistencia real aprobada ni a CI
configurado. En esa primera entrega Q04/Q05 seguian abiertos sin un gate CI.
Persisten avisos no bloqueantes de jsdom sobre pseudo-elementos y de Vite por
chunks mayores a 500 kB; las tareas correspondientes no se dan por resueltas.

## Entrega Q04-Q05: configuracion y gate preparados

Workflow quality.yml: calidad de API/frontend separada, lockfiles inmutables y
acciones fijadas por SHA. Gate de infraestructura MySQL explicito y runner con
verificacion SELECT del UUID/marcador del destino antes de ejecutar fixtures.
El runner ejecuta solo cinco suites nativas revisadas. El gate completo permanece
bloqueado por alcance mientras existan otras suites sin verificar; no basta
aprobar el subconjunto para declarar persistencia completa.
Ver CI-MySQL-Pruebas.md para secretos de pruebas, environment protegido,
fixtures y criterios de cierre. No se modificaron settings remotos ni se hizo
commit/push. La ejecucion remota sigue pendiente; no se declara CI activo.

El propietario autoriza exclusivamente CRM_THINK_V2 del .env. La conexion
nativa respondio; se ejecuto la validacion local rollback-only de cinco suites.
Se deshabilito legacy y no se ejecutaron migraciones ni DDL.
Q04 y Q05 se mantienen abiertos hasta ejecucion remota y persistencia verificadas.
Los cambios visuales y de ordenes ya estaban en el arbol al comenzar esta
remediacion; esta entrega no los modifica ni los presenta como tareas correctivas.

Pruebas reales nativas: primera corrida 29 aprobadas/1 fallida. Se identifico
falso positivo en la asercion de auditoria por localPasswordAssigned booleano;
se corrigio la asercion sin cambiar auditoria de producto ni permitir secretos.
Reejecucion de todo el archivo afectado: 9 aprobadas. Resultado acumulado:
30 pruebas distintas verificadas en cinco archivos, legado deshabilitado.
Conteos antes/despues de usuarios, ordenes y eventos de orden coinciden.
Q05 sigue parcial: no se ejecutaron suites legacy ni las de DDL/migraciones.

Verificacion final de esta entrega: check-all.cmd aprobado; 4457 pruebas API y
426 frontend aprobadas, con formato/lint/TypeScript/build limpios. La corrida
general mantiene 113 omisiones; las 30 pruebas MySQL nativas se verificaron
por separado. No se declara CI remoto activo ni Q05 completo.

## Ajuste de proceso y runner con dobles

Clasificacion del propietario: CRM_THINK_V2 es desarrollo/en construccion y
contiene datos a conservar; crmdatabase-api es produccion. Configuracion con
host RDS compartido, sin demostracion de aislamiento fisico. No repetir fixtures
ni escrituras como parte de esta revision.

Efecto real de las pruebas previas: consumieron valores AUTO_INCREMENT aunque
los fixtures se revirtieron y los conteos de filas coincidieron. No describir
esa corrida como "sin cambios" ni reiniciar secuencias. No hay medicion del
numero exacto de IDs consumidos. No se declaran escrituras en la BD productiva.

MySQL queda informativo con continue-on-error y su resumen conserva estados
bloqueado/parcial. Solo Quality / api y Quality / frontend deben ser obligatorios
hasta cerrar Q05; no se modifico proteccion de ramas remota.
Runner/preflight cubiertos con dobles: 14 pruebas de politica/integracion,
sin conexion real ni escrituras de fixtures.

Antes de activar CI remoto es obligatorio clonar los commits candidatos en una
carpeta vacia y ejecutar pnpm install --frozen-lockfile y pnpm check en ambas
apps, registrando SHA y git status limpio. No basta validar este arbol sucio.
Ver el criterio completo en CI-MySQL-Pruebas.md. Commits y clon siguen pendientes.

S01: el propietario pospone proveedor y responsable de correo. No se habilitan
envios; la opcion de deshabilitar honestamente queda para la entrega S01.

Cierre de esta revision: check-all.cmd aprobado con 4467 pruebas API y 426
frontend, formato/lint/TypeScript/build aprobados. Las 113 MySQL permanecieron
explicitamente deshabilitadas: solo dobles para preflight/runner, ninguna conexion
real. Clasificacion registrada y paso 2 verificado; checkout limpio y activacion
remota pendientes, sin atribuirlos al check del arbol de trabajo actual.

## Entrega de remediacion 2026-10-22

Las secciones anteriores son evidencia historica, no el estado actual de cada
archivo. El informe Reauditoria-54-Plan-y-Resultados.md registra pruebas, commits,
limitaciones y resultados actuales sin asignar nota nueva.

S01 se cierra por la alternativa explicitamente aprobada: recuperacion
deshabilitada con 503 uniforme, sin simular envios. No se implemento correo real.
Q08/S03 incluyen inventario real, allowlist publica, default-deny y perfil
compartido solo dentro de cada request. F07 sigue parcial por falta de medicion
de consultas/carga, no por ausencia de cache entre requests.
En ese corte S04 conservaba permiso/fila en servicios sin metadatos completos;
la continuidad posterior incorpora descriptores declarativos sin retirarlos.

S05 retira bypass Owner y respeta deny; alcance usuario/proyecto no esta definido.
D06 filtra seleccion por IDs en SQL; selector completo y EXPLAIN siguen pendientes.
S09 protege lecturas autenticadas por usuario/IP con contadores locales; S10
distribuido permanece abierto y los defaults no son capacidad medida.

F01-F04 pasan regresion y build. F05 retira DEMO de Inicio/seguimiento; calendario
y resumen mantienen alcance previo, sin presentarlos como integrados. Q06 tiene
cobertura medida y configuracion CI, pendiente politica de umbrales/publicacion
remota. O01/O02 implementados con dobles; O03 es runbook, no despliegue verificado.

Contencion adicional: loopback y legacy deshabilitado localmente, seis writers
exigen opt-in productivo separado y destino configurado. Credenciales/grants
compartidos no se alteraron. No repetir pruebas MySQL contra servidor compartido.
