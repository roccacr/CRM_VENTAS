# 27 - Entrega de Administracion y QA

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

### Perfil Formalizacion inicial - 2026-10-13

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
