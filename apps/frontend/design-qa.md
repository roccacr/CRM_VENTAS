# Design QA - Shell global visual

## Resultado

final result: passed

## Fuente visual

- Captura entregada por el dueno del producto: barra superior blanca, menu horizontal oscuro, botones laterales redondos y fondo claro.
- Ajuste solicitado: usar logo ROCCA del login, color de menu carbon `#0f172a`, letras mas visibles, command bar neutra y fondo `#eaedf7`.

## Verificacion

- Ruta revisada: `/home/global`.
- La ruta `/auth/login` se conserva como login canonico.
- En mobile `<640px`, el login usa layout full-bleed sin tarjeta flotante para maximizar area util y evitar cortes con teclado virtual (`100dvh`).
- En desktop/tablet, el login usa tarjeta light-glass sobria y replica la jerarquia del mobile: `Ingresar` es el CTA primario solido y Microsoft queda como alternativa secundaria outline.
- El contenedor del login permite scroll vertical en mobile para que el teclado nativo no tape el submit.
- El formulario conserva atributos nativos para teclado movil/autofill: `type=email`, `inputmode=email`, `autocomplete=username` y `autocomplete=current-password`.
- `Recordarme` se trata como touch target completo y el submit local toma jerarquia solida en mobile.
- La barra superior, command bar, acciones visuales minimas, menu horizontal y fondo con marca de agua renderizan sin conectar API.
- Se agregan tokens globales de radios, paneles glass claro/oscuro, sombras y foco de input para evitar decisiones visuales sueltas.
- Las acciones superiores quedan limpias: notificaciones, aplicaciones y perfil visual.
- El menu mantiene contraste alto sobre `#0f172a`.
- Header y menu comparten ancho maximo de contenido para que el futuro canvas central pueda alinear sus bordes.
- La navegacion queda reducida a modulos de negocio, alineada a la izquierda del contenedor y sin flechas laterales en desktop.
- El item activo usa una pastilla con acento sobrio, sin depender de cambios de ancho por negrita.
- El foco del command bar y selector usa el mismo acento del estado activo.
- La composicion evita recortes de texto usando navegacion Priority Plus: si una opcion no cabe, pasa al desplegable `Mas`.
- El shell respeta el zoom del navegador: compacta logo, controles y tipografia con limites responsive, y mueve opciones secundarias al overflow antes de generar scroll horizontal.
- Los modulos con opciones despliegan un panel visual desde una configuracion tipada; Mercadeo queda como ejemplo con Campanas, Origenes de Leads, Leads Entrantes y Metricas de Captacion.
- Las opciones incluyen metadata de permiso futuro solo para preparar el filtro de UX; no autorizan rutas ni acciones.
- El patron de desplegable incluye icono por opcion, microcopy para usuario final, hover/focus visible, conector al disparador y chevron rotado.
- Configuracion queda ampliado como ejemplo enterprise: Usuarios y Cuentas, Roles y Seguridad, Catalogos del CRM, Integraciones API y Auditoria y Logs.
- El selector superior funciona como selector visual de perfiles asignados y cambia el menu oscuro segun el perfil activo.
- `Todos` queda como perfil visual de revision global para mostrar las opciones agrupadas de CRM Tink, Finanzas, Mercadeo, Formalizacion y Administracion.
- `CRM Tink` queda como perfil propio con Leads, Calendario Outlook, Expedientes, Lista de Eventos, Reporte de Comisiones, Oportunidades, Ordenes de Venta y Tickets.
- `CRM Tink` evita salto de barra agrupando dinamicamente opciones secundarias dentro de `Mas`; el menu ya no debe partirse en dos filas ni producir scroll horizontal por zoom.
- Los labels de menu usan Title Case para mantener consistencia entre subnav y titulos de canvas.
- El selector superior muestra rotulo `Modulo` y el buscador declara el contexto activo para no confundirse con un filtro de busqueda.
- El atajo visual del command bar detecta plataforma: `Ctrl K` en Windows/Linux y `⌘K` en macOS/iOS.
- Si una opcion activa queda dentro de `Mas`, el disparador `Mas` hereda el estado activo para conservar ubicacion visual.
- El selector `Modulo` usa min-width estable de 180px para evitar saltos al cambiar entre perfiles cortos o largos.
- En mobile `<768px` se oculta el header de 2 niveles y se usa top app bar compacta de 56px con hamburguesa, busqueda, notificaciones y perfil.
- La top app bar mobile usa glass claro flotante y queda desaturada: hamburguesa, logo centrado, notificaciones y avatar; la busqueda ya no compite en 360px.
- La navegacion estructural en mobile pasa a drawer lateral con backdrop, cuenta visual, modulos de sistema en acordeon y accesos rapidos.
- El drawer mobile usa Light Enterprise Glass, cierre circular claro, busqueda interna y estados activos azul suave para reducir masa visual oscura.
- El drawer mobile queda como floating sheet: borde derecho redondeado, backdrop tenue, cuerpo con scroll propio, footer fijo compacto y acordeon sin doble marco.
- El footer del drawer funciona como Liquid Glass Dock: capa sticky esmerilada, micro-tarjetas tactiles y `Cerrar Sesion` diferenciado con tono cautelar.
- El drawer mobile no aplana la IA: `Resumen Global` es acceso directo y cada perfil asignado es un padre colapsable; sus vistas internas viven indentadas dentro del grupo del perfil.
- El drawer mobile sigue una lectura por categorias (`Vista Global`, `Perfiles Asignados`, `Accesos Rapidos`), usa iconos semanticos por perfil y subvista, y reserva scroll interno al cuerpo del menu.
- Los touch targets moviles principales usan al menos 44px de alto/ancho para cumplir la ergonomia tactil esperada.
- El selector superior usa ancho fijo y el header mantiene altura estable para evitar desplazamientos al cambiar de perfil.
- El canvas cambia segun perfil solo para mostrar el titulo de la vista; no renderiza KPIs, filtros, CTA, graficas, tablas ni agenda hasta que el dueno del producto defina el contenido real.
- Las configuraciones visuales de KPIs, tablas, barras y prioridades quedan como estructura interna no visible; no deben evaluarse como contenido activo.
- El header usa padding lateral comun y mas aire vertical para que el logo no quede pegado a la barra oscura.
- En pantallas XL los KPIs pueden ocupar hasta seis tarjetas por fila para reducir vacios laterales en monitores grandes.
- La vista global no muestra filtros secundarios ni breadcrumb en el canvas; el selector superior controla el contexto visual.
- La marca de agua se oculta cuando hay contenido para evitar fugas visuales.
- El canvas usa ancho fluido enterprise con `--page-max` alto y `--page-pad` elastico; header, menu y pagina comparten las mismas variables de alineacion.
- Los KPIs usan grid intrinseco con `auto-fit/minmax` para reordenarse al subir zoom o bajar ancho sin hacks de `devicePixelRatio`, `zoom` ni `transform: scale`.
- En viewport amplio el contenido pasa a una distribucion de tres columnas para usar mejor monitores grandes; en viewport reducido el menu no envuelve y evita scroll horizontal de pagina.
- En tablet, la subnavegacion desktop se comporta como barra horizontal desplazable con desvanecimiento lateral para conservar acceso sin romper el layout.
- El canvas central comparte ancho con header/menu y maqueta page header, filtros, CTA, KPIs mock, embudo, tabla y panel lateral.
- Los datos del dashboard son demostrativos y no representan metricas reales ni autorizan operaciones.

## Bitacora visual

| Fecha | Cambio | Estado |
| --- | --- | --- |
| 2026-09-28 | Se agrega menu desplegable visual por modulo, basado en configuracion y preparado para permisos futuros. | Pendiente de conectar al contrato real de identidad. |
| 2026-09-28 | Se agrega canvas visual inicial del dashboard global con KPIs mock, embudo, tabla y panel lateral. | Visual aprobado para revision; pendiente API, permisos y datos reales. |
| 2026-09-28 | Se refina el desplegable enterprise con iconos, microcopy de usuario final, estados hover/focus y Configuracion ampliado. | Patron visual listo para replicar con permisos reales cuando el API lo entregue. |
| 2026-09-28 | Se convierte `CRM Tink` en perfil activo visual y se agrega cambio de perfil asignado con menus distintos por contexto. | Visual mock; pendiente que el API entregue contextos y permisos reales. |
| 2026-09-29 | Se agrega `Todos` como perfil visual de revision global para ver opciones agrupadas de todos los perfiles mock. | Solo visual; en produccion dependera de permisos reales de TI/jefatura global entregados por el API. |
| 2026-09-29 | Se ajusta el corte 10/10: menu `CRM Tink` sin wrap mediante `Mas`, selector/header estable, canvas contextual por perfil, iconos propios, chips, tabla y barras pulidas. | Visual listo para reevaluacion; corte previo a la conexion BFF de identidad. |
| 2026-09-29 | Se cambia el layout a canvas fluido enterprise: ancho maximo alto, padding elastico, KPIs auto-fit, 3 columnas en pantallas grandes y reflow natural para zoom alto. | Visual listo para pruebas de 100% a 200% de zoom; sin deteccion artificial de zoom. |
| 2026-09-29 | Se corrigen pendientes del evaluador: barras proporcionales, leyenda de escala, prioridad compacta, seis KPIs en XL, padding/logo con mas aire y menos duplicacion de filtros/rotulos. | Visual listo para nueva evaluacion; datos siguen siendo mock. |
| 2026-09-29 | Se limpia el contenido visible de todas las vistas: queda solo el titulo por perfil y se conserva el menu contextual. | Pendiente que el dueno del producto defina contenido real por vista. |
| 2026-09-29 | Se aplica ajuste enterprise de navegacion: selector de modulo separado visualmente, busqueda por contexto, labels Title Case, icono neutro de Administracion, foco WCAG y overflow `Mas` dinamico. | Visual listo para reevaluacion; RBAC real sigue pendiente del API. |
| 2026-09-29 | Se corrige el patron mobile: top app bar compacta y drawer lateral reemplazan el header alto y la subnav horizontal en `<768px`. | Visual responsive listo para QA mobile; corte previo a la conexion BFF de identidad. |
| 2026-09-29 | Se aplican micro-pulidos finales: shortcut sensible a sistema operativo, `Mas` activo cuando contiene la vista activa y selector de modulo con min-width estable. | Navegacion lista para sign-off visual; pendiente conectar rutas/permisos reales. |
| 2026-09-29 | Se corrige la arquitectura del drawer mobile: `Resumen Global` queda como acceso directo y los perfiles asignados funcionan como acordeones con subpaginas indentadas. | Se elimina la lectura plana de subpaginas como modulos hermanos; permisos/rutas comerciales siguen pendientes. |
| 2026-09-29 | Se pulen ajustes finales del login mobile: full-bleed bajo 640px, CTA local solido, `Recordarme` tactil y atributos nativos de autofill/teclado. | Login visual listo para reevaluacion mobile; sigue sin conexion real al API. |
| 2026-09-29 | Se alinea el drawer mobile con referencia de navegacion lateral: categorias visibles, fondo institucional oscuro, iconos de perfil reales, cuerpo con scroll interno y acordeon con transicion. | Drawer visual listo para nueva evaluacion mobile; permisos/rutas comerciales siguen pendientes. |
| 2026-09-30 | Se conecta la compuerta de identidad al BFF: login local, Microsoft con selector de cuenta, logout, foto/avatar, estados de verificacion y shell `/home/global` autenticado. | Flujo de identidad validado localmente; modulos comerciales, datos reales de leads y autorizacion final siguen en API/fases posteriores. |
| 2026-09-29 | Se cierra micro-checklist del login mobile: `100dvh`, scroll vertical ante teclado, `Recordarme` dentro del target tactil y autofill validado por prueba. | Login mobile queda listo para sign-off visual; sigue sin envio real al API. |
| 2026-09-29 | Se aplica auditoria Liquid Glass: login desktop/tablet unifica jerarquia con mobile, se agregan tokens globales, drawer dark glass, top app bar mobile flotante y subnav desktop/tablet suavizada. | Visual listo para reevaluacion; sin cambios de API, roles, rutas ni contenido real. |
| 2026-09-29 | Se aplica evaluacion mobile final: se elimina la busqueda del header movil, se integra al drawer y el drawer cambia de dark glass a Light Enterprise Glass con activos azules suaves. | Header/drawer movil listos para nueva evaluacion; siguen siendo visuales, sin busqueda funcional ni permisos reales. |
| 2026-09-29 | Se corrige peso visual del drawer: panel flotante con borde derecho redondeado, backdrop menos invasivo, footer fijo compacto y estados activos sin recuadro doble. | Drawer movil listo para nueva revision visual; sin cambios de rutas, API, roles ni permisos reales. |
| 2026-09-29 | Se refina el footer del drawer como dock Liquid Glass con micro-tarjetas, bisel superior, press state y salida en tono rojo atenuado. | Pulido visual mobile aplicado; `Cerrar Sesion` sigue sin accion real hasta conectar identidad. |
| 2026-09-29 | Se aplica ajuste pixel-perfect del dock inferior: menor padding de base, fondo glass `0.85`, blur `16px`, tarjetas tactiles de `64px` y press `0.96`. | Micro-pulido final aplicado; sin cambios funcionales. |
| 2026-09-29 | Se corrigen microdetalles UX del drawer: Administracion usa icono propio, el perfil activo permanece desplegado, la busqueda declara alcance global y el avatar RC baja peso visual. | Pulido visual aplicado; sigue sin busqueda funcional ni RBAC real. |
| 2026-09-29 | Se separa el foco del drawer mobile: el padre abierto queda neutro, el subitem activo concentra el acento azul, el arbol usa guia vertical de 2px, el dock respeta safe area y el avatar mobile deja de insinuar dropdown. | Pulido visual aplicado; perfil/salida siguen siendo visuales y sin identidad real. |
| 2026-09-29 | Se corrige reevaluacion iPhone: el foco del acordeon abierto pasa de azul rigido a aro gris suave, el scroll del drawer reserva 96px antes del dock y la rama de submenu gana aire inferior. | Pulido visual aplicado; sin cambios funcionales ni datos reales. |
| 2026-09-29 | Se corrige el acordeon mobile para que el segundo toque sobre el mismo perfil cierre sus opciones. | Comportamiento visual validado con prueba; sin rutas ni permisos reales. |
| 2026-09-29 | Se elimina el contorno visible del padre abierto en mobile y se ajusta el colchon inferior del scroll a 100px para separar subitems largos del dock. | Pulido visual aplicado; sin cambios funcionales. |
| 2026-09-29 | Se agrega contrato de navegacion filtrable por permisos efectivos: `allow` muestra, `deny` prevalece, `Todos` se arma con perfiles permitidos y cada subopcion puede ocultarse aunque el modulo padre exista. | Listo para conectar a `/identity/me.permissions`; el backend sigue autorizando rutas y acciones reales. |

## Alcance no incluido

- Sin dashboard operativo ni KPIs visibles.
- Sin roles.
- Sin administracion funcional de permisos desde UI.
- Sin acciones funcionales.
- Sin cliente API.
- Sin home operativo por contexto.
