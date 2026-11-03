# 00 - Ley de Producto CRM TINK y P0 Frontend

## Contrato visual vigente — 2026-11-03

La [reconciliación85](../../api/Arquitectura/85-Reconciliacion-Documental-20261103.md), el [mapa30](30-Estado-Frontend-Verificado.md) y el [detalle32](32-Detalle-Orden-y-Cliente-Basico.md) registran el árbol actual. Sustituyen las restricciones históricas de maqueta/recepción/Graph pendiente para las funciones expresamente ampliadas.

Formalización presenta ocho etapas, selector obligatorio de fondos, validaciones de cuotas/traspaso/entrega y ayudas en títulos. Perfil del cliente en `/home/formalization/perfil`, contacto, Outlook y WhatsApp conservan contexto y permisos propios. Agendar desde orden fija cliente/orden y referencia; la cabecera abre un evento limpio. Guardar conserva la pantalla actual. Calendario integra las capacidades Graph descritas en [Calendario global](Calendario-Global-Frontend.md); no afirma invitación entregada solo por guardar CRM.

Adéndum es un seguimiento paralelo en ambas BD: marca manual con nota opcional, banner, bandeja, distintivo y acciones debajo de Acciones de la etapa. Sin permiso se oculta solo el contenido Adéndum; la orden permanece visible. Defaults067 de marcar pendiente: Owner, Jefe General y Jefe de Formalizaciones; Formalización base no lo recibe, y un deny personal prevalece. [Contrato83/84](../../api/Arquitectura/84-Adendum-Manual-Migracion-066-y-Permisos.md).

Los snapshots siguientes conservan sus fechas, sin ampliar el alcance ni autorizar operaciones externas. El inventario local y los tests no acreditan despliegue o aceptación completa del negocio.

## Antecedente documental - 2026-11-02

Esta revisión refleja las ampliaciones ya presentes en código y conserva las
decisiones anteriores con su fecha; no autoriza funciones nuevas por documento.
El [inventario30](30-Estado-Frontend-Verificado.md) registra todos los módulos,
rutas, servicios y límites contrastados con el HEAD `fcbf0c2` y el árbol actual.

Formalización incluye lecturas de ficha, cliente, unidad e historial, seguimiento,
etapa y aprobación con permisos independientes. Los capítulos NetSuite con mapeo
confirmado se muestran por API, sin rellenar con valores del ejemplo visual.
Campos no confirmados permanecen sin dato y las previews históricas no se vuelven
comandos reales por mostrar un botón. Edición general, cartera, registro operativo
de firma y validación conjunta de saldo/traspaso/llaves siguen sin acreditarse.

Calendario compartido tiene lectura/altas/ediciones nativas, invitados y relaciones
CRM, overlays y panel diario. Los correos y preferencia Teams no activan Graph,
envíos o sincronización Outlook. El contrato de formulario está en
[Calendario global](Calendario-Global-Frontend.md).

Las notas permiten vincular Cliente/lead y Orden con Select buscables desde el
formulario y gestionar relaciones secundarias desde la conversación del autor.
Fuente e ID son identidad técnica, no un filtro BD para usuarios. Sus resúmenes
se reautorizan; sin permiso comercial no se exponen nombres/IDs/enlaces del recurso
al invitado de una nota. Contexto original e invitaciones son controles distintos.
Contrato: [68 API](../../api/Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md).

Ni mostrar una lectura NetSuite ni el plan70 implementan un escritor duradero.
No importar registros legacy ni ejecutar comandos comerciales para actualizar
documentación. QA histórico, aceptación real y validación nueva se distinguen.

## Antecedente documental - 2026-10-29

Mis notas y la campana interna incluyen colaboracion por invitacion, respuestas,
menciones y actualizaciones por socket, junto con responsables, vencimientos,
recordatorios personales, historial, busqueda y Homes adicionales. La nota sigue
siendo privada para autor e invitados; compartir no concede acceso a su orden.
Una identidad de registro es tipo/origen/ID, independiente de la URL. No se
inventan rutas de detalle para modulos cuya ficha aun no esta implementada.

Las acciones con respuesta visual optimista conservan recuperacion en segundo
plano; crear y editar esperan confirmacion. Contrato y limites en
[66 API](../../api/Arquitectura/66-Notas-Enterprise-Seguimiento.md); resultados
fechados en [67 API](../../api/Arquitectura/67-Plan-QA-Regresiones-20261029.md).
Copia legacy, Redis multinodo, medicion de latencia y aceptacion visual con dos
cuentas no se dan por terminados por el solo hecho de tener interfaz o tests.
Los apartados anteriores se leen como cortes fechados, no restricciones que
retiren estas ampliaciones ya solicitadas.

## Roles, comandos y recuperación - 2026-10-28

Formalización y Jefe de Formalizaciones gestionan todas las órdenes con permiso
de la acción. El detalle y su actualización posterior son independientes de los
banners; una revocación bloquea comandos. El recorrido representa posición y
cierre, sin inventar visitas históricas. [Contrato65](../../api/Arquitectura/65-Formalizacion-Correcciones-Roles-y-Recuperacion.md).

## Detalle de orden: permiso independiente - 2026-10-28

«Ver orden de venta» permite abrir la ficha por selección o URL sin permisos
de banners. Los banners controlan solo sus contadores y listas. La restauración
consulta una sola identidad mediante `/formalization/orders/:source/:id/record`;
sin el permiso de detalle no abre ficha ni consulta datos del proveedor.
Contrato: [64](../../api/Arquitectura/64-Formalizacion-Permiso-Ver-Orden.md).

## Notas: ampliación autorizada etapa4 - 2026-10-27

Invitaciones, conversación, menciones y campana interna conectadas. [Contrato60 API](../../api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md). Vincular no comparte; copia legacy pendiente.

## Estado contrastado - 2026-10-27

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría las rutas, contratos y límites actuales: Captación conectada, seguimiento y cambio protegido de etapa de Formalización. Los cortes fechados siguientes son antecedentes; sus cifras de QA no se reejecutaron en esta revisión documental.


## Ampliacion autorizada: reporte conectado - 2026-10-26

Captacion consume `GET /marketing/leads/report` con datos reales agregados de
ambas fuentes; sustituye el limite anterior de maqueta para esta consulta.
Conserva las tres medidas y tres profundidades, filtros, tablas, graficos y
exportaciones. Directorios y publicId provienen de API; ninguna demo se usa como
fallback. Carga/error/reintento y respuestas obsoletas por periodo/identidad se
controlan antes de mostrar o exportar datos. Sin escritura/importacion de BD.
Contrato y pruebas en [53 API](../../api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md).

## Antecedente: Captacion de leads, maqueta interactiva autorizada - 2026-10-26

El propietario sustituye la entrada con solo H1 por una propuesta UX de analisis
dinamico: filtros combinables de proyecto/campana/anuncio/vendedor/etapa/cita,
medicion seleccionable, comparacion por dimension y segundo desglose opcional.
Solo muestra local ficticia identificada; sin API comercial, BD, importacion,
exportacion ni persistencia. No mezclar esta muestra con Inicio de Mercadeo real.
Conserva permiso `mercadeo.leads.read`, menu y ruta `/home/marketing/leads`.
Los nombres/IDs son de dimensiones CRM, sin acoplamiento a ERP ni schema legacy.
Detalle y verificacion en [27](27-Entrega-Administracion-y-QA.md).


## Lectura vigente de ampliaciones - 2026-10-23

Las restricciones del corte inicial de identidad se leen con las ampliaciones posteriores, sin cambiar firmas/versiones historicas. Cobertura transversal: [49 - Estado actual](../../api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).

Home de Formalizacion tiene aprobaciones con permiso independiente y seis banners conectados a `GET /formalization/home/summary`. Etapas exige rol efectivo activo `formalizacion` y allow sin deny de `formalizacion.home.stages.read`. Owner puede heredar ese rol por politica persistida, sin asignacion directa ni bypass. Cero de fallo marcado Sin verificar no acredita ausencia de ordenes. Listado/envio/reversion no son operaciones activas; Calendario/Resumen/previews siguen simulados.

Mercadeo ya consume el resumen canonico de leads y citas disponibles de [46](../../api/Arquitectura/46-Mercadeo-Resumen-Leads.md) y [48](../../api/Arquitectura/48-Mercadeo-Metricas-Citas.md). Sustituye la maqueta y el corte sin API siguientes solo para Inicio; no habilita CRUD de leads, editor de calendario, importaciones o comunicaciones.

## Contrato visible actual de Inicio de Mercadeo

Hoy, Semana, Mes y Ano; Mes inicial. Multiseleccion de vendedores y proyectos
con filtros locales dentro del JSON autorizado, fotos de los seleccionados en
la bienvenida, reporte diferido y precarga. Los cuatro indicadores distinguen
captacion, conversion de leads unicos, citas completadas por fecha del evento y
seguimiento de ultimos siete dias. La asistencia solo se confirma con evidencia
explicita; estados cancelados y registros sin vinculo no se ocultan como citas
realizadas. No hay filtros de campana/anuncio o rango libre expuestos en esta pagina.
Contrato y estados de error/carga en [27](27-Entrega-Administracion-y-QA.md) y
[04](04-API-Client-y-Estado.md). Las propuestas de fases siguientes permanecen
como antecedentes, no como funciones activas.

## Antecedente Mercadeo: retiro de demostracion antes de conectar API - 2026-10-23

El propietario solicita limpiar Inicio antes de conectar su API. Se conserva el
diseno, saludo de sesion, ilustracion y periodos; sin datos suministrados, los
indicadores muestran raya y los desgloses/grafico estados de informacion pendiente.
No hay numeros, porcentajes, tendencias, proyectos, vendedores o fotos de muestra
en runtime. La muestra generada queda exclusivamente en fixtures de pruebas.
Sin consultas API, persistencia, migraciones, permisos nuevos ni importaciones.
Este corte sustituye la muestra visible de la propuesta historica siguiente.

## Antecedente Mercadeo: propuesta visual de captacion y citas - 2026-10-23

El propietario amplia la bienvenida a una maqueta de Inicio: siete banners con
la anatomia visual de Formalizacion, filtros por periodo/proyecto/campana/anuncio/
vendedor y un desglose agrupable. Solo muestra datos ficticios identificados,
sin API comercial, persistencia, exportaciones, cambios de permisos ni operaciones
reales. Los filtros y agrupaciones actuan sobre la misma muestra local y se
reinician al recargar. Amplia solo la presentacion; no habilita las vistas
operativas de Leads, citas o Calendario. Detalle y limites en continuidad 25.

## Antecedente Inicio de Mercadeo: bienvenida ilustrada - 2026-10-23

El propietario autoriza una bienvenida visual en la ruta existente de Mercadeo:
saludo de sesion e ilustracion PNG original, con el lenguaje visual de
Formalizacion. Conserva el permiso de Inicio y no incorpora consultas, metricas,
reportes, acciones ni permisos nuevos. Detalle en continuidad frontend 25.

## Jefaturas por modulos - 2026-10-23

Correccion de gestion: Owner puede editar la plantilla Jefe General en Por rol:
modulos habilitados y acciones, con un solo guardado auditado. El acceso por
empleado queda dentro de ese techo. General no aparece como plantilla bloqueada;
Owner si conserva proteccion y los denies individuales prevalecen.

Implementacion autorizada: Jefe General obtiene acceso operativo solo a los
modulos seleccionados del empleado; jefes de area quedan bajo su techo modular.
Owner sigue global y denies individuales prevalecen. Reutilizar editores,
catalogo de seguridad y perfil canonico; no conceder administracion por elegir
un modulo ni inferir autoridad por nombre. Plan y evidencia en
[42 - Jefaturas](../../api/Arquitectura/42-Jefaturas-Modulos-y-Permisos.md).

## Owner y denies individuales - 2026-10-23

Owner hereda roles activos desde la politica persistida en la BD nueva, sin
insertar asignaciones directas masivas. Para etapas se requiere Formalizacion
efectiva y `formalizacion.home.stages.read`; un deny individual prevalece tambien
para Owner y evita montar el consumidor. No hay bypass por nombre del rol.
Esta decision prevalece sobre cortes anteriores. Aprobaciones conserva su permiso.
Referencia: [41 - Owner](../../api/Arquitectura/41-Owner-Herencia-y-Denegaciones.md).

## Resumen de etapas de Home autorizado - 2026-10-23

Los seis banners de etapas (contratos y los cinco indicadores posteriores) pasan
a un unico consumidor de `GET /formalization/home/summary`, montado solamente con
rol efectivo activo `formalizacion` y `formalizacion.home.stages.read` allow sin deny. Owner puede heredar el rol por politica backend. El indicador de aprobaciones conserva su permiso
independiente y endpoint. Se mantienen etiquetas, diseno, preload por numero,
previews vacias y ausencia de acciones persistentes. No habilitar bandejas reales
ni envio/reversion por conectar contadores.

No guardar contadores en cache persistida/compartida. Releer al entrar a Home,
recuperar foco visible o reintentar; impedir respuestas obsoletas despues de
revocacion o desmontaje. Esto no promete actualizacion instantanea entre usuarios
sin sondeo/notificaciones. Plan, definiciones y limites de verificacion:
[40 - Home y rendimiento](../../api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md).

## Antecedente Contratos: contador conectado - 2026-10-22

Correccion posterior del propietario: mantener solo Home, retirar el listado real y los botones que se adelantaron, devolver las colas a vacio. El banner y su consulta agregada se conservan. No hay ordenes reales ni acciones de envio/reversion montadas en esas vistas.

Ampliacion autorizada: Contratos pendientes lee los dos subtotales reales del API y solo se monta/consulta con rol formalizacion activo del perfil. Estados de carga/error y log DEV agregado; los ceros locales y su log provisional se retiran. El API controla origen y permisos, no el frontend. La lista operativa y los botones de envio/reversion no se implementan en las previews en este corte. Detalle en [29 - Reunion](29-Formalizacion-Reunion-Ajustes.md#contratos-conectado-por-rol---2026-10-22). Los apartados anteriores que indican que solo Aprobaciones tiene datos reales son historicos y quedan sustituidos para este segundo banner.

## Consolidacion historica - 2026-10-22

Resumen de las ampliaciones posteriores al primer corte de identidad, sin modificar firmas/versiones historicas: existen Administracion/catalogos y Formalizacion parcial. Solo el contador de aprobaciones es operacional en el Home; requiere permiso efectivo antes de montar su consumidor. Los otros seis indicadores son cero provisional; seguimiento/movimientos no tienen fuente operacional. Calendario/resumen y previews conservan simulaciones. No hay flujo persistido de aprobaciones/contratos completo.

El stack instalado usa React/Vite/TypeScript, Ant Design, DataTables y servicios fetch tipados con CSS del proyecto. TanStack Query, Zustand, React Hook Form y Tailwind son propuestas historicas, no requisitos para incorporar dependencias. Historial de navegador, carga diferida y errores recuperables por ruta estan implementados. La solicitud de recuperacion de clave del API responde 503 hasta configurar correo; no anunciar envio ni enlace funcional no implementado.

Prevalece la [ley canonica y sus ampliaciones](../../api/Arquitectura/00-Producto-CRM-TINK-y-P0.md). Consultar [evidencia actual](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md); los cortes fechados siguientes no certifican por si solos el runtime actual ni autorizan ampliar alcance.

## Continuidad vigente 2026-10-08

La cabecera siguiente conserva su corte historico. Administracion ya incluye usuarios, roles, auditoria y catalogos compartidos scoped por modulo. El inventario runtime, decisiones y pendientes estan en [25 - Continuidad](25-Continuidad-Administracion.md) y en el cierre API 34. Los planes posteriores del propietario sustituyen la propuesta inicial de permisos catalogo globales. La prioridad sigue siendo cerrar Administracion antes del contrato NetSuite -> API y de UI Leads.


| Campo | Valor |
| --- | --- |
| Version | `0.3.17` |
| Fecha | `2026-09-30` |
| Estado | Addendum frontend firmado, subordinado a la ley canonica de producto; autoriza y documenta la compuerta de identidad conectada al BFF, login local, Microsoft OIDC, logout, foto/avatar y shell global autenticado. |
| Fuente canonica | `apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md` |
| Dueno de producto | CRM TINK <soporte@roccacr.com> |
| Aprobado por | CRM TINK <soporte@roccacr.com> |
| Ultimo cambio | Cierra el corte de autenticacion frontend: `/auth/login` consume el BFF con CSRF, login local y Microsoft; `/home/global` muestra sesion autenticada, proveedor actual, permisos devueltos por API, foto/avatar y logout. Sigue prohibido crear modulos comerciales o decidir autorizacion final en React. |

## Regla superior

Este documento se lee primero dentro del frontend.

Este documento no redefine el producto. Solo agrega reglas visuales del frontend.

Si este documento contradice a `apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md`, gana la ley canonica del producto.

Si este documento contradice a `AGENTS.md`, skills, mapas de implementacion, documentos de UX, componentes futuros o notas largas, gana este documento dentro del frontend hasta que la ley canonica de producto apruebe una nueva version.

Mientras este documento no apruebe construir una pantalla o flujo, esta prohibido crear nuevas pantallas, modulos, rutas, clientes API, flujos de login o experiencias fuera del P0-S1.

Excepcion vigente de esta version:

```txt
Se autoriza mantener y evolucionar la compuerta de identidad en `src/modules/auth`.
Se autoriza mantener el shell global autenticado en `src/modules/home` expuesto en `/home/global`.
```

Alcance exacto:

- formulario funcional de correo y contrasena contra `POST /identity/local/login`;
- boton funcional de Microsoft contra `POST /identity/microsoft/start`;
- enlace visual de recuperacion de contrasena;
- ruta publica canonica `/auth/login` para la pantalla de acceso requerida por Azure/Entra;
- ruta protegida `/home/global` para revisar barra superior, menu global, datos de sesion y permisos efectivos devueltos por API;
- canvas inicial de identidad con datos de sesion reales y sin datos comerciales;
- selector visual de perfiles/contextos asignados en la barra superior, filtrable por permisos cuando el API lo entregue;
- menu visual por perfil activo, basado en configuracion local mock;
- estilos responsive de la pantalla;
- soporte responsive y zoom del navegador sin bloquear accesibilidad;
- sin tokens;
- sin llamadas directas a Microsoft Graph desde React;
- sin home comercial operativo por rol/contexto;
- sin guards finales de rol o permisos en React;
- sin rutas comerciales;
- sin KPIs reales.

Regla de no duplicacion:

- no copiar decisiones de producto si ya viven en la ley canonica;
- si cambia el producto, primero cambia la ley canonica del API;
- este archivo solo puede ajustar traduccion visual, estados de UI y prohibiciones especificas del frontend.

## Que UI estamos construyendo

Estamos construyendo la interfaz operativa del CRM interno para manejar el expediente comercial del cliente desde lead hasta contrato.

La primera compuerta visual no es lead. Es identidad: usuarios, autenticacion, roles y permisos.

La UI habla el idioma del vendedor y la jefatura. No habla NetSuite, Odoo, Kapso ni estructuras del CRM viejo.

La UI tampoco usa ids de proveedores externos para navegar, relacionar o ejecutar acciones. Siempre usa `publicId` y contratos canonicos del CRM.

## Ley de aislamiento frontend

El frontend no tiene adapters de proveedores externos.

Regla:

```txt
React -> services/api -> API canonica -> adapters backend
```

Separacion aprobada:

| Area frontend | Carpeta permitida | Responsabilidad | Prohibido |
| --- | --- | --- | --- |
| Auth global | `src/modules/auth`, `src/services/auth` | Sesion visual, estado de autenticacion y helpers frontend aprobados. | Guardar tokens, decidir permisos finales o llamar Microsoft Graph directo para reglas CRM. |
| API canonica | `src/services/api` | Cliente HTTP tipado contra el API del CRM. | Mappers de NetSuite, Odoo, Kapso o CRM viejo. |
| Modulos visuales | `src/modules/**` | Pantallas y flujos del dominio aprobado. | Conectarse a DB, ERP, Kapso, legacy CRM o Microsoft Graph directo. |
| UI reutilizable | `src/components/**`, `src/hooks`, `src/stores`, `src/types` | Piezas visuales, composicion UI, estado local y tipos canonicos. | Reglas de negocio finales o payloads de proveedores. |

Si se agrega Kapso, Odoo, NetSuite u otro proveedor, el frontend no recibe carpeta de proveedor. La integracion vive en el API. El frontend solo ve acciones y estados canonicos devueltos por `services/api`.

## Ley de homes por contexto operativo

Despues de autenticarse, el usuario no entra a una pagina generica unica para todos. Entra a un contexto operativo permitido por el API.

Regla:

```txt
auth global -> sesion/me -> contextos operativos permitidos -> home del contexto -> menus del contexto
```

Un contexto operativo es la combinacion visible de:

- rol o roles activos;
- area/equipo donde participa;
- permisos efectivos;
- alcance organizacional.

No es una segunda cuenta, no es otro login y no es un token diferente.

Ejemplos esperados:

| Contexto operativo | Home esperado | Menu esperado |
| --- | --- | --- |
| `sales` | Home de vendedor/ventas. | Leads, seguimiento, oportunidades y acciones comerciales aprobadas. |
| `finance` / `collections` | Home financiero/cobros cuando se apruebe. | Bandejas financieras, pagos, vencimientos y estados permitidos. |
| `marketing` | Home de mercadeo cuando se apruebe. | Campanas, origenes, reportes de captacion y acciones aprobadas. |
| `formalizations` | Home de formalizaciones cuando se apruebe. | Contrato, banco, traspaso, documentos y timeline de formalizacion. |
| `management` | Home de jefatura/gerencia. | Supervision, vistas consolidadas, filtros por area y accesos al modulo propietario. |
| `support` / `it` | Home de sistemas/soporte. | Identidad, diagnostico autorizado, configuracion visible y herramientas aprobadas. |

Regla para usuarios con varios roles:

```txt
Si una persona tiene mas de un contexto permitido, la UI muestra un selector de contexto en navbar/sidebar.
```

Ese selector permite cambiar de home sin cerrar sesion. Ejemplo: una persona puede operar `marketing` y `formalizations`; el sidebar debe mostrar ambos contextos separados si el API devuelve permisos para ambos.

Regla para jefatura superior o TI:

```txt
Jefatura superior y TI pueden ver varios contextos solo si el API devuelve permisos efectivos para esos contextos.
```

No se debe hardcodear que un rol ve todo por el nombre del rol. El API manda permisos y alcance; React solo renderiza.

Regla de URL directa:

```txt
Tener la URL de una vista no autoriza acceso a esa vista.
```

Toda ruta protegida debe validar, antes de renderizar:

1. sesion activa;
2. usuario activo;
3. contexto operativo permitido;
4. permiso efectivo requerido para esa vista;
5. alcance organizacional suficiente.

Si falla cualquiera de esas validaciones, la UI no renderiza la vista y debe mostrar estado de no autorizado, redirigir al selector permitido o enviar a login segun corresponda. El API siempre vuelve a validar la accion real.

Regla para jefe global:

```txt
Solo `owner`, `jefe_general` o un rol equivalente devuelto por el API con permisos efectivos vigentes puede acceder a vistas globales.
```

Si una persona no tiene ese rol/permiso vigente, no entra aunque conozca la URL, aunque tenga el menu cacheado o aunque haya entrado antes.

Regla de carpetas:

```txt
Crear modulos por contexto operativo/dominio, no duplicar una pantalla completa por cada rol literal.
```

Correcto:

- `src/modules/sales`;
- `src/modules/marketing`;
- `src/modules/formalizations`;
- `src/modules/collections`;
- `src/modules/management`;
- `src/modules/support`;
- `src/modules/auth`;
- `src/modules/permissions`.

Incorrecto:

- copiar la misma pantalla en `src/modules/vendedor`, `src/modules/jefe_ventas` y `src/modules/supervisor`;
- crear reglas finales de autorizacion en React;
- crear `services/netsuite`, `services/odoo` o `services/kapso`;
- crear un home que dependa de ids de proveedor.

Regla para integraciones:

NetSuite, Odoo, Kapso, Microsoft 365 y el CRM viejo se aislan en el API. Si algun dia existe una pantalla administrativa para ver estado de integraciones, sera una vista CRM canonica autorizada, no un adapter frontend ni una llamada directa al proveedor.

## Para quien

| Usuario | Que necesita en la UI |
| --- | --- |
| Vendedor | Ver sus leads, abrir detalle, entender historial y registrar acciones cuando el API lo permita. |
| Jefatura | Ver trazabilidad y supervisar motivos, pausas, perdidas y responsables cuando el alcance lo permita. |
| Formalizacion | No opera en P0-S1. Entra despues. |
| Cobros | No opera en P0-S1. NetSuite sigue siendo el sistema principal de cobros. |
| Sistemas/soporte | Ver una UI alineada al contrato canonico, sin nombres de proveedores ni reglas duplicadas. |

## Que problema mata

El frontend nuevo debe evitar que el usuario dependa de codigos, tablas viejas o reglas mezcladas con proveedores externos.

Debe mostrar una experiencia clara, auditable y en espanol Costa Rica para entender:

- que lead existe;
- quien lo atiende;
- que historial tiene;
- que permisos visibles devuelve el API;
- que informacion pertenece al CRM y no al ERP.

## Que no somos

Este frontend no es:

- landing page;
- HubSpot;
- Odoo;
- Salesforce Platform;
- Bitrix;
- marketing automation;
- calendario empresarial;
- cliente directo de NetSuite/Odoo/Kapso;
- suite de notas, chat, documentos o WhatsApp.

Si una pantalla empuja el frontend hacia suite completa antes de cerrar P0-S1, queda fuera.

## Ley de P0-S1 Frontend

P0-S1 existe para preparar la experiencia minima del CRM en orden. Nada mas.

No se debe avanzar a pantallas de leads hasta cerrar primero identidad, usuarios, roles y permisos minimos.

## Alcance historico del runtime de identidad - 2026-09-30

El frontend ya tiene `package.json`, `src/` y `pnpm-lock.yaml` porque existe un runtime React/Vite minimo para identidad.

Eso no significa CRM comercial funcional.

Regla:

```txt
El frontend actual solo puede operar identidad y shell global autenticado; pantallas comerciales siguen cerradas.
```

Permitido:

- mantener login local y Microsoft contra el BFF;
- correrlo para validar autenticacion, logout, refresh visual y foto/avatar;
- revisar `/home/global` con usuario, roles, areas y permisos devueltos por API;
- ajustar documentacion de arquitectura.

Prohibido:

- crear pantallas comerciales;
- crear leads;
- crear rutas nuevas de negocio;
- crear administracion avanzada;
- conectar integraciones externas;
- usar el runtime de identidad como prueba de que P0-S1 comercial esta construido.

La diferencia con el API es intencional:

- API: runtime comercial prohibido; el runtime minimo de identidad lo regula la ley canonica del API;
- frontend: compuerta de identidad conectada y shell global autenticado, no CRM comercial operativo.

El runtime de identidad no autoriza nuevas pantallas comerciales. Su valor permitido ahora es validar que la compuerta BFF funciona sin tokens en frontend y que el shell global base puede mostrar sesion, permisos y contexto sin mezclar leads.

| Numero | Si entra | Dueno principal |
| --- | --- | --- |
| 1 | Compuerta visual de identidad: usuarios, autenticacion, roles y permisos. | Sistemas / Jefatura |
| 2 | Reglas de sesion segura BFF sin tokens en frontend. | Sistemas |
| 3 | Permisos visibles simples recibidos del API. | Jefatura / Sistemas |
| 4 | Contrato visual basado en campos canonicos del lead, cuando identidad este cerrada. | Vendedor / Sistemas |
| 5 | Lista conceptual de leads, cuando identidad este cerrada. | Vendedor |
| 6 | Detalle conceptual de lead, cuando identidad este cerrada. | Vendedor |
| 7 | Timeline/bitacora basica visible, cuando identidad este cerrada. | Vendedor / Jefatura |

P0-S1 frontend no autoriza programar pantallas de leads si identidad/usuarios/roles, contrato canonico y modelo minimo no estan cerrados.

Identidad P0-S1A visual queda cerrada en papel cuando la UI se limite a:

- sesion;
- usuario actual;
- roles visibles;
- areas/equipos visibles;
- permisos efectivos recibidos del API;
- mensaje claro de que leads sigue bloqueado.

## Prohibiciones iniciales sujetas a ampliaciones fechadas

Hasta que P0-S1 quede cerrado por producto, queda prohibido:

- crear nuevas pantallas fuera de la compuerta de identidad aprobada y el shell `/home/global`;
- crear pantallas de lead antes de cerrar identidad/usuarios/roles;
- crear modulo de calendario;
- crear notas adhesivas;
- crear Kapso o WhatsApp en UI;
- crear formalizaciones;
- crear cobros;
- crear modificaciones;
- crear dashboard ejecutivo completo;
- crear flujos avanzados de delegacion o aprobacion fuera del contrato API de identidad;
- guardar tokens en frontend;
- llamar NetSuite, Odoo, Kapso o Microsoft Graph directo desde componentes;
- usar ids de NetSuite, Odoo, legacy CRM o Kapso como ids principales de UI;
- duplicar autorizacion del backend;
- ampliar el alcance por parecer "enterprise".

## Definition of Done visual minima

En cualquier UI real del corte aprobado, ninguna pantalla se considera lista si no cumple:

1. Usa solo contratos canonicos del API.
2. No guarda tokens en `localStorage`, `sessionStorage` ni variables globales.
3. Oculta acciones por UX, pero nunca decide autorizacion final.
4. Muestra estados de carga, error, sin sesion y permiso denegado.
5. No muestra ids internos de MySQL ni ids de proveedores externos.
6. No llama NetSuite, Odoo, Kapso, Microsoft Graph ni legacy CRM directo desde componentes.
7. Todo texto visible operativo esta en espanol Costa Rica.
8. Cada pantalla nueva tiene camino claro a permisos, auditoria o contrato API.
9. Cada archivo, componente, hook o servicio tiene una responsabilidad clara.
10. Los comentarios de codigo explican reglas de negocio, seguridad, accesibilidad o decisiones no obvias; no comentan obviedades.
11. Los valores repetidos, rutas, labels, permisos, storage keys y contratos visuales viven en constantes o contratos nombrados.
12. Si una funcion o componente mezcla concerns, se divide en piezas enfocadas y la pieza publica queda como orquestador.
13. Si la logica se reutiliza entre vistas, se mueve a `hooks`, `services`, `components`, `stores` o `types` segun corresponda; no se crea un `utils` generico.
14. La configuracion critica de frontend falla rapido; no se aceptan valores vacios silenciosos para API, seguridad o proveedores.

## Orden obligatorio

El orden del frontend es:

```txt
producto -> identidad/usuarios/roles -> contrato visual canonico -> pantallas React
```

Invertir el orden se considera volver a empujar UI antes de entender el producto.

## Criterio de salida

Se puede avanzar a pantallas React solo cuando:

- esta ley este aceptada;
- P0-S1 frontend este cerrado sin ambiguedades;
- cada "si" tenga dueno;
- cada "no" este escrito;
- el indice frontend apunte a este documento como lectura cero;
- identidad/usuarios/roles este cerrado;
- el contrato canonico minimo del API este listo para consumo visual.

Mientras tanto, el runtime React/Vite de identidad no autoriza construir pantallas de lead ni administracion avanzada.


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

### Notas personales, etapa3 (27 octubre2026)

[58 API](../../api/Arquitectura/58-Notas-Etapa3-Interfaz-Personal.md): icono junto a campana, Drawer derecho, Home y orden nativa de Formalizacion; contenido propio y layout/PIN por dispositivo. Clientes tipados, reintentos con mismo identificador, conflictos explicitos y sin datos ficticios de fallback. Compartir/respuestas/campanita/copia legacy pendientes.

Correccion vigente de notas: [59 API](../../api/Arquitectura/59-Notas-Contexto-Opcional-y-Vistas.md). Creacion desde cualquier pantalla, personal por defecto, checkbox opcional para vista registrada/orden native o legacy; vincular no comparte. Contexto incluye source+id y siempre revalida acceso; sin URLs arbitrarias/imports.

Estado vigente de notas 2026-10-28: [implementación realtime y límites](../../api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md). Provider único por sesión, campana y conversación actualizadas, preservación de borradores, lectura explícita y revocación. La invitación no concede acceso al registro: contexto restringido se recibe como null. Reconciliación REST al reconectar; copia legacy inactiva.
