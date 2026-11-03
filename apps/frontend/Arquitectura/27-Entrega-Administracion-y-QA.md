# 27 - Entrega de Administracion y QA

## Conciliación de alcance y evidencia - 2026-11-02

Las entregas siguientes son bitácora fechada; el inventario actual de rutas,
servicios y capacidades está en [30](30-Estado-Frontend-Verificado.md). Se amplió
después con notas colaborativas/realtime/workflow/vínculos, calendario global
con participantes/relaciones y consulta de fichas/capítulos NetSuite de
Formalización. No describir el sistema actual como solo Identidad o dos banners,
ni recuperar la maqueta de Captación como fallback cuando falle su API.

Formalización conserva permisos independientes por banner, lectura de orden,
etapa y aprobación; consultas de cliente/unidad/bitácora no entregan edición
general ni importan filas legacy. El borrador Outlook no equivale a correo
enviado. Calendario guarda datos CRM de invitados y Teams sin Graph ni envíos.
Notas invitan con ACL separada de permiso comercial; los Select de cliente/orden
no exponen opciones de BD. Contratos: [Calendario global](Calendario-Global-Frontend.md),
[16 notas](16-UX-Notas-Adhesivas-y-Anotaciones.md) y [68 API notas](../../api/Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md).

La ejecución nueva `pnpm check` del 2/11 pasa formato pero falla lint en cuatro
puntos de código. No se corrige código como parte de esta revisión documental.
Tipos/pruebas/build separados y los resultados del comando raíz deben leerse
en el cierre actual, sin reemplazar las cifras históricas conservadas abajo.
La suite frontend separada del 2/11 terminó con 1.270 aprobadas y una fallida en
movimiento encolado (`personal-notes.spec.tsx`, posición60 frente a70 esperada).
No se modificó implementación ni aserción para ocultarla. Una nueva ejecución
fallida no queda sustituida por la aceptación histórica registrada en68.
No hay aceptación actual de BD, infraestructura o integraciones solo por revisar
los commits. En particular los cambios locales057 y plan70 no activan una UI
de indicadores ni sincronización duradera NetSuite.

## Estado contrastado - 2026-10-27

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría las rutas, contratos y límites actuales: Captación conectada, seguimiento y cambio protegido de etapa de Formalización. Los cortes fechados siguientes son antecedentes; sus cifras de QA no se reejecutaron en esta revisión documental.


## Captacion: conexion federada autorizada - 2026-10-26

La vista `/home/marketing/leads` ya usa `GET /marketing/leads/report`. El modelo
acepta directorios y filas de API, sin mutacion de catalogos globales ni fallback
de demo. Las muestras anteriores se conservan solo como evidencia historica y
fixtures de prueba. Semana empieza lunes; Hoy/Mes/Todo dependen de fechas reales
devueltas por el servidor. Vendedores por publicId nativo o identidad legacy
separada, con foto solo cuando coincide el publicId. La seleccion se conserva
cuando un vendedor no tiene resultados en otro periodo, mostrando cero.
Se conservan tres profundidades y las exportaciones PNG/PDF; solo se exporta
el reporte vigente, no datos anteriores durante cargas o errores. Citas son
leads con cita (completada tiene prioridad sobre programada), no eventos.
[Contrato y cierre de verificacion](../../api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md).

## Captacion: comparar en el tablero, sin explorador - 2026-10-26

Se retiro de la pagina la seccion «Explorar a fondo» y su estado de pregunta/panel.
Las comparaciones se concentran en «De donde vienen los leads», reutilizando las
barras que filtran el tablero. Un selector multiple permite mostrar vendedores,
proyectos, campanas y anuncios; vacio muestra todos, vendedores primero. Otro
selector cambia la medida (sin dinero). Cada tarjeta alterna entre horizontal y
vertical sin alterar datos. Las verticales comparten escala dentro de su tarjeta
y colocan categorias una al lado de otra; en movil tienen scroll propio.

Seleccionar barras ahora agrega/quita ids individualmente, sin reemplazar las
selecciones anteriores. Cambiar proyectos limpia campanas/anuncios dependientes;
cambiar campanas limpia anuncios. Cada tarjeta ignora su propio filtro y los
niveles dependientes para mantener opciones disponibles; banners y embudo usan
el filtro completo. Este contexto permanece explicado junto a los controles.
Se muestran todas las categorias disponibles (scroll interno), sin limitar a seis.
Cada tarjeta tiene «Ver tabla» con los mismos valores del grafico y nombres/fotos
por publicId para vendedores. Tasas sin denominador siguen mostrando raya.

La pagina mantiene filtros multiples, banners, embudo, tendencia, motivos de
perdida y permiso original. No se cambiaron API, BD ni datos reales. Las pruebas
UI de navegacion del explorador retirado se sustituyen por comparaciones del
tablero; las pruebas puras del modelo/arbol y charts reutilizables permanecen.
La revision independiente detecto y se corrigio el fallo al borrar una fecha y
la perdida de contexto en nombres de campanas/anuncios repetidos en las tablas.
La tendencia no convierte fechas invalidas; la tabla conserva etiquetas completas.
Verificacion focalizada: 30 pruebas aprobadas. Auditoria Lighthouse snapshot movil:
100 en accesibilidad, sin certificacion WCAG completa. Viewport 390px sin overflow
del documento y scroll interno para columnas; el HTML temporal se retira al cerrar.
La comprobacion global de tipos/build encuentra errores ajenos en
`test/home/formalization-follow-up.spec.tsx` (Object.assign sobre posible undefined,
lineas 223/242). No se modifico ese archivo. Lint del codigo tocado aprobado.
Reejecucion final: 492 pruebas Home/App aprobadas con dos workers. Formato
focalizado y diff sin errores de whitespace. El bloqueo global de tipos/build
descrito arriba sigue separado de estas pruebas de ejecucion.



## Captacion: identidad visual por vendedor - 2026-10-26

Los graficos y tablas identifican a cada vendedor con imagen y nombre mediante
`CaptureSellerIdentity`, reutilizando `MarketingWelcomeArt`. El archivo local
solo se selecciona por publicId nativo exacto; no por nombre, posicion, id legacy
ni referencia de proveedor. Foto ausente/rota mantiene la ilustracion anterior.
Cambiar de identidad reinicia el estado de error de imagen. Las personas ficticias
siguen con publicId null: no se asignan fotos reales a nombres de demostracion.
El arbol de analisis transporta sellerId explicito para barras, columnas,
porcentajes, Pareto, filas del mapa de calor y detalle; grupos no vendedores no
reciben retratos. La resolucion usa el directorio CRM con su publicId, no el texto
del grafico. No se consulta API/BD ni se conecta un directorio real en esta maqueta.

Revision de accesibilidad en pagina temporal aislada: Lighthouse snapshot paso
96 a 100 tras mejorar contraste del placeholder y fechas/eje del grafico. Esto
no certifica conformidad WCAG completa. Prueba manual con Enter selecciona el
vendedor; viewport 390px sin desbordamiento. Nombres permanecen visibles, las
imagenes por defecto son decorativas y las fotos tienen texto alternativo.
Verificacion: 391 pruebas Home aprobadas y 53 focalizadas de captacion/conexion
aprobadas. Pruebas nuevas cubren dos publicId distintos, fallback de imagen,
recuperacion al cambiar de identidad y retratos en barras/columnas de dos
vendedores sin agregarlos a proyectos. Tipos y build frontend aprobados; el build
conserva aviso de chunk AntD grande. Se retiro el HTML temporal de revision.


## Captacion: lectura grafica de resultados - 2026-10-26

La vista usa banners con icono, cifra y tendencia, grafico diario reutilizado del
Inicio, barras agrupadas de leads/cita/contrato por vendedor y distribucion por
etapa actual con cantidades y porcentajes. El detalle conserva tabla y columnas
seleccionables. Los colores tienen leyendas y cifras: no son el unico indicador.
Los vendedores comparten una escala de conteos; las series se superponen en el
negocio (un lead puede tener cita y contrato) y no se suman. Las etapas actuales
si particionan la muestra. La tendencia mantiene filtros en ambos periodos.
Cuando el periodo anterior queda fuera de la cobertura ficticia septiembre/octubre,
la comparacion se desactiva y se muestran solo barras del periodo seleccionado.
No presentar ausencia de muestra como cero leads del periodo anterior.

Se reutilizan MarketingHomeCharts, banners y tokens del CRM sin dependencias
nuevas. Las explicaciones extensas pasan a InfoHint, manteniendo visible que son
datos de demostracion sin API/BD y que los valores contractuales no son cobros.
Todos los graficos responden a los mismos filtros locales; no hay importacion,
persistencia ni llamadas comerciales. Implementacion grafica adicional en
`src/modules/marketing/CaptureOverviewCharts.tsx`.

Verificacion grafica: 15 pruebas focalizadas aprobadas, 47 de navegacion/captacion
aprobadas y 455 Home/App aprobadas con dos workers. Una ejecucion amplia previa
agotaba la espera de la ruta lazy; la repeticion focal y la amplia con dos workers
pasaron. Tipos y build aprobados; lint sin errores, con aviso Fast Refresh en
CaptureAnalysisBuilder. Build conserva el aviso AntD de chunk grande. Revision
visual desktop y comprobacion de viewport 390px sin desbordamiento; captura movil
adicional agoto tiempo del navegador. HTML temporal retirado. La revision estatica
independiente detecto y se corrigio la comparacion sin cobertura ficticia.


## Captacion: filtros multiples desde vendedor - 2026-10-26

Vendedor es el primer filtro y la dimension de comparacion inicial. Sin seleccion
incluye todos los vendedores. Proyecto, campana, anuncio, etapa, canal, citas,
resultado comercial y registro de anuncio permiten varias opciones; vacio
significa todas. Se conserva OR dentro del filtro y AND entre filtros; seleccionar
con y sin cita incluye ambos, sin duplicar leads. Las fechas delimitan un solo
intervalo. Aplicar conserva la separacion borrador/reporte; Restablecer vuelve a
todos y comparacion por vendedor. Los ejemplos cargan sus dimensiones especificas.
Solo maqueta local, sin cambiar API, BD, permisos ni Inicio real.

Verificacion de este ajuste: lint general, tipos, formato focalizado y build
frontend aprobados; 453 pruebas Home/App aprobadas, incluidas 13 del constructor.
Cubren orden inicial, controles multiples, combinacion OR/AND, ausencia de
duplicados y restablecimiento a todos. El build conserva el aviso de chunk AntD
grande. No se repitio revision visual de navegador en este ajuste.

## Ampliacion UX de resultados comerciales - 2026-10-26

La propuesta local de Captacion incorpora siete paneles: Panorama, Embudo y
etapas, Vendedores, Citas, Ventas y contratos, Perdidas, Inversion y tiempos.
Reutiliza Select, Tabs, InfoHint y los tokens del CRM. No agrega dependencias,
servicios, permisos, migraciones ni consultas a ninguna BD.

- Los filtros seleccionan leads por fecha de registro; los resultados asociados
  se observan hasta el corte ficticio del 26 de octubre de 2026. No es un reporte
  de ventas ocurridas exclusivamente dentro del periodo seleccionado.
- Filtros multiples de proyecto/campana/anuncio/vendedor/etapa/canal; condiciones
  de cita, atribucion de anuncio y resultado comercial. Se conserva OR dentro
  de un filtro y AND entre filtros, con borrador y aplicacion explicita.
- Hasta seis KPIs personalizables; constructor de barras por metrica, dimension
  y segundo desglose; columnas seleccionables y total recalculado sobre la muestra.
- Leads con orden o contrato se cuentan una vez; documentos se cuentan aparte.
  Contratos pendientes y cancelados no acreditan cierre. El valor contractual
  no equivale a cobro, ni se suma al valor de ordenes para calcular ingresos.
- Citas completadas y asistencia confirmada son medidas distintas; asistencia
  sin verificar se excluye de la tasa. Las personas copiadas no forman parte
  del modelo local. La integracion futura debera deduplicar eventos reales.
- Perdidas actuales se distinguen de eventos historicos y leads recuperados.
  La distribucion por vendedor expresa propietario actual, no reasignaciones.
- Costos y tiempos son ilustrativos; no acreditan gasto de plataformas,
  rentabilidad, ROI ni cobros. Tasas sin denominador muestran raya.

Implementacion en `src/modules/marketing/MarketingLeadCapturePage.tsx`,
`CaptureAnalyticsPanels.tsx`, `lead-capture-preview.model.ts` y
`lead-capture-journey.model.ts`. La muestra no depende de nombres legacy ni ERP.
La futura federacion debe seguir siendo un contrato CRM independiente del origen.

Verificacion de la ampliacion: tipos y build frontend aprobados; 450 pruebas de
Home/App aprobadas y 10 pruebas focalizadas del constructor aprobadas. Lint y
Prettier del modulo aprobados. El lint general detecto ademas complejidad 12/8
en `FormalizationFollowUpPreview.tsx`, ajeno a esta entrega; no se modifico.
Build conserva el aviso de chunk AntD mayor de 500 kB. Revision independiente:
corregidas tasas sin denominador y aclaracion persistente del periodo. Revision
visual aislada en 1440px y 390px, sin desbordamiento del documento; panel comercial
verificado, sin peticiones de API observadas. HTML temporal retirado. No acredita
pruebas end-to-end con sesion comercial ni integracion con datos reales.

La verificacion inicial descrita debajo corresponde a la version anterior.

## Captacion de leads: propuesta UX dinamica - 2026-10-26

Reemplaza la pagina de solo H1, conservando ruta y permiso. Implementacion aislada
`src/modules/marketing/MarketingLeadCapturePage.tsx`, su CSS y
`lead-capture-preview.model.ts`. Ant Design Select y tokens del CRM existentes,
sin dependencias nuevas. No importa servicios de datos ni consulta las BD.

- Muestra ficticia determinista de septiembre/octubre de 2026, identificada en
  cabecera y pie; no representa resultados actuales ni datos migrados.
- Proyecto, campana, anuncio, vendedor y etapa admiten seleccion multiple.
  Citas y presencia de anuncio permiten incluir/excluir. Fechas por creacion.
- OR dentro de una dimension, AND entre dimensiones; campanas se limitan a los
  proyectos elegidos y anuncios a campanas/proyectos, depurando selecciones incompatibles.
- Borrador de filtros separado del reporte aplicado. Aplicar actualiza localmente;
  Restablecer y los cuatro ejemplos cargan configuraciones locales conocidas.
- Medida: cantidad de leads, con cita, perdidos o sin anuncio. Comparar por
  proyecto/campana/anuncio/vendedor; segundo desglose opcional en tabla.
- Las barras comparan categorias, no periodos distintos. El estado Perdido es
  actual; no cuenta repeticiones historicas. Varias citas no multiplican leads.
- Sin coincidencias no se inventan resultados. Sin campana/anuncio permanece
  visible como falta de atribucion. No se guardan filtros ni se exporta nada.

La futura integracion debera alimentar un contrato CRM independiente del origen;
esta maqueta no implementa federacion, SQL ni reglas de precedencia entre BD.
El adaptador legacy podra retirarse sin que esta UI dependa de nombres/campos ERP.

Verificacion de esta maqueta: lint y tipos frontend aprobados; 446 pruebas de
Home/App aprobadas, incluidas seis focalizadas del constructor local; build
completado (con advertencia preexistente de chunk AntD grande). Las pruebas
cubren filtros combinados, depuracion de dependencias, borrador/aplicacion/reset,
agrupacion sin doble conteo, fechas invertidas y ausencia de llamadas fetch.
Navegador: revision visual desktop y viewport movil de 390px sin desbordamiento
del documento; tabla con scroll propio. Ejemplo Perdidos comprobado en una
pagina de prueba aislada con los mismos componentes; no sesion comercial real.
Se retiro el HTML temporal de revision. Revision independiente sin hallazgos
importantes. No se consultaron BD, ni se cambiaron permisos, migraciones o APIs.



## Antecedente Captacion de leads: entrada minima autorizada - 2026-10-26

La opcion de Mercadeo navega a `/home/marketing/leads`. La pagina contiene
exclusivamente el H1 Captacion de leads dentro del contenedor habitual. Reutiliza
`mercadeo.leads.read`, ya existente; el filtro de menu y la autorizacion de ruta
exigen el permiso efectivo y respetan denies. No se requiere el nombre de un rol:
una persona con el permiso efectivo y contexto modular permitido puede entrar.
No incorpora tabla, consultas de leads, exportaciones ni acciones comerciales.
SELECT de solo lectura confirma permiso activo y grants activos en mercadeo y
jefe_mercadeo; no se crearon grants duplicados ni se ejecutaron migraciones.
Verificacion de la entrada: 32 pruebas de navegacion/permisos aprobadas, lint y
tipos frontend aprobados y build completado. Sesion real autenticada de navegador
no verificada en esta entrega; no se modificaron credenciales.


## Mercadeo: textos y comparaciones explicitos - 2026-10-26

El propietario aprobo aclarar Inicio sin cambiar calculos, API, permisos o BD.
Los titulos visibles pasan a Leads registrados, Leads registrados que tienen cita
y Citas marcadas como completadas. Se explica que lead es registro de interes,
no persona unica; conversion admite citas futuras no canceladas y completada
no equivale a asistencia confirmada. Ultimos siete dias muestra fechas propias.

Mostrando/Comparando con y la leyenda del grafico exponen fechas exactas;
el grafico de Hoy conserva su contexto de siete dias. Vendedores muestran
mas/menos leads y Sin leads en el periodo anterior, sin sugerir alta de empleado.
Los proyectos del filtro son agrupaciones de los leads, no prueba de asignacion.

Los avisos muestran la diferencia absoluta, porcentaje y ambos conteos, con
fechas comunes del bloque. Proyectos se priorizan por mayor perdida absoluta,
con desempate alfabetico; se conserva el umbral existente de caida (20%), base
minima (25 leads anteriores), periodo minimo (7 dias) y limite de tres avisos.
La advertencia de citas sin lead solo muestra problemas con conteo positivo.
Los snapshots y verificaciones del 23 conservan su fecha y alcance.


## Estado revisado - 2026-10-23, lectura de codigo sin ejecutar runtime

Inventario de Administracion y bitacora de entregas. Cada cifra y comprobacion fechada conserva su corte original. Un antecedente registrado: 428 pruebas frontend, 84.77% de lineas; API 4583 aprobadas y 113 MySQL omitidas, no aprobadas. No es la corrida mas reciente del historial. Fuente: [reauditoria](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md). No se reejecutaron checks, cobertura, build ni navegador por editar Markdown.

Formalizacion vigente: [29 - Navegacion y seguimiento](29-Navegacion-Recuperacion-y-Seguimiento.md). [28 - Recorrido](28-Formalizacion-Recorrido-Visual.md) conserva el historial visual. Inicio/Gestion/seguimiento ya no muestran filas DEMO y Movimientos recientes declara indisponibilidad; no hay listado/detalle operativo conectado. Calendario, Resumen y modelos de preview conservan simulaciones, no operaciones reales.

La entrada exige modulo activo en el perfil efectivo; Owner recibe modulos virtuales desde backend, no un bypass en React. `formalizacion.home.read` esta inactivo. Aprobaciones conserva `formalizacion.home.approvals.read` allow sin deny: Spin/Consultando, valor al resolver, No disponible al fallar; no concede aprobar/devolver.

Los seis banners de etapas consumen un unico `GET /formalization/home/summary` con rol efectivo activo `formalizacion` y `formalizacion.home.stages.read` allow sin deny. Owner puede heredar ese rol desde politica persistida, sin asignacion fisica directa. Preload por numero; fallo muestra Sin verificar/reintento y ceros visuales no confirmados. `useHomeSummary` relee al entrar, recuperar foco/visibilidad y refrescar; no es tiempo real. El servicio conserva desglose nativo/legacy y deduplicacion; no se consulto BD en esta revision.

Mercadeo / Inicio ya usa `GET /marketing/home/summary?period=day|week|month|year` con `mercadeo.home.read` y alcance backend. Cuatro indicadores, grafico y desgloses vendedor/proyecto usan datos canonicos y multiseleccion; las fotos locales aparecen en la bienvenida de vendedores seleccionados, no en las filas del listado. Se buscan por publicId nativo en `public/vendedores`; identidad nula, archivo ausente o imagen fallida conserva la ilustracion. No hay fallback de cifras de ejemplo. Error/carga no se muestran como cero confirmado. Citas disponibles distinguen eventos unicos por fecha del evento frente a conversion por cohortes de leads; varios participantes/enlaces no multiplican eventos, programada no implica realizada/asistida. No hay editor de citas, Outlook ni notificaciones conectadas. Contratos: listado/envio/reversion siguen fuera de runtime activo aunque existan clases/servicios preparados.

### Contrato visible de Mercadeo contrastado con codigo - 2026-10-23

| Elemento | Comportamiento actual |
| --- | --- |
| Periodo | Inicio en Mes. Hoy compara con ayer; Semana comienza lunes y termina hoy; Mes comienza el primer dia y termina hoy; Año comienza el 1 de enero y termina hoy. La comparacion conserva el tramo transcurrido del periodo anterior, con ajuste de mes/anio. El grafico de Hoy muestra los ultimos siete dias; Año agrupa por mes. Rango y comparacion personalizada existen en helpers genericos, sin controles visibles en este Home. |
| Seleccion | Vendedor y Proyecto permiten varios valores. Un cambio de vendedor conserva solo proyectos compatibles con el nuevo alcance. La lista de vendedores permite alternar seleccion y se calcula sin aplicar el filtro de vendedor, conservando los demas criterios. Filtros locales no amplian el alcance devuelto por API. |
| Carga | Preload compartido Actualizando Mercadeo durante lectura y transiciones locales; seleccion del control inmediata y reporte diferido con React. Cambiar periodo oculta cifras anteriores hasta resolver la nueva lectura. Error ofrece Reintentar, sin inventar ceros. El hook no consulta por foco ni hace polling. |
| Leads captados | Suma de cohortes por fecha de creacion en el periodo y filtros seleccionados, independiente del estado comercial actual. |
| % de leads con cita | Leads de esas cohortes con cita dividido por leads captados; utiliza `leadsWithAppointment`, no numero de eventos. La comparacion de tasa requiere leads en el periodo anterior. |
| Citas realizadas | Eventos unicos `completed` por fecha del evento; filtros vendedor/proyecto deben coincidir en un mismo enlace. El subtitulo distingue pendientes, canceladas, asistidas, ausencias y asistencia sin verificar. No muestra una variacion porcentual inventada. |
| Leads sin cita | Cohortes captadas durante los ultimos siete dias sin cita, con filtros aplicados; esta ventana permanece fija al cambiar el periodo principal. |
| Citas no disponibles | Los tres indicadores dependientes de citas muestran — y se omiten alertas dependientes; Leads captados conserva su lectura disponible. |

Tipos, GET y parser residen juntos en `src/services/marketing/home-summary-service.ts`; `src/modules/home/useMarketingHomeSummary.ts` controla usuario/periodo y resultados tardios. El parser valida coherencia de referencias, totales y cohortes, y rechaza eventos duplicados antes de mostrarlos. Detalle del estado remoto: [04](04-API-Client-y-Estado.md). Esta tabla describe codigo inspeccionado; no agrega evidencia de ejecucion ni de calidad del origen.

Usuarios muestra todos los `orgUnits` devueltos en ambas tablas y detalle, con salto de linea; `[]` significa Sin area, no recupera la primera area. Respuestas antiguas sin `orgUnits` usan `orgUnit`. Jefe General opera solo los modulos seleccionados dentro del techo editable de su plantilla; seleccion modular no concede Administracion. Se conservan asignaciones directas para editar y roles efectivos para consumir, con deny prioritario.

Fuentes inspeccionadas: `src/modules/home/FormalizationHomePage.tsx`, `useHomeSummary.ts`, `MarketingHomePage.tsx`, `useMarketingHomeSummary.ts`, `marketing-appointments.model.ts`, `src/services/formalization/home-summary-service.ts`, `src/services/marketing/home-summary-service.ts`, `src/routes/app-routes.ts`, `src/routes/auth-state.ts`, `src/modules/administration/system-users.model.ts` y componentes de tablas/detalle. Backend: `identity-profile.repository.ts`, `identity-module-policy.ts` y `common/security/route-permission.ts`. Consolidacion, importacion de usuarios y esquema calendario: [49](../../api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).

Relectura final tras cambios concurrentes de Mercadeo, 2026-10-23: `MarketingHomePage.tsx`, `marketing-appointments.model.ts`, `marketing-home-preview.model.ts`, `marketing-home-projects.ts` y pruebas `test/home/marketing-connected.spec.tsx` / `marketing-appointments.spec.ts` inspeccionadas, no ejecutadas. Citas realizadas usa eventos completed por fecha del evento; asistencia null sigue Sin verificar. Vendedor y proyecto deben coincidir en el mismo enlace de lead, sin cruzar enlaces de personas distintas. El directorio combina cohortes y enlaces de citas, conservando vendedores/proyectos con citas aunque su lead se capto fuera del periodo. Calidad de datos informa enlaces no resueltos, fechas invalidas y estados desconocidos; alertas usan nombres legibles y no inventan campanas/anuncios ausentes. La existencia de esas pruebas no acredita su resultado actual.

### Cobertura documental de esta revision - 2026-10-23

35/35 Markdown propios revisados: 25 con correcciones locales y 10 sin cambios. No incluye dependencias, salidas generadas ni paquetes de skills instalados/ignorados; se consultaron `code-documenter` y `crm-documentation-standards` locales como instrucciones. No es cobertura de tests ni certificacion de produccion. Se preservan cambios concurrentes, cifras y pruebas de cada entrega historica.

| Archivo relativo a apps/frontend | Resultado |
| --- | --- |
| `AGENTS.md` | Corregido |
| `Arquitectura/00-Indice.md` | Corregido |
| `Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md` | Corregido |
| `Arquitectura/01-Resumen-Frontend.md` | Corregido |
| `Arquitectura/02-Arquitectura-Frontend.md` | Corregido |
| `Arquitectura/03-UI-UX-CRM.md` | Corregido |
| `Arquitectura/04-API-Client-y-Estado.md` | Corregido |
| `Arquitectura/05-Testing-Frontend.md` | Revisado sin cambios: estrategia y evidencia historica |
| `Arquitectura/06-ADRs-Frontend.md` | Revisado sin cambios: adopciones futuras calificadas |
| `Arquitectura/07-Skills-Codex-Instaladas.md` | Revisado sin cambios: inventario fechado, no nuevo censo |
| `Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md` | Corregido |
| `Arquitectura/09-Decisiones-P0-UX-Permisos-y-Preguntas.md` | Corregido |
| `Arquitectura/10-Contrato-Canonico-Frontend.md` | Corregido |
| `Arquitectura/11-UX-Bitacora-Acciones-y-Timeline-Lead.md` | Corregido |
| `Arquitectura/12-Diccionario-Funcional-y-Acciones-CRM.md` | Revisado sin cambios: diccionario futuro |
| `Arquitectura/13-Flujo-Comercial-CRM.md` | Revisado sin cambios: flujo futuro calificado |
| `Arquitectura/14-Modularizacion-Frontend-por-Areas-y-Roles.md` | Corregido |
| `Arquitectura/15-UX-Calendarios-por-Area-y-Supervision.md` | Corregido |
| `Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md` | Revisado sin cambios: notas futuras |
| `Arquitectura/17-UX-Dashboard-Leads-SLA-y-Perdida.md` | Corregido |
| `Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md` | Corregido |
| `Arquitectura/19-Mapa-de-Implementacion-Frontend.md` | Corregido |
| `Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md` | Revisado sin cambios: vertical futuro |
| `Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md` | Corregido |
| `Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md` | Revisado sin cambios: compuerta historica calificada |
| `Arquitectura/23-Regla-IDs-Canonicos-y-Proveedores-Frontend.md` | Corregido |
| `Arquitectura/24-Contrato-Visual-Identidad-P0-S1.md` | Corregido |
| `Arquitectura/25-Continuidad-Administracion.md` | Corregido |
| `Arquitectura/26-Projects-Design-System.md` | Corregido |
| `Arquitectura/27-Entrega-Administracion-y-QA.md` | Corregido |
| `Arquitectura/28-Formalizacion-Recorrido-Visual.md` | Corregido |
| `Arquitectura/29-Formalizacion-Reunion-Ajustes.md` | Corregido |
| `Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md` | Corregido |
| `design-qa.md` | Revisado sin cambios: QA de shell fechado |
| `public/Logo/README.md` | Revisado sin cambios: referencias locales contrastadas |

Discrepancias resueltas: dos banners/cinco o seis ceros provisionales frente al resumen de seis etapas; asignacion directa frente a rol efectivo heredado; exencion Owner frente a perfil/deny; modulos como mera visibilidad frente a limite de grants de General; primera area frente a todos los modulos; Mercadeo mock/sin API frente a resumen conectado; calendario simulado frente a esquema nativo sin operaciones; origen/API canonico frente a claves opacas de resumen; clases contractuales preparadas frente a handlers activos; herramientas propuestas frente a dependencias instaladas; header/modal/overlay historicos frente a CSS/drawer actual.

Limites restantes: aceptacion manual autenticada, persistencia/concurrencia y calidad real de datos de las nuevas lecturas requieren evidencia propia. El corte comunicado por el responsable de importacion es 43 usuarios nuevos (30 pendientes, 13 inactivos), uno omitido y total 46; rol ventas ID interno 317 asignado a 43 sin permisos, auth ni membresias. Es evidencia fechada del 2026-10-23 ([45](../../api/Arquitectura/45-Usuarios-Por-Correo.md)), no consulta realizada aqui ni garantia de acceso. El esquema 034 consta como ocho tablas vacias, 106 columnas comentadas, 27 checks, 40 indices y ocho triggers en la entrega de [47](../../api/Arquitectura/47-Calendario-Compartido-Esquema.md); no implica carga legacy, tipo Cita sembrado, endpoints operativos de calendario, Outlook o campana. La lectura agregada de citas de Mercadeo es una ampliacion distinta.

Verificacion de esta revision: inspeccion de codigo/documentos y diff completo de los Markdown modificados; 123 destinos de enlaces locales comprobados, ninguno ausente, incluido el documento 49 del responsable principal. Sin tests, lint, typecheck, build, DB, commits o despliegues nuevos. Los cambios de otras tareas que aparecen en el diff global conservan su autoria y no son evidencia de esta revision.

## Antecedentes de entregas y QA - 2026-10-13 a 2026-10-20

Las menciones siguientes a `formalizacion.home.read`, filas/contadores DEMO y limites de checks describen su corte original y fueron sustituidas por el estado anterior. No usar esos permisos historicos para implementar.

Antecedente visual de Formalizacion: [28-Formalizacion-Recorrido-Visual.md](28-Formalizacion-Recorrido-Visual.md).
Las entradas de validacion siguientes conservan el historial de entregas; los
contadores navegables y la sesion visual compartida del documento 28 sustituyeron en aquel corte
las limitaciones iniciales de banners estaticos y descarte al salir de la orden.

## Clave inicial manual - 2026-10-13

Nuevo usuario incluye un campo opcional de clave inicial solamente si el actor
tiene permiso efectivo `user.assign_password` y el destino usa Contraseña local.
Crear usuarios sigue exigiendo `user.create`. El permiso aparece como sensible
en Administracion / Usuarios; Owner lo recibe inicialmente. No usar el rol del
destino para decidir si el administrador puede asignar claves.

El campo no aparece en edicion y no se precarga con credenciales existentes.
Ocultarlo/quitar acceso local/cerrar o completar el alta debe limpiar el secreto;
no persistirlo en storage, cache, auditoria, URLs o estado de perfil. Sin clave
se conserva el alta pendiente; con clave inicial valida la cuenta queda activa
salvo estado inactivo explicito. Es clave inicial normal, no temporal ni cambio
obligatorio. Backend aplica las mismas restricciones aunque se manipule el JSON.

QA: autorizado ve el campo, no autorizado no lo ve; Microsoft-only y edicion no
envian password; sin user.assign_password el API rechaza aunque exista
user.create; ambos permisos permiten alta local con hash; no mostrar claves en
errores, detalle, auditoria o resultados. La prueba manual con credenciales
reales corresponde al usuario; no automatizar escritura de contrasenas reales
en el navegador. Contrato, migracion y evidencia backend: documento API 37.

Verificacion de esta ampliacion: check frontend completo con 273 pruebas
aprobadas, lint/formato/typecheck/build aprobados. Navegador Owner confirma
campo visible; captura `C:/codex-data/visualizations/initial-password/authorized-input.png`.
No se escribieron claves ni se guardaron usuarios desde el navegador. La
advertencia historica del bundle Ant Design no bloquea el build.

Actualizado: 2026-10-13. Referencia vigente de comportamiento; complementa [continuidad historica](25-Continuidad-Administracion.md) y [sistema visual Proyectos](26-Projects-Design-System.md). Backend, migracion, pendientes y matriz de solicitudes: [registro de entrega](../../api/Arquitectura/36-Registro-Entrega-Administracion.md). Esta actualizacion no ejecuta cambios de negocio.

## Catalogos estandarizados

Proyectos, Campanas, Clases, Ubicaciones, Subsidiarias y Corredores reutilizan `CatalogItemsPage`, `CatalogItemsDataTable`, estilos de Proyectos/usuarios y SearchPanes. Cada feature conserva su definicion/carpeta; compartir un componente visual no fusiona sus modulos API o sus tablas.

Default 100 filas; opciones 10, 50, 100 y 200. Cada pagina solicita su limit y offset, no acumula todos los registros bajo un boton Cargar mas. El total viene del API. Cache en memoria por catalogo, contexto, tamano y pagina; maximo 20 paginas. Volver a una pagina cacheada no consulta. Actualizar invalida cache; discrepancias de total tambien la limpian. No es cache persistente entre desmontajes ni una garantia de frescura ante ediciones externas.

Durante carga conservar estructura, indicador y controles coherentes; no reconstruir un vacio enorme por cambiar de pagina. Los filtros SearchPanes estandar de estos catalogos se aplican a los registros cargados; no confundirlos con filtros globales de inventario. El drawer agrupa referencias por proveedor y muestra Sin asignar para faltantes.

## Expedientes: busqueda antes de inventario

Ruta `/home/administration/catalogs/files`, feature `src/modules/administration/unit-files`; consume `/unit-files`, no persistencia generica `/catalogs/files/items`. El montaje consulta opciones de proyecto pero no descarga inventario.

Tres criterios primarios: Proyectos multiseleccion, Estado y Codigo de expediente/coincidencia. Buscar exige al menos uno y una lista de proyectos disponible. Si solo se proporciona estado o coincidencia, la UI transmite los proyectos canonicos disponibles como alcance. El selector de proyectos no tiene el antiguo tope visual de tres; los limites tecnicos del API siguen aplicando. No prometer consulta irrestricta sin criterio.

Despues de buscar aparecen cuatro paneles DataTables SearchPanes: Codigo, Proyecto, Tipo de vivienda y Estado. No son Select ordinarios. Se retiraron los Select adicionales Tipo de vivienda (Todos) y Unidad (Todos), asi como la busqueda global duplicada de la tabla. Select primario, tamano de pagina y selector de referencia de comparacion siguen siendo controles validos fuera de SearchPanes.

Los paneles permiten seleccion, conteos, limpiar por panel/global y expandir/contraer. OR dentro de cada panel, AND entre paneles. Sus opciones/conteos se agregan sobre todo el alcance primario mediante `/unit-files/facets`, no solo sobre las primeras 50/100 filas: asi una opcion no aparece por primera vez al avanzar de pagina. Se consultan paginas de valores agregados hasta completar opciones, sin descargar todas las fichas; esto aun tiene costo de agregacion.

### Cache y limite del filtrado local

`UnitFilesPage.tsx` conserva cache local de paginas (20), facetas (20), detalles (24), TTL de 30 segundos para esas entradas y hasta 2.000 filas conocidas para evaluacion local. No es cache permanente, sincronizacion en tiempo real ni almacenamiento entre sesiones.

`localUnitPaneData` solo filtra sin HTTP cuando los conteos agregados prueban que se dispone del conjunto necesario, incluidas las facetas cruzadas, y el resultado cabe en una pagina. Si solo existe una parte del conjunto, consultar servidor es correcto: filtrar solo la pagina visible ocultaria registros. Si se requiere cursor o la cache expiro, se vuelve a consultar. No afirmar que toda seleccion de SearchPanes evita SQL.

`createUnitPaneAjax` agrupa redraws sincronicos de Limpiar, comparte trabajo pendiente para la misma seleccion, descarta respuestas obsoletas y no consulta por ordenar/redibujar una seleccion aceptada. El orden de cabecera es local a la pagina; no promete ordenamiento global del inventario.

Paginacion de expedientes: default 50, opciones UI 10/50/100, cursor ligado a criterios y maximo API 100; no total global obligatorio ni offset. Next consulta lo no recuperado; Back usa pagina fresca cacheada. Cambiar criterio reinicia cursor y facetas. Errores no dejan inventario anterior etiquetado como si correspondiera al filtro nuevo.

### Tabla, detalle y comparacion

Columnas: Codigo, Proyecto, Tipo de vivienda, Precio de venta, Estado, Entrega estimada, Area total, Lote y Area de parqueo. Detalle bajo demanda: los 27 valores de negocio del origen, identidad CRM, enlace legacy/procedencia, proyecto CRM y referencias por proveedor. Valores faltantes no se convierten en cero. Una ficha no migrada muestra Pendiente de migracion, no una identidad CRM inventada.

Planos solo se convierte en enlace si `unitPlans` es URL valida HTTP/HTTPS; abre nueva pestana con `rel="noopener noreferrer"`. Otros esquemas o texto se muestran como valor, no como enlace ejecutable.

La barra de seleccion esta debajo de filtros, antes de filas; Comparar requiere al menos dos seleccionados. Actualmente admite hasta ocho expedientes, conservando seleccion entre paginas. Este limite es de comparacion, distinto de la multiseleccion de proyectos.

Comparacion por columnas de unidad y grupos de campos; cabeceras, referencia seleccionable, Solo diferencias y desplazamiento horizontal. Costos (precio anunciado/minimo, precio por m2, mantenimiento): menor es favorable. Areas: mayor es favorable. Verde mejor, amarillo intermedio, rojo menos favorable; empate neutral cuando todos son iguales. Flecha expresa direccion numerica, no conveniencia: un precio bajo puede ser verde con flecha abajo. Faltantes/no numericos no se rankean como cero. Texto, estado y fechas no reciben un ranking arbitrario. No existe un ganador global ponderado ni conversion de moneda.

## Roles y seguridad

### Acciones de catalogo y permisos efectivos

La pagina compartida de catalogos oculta Alta, Editar e Inactivar/Reactivar
cuando falta el permiso exacto del modulo de contexto y catalogo. No basta
tener lectura. Crear requiere `<contexto>.<catalogo>.create`, editar y reactivar
requieren `.update`, inactivar requiere `.inactivate`. Los menus de fila y el
detalle siguen la misma regla; sin acciones autorizadas no aparece el menu vacio.
La UI parte sin autoridad y revalida antes de abrir o enviar una mutacion;
errores o revocaciones retiran formularios y acciones. La API vuelve a validar
la sesion y permiso antes de persistir, incluso si se intenta omitir la interfaz.
Esta correccion no cambia estilos, navegacion, permisos guardados ni registros.

Verificacion de acciones de catalogos: `pnpm check` completo aprobado con 341
pruebas, formato, lint, typecheck y build. Incluye siete casos nuevos de
Formalizacion no Owner (lectura, otro modulo/catalogo, deny y revocacion antes
de abrir/enviar o al recuperar foco), doce casos de tabla/detalle y 67 casos
de la pagina compartida. La cache Back no consulta perfil ni listado; cambiar
modulo/catalogo descarta formularios antiguos. API: 3.840 casos HTTP nuevos
aprobados; limites de la ejecucion global registrados en API 36. No se probaron
mutaciones con la cuenta real del usuario ni se alteraron grants persistidos.

La cantidad de opciones autorizadas no cambia la linea grafica del menu:
Formalizacion con solo Inicio reutiliza la misma barra oscura, dimensiones,
iconos y estado activo que Administracion. Se retiro la variante visual
`global-home-menu--single`; el filtrado por permisos permanece intacto.

### Perfil Formalizacion inicial historico - 2026-10-13, permiso sustituido

Rol Formalizacion disponible en el catalogo API; solo `formalizacion.home.read`
en Formalizacion / Inicio. El alta deriva el modulo desde permisos del rol y
backend aplica el default cuando no se envian areas explicitas. El perfil
exclusivo solo ve Inicio en `/home/formalization`; no ve Resumen, Expedientes,
Contratos o Catalogos. Inicio no reutiliza `file.read`, no descarga expedientes
ni muestra metricas inventadas. La UI no concede permisos por nombre del rol:
consume permisos efectivos y membresias del API; roles adicionales/overrides
se siguen resolviendo con las reglas generales. Requisitos de futuras secciones
y migracion puntual: [documento API 36](../../api/Arquitectura/36-Registro-Entrega-Administracion.md).

Verificacion nueva: `pnpm check` completo aprobo 269 pruebas, formato, lint,
typecheck y build. En sesion real Owner reautenticada se verifico Formalizacion
/ Inicio 1/1 y alta con modulo derivado (1 rol / 1 modulo), sin guardar usuarios
ni cambiar switches. Capturas en `C:/codex-data/visualizations/formalization-home/`.
Login como un nuevo empleado Formalizacion sigue pendiente de una cuenta real
autorizada; el aislamiento y redireccion del perfil estan cubiertos por pruebas.

Vista focalizada: Por rol / Por empleado; selector de sujeto; encabezado con nombre, contador y proteccion Owner; guardar cambios y motivo auditable. Modulo -> Seccion -> pestana de catalogo, mostrando solo el contenido seleccionado. Se sustituyo la exposicion simultanea de todos los acordeones.

Administracion agrupa Usuarios, Roles y seguridad y Catalogos del catalogo API. Los otros modulos conservan sus secciones reales. No sintetizar una seccion Auditoria o una matriz de cuatro acciones si el API no entrega permisos de ese tipo: Auditoria comparte autorizacion `role.assign` en backend y no tiene necesariamente una vista independiente en el catalogo de permisos. Esto explica la diferencia entre el ejemplo inicial solicitado y las opciones realmente disponibles.

Acceso de seccion concede lectura si existe, o sus acciones si no tiene lectura. Marcar todos afecta solo la vista elegida. Permisos indican Lectura/Estandar/Sensible. En empleados, mostrar Por rol, Sin permiso del rol o Excepcion permitido/denegado. Quitar excepciones redundantes cuando el estado coincide con roles. Visibilidad en menu no equivale a autorizacion final: API siempre revalida.

Owner protegido no puede degradarse saltando validaciones de UI. Conflictos de negocio muestran el motivo API sin repetir mutaciones. Solo 401 o 409 exacto de sesion obsoleta activa renovacion/reintento. Ante fallo de red, el resultado del guardado es incierto: verificar estado antes de reenviar. [Contrato y pruebas](../../api/Arquitectura/37-Auditoria-Trazabilidad-y-Conflictos.md).

## Autorizacion de Usuarios y Roles - 2026-10-13

Usuarios obtiene permisos efectivos antes de mostrar datos o acciones. Lista y
detalle se controlan con `user.view_list` y `user.view_detail`, respectivamente.
Alta requiere `user.create` y `role.assign` porque asigna roles iniciales;
clave manual requiere ademas `user.assign_password`. Editar datos usa
`user.update`; sin `role.assign` no se pueden modificar roles/modulos.
Activar exige `user.activate`, bloquear/inactivar `user.deactivate`; se mantienen
las restricciones de la cuenta propia. Menus, drawer y envio siguen la misma regla.

Roles y seguridad exige `role.assign`. Carga, errores y revocacion no conceden
autoridad por defecto ni muestran roles de demostracion editables. Se revalida
antes de guardar; el API vuelve a comprobar cada operacion. No se mutan cuentas
reales desde el navegador como parte de la verificacion automatizada.

Verificacion de esta revision: `pnpm check` completo aprobado (formato, lint,
typecheck, 315 pruebas y build), incluidas
regresiones de permisos exactos, revocacion, errores de catalogo/acceso y
edicion multiarea. Los tests de navegacion ahora esperan una revalidacion de
permisos al entrar a Usuarios/Roles sin reiniciar la sesion. El test de detalle
concede explicitamente lectura y activacion; no deduce acciones por ser Owner.
El test de paginacion espera el dibujo de DataTable, no solo el contador React.
El API aprobo 588 pruebas (167 HTTP incluidas), mas ocho casos MySQL rollback
por separado. Los limites globales y aceptacion manual estan registrados en API 36.

## Auditoria para usuarios finales

Modulo y Seccion obligatorios antes de consultar, Catalogo opcional si corresponde, busqueda y paginas acotadas. Tabla: evento legible, actor y roles historicos cuando existen, contexto, registro exacto, accion y fecha. Drawer: motivo, referencia al registro y valores anteriores/nuevos; detalle se solicita al abrir. No descargar snapshots de todos los eventos al entrar.

Los eventos tecnicos se traducen visualmente (por ejemplo Se actualizo la campana); codigos internos no son el titulo principal. Contexto/roles/valores no registrados historicamente se declaran desconocidos. El drawer identifica el registro por ID/nombre, pero Abrir seccion lleva a su seccion, no abre automaticamente el registro. Ese deep link queda pendiente. El enlace no evade permisos ni garantiza que el registro siga existiendo.

## Matriz de aceptacion manual

Ejecutar en entorno autorizado con datos de prueba controlados. Guardar evidencia de solicitud/respuesta, captura, identificador y consulta de auditoria sin secretos. Estas filas son casos pendientes de aceptacion, no resultados inventados.

| Caso                                         | Resultado esperado                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Catalogo pagina 100 -> siguiente -> anterior | Next solicita limit/offset correctos; Back cacheado sin solicitud; indicador sin salto/vacio persistente |
| Cambiar tamano a 10/50/200                   | Reinicia pagina; solo cantidad solicitada; total y botones correctos                                     |
| Crear/editar/desactivar catalogo autorizado  | Motivo obligatorio, identidad/referencias correctas, antes/despues y rollback si falla auditoria         |
| Abrir expedientes sin buscar                 | Ninguna solicitud de inventario                                                                          |
| Buscar ff/ff03 solo o con proyecto/estado    | Coincidencias globales del alcance, cursor coherente, sin payload masivo                                 |
| Proyecto con mas de una pagina               | Facetas incluyen opciones de paginas no visitadas y conteos consistentes                                 |
| Filtrar conjunto completo ya conocido        | Sin consulta cuando prueba de completitud y limite permiten filtro local                                 |
| Filtrar conjunto incompleto                  | Servidor resuelve coincidencias faltantes; no ocultarlas por filtrar solo pagina                         |
| Limpiar multiples paneles / ordenar          | Sin duplicar consultas por redraw; seleccion y conteos restaurados                                       |
| Detalle y Planos                             | Todos los valores, faltantes explicitos y enlace HTTP/HTTPS seguro                                       |
| Comparar dos o mas                           | Barra visible; menor costo verde, mayor area verde, intermedios amarillos, empate/faltante neutral       |
| Selector rol/empleado/modulo/seccion         | Solo contenido elegido; no perder cambios de otras secciones; guardar con motivo                         |
| Conflicto Owner o propiedad de referencia    | Una mutacion, explicacion concreta, proteccion intacta                                                   |
| Perdida de red al guardar                    | Sin replay automatico; aviso de resultado incierto, verificar estado                                     |
| Editar nombre y consultar auditoria          | Actor, rol historico, seccion, ID de registro, valor previo y nuevo correctos                            |
| Evento anterior a instrumentacion            | Desconocido explicito, sin reconstruccion inventada                                                      |
| Perfil sin permiso / revocacion              | UI coherente y API rechaza operacion protegida aunque exista cache                                       |
| Desktop y movil                              | Sin superposiciones, controles alineados, scroll acotado y carga visible                                 |

## Evidencia y pendientes

### Recarga y revocacion de sesion local - 2026-10-13

El diagnostico reportado, confirmado mediante inspeccion de DB, corresponde a
un usuario de autenticacion local: el reemplazo de accesos revoco tanto la
sesion CRM como su refresh el 2026-10-13 a las 15:32 de Costa Rica (UTC-06), unos
seis minutos despues del login. La vigencia de ocho horas no habia vencido; no
se atribuye este caso a expiracion ni a una simple ruta denegada.

Ese cierre refleja la politica anterior, sustituida el 2026-10-13 por decision
explicita del usuario. El [contrato de seguridad 24](../../api/Arquitectura/24-Seguridad-Autenticacion-BFF-OIDC-Local.md)
exige conservar identidad activa y refresh ante cambios de permisos, sin logout
forzado. La autorizacion obsoleta se rechaza y renueva antes de continuar: el
refresh rota a la version vigente y devuelve usuario/sesion minimos, sin roles
ni permisos; `/identity/me` o la solicitud protegida siguiente resuelve los
derechos canonicos actuales. El frontend
contempla respuesta de sesion anonima, 401 y el 409 especifico existente; no se
promete siempre un 409. Los permisos retirados no se mantienen. Logout,
bloqueo/inactivacion y replay de refresh siguen causando revocacion fuerte.
La implementacion esta terminada y verificada localmente con la evidencia
indicada abajo. Sesiones ya revocadas no se rehabilitan.

Secuencia de aceptacion (recarga real comprobada; edicion manual pendiente):

1. Iniciar una sesion local nueva.
2. Recargar sin cambios de permisos o accesos: debe mantenerse autenticada.
3. Realizar un reemplazo autorizado de accesos; comprobar que la siguiente
   solicitud protegida y recarga mantienen la autenticacion, renuevan claims
   obsoletos y aplican los permisos actuales, incluidos los accesos retirados
   que deben quedar denegados. No debe exigirse nuevo login por ese cambio.

Evidencia final: `pnpm check` completo aprobado con 369 pruebas en 24 archivos,
formato, lint, typecheck y build. Un fallo intermitente anterior de catalogo
legacy paso aislado y posteriormente en la suite completa. Se mantiene la
advertencia de tamano de bundle. API: 4.430 pruebas aprobadas, 102 omitidas y
ocho casos MySQL rollback aprobados; el check global API conserva bloqueos de
formato/JSDoc ajenos a estos archivos (detalle en API 36).

En navegador integrado, tres recargas finales con API estable conservaron el
login local de Formalizacion, ambas cookies y su vencimiento original, sin
imprimir valores secretos. DB mostro sesion activa, versiones 4/4 y ninguna
revocacion. Durante las ediciones del API se observaron resets/refusals de red;
reintentar recupero la sesion sin credenciales. No se confundieron con expiry.

`resolveAuthState` ahora convierte en anonimo solo un refresh rechazado con
401. Red, servidor y CSRF fallidos conservan la URL y muestran el problema de
acceso. No se reintenta automaticamente el POST de rotacion. Las regresiones
cubren recarga local bajo StrictMode, version obsoleta con respuesta anonima
200 o 409, derechos nuevos y fallos de red/500/403.

La renovacion y su auditoria son transaccionales; el snapshot minimo no
transporta grants ni depende de leer un perfil despues del commit. Sigue
pendiente la edicion manual real de permisos; HTTP/MySQL con rollback verifica
ese escenario sin cambiar asignaciones reales. No se acredita despliegue.

### Rutas denegadas o inexistentes con sesion valida - 2026-10-13

Una denegacion de autorizacion no equivale a una sesion expirada. Con perfil
validado, `AppRouteContent` conserva `GlobalHomeShell` y presenta el icono y
mensaje de acceso denegado o ruta no encontrada dentro de `Contenido principal`.
La cabecera, cuenta y navegacion siguen disponibles con su estilo original.
El aviso no ejecuta logout ni ofrece volver a iniciar sesion. Volver al inicio
resuelve una ruta accesible segun los permisos efectivos y las membresias.

La pagina denegada no se monta: no se consulta su listado ni se renderizan sus
formularios para mostrar el aviso. Abrir una URL directamente no concede el
permiso oculto en el menu. El API sigue siendo la autoridad final de cada
operacion. Un perfil sin vistas disponibles conserva su cuenta, sin enlaces
operativos no autorizados. Las rutas desconocidas no se convierten en rutas
validas ni fuerzan una redireccion automatica a login.

Sin sesion validada se conserva el flujo publico de autenticacion. Los estados
de verificacion, expiracion o fallo de identidad no abren el layout privado.
No se cambian grants, roles, datos o esquema como parte de este ajuste.

El guard se resuelve sincronicamente antes de crear la pagina, incluso cuando
el estado React todavia corresponde a la URL anterior. Reutiliza las opciones
del menu filtrado en todos los modulos, con deny prevaleciendo sobre allow.
Se conserva el landing de Administracion, que no tiene un permiso home
independiente, y las URLs compartidas de Ventas/Contabilidad. Cuando home no
esta permitido, el retorno elige una ruta registrada que si lo este.

La suite de acciones de catalogos espera el desmontaje asincrono de los slots
React de DataTables (250 ms en la version instalada), para que los menus de
una prueba no contaminen la siguiente. Se conservan las aserciones negativas
de acciones no autorizadas; no se cambia el componente productivo por este
ajuste de aislamiento.

Aceptacion manual: entrar con un perfil restringido, abrir una ruta denegada,
una URL inexistente y despues una opcion permitida del menu. Comprobar que el
aviso cambia solo el contenido y que no aparecen solicitudes del listado
protegido. Repetir en movil y verificar por separado la expiracion real de la
sesion. Los resultados automatizados se registran en la entrega; esta lista
no representa una aceptacion manual ya ejecutada.

Verificacion automatizada de esta revision: `pnpm check` frontend aprobado
(formato, lint, typecheck, 361 pruebas en 24 archivos y build). La advertencia
de chunk Ant Design mayor de 500 kB permanece no bloqueante. Tambien se
comprobaron en navegador autenticado Owner los avisos de ruta inexistente y
acceso denegado, y el retorno al inicio sin cerrar sesion. El perfil restringido
se cubrio con fixtures; su aceptacion manual real sigue pendiente. No se
reejecutaron suites API porque esta revision no modifica el backend.

Suites frontend: `test/catalogs`, `test/unit-files`, `test/administration`, `test/app/api-client-conflicts.spec.ts`. Ultimo check frontend registrado antes de esta consolidacion: 257 pruebas, lint/typecheck/formato/build aprobados; 13 regresiones API de acceso aprobadas. No se reejecutaron esas pruebas por escribir Markdown. Las verificaciones realizadas para esta consolidacion se reportan en la entrega, sin alterar retrospectivamente la evidencia anterior.

Pendientes: aceptacion manual completa, drift externo, mapeos bloqueados/importacion de inventario, EXPLAIN/indices y carga representativa, conectores ERP operativos, captura de cambios fuera del API y despliegue. No convertir pruebas mock o rollback en confirmacion de DML productivo. Advertencia de bundle y bloqueo global de formato se conservan como limites conocidos.

## Inicio de Formalizacion: propuesta visual 2026-10-13

### Calendario de Formalizacion: ampliacion visual 2026-10-14

El menu conserva su estilo y agrega Calendario en `/home/formalization/calendar`, despues de Gestion de formalizaciones. La maqueta reutiliza `formalizacion.home.read` y el guard de rutas existente; no crea ni amplia permisos operativos de backend. Un perfil sin ese permiso no puede abrir esta ruta.

`FormalizationCalendarPage` reutiliza el calendario mensual de Ant Design instalado, con mes anterior/siguiente, Hoy, seleccion de dia y vista Agenda. Muestra tres eventos ficticios relativos al dia del dispositivo. Los filtros por tipo y orden operan en memoria. El formulario permite reuniones o tareas con titulo, fecha, inicio/fin, orden, responsable, participantes, lugar/enlace, notas y estado Programado/Completado/Cancelado. La hora final debe ser posterior a la inicial y la orden es obligatoria.

Crear, reprogramar o editar actualiza solamente estado React. Guardar muestra el dia correspondiente y limpia los filtros para que el evento quede visible. El acceso Ver orden de venta abre la misma ficha ficticia existente. La revision operativa posterior comparte eventos y escenarios entre Inicio, Gestion y Calendario mientras el modulo siga montado. Recargar, cerrar sesion o salir de Formalizacion descarta los cambios; navegar entre sus tres rutas ya no los descarta. No cambia el estado comercial de la orden por crear un evento. No hay API, BD, localStorage, sincronizacion con Outlook/Microsoft, invitados reales ni envio de notificaciones o recordatorios.

La vista mensual mantiene sus columnas con desplazamiento horizontal propio en pantallas estrechas; la vista Agenda y los formularios se adaptan a movil. Esta ampliacion no modifica Inicio, banners, flujo de Formalizacion ni secciones ajenas.

Verificacion del calendario: formato, lint, TypeScript y build aprobados; seis pruebas nuevas de ruta, creacion, horario invalido, edicion/estados, cambio de mes y filtros/acceso a orden aprobadas. Las pruebas de acceso y navegacion tambien aprobaron. La corrida global registro 406 aprobadas y un fallo en CatalogItemsPage (espera de project_001 al promover una ubicacion); ese caso aprobo al repetirse aisladamente, sin cambiar Catalogos. No se declara la corrida global completamente verde. Sigue la advertencia no bloqueante de chunks superiores a 500 kB.

En navegador autenticado se verificaron el nuevo menu y URL, navegacion mensual/Hoy, creacion y reprogramacion por fecha/hora, agenda, enlace a la orden y descarte de ejemplos al cambiar de ruta. Medidas revisadas: escritorio 1440x1000 y movil 390x844, sin desbordamiento de pagina/formulario. Evidencias calendario-escritorio.png y calendario-movil.png en C:/codex-data/visualizations/2026/10/14/formalization. No se ejecutan pruebas API/BD porque no se modifican esas capas.

`FormalizationHomePage` reemplaza solo el placeholder de `/home/formalization` con seis banners: contratos pendientes (por enviar y pendientes de firma), gestion bancaria, pendientes de saldo, traspasos pendientes, contratos firmados y formalizaciones cerradas. Conserva el shell y el permiso `formalizacion.home.read`. Distribucion responsive: tres columnas en escritorio, dos en tablet y una en movil.

Desde la solicitud visual del 2026-10-14, los contadores muestran cifras ficticias coherentes con las cinco operaciones de ejemplo: por enviar 1, pendiente de firma 1, bancaria 1, saldo 1, traspaso 1, firmados 3 y cerrados 0. Los tres firmados corresponden a banco, saldo y traspaso; no se suman como operaciones adicionales. Cada contador tiene nombre accesible `Valor ficticio` y el banner identifica datos de demostracion mediante tooltip; el aviso de ejemplos sigue visible en la pagina. No consultan servicios. Los banners no ejecutan acciones ni habilitan permisos. Permanecen pendientes las fuentes, periodos, criterios de conteo, autorizacion granular y navegacion a bandejas. Cerrado se refiere a Formalizacion, no a entrega fisica de la unidad.

### Seguimiento inferior: demostracion local

#### Botones documentales de la orden (2026-10-14)

`FormalizationOrderActions` ubica los controles en la seccion correspondiente. Fuentes releidas: `CRM IDEA.pdf`, paginas 4, 5 y 14; resumen ejecutivo ajustado, paginas 1 a 3. Nombres expresos del original: Enviar contrato, Contrato firmado y Traspaso realizado. Adjuntar contrato es requisito expreso del resumen ajustado. Cambiar modalidad, seleccionar banco/asesor, Otro asesor, iniciar gestion bancaria, marcar credito formalizado, consultar condicion financiera, registrar excepcion y cerrar Formalizacion son etiquetas de interfaz propuestas para representar las operaciones/estados descritos, no nomenclatura definitiva aprobada.

Actualizacion visual 2026-10-14: los botones abren formularios locales y permiten confirmar un resultado ficticio. Adjuntar acepta PDF/Word o documento de ejemplo; del archivo seleccionado solo conserva nombre y tamano, nunca lee su contenido ni lo carga. La hoja documental es una muestra sin validez legal, no un generador de contratos. Enviar presenta destinatario, asunto, mensaje y adjunto; no envia correo. Firma exige referencia del documento firmado. Modalidad, banco y asesor usan ejemplos; Otro asesor recoge nombre, correo y telefono sin crear bancos.

Excepcion y cierre ahora abren formularios de propuesta: solicitud pendiente o autorizacion ficticia, motivo, responsable y respaldo; cierre por Formalizaciones o pendiente por fase posterior. Se advierte que criterios, permisos, responsables y evidencia requieren aprobacion. Simular autorizacion nunca concede privilegios reales. El cierre completo de ejemplo requiere traspaso realizado o excepcion ficticia autorizada. Un saldo desconocido o pendiente no habilita el traspaso normal. Cobros, registro de pagos, entrega de llaves, gestion del maestro de bancos y generacion automatica de contratos siguen excluidos. Ningun permiso real fue agregado o ampliado.

`formalization-scenario.model.ts` mantiene el estado descartable compartido por `FormalizationPreviewSession` dentro del modulo. Cada resultado simulado actualiza campos, estado visible, fechas automaticas y un historial con antes/despues, actor ficticio y detalles del formulario. Abrir o cancelar no registra resultados. Volver a la lista y cambiar entre Inicio/Gestion/Calendario conserva la simulacion; bandejas y contadores reflejan el resultado. Restablecer reinicia solamente la orden; recargar o abandonar el modulo descarta la sesion visual. Los fixtures originales no se mutan. No usa API, backend, BD, almacenamiento local ni integraciones. Estas compuertas de maqueta no constituyen reglas productivas aprobadas.

`FormalizationTimingPreview` muestra firma a inicio bancario, duracion bancaria y firma a formalizacion por orden, con acceso al mismo detalle. Corte ficticio fijo 14/10/2026: DEMO-OV-103 acumula 18 dias en proceso; DEMO-OV-105 registra 2 dias hasta inicio, 5 bancarios y 7 totales. Son dias naturales de ejemplo, no SLA ni fechas reales. La bandeja y los contadores existentes mantienen el seguimiento por estado/proyecto/responsable.

Cobertura visual de esta ampliacion:

| Solicitud | Presentacion implementada | Limite |
| --- | --- | --- |
| Adjuntar y presentar contrato | Selector PDF/Word, nombre y hoja ficticia sin validez legal | Sin lectura del contenido ni carga |
| Enviar contrato | Destinatario, asunto, mensaje y adjunto | Confirmacion solo simulada |
| Modalidad, banco y Otro asesor | Recursos propios/financiado, catalogo ficticio y formulario del asesor | No administra bancos ni guarda contactos |
| Excepciones y cierre | Solicitud/autorizacion ficticia y dos resultados de cierre | Politicas y autoridad pendientes de aprobacion |
| Fechas e historial | Fechas automaticas, antes/despues, actor ficticio y detalles | Estado React descartable, no auditoria real |
| Indicadores y seguimiento | Duraciones bancarias y acceso a orden; bandejas por estado | Corte fijo, sin SLA; tabla desplazable en movil |

Verificacion de formularios e indicadores: formato, lint, TypeScript y build final aprobados. Una corrida global aprobo 401 pruebas en 27 archivos; la ultima repeticion, despues del ajuste movil, aprobo 398 y fallo en tres casos de CatalogItemsPage/UnitFilesPage (timeout y espera de boton AM-101). Esos dos archivos, sin modificarlos, aprobaron sus 77 pruebas al repetirse con un solo worker. Las pruebas de Formalizacion aprobaron en ambas corridas. No se declara la ultima corrida global completamente verde ni se atribuye una causa definitiva a esos fallos intermitentes. Permanece la advertencia no bloqueante de chunks mayores de 500 kB y avisos jsdom getComputedStyle con pseudo-elementos.

En navegador autenticado se comprobaron adjunto, correo, firma, banco/asesor, traspaso, cierre, historial y acceso desde indicador a orden. Escritorio 1440x1000 y movil 390x844: formularios sin desbordamiento; tabla bancaria con desplazamiento horizontal propio para conservar columnas legibles. Evidencias locales: documento-ejemplo.png y tiempos-movil.png en C:/codex-data/visualizations/2026/10/14/formalization. No se ejecutaron pruebas de integraciones, API o BD porque no forman parte del alcance visual.

Validacion final de botones: corregidas dos opciones `exact` no soportadas por Testing Library en las pruebas. `pnpm check` aprobado: formato, lint, TypeScript, 391 pruebas en 26 archivos y build; advertencia de bundle Ant Design no bloqueante. Las 21 pruebas especificas de navegacion/botones tambien pasaron. En navegador se comprobaron los controles de contrato y el modal explicito de vista previa, sin cambiar la orden, y medidas sin desbordamiento de pagina ni grupos de botones en escritorio/movil. No se probaron integraciones reales, que siguen fuera de esta entrega.

Recorrido visual 2026-10-14: los siete contadores abren una vista de tabla con su filtro correspondiente, incluida una bandeja vacia para cerrados. Cada fila (clic, Enter o espacio), su flecha y los movimientos recientes abren la misma pagina completa de orden; los contadores por proyecto abren la bandeja de etapa/proyecto. `formalization-preview.model.ts` centraliza la muestra y los filtros; `FormalizationOrderPreview` presenta cliente/unidad, condiciones comerciales, aprobaciones, contrato/documentos, banco, condicion financiera, traspaso/cierre e historial. Los valores adicionales son ficticios o explicitamente no incluidos; no acreditan un modelo comercial real ni datos existentes en BD.

Inicio permanece en `/home/formalization`; el menu Gestion de formalizaciones abre ahora `/home/formalization/orders`, mostrando directamente la tabla general de ejemplos y marcando el item activo correspondiente. La ruta reutiliza `FormalizationHomePage` con vista inicial de ordenes. `AppRouteContent` facilita a las paginas el callback opcional de navegacion existente para volver a Inicio sin recargar ni mostrar Inicio bajo la URL de Gestion.

Validacion de la conexion del menu: `pnpm check` completo aprobado con 392 pruebas en 26 archivos, formato, lint, TypeScript y build. En navegador autenticado se confirmaron el clic del menu, la URL de Gestion, `aria-current=page` y el retorno a Inicio con su URL correcta. Las pruebas cubren entrada directa a la ruta y denegacion sin permiso de Inicio. La advertencia de bundle Ant Design sigue siendo no bloqueante.

Dentro de cada ruta, el paso bandeja-detalle sigue siendo estado local, sin enlaces profundos de orden ni rutas comerciales operativas. Volver a la lista conserva busqueda y filtros mientras la pagina siga montada; recargar reinicia la maqueta (en Gestion vuelve a la tabla general). Los anclajes internos solo desplazan a las secciones de detalle. La ruta de maqueta conserva `formalizacion.home.read`, sin nuevos permisos, API ni escritura; sin ese permiso la ruta se deniega. Firmados reutiliza las mismas tres ordenes de banco/saldo/traspaso, sin duplicar registros. La integracion futura requiere contratos, permisos y rutas especificas de negocio.

Verificacion de este recorrido: las once pruebas de Formalizacion pasaron dentro de la suite global (380 aprobadas y una fallida en ordenamiento del detalle de Usuarios). Esa prueba ajena al cambio paso al repetirse de forma aislada, sin modificar Usuarios; no se declara la corrida global completamente verde. Formato, lint, TypeScript y build aprobados; se verifico en navegador autenticado el contador Por enviar, clic de fila, orden completa, retorno a lista y ausencia de desbordamiento de pagina/paneles en escritorio y movil. No se ejecutaron pruebas API porque no cambia backend. Permanece la advertencia de bundle Ant Design mayor a 500 kB.

Ajuste visual 2026-10-14: se preservan titulo y seis banners sin cambios. Solo la zona inferior agrupa responsable/tiempo, integra el acceso al detalle en siguiente paso y reduce la bandeja a cinco columnas. Fondos blancos, tipografia y separaciones refuerzan la jerarquia; el resumen por proyecto y los movimientos conservan los mismos datos ficticios, filtros y comportamiento local. Alineación con Proyectos 2026-10-14: bandeja, lista filtrada y orden completa adoptan la escala, densidad y anatomía de `26-Projects-Design-System.md` (ver "Formalization Home Adoption"). Título y banners se conservan sin cambios. Sin nuevos datos, columnas ni acciones.

`FormalizationFollowUpPreview` incorpora cinco operaciones ficticias identificadas con `DEMO-OV-*`, busqueda y bandejas locales, detalle, pendientes por proyecto y movimientos recientes. El aviso visible distingue estos ejemplos de registros reales; los banners superiores muestran la misma muestra ficticia, no KPIs reales. Solo hay transiciones de estado React para revisar pantallas; no hay fetch, mutaciones remotas, persistencia ni operaciones reales. Recargar reinicia la demostracion.

La propuesta responde a responsable, bloqueo, documentos y trazabilidad solicitados en `CRM IDEA.pdf` (paginas 3 a 5) y `RESUMEN_EJECUTIVO_CRM_TINK AJUSTADO (1).pdf` (paginas 1 y 3). Ordenar por dias en etapa y agrupar pendientes por proyecto son decisiones de presentacion, no reglas de SLA aprobadas. El resumen ajustado delimita la fase: sin cobros, pagos ni entrega de llaves. El saldo no consultado se muestra como pendiente de consulta, nunca como cero.

Se inspeccionaron solo metadatos del esquema legacy `crmdatabase-api`: `ordenventa` contiene referencias de cliente/unidad, aprobaciones y flags contractuales; `expedientes` corresponde a unidades; `bitacoras` contiene actor, detalle y fecha. No se interpretaron valores numericos ni se extrajeron registros personales. Los tipos actuales de la nueva API cubren identidad, catalogos y auditoria, pero no un agregado operativo completo de Formalizacion. Quedan pendientes el modelo nuevo, el mapeo validado de estados legacy, las reglas de ingreso/cierre/excepciones, el contrato financiero, los permisos y la integracion de datos. Esta maqueta no acredita esos pendientes como implementados.
# Ilustraciones de banners Formalizacion - 2026-10-26

Decision final del propietario: restaurar el patron original de seis cuadrados
en la esquina superior derecha, a 64x64, aumentando opacidad de 0.1 a 0.35.
Se retiran los siete SVG de las propuestas descartadas y se recupera el
espaciado original. Decoracion aria-hidden, sin animacion ni dependencias.
Se conservan iconos negros, permisos, consultas, contadores y precargas.


## Información primaria de la orden: maqueta autorizada (2026-10-26)

La vista completa conserva identidad y avance real. Los bloques Datos de la orden y Situación actual se sustituyen por Información primaria con etiqueta Datos de ejemplo: pedido/cliente, contrato/entrega, organización/ubicación, indicadores de solo lectura y resumen económico. `primaryInformationExample` en `FormalizationRecordSummary.tsx` centraliza los valores ficticios para sustituirlos posteriormente por un DTO canónico. No consume el JSON de NetSuite, no sirve de fallback ante errores y no modifica etapas, permisos, API ni bases de datos. No se implementa aún Estado de cuenta.


## Carga del detalle NetSuite (2026-10-27)

El estado de la petición existente controla el detalle: skeleton animado y aria-busy mientras carga, sin montar campos, importes ni checks de muestra. Un fallo muestra indisponibilidad sin fallback ficticio. La respuesta correcta conserva por ahora la maqueta identificada; el mapeo de sus campos al JSON sigue pendiente. Se mantiene la consulta DEV autorizada y el console.log, sin persistir el payload. Las respuestas de una orden anterior no actualizan la abierta.


## Restauración por URL y retiro de datos de muestra (2026-10-27)

El detalle restaura orderSource/orderId usando seguimiento con filtro exacto recordId validado y parametrizado; no depende de la primera página ni usa netsuiteId como autorización. Conserva sesión, rol efectivo, stages.read, deny y alcance por recurso. Una URL sin acceso no consulta; un rechazo deja estado explícito sin volver al Home. El BFF conserva renovación y salida a login ante sesión inválida. Los valores, importes e indicadores de muestra quedan vacíos hasta el mapeo explícito. Comprobación de solo lectura en CRM_THINK_V2: rol Formalización, permiso stages.read y su asignación activos. No se modificó la BD.


## Recargar transacción (2026-10-27)

El encabezado del detalle incorpora Recargar transacción con el patrón del Home. Repite la consulta existente de NetSuite bajo los mismos permisos, sin recargar la página, conserva la identidad de URL, oculta los campos con el preload y deshabilita el botón mientras carga. Un contador de solicitud distingue respuestas anteriores; no se persiste ni cachea el payload. No modifica estados ni registros.


## Inspección de orden, lead y expediente federados (2026-10-27)

La apertura y Recargar transacción consultan en paralelo /formalization/orders/:source/:id/database y /netsuite, bajo el gate existente. Consola DEV: [Base de datos: orden de venta] y [NetSuite: orden de venta]. Se esperan ambas consultas para cerrar el preload, sus logs son independientes y los errores no imprimen payloads ni secretos. No se guarda el JSON ni se mapea aún a campos visibles. El snapshot de BD tiene un envelope común, referencias e incidencias, y sourceFields separados para inspeccionar los nombres originales sin adivinar equivalencias.


## Cinco datos clave de orden desde BD (2026-10-27)

Se conectan exclusivamente Cliente, Proyecto · Unidad, Vendedor, Etapa y Siguiente paso usando FollowUpItem del API de seguimiento federado, no campos NetSuite ni interpretación de legacy en React. El vendedor es el del lead; no se confunde con responsable de etapa. Estado y siguiente paso usan la clasificación actual del servidor. Al abrir/recargar se vuelve a consultar la identidad exacta y se ocultan valores pendientes u obsoletos ante carga/error. Sin dato se muestra guion. Los demás campos, importes e indicadores permanecen sin mapear. No hay escrituras de BD.


## Preload único de ficha completa (2026-10-27)

La apertura directa y Recargar transacción usan el mismo skeleton completo, incluyendo breadcrumb/título, avance, datos clave y secciones. No se renderiza el número ni la etapa anterior mientras la consulta está pendiente. La ficha se revela cuando están listas la proyección de seguimiento de BD y las consultas existentes del detalle. Identidad y avance continúan leyendo FollowUpItem del API; no se infieren de NetSuite. Los campos aún sin mapear permanecen vacíos.


## Regresión de pruebas del resumen de orden (2026-10-27)

Se reprodujeron tres fallos en formalization-record-summary.spec.tsx: esperaba el aviso y valores de muestra, días concatenados a etapa, conteos/checks de ejemplo y el antiguo listado de campos vacíos. Se actualiza el contrato de pruebas al alcance aprobado: cinco datos reales, sin aviso de muestra, resto de campos visibles sin dato, importes y estados no confirmados vacíos. Se conservan las pruebas de panel lateral, acordeones y navegación. Esta corrección no restaura datos ficticios ni amplía el mapeo de pantalla.


## Consulta lateral del cliente desde la orden (2026-10-27)

Cliente en Datos clave es un botón accesible cuando existe nombre. Abre el Drawer derecho con el tema compartido de Usuarios/Catálogos, de solo lectura. Al abrir solicita /formalization/orders/:source/:id/database; el servidor revalida sesión, permisos, alcance y fuente nativa prioritaria. Presenta los campos disponibles de contacto y lead (comercial, captación/seguimiento, registro); referencias de origen no confirmadas no se interpretan como estados nuevos. Sin dato permanece explícito. No consulta ni mezcla clientes por nombre o email. Incluye carga, error genérico, reintento y relación ausente/ambigua sin cliente alternativo. Cambio de orden/cierre descarta respuestas antiguas; cada apertura consulta de nuevo y no persiste datos. No hay edición ni nuevos permisos ni escrituras de BD.
