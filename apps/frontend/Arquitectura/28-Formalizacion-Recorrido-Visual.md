# Formalizacion: recorrido visual y trazabilidad

## Retiro de tiempos bancarios - 20/10/2026

Se retira del Inicio la seccion Tiempos de gestion bancaria y su tabla.
Se conserva la informacion de las ordenes. El menu Resumen ya no dirige
a esta tabla ni al resumen por proyecto retirado anteriormente; indica
los contadores y filtros disponibles y la cobertura parcial de indicadores.

## Retiro del resumen por proyecto - 20/10/2026

Se elimina la seccion Pendientes por proyecto y su tabla de ordenes por
etapa. Movimientos recientes ocupa el ancho disponible. Se conserva el
filtro de proyecto de Pendientes de seguimiento y el acceso a las ordenes.
Las referencias anteriores a la tabla por proyecto son antecedentes.

## Consistencia del seguimiento - 20/10/2026

Encabezado con el mismo recuadro negro de 34px e ilustracion documental de
los indicadores. Conserva titulo y cantidad. Filtros de Inicio en tres
columnas proporcionadas: buscador, proyecto y bandeja; en tablet el buscador
ocupa una fila y en movil se apilan. Informacion secundaria en gris neutro,
sin alterar filtros, permisos, registros ni apertura de la orden. Los estilos
estan limitados a seguimiento; el selector avanzado de las bandejas filtradas
conserva su disposicion previa.

## Selector compacto de seguimiento - 20/10/2026

La barra de Inicio sustituye las pestanas por buscador, proyecto y selector
de bandeja con Todas por defecto. Cada opcion muestra su cantidad calculada
con el proyecto y busqueda actuales, conservando nombres, orden y permiso
de aprobaciones. El selector nativo permite teclado y opciones crecientes
sin ampliar horizontalmente la pagina. Los apartados sobre pestanas quedan
como antecedente; se conserva la lista filtrada y el retorno a Todas al
retirar el permiso de aprobaciones.

## Bandejas de seguimiento alineadas - 20/10/2026

Se elimina el subtitulo de antiguedad del encabezado. Las bandejas usan
Todas, Pendientes de aprobacion (solo con el permiso efectivo del banner),
Contratos pendientes, Gestion bancaria, Pendientes de saldo, Traspasos
pendientes, Traspaso firmado y Formalizaciones cerradas este anio.
Nombres, orden y filtros corresponden a los indicadores; se reutiliza
matchesPreviewFilter para evitar diferencias en los conteos. La retirada
del permiso con aprobaciones seleccionada muestra Todas. Navegacion por
teclado y selector de etapa usan solo opciones visibles. No cambia la
semantica de los datos de prueba, ni se agrega API o persistencia.

## Visibilidad de aprobaciones - 20/10/2026

El banner se monta exclusivamente con un allow efectivo para
formalizacion.home.approvals.read recibido en profile.permissions.
Permisos ausentes, en carga, vacios o ajenos no muestran el banner.
No se habilita por el nombre del rol. El calculo existente del API combina
permisos por rol y grants directos; un deny directo prevalece.
La retirada del permiso oculta tambien la bandeja de aprobaciones abierta.
Este permiso es solo de consulta: no concede aprobar ni devolver ordenes.
Pruebas explicitas cubren hidratacion de permisos por rol y override,
denegacion y retirada, sin modificar el diseno ni la politica existente.

## Ajuste de jerarquia visual - 20/10/2026

Se reduce el peso de las esquinas decorativas (opacidad 0.1), sombras y
cifras (26px, peso 500). Las descripciones usan gris neutro; se conservan
los acentos semanticos de cada etapa. Bienvenida compacta de 128px minimo
y aprobaciones centradas verticalmente, sin cambiar contenido, permisos,
iconos, acciones ni disposicion responsive. Menos reserva lateral para
decoracion permite mas espacio a los titulos largos.

## Iconos propios de indicadores - 20/10/2026

Siete SVG locales en public/illustrations/formalization-icons sustituyen los
iconos genericos: documento aprobado, contrato, banco, saldo, vivienda con
flechas, firma y vivienda cerrada. Paleta clara con acentos verdes sobre
el contenedor negro existente, sin modificar sus dimensiones. Ilustraciones
originales de interfaz, no logotipos oficiales. Render a 24x24 con viewBox
32x32; decorativos (alt vacio), pues cada indicador conserva su titulo.
Sin cambios en permisos, cifras, colas ni operaciones.

## Bienvenida actual: ilustracion original - 20/10/2026

Se sustituye la fotografia de Andira por
public/illustrations/rocca-formalization-generated.png, PNG transparente
generado para este dashboard: arquitectura residencial contemporanea,
documentos y llaves. Inspirado en las referencias de ROCCA, sin representar
un proyecto real ni alterar el logo oficial. Se presenta completo con contain,
sin recortes; es decorativo y utiliza alt vacio. Se conservan saludo, boton,
permisos y tamanos adaptables. Los apartados siguientes son antecedentes.

## Referencia ROCCA en bienvenida - 20/10/2026

La bienvenida utiliza ahora public/illustrations/rocca-andira.webp, imagen
publicada por ROCCA para Andira. Fuente: https://www.roccacr.com/proyectos/andira
y https://www.roccacr.com/images/proyectosNUEVOS/andira1.webp.
Se conserva localmente para evitar dependencias externas durante la navegacion.
El texto alternativo identifica el proyecto; la imagen es una referencia de
marca y no indica que las ordenes mostradas pertenezcan a Andira. No se altera
el logo del encabezado, los permisos, contadores ni la navegacion.
La ilustracion generada descrita a continuacion queda como antecedente,
conservada en disco pero ya no utilizada por la bienvenida.

## Imagen de bienvenida - 20/10/2026

Se integra public/illustrations/formalization-welcome.png, generada para el
proyecto con fondo transparente: maqueta residencial, documentos, pluma y llave.
Es una ilustracion decorativa, no un proyecto ROCCA real ni un contrato valido.
La imagen conserva el PNG original y se sirve localmente usando BASE_URL;
no depende de servicios externos al visualizar la pagina. Alt vacio evita
repetir informacion que no aporta al lector de pantalla.
El saludo personalizado y Ver todas las ordenes se conservan; el texto
instructivo sobre las colas se sustituye por Gestion contractual. La imagen
reemplaza el patron de esquina solo en la bienvenida; los indicadores mantienen
su contenido, permisos y navegacion. Tamano de imagen y grilla adaptables,
sin posicionamiento sobre el texto. Correccion tipografica scoped para evitar
que el estilo global del encabezado reduzca el saludo.
Chrome confirma PNG cargado a 1774x887, saludo de 18px en escritorio y ausencia
de overflow de pagina en escritorio y movil 390x844. Se restauro el viewport.
La prueba de bienvenida verifica imagen, saludo y apertura de todas las ordenes.
No se modifica el HTML de previsualizacion preexistente ni API/BD.
Verificacion final: 418 pruebas frontend aprobadas; lint/formato de archivos
tocados, TypeScript y build aprobados. El check agregado conserva los problemas
de formato preexistentes de HomeInsights/StatusPill; no se alteraron para esta
entrega. Permanece el aviso de tamano del bundle, no bloqueante.

## Banner de aprobaciones autorizado - 20/10/2026

Distribucion vigente tras el ultimo ajuste del propietario: bloque a la izquierda,
debajo del titulo, con el mismo ancho de una columna de los seis indicadores.
Usa los mismos cortes de tres/dos/una columnas. Chrome confirma igualdad de
posicion izquierda y ancho (598.734375px en escritorio). Sustituye el bloque
de 360px a la derecha descrito como antecedente a continuacion.

Ajuste visual posterior: el propietario rechazo la franja de ancho completo.
Se sustituye por un bloque de 360px junto al titulo, alineado a la derecha,
sin fila adicional de indicadores. Los seis banners mantienen 3x2. Bajo 640px
el encabezado apila titulo y bloque, limitado al ancho disponible. No cambia
conteo, permisos ni navegacion. Prueba de ubicacion en encabezado observada
fallida antes del ajuste; Chrome confirma escritorio y movil sin overflow.
La descripcion de franja que sigue se conserva como antecedente de la primera
version y no representa la distribucion actual.

Inicio incorpora una franja compacta de supervision, anterior y externa a la
cuadricula existente de seis banners. En escritorio conserva tres columnas y
dos filas; en movil la franja se adapta sin alterar los banners operativos.
La ruta transmite los permisos efectivos del perfil a la pagina. Solo se
renderiza con allow de formalizacion.home.approvals.read y sin deny explicito;
no depende del nombre del rol. Sin permiso no reserva espacio ni monta la
bandeja; retirar el permiso con la bandeja abierta devuelve el contenido a Inicio.
El clic abre la tabla local filtrada por approvalPending === true. Ninguna de
las cinco ordenes existentes tiene ese indicador; originalmente el contador iniciaba en cero,
sin duplicar ordenes aprobadas ni inventar pendientes. No hay botones de aprobar,
escritura de checks, acceso NetSuite ni cambios API/BD en esta entrega.
La aprobacion gestionable sigue pendiente: este avance solo cubre banner y
bandeja visual con permiso. No sustituye las decisiones de negocio de reunion.

Actualizacion del contador conectado: ApprovalStrip ya consulta
GET /formalization/approvals/summary mediante apiRequest, solo al montarse
con formalizacion.home.approvals.read permitido y sin deny. El endpoint
une BD nueva y legado sin duplicar identidades migradas y devuelve total,
observedAt y desglose sources. Se conserva la navegacion local del clic:
solo el numero del banner es real; listas y otros indicadores siguen DEMO.
La carga muestra un guion, no un cero inventado; un fallo muestra No disponible.
No se escriben checks ni se modifica ninguna BD. La comprobacion MySQL
actual devolvio timeout, por lo que la cantidad real aun no esta confirmada.
Contrato y regla exacta: apps/api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md.

Limpieza de indicadores: los otros seis banners muestran cero fijo, sin derivar
sus valores de ordenes DEMO. Sus consultas reales siguen pendientes.
Aprobaciones muestra Spin de Ant Design, texto Consultando y aria-busy mientras
consulta, conservando el espacio de la metrica para evitar saltos de layout.
Al resolver aparece el numero; ante un error se conserva No disponible.
No se simula carga ni se generan peticiones para indicadores sin conexion.

Verificacion: prueba previa fallida y luego suite frontend completa con 417
pruebas aprobadas en 29 archivos. Pruebas del banner cubren ausencia de permiso,
deny sobre allow, seis banners intactos, contador, clic y revocacion en memoria.
TypeScript, build y lint de archivos tocados aprobados; el check global sigue
detenido por formato previo en HomeInsights y StatusPill, no modificados.
Chrome autenticado: cuadricula 3x2 con anchos iguales en 1920px, apertura de
bandeja vacia y retorno. A 390x844, ancho cliente/documento 375px sin overflow;
franja de 343px. El viewport temporal se restauro. No certifica aprobaciones
reales ni implementacion de permisos API para futuros datos comerciales.

> Registro posterior: [29-Formalizacion-Reunion-Ajustes.md](29-Formalizacion-Reunion-Ajustes.md).
> La reunion incorpora necesidades que cambian el alcance anterior (supervision,
> traspaso firmado, llaves como requisito de cierre, cierre anual y adendas).
> Se registraron solo en documentacion; no estan acreditadas como implementadas
> por las pruebas o capturas de esta entrega visual.

Actualizacion de textos 15/10/2026: los banners y bandejas ahora se titulan
Traspaso firmado y Formalizaciones cerradas este anio. Es un cambio exclusivo
de nomenclatura, no de conteos: firmado aun agrupa contratos firmados de ejemplo
y cerrado aun no aplica periodo anual. Una nota visible aclara ambas limitaciones.
Ver el avance acotado en el documento 29; el resto de esta entrega conserva
su contexto historico.

Limpieza visual posterior solicitada el 15/10/2026: se quitaron los avisos
generales de demostracion y la nota de nomenclatura. Los datos de prueba y
las limitaciones tecnicas permanecen: sin nuevas integraciones, conteo anual
ni validacion de llaves. Ver el registro de limpieza en el documento 29.
Las referencias historicas a avisos visibles mas abajo no describen la UI
posterior a esta limpieza.

## Resumen dentro de la aplicacion - 2026-10-15

El menu agrega Resumen en /home/formalization/summary, con la misma linea grafica
y el permiso de maqueta formalizacion.home.read. No utiliza el antiguo permiso
file.read ni agrega permisos de negocio. La pagina presenta 15 puntos numerados:
que pide el PDF, fuente/pagina, que representamos, donde esta y como comprobarlo.
Los botones abren la misma orden de ejemplo dentro de Resumen o navegan a Inicio
y Calendario. La ficha vuelve con Volver al resumen.

Las casillas son revision manual, inicialmente vacias; no certifican cumplimiento
ni permisos. Conservan su estado al abrir/cerrar una ficha y se reinician al
abandonar la ruta o recargar. Los estados de cobertura son independientes:
representado visualmente, politica pendiente, cobertura parcial y fuera de fase.
Indicadores comerciales/SLA restantes y politicas de excepcion/cierre no aparecen
como trabajo terminado. No hay API, BD, almacenamiento persistente ni integraciones.

Pruebas nuevas: contenido numerado, referencias, casilla/contador, abrir orden y
volver conservando revision, acceso al calendario y guard por permiso. Revision
visual en escritorio 1440x1000 y movil 390x844, sin desbordamiento horizontal.
Evidencias: resumen-escritorio.png y resumen-movil.png, en la misma carpeta de
evidencias indicada al final de este documento.

Verificacion final de Resumen: `pnpm check` aprobado (formato, lint, TypeScript,
414 pruebas en 29 archivos y build). Se actualizaron las expectativas de menu
en pruebas de sesion sin retirar verificaciones de refresh ni de denegacion de
Catalogos. Permanecen avisos no bloqueantes de jsdom y bundle mayor a 500 kB.
`git diff --check` aprobado. Sin cambios API/BD, integraciones ni despliegues.

## Alcance y criterio

Revision del 2026-10-14. Solo frontend con datos DEMO; no implementa operaciones reales, permisos nuevos, servicios, correos, carga documental, API ni BD. Se preservan la linea grafica del menu y la apariencia de los seis banners.

Fuentes releidas: CRM IDEA.pdf (15 paginas) y RESUMEN_EJECUTIVO_CRM_TINK AJUSTADO (1).pdf (3 paginas), en la raiz del proyecto. El resumen ajustado delimita esta primera fase: Formalizacion contractual, bancaria, condicion financiera de consulta, traspaso/excepcion y cierre. Las entregas fisicas/llaves, Cobros y Modificaciones del planteamiento general no se convierten en acciones de esta fase.

## Recorrido operativo

1. Inicio resume la carga de trabajo; cada contador abre las mismas ordenes filtradas.
2. Gestion de formalizaciones abre la bandeja general: buscar, filtrar etapa/proyecto/responsable, limpiar, abrir fila.
3. La ficha mantiene visibles identidad de orden/cliente/unidad, responsable, etapa, pendiente y siguiente accion. Una guia de seis pasos distingue Contrato, Firma, Banco, Condicion financiera, Traspaso y Cierre. Recursos propios muestra Banco como no aplicable.
4. La accion principal propone el siguiente paso. Los botones de cada seccion permanecen disponibles como referencia, explicando su bloqueo; cancelar no avanza el proceso.
5. Una orden sin responsable ofrece asignarlo. Adjuntar, enviar y registrar firma mantienen su secuencia. Firmar no equivale a finalizar el credito. Cambiar asesor tampoco cambia la etapa.
6. El traspaso normal requiere firma, credito finalizado cuando aplica y condicion totalmente cancelada. Desconocido no significa saldo cero. Solicitud de excepcion no equivale a autorizacion. Los resultados de autorizacion/cierre son propuestas ficticias, no autoridad efectiva.
7. La ficha ofrece Agendar seguimiento; abre Calendario con la orden seleccionada. Cada evento puede volver a la misma ficha.
8. Volver conserva los filtros de la lista montada y los resultados simulados. Inicio/Gestion/Calendario comparten estado React por usuario mientras Formalizacion esta montada. Recargar, cerrar sesion o cambiar de modulo lo descarta. No hay almacenamiento persistente.

Los documentos de contrato, firma, traspaso y excepcion se conservan como referencias navegables dentro de la simulacion. Un archivo seleccionado solo aporta nombre/tamano, no su contenido. Una orden cerrada permanece consultable pero sus acciones de cambio quedan bloqueadas; Restablecer ejemplo permite repetir el recorrido.

## Trazabilidad de los PDF

| Necesidad y fuente | Representacion visual | Limite o pendiente |
| --- | --- | --- |
| Orden unica y aprobaciones; IDEA p2, resumen p1/p3 | Identidad estable, cliente/unidad, condiciones comerciales y aprobaciones Jefatura/RDR de ejemplo | Sin recepcion real ni edicion comercial |
| Backlog por estado y bloqueos; resumen p1/p2 | Banners, bandejas, filtros, responsable y siguiente paso; Por cerrar/Cerradas/Fase posterior | No SLA aprobado |
| Contrato existente obligatorio; resumen p1/p2 | Adjuntar, hoja de muestra, envio bloqueado sin documento | Sin generacion legal ni carga a repositorio |
| Enviar contrato y registrar firma; IDEA p4 | Compositor destinatario/asunto/mensaje/adjunto; confirmaciones, fechas e historial | No correo ni firma electronica real |
| Recursos propios/financiado; IDEA p5 | Modalidad y credito no aplicable; cambio limpia datos incompatibles | Validacion comercial pendiente |
| Banco/asesor y Otro asesor; IDEA p5 | Banco ficticio, asesores filtrados por banco, formulario de otro asesor asociado | Maestro administrado por TI; no alta de bancos |
| Credito Sin iniciar/En proceso/Formalizado; IDEA p5, resumen p3 | Botones, requisitos y fechas automaticas; guia no salta credito por saldo pagado | Solo transicion local |
| Finanzas fuente NetSuite; IDEA p2/p5, resumen p1/p3 | Consulta ficticia desconocido/pendiente/100% cancelado | Sin movimientos de dinero ni conexion ERP |
| Traspaso/excepcion; IDEA p5, resumen p3 | Respaldo, solicitud pendiente/autorizacion ficticia diferenciadas y bloqueo de avance normal | Criterios, autorizante, evidencia y permisos pendientes de aprobacion |
| Cierre y fase posterior; resumen p3 | Dos resultados, observaciones, historial y consulta posterior sin mutaciones | No entrega fisica ni llaves |
| Documentos por orden; IDEA p3/p14, resumen p1 | Selector de referencias y hoja de muestra; contratos y respaldos separados | Sin OneDrive real ni duplicacion de contenido |
| Fechas/actor/antes-despues; IDEA p2/p13 | Historial local de acciones, orden identificada y fechas por hito | No auditoria persistente |
| Calendario vinculado e historial; IDEA p3/p13 | Mes/agenda, tareas/reuniones, orden, responsable, reprogramar/completar/cancelar; historial anterior/nuevo | Sin invitaciones ni recordatorios |
| Indicadores; IDEA p5/p13, resumen p2 | Firma-inicio, duracion bancaria y firma-formalizado; backlog por etapa/proyecto | Fechas iniciales fijas de ejemplo, no recalculadas; tiempos comerciales/SLA y reportes productivos posteriores |
| Entregas fisicas y preparacion; IDEA p6 | Excluidas de esta primera fase por resumen p1/p3 | No declarar cubierto todo el CRM original |

## Implementacion y pruebas

- Modelo de escenarios: prioridad del pendiente, requisitos, documentos, historial, proyeccion de la misma orden a bandejas/contadores.
- Contexto local: FormalizationPreviewSession y formalization-preview-session. AppRouteContent lo monta solo para Formalizacion con clave de usuario, sin modificar autenticacion.
- Componentes existentes de ficha, acciones, formularios, calendario, tabla e indicadores reutilizados; sin dependencias nuevas.
- Pruebas: asignacion inicial, secuencia contractual, credito antes del traspaso, desconocido no pagado, excepcion pendiente vs autorizada, documentos retenidos, cierre sin mutaciones y retorno a bandeja/banner coherente.
- Calendario: crear/reprogramar, horarios invalidos, estados, filtros, enlace a orden e historial con valores anteriores/nuevos.

Esta maqueta permite revisar operatividad y jerarquia. No acredita reglas productivas aprobadas, datos comerciales existentes ni cobertura de integraciones. La aceptacion del usuario y las politicas pendientes deben resolverse antes de construir backend.

### Comprobacion visual del recorrido

En navegador autenticado: Inicio -> Por enviar -> DEMO-OV-101 -> asignar gestor -> adjuntar muestra. La guia paso a Enviar contrato y el responsable aparecio en ficha. Agendar seguimiento abrio Calendario filtrado por esa orden y Nuevo evento la precargo. Se creo una reunion ficticia, se regreso por el menu a Gestion y la misma orden conservo contrato y gestor. No se invocaron operaciones comerciales reales.

Se revisaron escritorio 1440x1000 y movil 390x844. La guia movil dispone sus seis pasos en dos columnas y mantiene visibles las dos acciones principales; ancho de pagina 375 px dentro de viewport 390 px, sin desbordamiento horizontal de pagina. Los anchos temporales del navegador se restablecieron.

Evidencias: C:/codex-data/visualizations/2026/10/14/formalization/flujo-orden-escritorio.png, flujo-orden-movil.png y flujo-guia-movil.png. Los resultados de formato, analisis estatico, pruebas y build se registran por separado; una comprobacion visual no sustituye las pruebas.

### Resultado automatizado final

`pnpm check` completo aprobado: formato, ESLint, TypeScript, 411 pruebas en 28 archivos y build Vite. La corrida final no tuvo pruebas fallidas. Permanecen los avisos no bloqueantes de jsdom sobre getComputedStyle/pseudo-elementos y de bundles mayores a 500 kB. `git diff --check` aprobado. No se ejecutaron pruebas API/BD porque esas capas no fueron modificadas. No se hizo commit, despliegue ni cambio de integraciones.
