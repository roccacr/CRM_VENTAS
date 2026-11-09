# Publicación verificada — 03/11/2026

Publicación autorizada expresamente en este chat. Registro posterior a la activación, sin alterar el paquete publicado.

## Fuente y alcance

- Aplicación: Habita CRM, proyecto CRM VERION NESTJS; no las aplicaciones vecinas de /var/www.
- Rama: temp/crm-tink-api-frontend-inicial.
- Base: 4d446ed169d803c2151b94c6b36db34829a033c7, más la copia local congelada de cambios acumulados. No se creó commit ni se hizo push.
- El repositorio continuaba recibiendo cambios de otras tareas; se preparó una copia privada fija antes de compilar/publicar. No se afirma incluir cambios posteriores a esa congelación.
- Se corrigió antes de publicar la condición de Home que ocultaba duplicatesExcluded por el permiso addendum (no forma parte de StageCounts). Se actualizaron expectativas obsoletas de la ruta del perfil y del registro de migraciones, y se normalizó formato de dos archivos previamente señalados por Prettier.

## Infraestructura verificada

- SSH: ubuntu@3.12.74.187, hostname ip-172-31-11-173.
- Raíz: /var/www/habita-crm.
- Apache sirve frontend y proxy al API en 127.0.0.1:3100.
- Supervisor aislado: habita-pm2; proceso habita-api. No se reiniciaron servicios vecinos ni se modificaron vhosts.
- Entorno conservado: shared/api.env, modo0600, enlace desde apps/api/.env. No se copiaron secretos del entorno de desarrollo ni se modificó la llave SSH original. Se usaron copias temporales privadas.
- Apache syntax OK, con advertencia previa ajena sobre /var/www/sambox/crmm-app/ inexistente.

## Release final y rollback

- Release inicial encontrado: 20261029163233-ce19e12-local.
- Primera activación nueva: 20261103152619-4d446ed-local, saludable.
- La revisión del primer manifiesto encontró MiniMonth.tsx, eliminado del workspace original pero conservado por el clon de preparación. Se retiró del candidato y se repitió publicación; no se cambió lógica de ese componente.
- Release final activo: **20261103152956-4d446ed-local**.
- Archivo SHA-256: **df3edfcf01535c0c1546713523f6766617ffcae38e80d63b051e9196f0865535**.
- 1283 fuentes y715 compilados verificados, cero discrepancias. MiniMonth.tsx ausente del release final.
- current apunta a /var/www/habita-crm/releases/20261103152956-4d446ed-local.
- Se conservan los releases previos. Rollback: restaurar current al release anterior conocido y recargar únicamente habita-pm2; comprobar salud después. No hubo rollback automático en estas dos activaciones.

## Verificación de destino

- Build API y frontend desde copia fija aprobados. Dependencias runtime Linux instaladas con lockfile y sin scripts; validación de entorno y binding argon2 aprobada.
- Hash público del HTML igual al index del paquete; 14 recursos JS/CSS públicos verificados, incluidos ExpedienteLink y los recursos de Formalización. CSS publicado confirma grid-auto-flow:column para el timeline.
- Proceso final habita-api online, PID508637 al verificar, cwd del release final, contador acumulado de reinicios9 (8 tras primera activación); no se interpreta ese contador histórico como errores del release.
- Desde el cliente: login200, ruta SPA /home/formalization200, /health/ready200, /health/live200; /identity/me401 sin sesión. index con Cache-Control:no-cache.
- Lectura de RDR673/id208 con el código compilado desplegado, dentro de transacción READ ONLY:8 secciones y32 campos, precio/link/cliente/moneda coinciden con la fuente legacy, sin warnings. Esto no sustituye una sesión autenticada del empleado ni un flujo comercial real.
- No se ejecutaron migraciones, fixtures, aprobaciones, envíos de correo/WhatsApp ni escrituras comerciales como verificación. El ledger observado inicialmente llegaba a066 y una lectura posterior a067; la publicación no ejecuta el runner de migraciones. Se conservó la configuración existente de integraciones.

## Pruebas y límites

- Suite API inicial:7711 aprobadas,225 omitidas condicionales,4 fallidas (tres por condición Home y una expectativa de migraciones). Correcciones verificadas sobre candidato:68/68 focalizadas aprobadas, incluidos Home, lectura de orden, registro de migraciones y SuiteScript.
- Suite frontend inicial:1828 aprobadas,3 fallidas (ruta de perfil antigua, conflicto Outlook y doble recarga de banners). En candidato:66/67 focalizadas; ruta corregida y prueba Outlook aprobada al repetir.
- Pendiente conocido: test/home/home-summary-banner.spec.tsx, doble clic de recarga espera2 lecturas de aprobaciones y recibe3. Son lecturas duplicadas; no se cambió la concurrencia de invalidaciones tras escrituras para corregirlo incidentalmente en este despliegue.
- Formato de ambas apps aprobado en candidato; lint API aprobado. Lint frontend conserva dos avisos ajenos: complejidad de NotesInbox y orden de imports de PersonalNotes.
- Typecheck API/frontend y builds aprobados; no se afirma que toda la suite general esté verde ni aceptación autenticada extremo a extremo.

Evidencia local: deploy-publish-final.log, deploy-api-tests.log y deploy-frontend-tests.log en C:/codex-data/visualizations/2026/11/02/01a19e7b-4e7a-7603-adcb-773cff231852/.


## Último corte de aplicación solicitado posteriormente

- Release activo: **20261103154247-4d446ed-local**; sustituye los cortes anteriores de este recibo.
- SHA256: **f561968b6e52e0a96a080d97d5afa213e2e99694fea9e867e9e99a6d81d4b326**.
- Incluye los últimos cambios funcionales de Calendario: guardado crm_only según sesión, formulario, panel diario, selector de salas, foco y altura del campo Lugar. Se detectaron ediciones concurrentes después de cortes intermedios y se repitió publicación.
- 1284 fuentes y715 compilados verificados; cero discrepancias. HTML y12 recursos públicos comprobados, incluidos bundles de Calendario. API online y cwd del release final.
- Comprobaciones externas: login200, ready200, protegido401 sin sesión.
- Comparación final workspace/manifiesto: **cero archivos funcionales de aplicación pendientes**. Solo quedaron ediciones de pruebas y Markdown posteriores a capturar el paquete; no afectan el runtime publicado. Este recibo también se agrega después de publicar.
- Focalizadas aprobadas:14 API,30 frontend del primer lote,20 selector/salas/conexión/adéndum y13 del ajuste visual final; lint de archivos afectados y builds API/frontend aprobados. No se volvió a ejecutar toda la suite general; sus límites anteriores siguen registrados.
- Sin commit/push ni ejecución de migraciones en esta publicación. Entorno privado conservado; releases previos disponibles para rollback.

## Publicacion completa posterior — 03/11/2026 11:51 Costa Rica

- Autorizacion: publicar todos los cambios pendientes del sistema, solicitada en este chat.
- Release activo confirmado: `20261103175114-4d446ed-local`.
- SHA256: `839f46b305b0e8fb5b9abc78732ce76f07d715a703913f8c00547f69703f7098`.
- Rama `temp/crm-tink-api-frontend-inicial`, base `4d446ed169d803c2151b94c6b36db34829a033c7`, mas cambios locales congelados. Sin commit/push.
- Publicador existente: copia fija, builds de API/frontend, manifiesto y verificacion remota, cambio de current y reinicio solo habita-pm2. Release previo `20261103171020-netsuite` conservado para rollback.
- Verificacion posterior: 2122 archivos fuente/artefacto, cero discrepancias; diez recursos JS/CSS publicos con status200 y hash identico al build. Login200, ruta Formalizacion200, ready200, identidad sin sesion401. Cero fuentes funcionales pendientes respecto de la copia publicada al comparar despues de la activacion.
- Preflight readonly: base CRM_THINK_V2, migraciones068/069 registradas y tablas crm_bank/crm_bank_advisor/crm_sales_order_bank_assignment existentes. No se ejecutaron migraciones ni escrituras de negocio. ENABLE_ORDER_DOCUMENTS=false conservado; no se aplico070 ni se habilito Graph documental.
- Entorno privado preservado; NetSuite production/script3739/1. Consulta GET desde Ubuntu con los encabezados del cliente desplegado, orden11998725: ProduccionHTTP200/status200, ID coincide, fields.custbody37="2" (Financiado). SandboxHTTP200/status200, ID coincide, sin fields.custbody37 en esa respuesta. Ninguna consulta persiste fondos en CRM ni acredita entrega de User Event. El despliegue CRM no instala archivos en NetSuite.
- Builds API/frontend aprobados; frontend build incluye typecheck. Lint y typecheck API aprobados. Lint frontend falla por complejidad NotesInbox y orden imports PersonalNotes, ya documentados previamente.
- Suite API completa:7747 aprobadas,215 fallidas,250 omitidas. 191 fallos apuntan a archivos SuiteScript anteriores a la unificacion; los otros24 corresponden al inventario de rutas de seguridad (23) y un caso HTTP de adendum (503 frente409 esperado). Ademas una suite de libreria no pudo cargar su archivo antiguo. No se afirma suite global verde.
- Informes locales de esta ejecucion: `%TEMP%/habita-production-review-20261103/` (publish.log, lint/typecheck y frontend-tests.json cuando concluya); API JSON en `C:/codex-data/invalid-result.json`.
- Suite frontend completa:1926 aprobadas,9 fallidas,0 omitidas (1935 totales). Fallos en SystemUsersPage(1 timeout), CatalogItemsPage(2 timeouts), App(3 expectativas de consultas), home-summary-banner(1 lecturas duplicadas), navigation-permissions(1 expectativa de navegacion), netsuite-primary(1 encabezado antiguo AQUI VA EL ONEDRIVE). No se afirma suite global verde ni recorrido autenticado completo. Informes JSON completos conservados junto al log de publicacion.

## Activación de calendario Microsoft en producción — 03/11/2026 12:08 Costa Rica

- Autorización expresa del usuario: activar y dejar operativo en producción, con verificación en Habita.
- Release conservado: `20261103175114-4d446ed-local`. Se agregó `ENABLE_CALENDAR_EXTERNAL=true` a `/var/www/habita-crm/shared/api.env` (0600), con copia privada anterior para rollback. No se cambiaron credenciales, permisos Graph, documentos ni BDs.
- Se recargó únicamente `habita-pm2`; proceso activo y `/health/ready` interno y público verificados. La configuración compartida persiste entre releases.
- Verificación autenticada en `https://habita.roccacr.com`: selector con siete salas reales, disponibles primero, estados verde/rojo; cinco sugerencias de horario y agenda Outlook en el panel diario. No se crearon eventos ni se enviaron invitaciones como prueba.
- Al publicar cambios de calendario, comprobar las funciones autenticadas en producción además de builds y salud del API. La creación efectiva y entrega de invitaciones requiere su propia comprobación; esta activación no la acredita.

## Prueba real de creación, edición y detalle de calendario — 03/11/2026

- Autorización: el usuario solicitó crear un evento en Habita, editarlo y verificar detalle, BD y Outlook. Se utilizó un único evento identificado como prueba, sin participantes, vínculos comerciales ni reserva de sala.
- Evento CRM: `01M6H9RK6AY3J78GMJC426HJXY`. Título final: `PRUEBA HABITA · Editado y verificado · 03-11-2026`. Horario final: 04/11/2026 11:00–12:00, America/Costa_Rica. Se conservó para revisión.
- El primer POST respondió HTTP200 y `delivery.status=synced`, pero el frontend rechazó `selectionOptions:{}` y mostró una falsa incertidumbre. Se corrigieron las cuatro listas con el lector opcional existente, manteniendo la validación estricta de valores presentes. Pruebas de regresión primero fallaron y luego pasaron.
- Publicación acotada desde una copia del release activo: únicamente el servicio de calendario frontend, su prueba y el build resultante. Release confirmado `20261103181621-4d446ed-calendar`, overlay SHA256 `8180fa433d1fa90d83ba3a0605886e34af233f4c883cfabd9a7e3003e964f409`. Sin commit/push, migraciones ni cambios del API. Release anterior conservado. Manifiesto remoto verificado:1357 fuentes y785 artefactos; HTML y JS públicos con hashes idénticos al build; API ready200.
- Validación:105 pruebas de calendario frontend aprobadas, lint focalizado aprobado, typecheck y build aprobados sobre la copia del código desplegado más la corrección. La primera ejecución de la suite aislada carecía del JSON del catálogo API; al copiar ese mismo archivo del release desplegado, los14 archivos de prueba pasaron.
- Edición real PATCH200 sobre el mismo ID: cambió título, descripción, referencia, ubicación y horario; habilitó Teams. Pantalla confirmó `Evento guardado en CRM y Outlook` y devolvió enlace Teams.
- BD:un solo registro con la referencia QA, versión2; sincronización `synced` y `last_synced_version=2`, ID Outlook conservado; cero participantes y vínculos. Auditoría contiene `create` versión1 y `update` versión2.
- Lectura nueva de Graph por el feed:Outlook conectado, título/horario/ubicación editados, `isOrganizer=true`, `isOnlineMeeting=true`, enlace Teams y descripción. Detalle CRM volvió a cargar tipo/color, estado, referencia, fechas, zona horaria y versiones correctas. La unión mostró un solo evento.
- Se observó un timeout de red al recargar; un reintento respondió200 y recuperó los33 eventos combinados. No se afirma que ese problema intermitente esté resuelto. No se probaron invitaciones a terceros, reserva de sala ni vínculos a leads/órdenes en esta operación.

## Confirmación visual de calendario en producción — 03/11/2026

- Solicitud: mejorar la UX del resultado de guardado. Se reutilizaron Button e iconos existentes; tarjeta de éxito con encabezado, resumen de título/fecha/lugar y jerarquía de acciones. El formulario se oculta tras una entrega confirmada; se conservan los avisos de sala y los estados inciertos.
- Release activo confirmado: `20261103182719-4d446ed-calendar-ux`. Overlay SHA256 `da3ae1237628d0a0c5a1f607b173389f865fd24972c457572525ae3ecd8edfb7`. Cambios acotados a CalendarEventDrawer.tsx, SharedCalendarPage.css, pruebas y build frontend; anterior conservado para rollback. Manifiesto verificado:1357 fuentes/814 artefactos. Salud200 y HTML público con hash idéntico al build.
-105 pruebas de calendario aprobadas; lint focalizado, typecheck y build aprobados. La prueba de confirmación comprueba encabezado, resumen, formulario no visible y cierre/regreso al calendario. El check global se detiene por formato ajeno en API.
- Verificación visual autenticada de escritorio y390px en Habita: tarjeta de éxito, resumen, botón principal `Volver al calendario`, enlace secundario `Abrir Teams`, foco en la acción principal y botones apilados de ancho completo en móvil. Viewport restaurado al terminar. Evaluación visual propia según las ocho comprobaciones de refactoring-ui:10/10 (jerarquía, espacio, etiquetas secundarias, escala, ancho legible, contraste y elevación coherentes); no sustituye una auditoría WCAG completa.
- Para la comprobación se editó el evento QA anterior (versión3/sincronizada3 en BD), pero su entrega respondió incierta a la pantalla; no se modificó ese manejo ni se afirma resuelto. También se creó `PRUEBA UX · Confirmación de guardado`, referencia `QA-UX-20261103`,04/11/2026 08:00–09:00 Costa Rica, sin invitados ni reserva; mostró el resultado confirmado con Teams en producción. Ambos registros siguen identificados como pruebas. No se cambió la integración Graph ni los contratos de guardado.
- Capturas: `habita-calendar-success-ux.png` y `habita-calendar-success-ux-mobile.png`, en el directorio local de evidencias de03/11/2026.

## Colores independientes de módulo y tipo — 03/11/2026

- Solicitud: cada evento debe mostrar el color de su módulo y el color global de su tipo. El catálogo ya define colores comunes por código para todos los módulos; no se cambió BD ni configuración de tipos.
- Se centralizó la resolución en `calendarEventColors`: origen por módulo y tipo por código, incluso cuando el ID del catálogo difiere o el evento está sincronizado con Outlook. En mes/semana/día/agenda y lista emergente se entrega el color del tipo a FullCalendar y el módulo como propiedad CSS independiente; franja izquierda módulo, franja derecha tipo y fondo del tipo. La misma regla alimenta Próximos eventos y panel diario, incluidos eventos de día completo. Se conservan señales de conflicto, privacidad, cancelación y selección.
- Release activo confirmado:`20261103184145-4d446ed-calendar-colors`; overlay SHA256 `d7cb65778c693e5a6c64338178e66b7748bb54d0b2697f7a30290f24fe306312`. Cambio acotado a siete fuentes/pruebas frontend y artefactos; release previo conservado. Manifiesto:1357 fuentes/835 artefactos. API ready200, hashes de HTML/JS públicos iguales al build.
- Verificación:107 pruebas de calendario aprobadas, incluida prueba del elemento real de FullCalendar con ambos colores; lint focalizado y typecheck/build aprobados. Check global bloqueado por formato ajeno en API.
- Verificación autenticada en Habita: Reunión con izquierda `rgb(180,50,90)` / `#b4325a` y derecha `rgb(79,70,229)` / `#4F46E5`; Tarea con la misma izquierda y derecha `rgb(71,85,105)` / `#475569`. Títulos emergentes muestran módulo/tipo. Abrir el evento conserva los colores del elemento. Se ocultó Outlook en la vista de comprobación para comparar los dos eventos CRM existentes; no se crearon ni editaron registros de negocio.
- Captura:`habita-calendar-module-type-colors.png`, en el directorio de evidencias local de03/11/2026.

## Publicacion completa de sincronizacion manual — 03/11/2026 12:46 Costa Rica

- Autorizacion expresa en este chat para publicar todos los cambios pendientes.
- Release activo: `20261103184655-4d446ed-local`; previo `20261103184145-4d446ed-calendar-colors` conservado como rollback.
- SHA256 del paquete: `a97ff72fe39c77dc0c376e00757f01d29e4b41a576811e3f8930b0a2a32b66b9`.
- Rama temp/crm-tink-api-frontend-inicial, base4d446ed mas fuentes locales congeladas. Sin commit/push. Se preservan las mejoras actuales del calendario y se incluyen sincronizacion manual, ambienteNetSuite en cabecera, cambios pendientes de asignacion/desvinculacion bancaria y documentos sin habilitar la integracion documental.
- Preflight remoto readonly:071 registrada y ambas FK bancarias nullable. No se ejecutaron migraciones. shared/api.env conservado; Produccion3739/1, realm4552704, persistenciaProductiontrue, documentosfalse; no se cambiaron credenciales ni flags.
-209 pruebas focalizadas aprobadas:114API NetSuite/resolucion+5UI/layout de sincronizacion,63API bancos/documentos/migracion y27UI calendario/bancos/documentos. Lint focalizado de sincronizacion aprobado; builds de ambas apps desde la copia fija aprobados. No se volvio a ejecutar ni se declara verde la suite global; mantiene los fallos ya registrados.
- Verificacion remota:2132 archivos fuente/artefacto sin discrepancias; diez assetspublicos200 conhashigual. Login200, rutaordenes200, ready200, identidad/contextosinSesion401, sincronizacionsinSesion403 antesdeescritura.
- Cliente API recien desplegado: GET syncSnapshot de Produccion para orden11998725 retorna200, crm_sync_projection1 y custbody37="2". Envelope validado con el contrato productionOrderEvent del release. No se invoco receive ni sincronizacion autenticada; no hubo escrituras de negocio. Esto acredita conectividad y contrato de lectura, no un guardado E2E real.
- Evidencia local: `%TEMP%/habita-publish-sync-20261103/publish.log` y `verification.log`. Copias temporales de llaves eliminadas, original intacta.

## Publicación completa del checkout congelado — 03/11/2026

- Autorización: solicitud expresa de publicar todos los cambios en producción. Se usó el publicador existente, sin commit/push ni migraciones.
- Release verificado: 20261103195227-4d446ed-local; anterior conservado: 20261103192000-4d446ed-calendar-lifecycle. SHA256: 3ab3ba1aedf5fa63c6e80aa94824c430dd6c161bddf8b1312f29050f2cd6e5a0.
- Builds de ambas aplicaciones aprobados desde una copia fija. La primera transferencia se interrumpió antes de activar; el mismo archivo se transfirió de nuevo y el activador comprobó su hash. Activación y reinicio exclusivo de habita-api por PM2 completados.
- Verificación independiente readonly:1379 fuentes y765 artefactos con hashes correctos; HTML público y14 assets iguales al release. Login, Inicio Mercadeo, Captación y health/ready200; identidad y documentos sin sesión401.
- Navegador autenticado en producción: Captación sin selector, nombres ni fotos de vendedores; leyenda y columnas por proyecto/campaña/anuncio según profundidad. Se conservaron las etiquetas comerciales originales de campañas/anuncios. No escrituras de negocio durante QA.
-350 pruebas focalizadas aprobadas:188API (Adéndum, seguimiento, calendario/documentos) y162frontend (Mercadeo, filtros, Adéndum, acciones calendario). Suite general API:7852aprobadas,227fallidas,266omitidas; una suite adicional falla al cargar archivos SuiteScript retirados. Frontend general:1974aprobadas,11fallidas. No se declara QA global aprobado. Entre los fallos hay inventarios/expectativas antiguas de rutas, permisos, selector por vendedor y placeholderOneDrive; check-all se detiene por formato en cuatro archivos NetSuite.
- Preflight productivo readonly:070,071,072 registradas y estado sent presente en los ENUM nativo/legacy. No DDL ni cambios de credenciales/configuración. Calendario habilitado; ENABLE_ORDER_DOCUMENTS permanece false según configuración productiva previa. El código documental está publicado, pero su activación operativa sigue pendiente.
- Después de congelar el paquete se detectaron15fuentes modificadas concurrentemente en transición/seguimiento/tiempos de Formalización y sus drawers. Esas ediciones posteriores no forman parte de este release y requieren su propio corte y validación; se conservó intacto el checkout.
- Evidencia de publicación y activación en carpeta temporal privada habita-full-d89288457f0c4a49b3080bceec022e0e. Paquete y manifiesto conservados en habita-publish-5ae2c295ff6a4cd2880f6c36318d0392; copias temporales de llaves eliminadas, originales intactos.

## Publicación completa de pendientes — 03/11/2026 15:19 Costa Rica

- Autorización expresa: publicar en producción todos los cambios pendientes. Publicador existente ejecutado desde una copia fija del checkout, rama temp/crm-tink-api-frontend-inicial, base4d446ed más cambios locales. Sin commit/push.
- Release activo verificado: **20261103211935-4d446ed-local**; anterior20261103195227-4d446ed-local conservado como rollback. SHA256185eb5d8920ac9346ff8d250096d50c2aa72d10ad3927c24cb67e6a3b34e3a51.
- Frente al release anterior:83 fuentes cambiadas,45 fuentes funcionales de API/frontend; incluye Inicio unificado y filtros, orden global por proyecto/expediente, distribución por proyecto descendente, acceso rápido de calendario en cuatro módulos, cambios acumulados de finiquito/transiciones/tiempos y Mercadeo. Se conservaron las demás fuentes ya publicadas. Copia fija1401 fuentes;19 archivos del clon ausentes/excluidos se respetaron al preparar el corte.
- Preflight remoto de solo lectura: esquema CRM_THINK_V2 y migraciones068–073 presentes; ambos ENUM de Adéndum incluyen sent; columnas de calificación existen en ambas BDs. NetSuite production/modules con URL configurada y persistencia de eventos habilitada. No se ejecutaron migraciones ni se cambiaron secretos, flags, vhosts o servicios vecinos.
- Verificación independiente:1401 fuentes y769 artefactos sin discrepancias, HTML público y56 JS/CSS con hashes idénticos al paquete. Login, Inicio Formalización, ready y live200; identidad y distribución sin sesión401. HTML Cache-Control:no-cache.
- Proceso habita-api online, PID520631 y cwd del release nuevo. SHA256 del archivo privado shared/api.env idéntico antes/después; permisos0600 conservados. Reinicio limitado a habita-pm2.
- Código desplegado consultado directamente dentro de transacción READ ONLY:243 órdenes en14 proyectos, orden descendente confirmado, primeros totales46,39,32,30,25. No escrituras de negocio ni creación de eventos/correos durante la verificación.
- Builds de API/frontend aprobados desde la copia fija; lint y typecheck API aprobados.1015 pruebas específicas API aprobadas/32 omitidas y167 frontend aprobadas. No se declara toda la suite general verde: check-all se detuvo por formato en7 archivos (NetSuite y pruebas); lint frontend conserva complejidad de NotesInbox y orden de imports de PersonalNotes ya documentados. No se modificaron esos comportamientos incidentalmente.
- Comparación final con el workspace después de activar: cero fuentes funcionales modificadas o nuevas pendientes respecto de la copia publicada. Este recibo se agrega después de activar y no altera el runtime.
- Evidencia privada local: carpeta temporal habita-release-review-a95d8f3ce7834e2e9a2079f66029c5e6 (freeze-manifest, pending-source-diff, production-preflight, publish.log, verification.json y deployed-readonly.json). Paquete del publicador en habita-publish-16e036bb4dee4d5793591760b8fe15a6. Copias temporales de llave retiradas; original preservada.

## Publicación completa — permisos personales y Mercadeo — 03/11/2026

- Autorización expresa del usuario: publicar todos los cambios del proyecto. Se ejecutó publish.ps1 sobre una copia fija de la rama temp/crm-tink-api-frontend-inicial, base4d446ed y cambios locales. Sin commit/push.
- Release activo: **20261103221757-4d446ed-local**. SHA256 del paquete: **5ceff3f19a6ab4af624c497faa26e55ac75542d3a0362bb2f52e9ed529ed6bc9**. Rollback anterior conservado:20261103211935-4d446ed-local.
- Ambos builds aprobados desde la copia fija. Incluye1403 fuentes y770 artefactos, verificados independientemente en el servidor. HTML público y57 JS/CSS iguales al paquete. API PM2 online, PID521901 y cwd del release nuevo. live/ready/login/rutas SPA200; identidad y endpoints protegidos sin sesión401.
- Preflight de solo lectura confirmó migraciones hasta073 y los cuatro grants personales de Bancos activos de Kenneth. Después de activar, IdentityProfileRepository del release resolvió los cuatro grants como source=override; canUseBanks confirmó read/create/update/inactivate y módulo Formalización activo. No se creó una sesión de Kenneth ni se cambiaron sus asignaciones.
- Entorno privado conservado byte por byte: SHA2566cd1eda6ca90aa7ff2608a959797a6bcf6e570b2ed6171438914cd239040fe8f, modo0600. No migraciones, escrituras de negocio, cambios de credenciales, flags o vhosts. Calendario conserva true; documentos de órdenes conserva false.
- Navegador autenticado en Habita confirmó Captación de leads con selector de meses y Aplicar filtro, sin error inicial. Editar meses conserva rango y cifras aplicados hasta confirmar.
- Comparación del workspace tras activar: cero fuentes nuevas/modificadas pendientes; segunda comparación funcional también sin diferencias. Este recibo se agrega después de publicar y no cambia el runtime del paquete.
- QA previo:115 rutas protegidas con casos de permiso personal y deny;771 pruebas HTTP,155frontend focalizadas y builds/typecheck aprobados. Se conservan límites conocidos de la suite completa (expectativas históricas/UI y formato NetSuite/Finiquito); no se declara check global verde.
- Evidencia privada local: carpeta habita-complete bajo C:/codex-data/tmp, con publish.log, verification.json, kenneth-verification.json, runtime.json y comparación del workspace. Paquete/manifiesto conservados en %TEMP%/habita-publish-31e3814aa8eb4f898378d4d46892f423. Las copias temporales de llave se retiran; original preservada.

Comprobación visual final del release20261103221757: Mercadeo en Habita mantuvo50 leads al editar meses, y solo después de Aplicar filtro mostró octubre/noviembre en15 proyectos,1461 leads, sin error. Captura local: C:/codex-data/visualizations/2026/11/03/marketing-periods/produccion-ultima-version.png. No hubo escrituras de negocio.


## Publicación completa — aprobación Formalización — 03/11/2026 16:57 Costa Rica

- Solicitud expresa: publicar todos los cambios y conservar OneDrive y calendario activos. Publicador existente sobre copia fija; base06a489c y cambios locales. Sin commit/push ni migraciones.
- Release activo verificado: **20261103225704-06a489c-local**. Paquete SHA256dfacab95543549e348bb838dd35f512423d6cb7aec1f87f98860da7a1d989dfe. Release anterior20261103221757-4d446ed-local conservado para rollback.
- Builds API y frontend aprobados desde la copia fija. Verificación independiente de1404 fuentes y770 artefactos sin diferencias. Código compilado confirma retirada del bloqueo de aprobación exclusivo a Sandbox; permisos, auditoría y confirmación NetSuite permanecen.
- Configuración privada conservada byte por byte: SHA256c2d87895d07f041aa1726678871b60149f0fb0528d4e254f367451521165614c. ENABLE_ORDER_DOCUMENTS=true y ENABLE_CALENDAR_EXTERNAL=true antes y después. Servicio habita-pm2 activo; live/ready/login/ruta de órdenes200. POST de aprobación sin sesión/CSRF403, sin escritura de negocio.
- QA focalizado previo de esta acción:132 pruebas API y349 frontend aprobadas; lint API, typecheck y compilación aprobados. No se ejecutó aprobación real en NetSuite ni se subieron scripts al File Cabinet; una prueba externa requiere una orden elegida expresamente. No se afirma aceptación externa por salud del servicio.
- Comparación final del workspace contra el paquete: cero archivos modificados o nuevos pendientes. Este recibo se incorpora después de activar; no cambia el runtime desplegado.
- Evidencia privada: C:/codex-data/tmp/habita-approval-release-current.txt apunta a preflight.log, publish.log y verification.log. Copia fija en %TEMP%/habita-publish-9a4b4f4b6afc4055bf655b9902351278. Copia temporal de llave eliminada; original preservada.

## Publicación completa — workflow y modal de adéndum — 03/11/2026

- Autorización expresa: publicar todos los cambios y mantener calendario/OneDrive habilitados. Release activo **20261103231611-06a489c-local**, base06a489c con cambios locales; paquete SHA2563edd4a88476b07e3ba6b1ce8f22464e36037218ce8517a5ad1114d028cc1dfbc. Anterior20261103225704-06a489c-local conservado para rollback. Sin commit/push ni migraciones.
- Builds API/frontend aprobados sobre copia fija. Verificación remota independiente:1404 fuentes y770 artefactos correctos, HTML público idéntico al build; servicio habita-pm2 activo, live/ready/órdenes200.
- ENABLE_ORDER_DOCUMENTS=true y ENABLE_CALENDAR_EXTERNAL=true antes/después. Configuración privada conservada byte por byte: SHA256c2d87895d07f041aa1726678871b60149f0fb0528d4e254f367451521165614c.
- Incluye modal de marcación manual por encima de la capa global y SuiteScript2026.11.03.5 con N/workflow.trigger, customworkflow219/workflowstate2778. La librería se publica como fuente del CRM; no equivale a subirla al File Cabinet de NetSuite. No se ejecutaron workflows/aprobaciones reales ni mutaciones de órdenes para QA.
- QA focalizado previo:158 pruebas API de aprobación/cliente/paquete y38 frontend de adéndum, lint de archivos tocados, typecheck/build aprobados. Comparación del workspace frente a la copia fija sin diferencias de fuentes antes de este recibo.
- Evidencia privada: C:/codex-data/tmp/habita-workflow-release-current.txt apunta a preflight.log, publish.log y verification.log. Copia fija %TEMP%/habita-publish-186081d3799c406497f18abfff5d0c08. Copias temporales de llave eliminadas; original intacta.

## Publicación final de pendientes — 03/11/2026 17:46 Costa Rica

- Solicitud expresa de publicar pendientes en Habita. Release activo: **20261103234602-06a489c-local**; anterior20261103231611-06a489c-local conservado para rollback. Paquete SHA256568b93fbe6c7199b44209b0e1adc139e6543fe2c5b79f0e8122cc6fbb2dab62a. Sin commit/push ni migraciones.
- Frente al release anterior se publicaron siete fuentes pendientes: librería SuiteScript, sus pruebas y documentación. La versión publicada como fuente es2026.11.03.7; desplegar Habita no actualiza el File Cabinet de NetSuite ni ejecuta workflows reales.
-122 pruebas focalizadas aprobadas (107API y15frontend), lint API focalizado aprobado; builds API/frontend desde copia fija aprobados. No se reejecutó ni se acredita verde la suite global.
- Verificación independiente:1404 fuentes y770 artefactos sin diferencias; HTML y10assets públicos conhashigual. Login, Formalización, Captación y live/ready200; identity/me sin sesión401. Serviciohabita-pm2activo.
- Archivo privadoapi.envconservado byteporbyte (SHA256c2d87895d07f041aa1726678871b60149f0fb0528d4e254f367451521165614c, modo0600). Calendario externo y documentos continúantrue. No se cambiaron BD, credenciales ni servicios vecinos.
- Comparación del checkout frente al paquete antes de este recibo: cero fuentes modificadas durante la publicación. Los accesos de usuarios y la limpieza de datos autorizados anteriormente ya son cambios de BD compartida, no migraciones ejecutadas durante este despliegue.
- Evidencia local: C:/codex-data/tmp/habita-final-current.txt apunta al directorio conpublish.log,verification.log, manifiesto previo y diagnóstico de diferencias. Copias temporales de llave eliminadas; original intacta.
