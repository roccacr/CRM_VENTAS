# 27 - Entrega de Administracion y QA

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

Vista focalizada: Por rol / Por empleado; selector de sujeto; encabezado con nombre, contador y proteccion Owner; guardar cambios y motivo auditable. Modulo -> Seccion -> pestana de catalogo, mostrando solo el contenido seleccionado. Se sustituyo la exposicion simultanea de todos los acordeones.

Administracion agrupa Usuarios, Roles y seguridad y Catalogos del catalogo API. Los otros modulos conservan sus secciones reales. No sintetizar una seccion Auditoria o una matriz de cuatro acciones si el API no entrega permisos de ese tipo: Auditoria comparte autorizacion `role.assign` en backend y no tiene necesariamente una vista independiente en el catalogo de permisos. Esto explica la diferencia entre el ejemplo inicial solicitado y las opciones realmente disponibles.

Acceso de seccion concede lectura si existe, o sus acciones si no tiene lectura. Marcar todos afecta solo la vista elegida. Permisos indican Lectura/Estandar/Sensible. En empleados, mostrar Por rol, Sin permiso del rol o Excepcion permitido/denegado. Quitar excepciones redundantes cuando el estado coincide con roles. Visibilidad en menu no equivale a autorizacion final: API siempre revalida.

Owner protegido no puede degradarse saltando validaciones de UI. Conflictos de negocio muestran el motivo API sin repetir mutaciones. Solo 401 o 409 exacto de sesion obsoleta activa renovacion/reintento. Ante fallo de red, el resultado del guardado es incierto: verificar estado antes de reenviar. [Contrato y pruebas](../../api/Arquitectura/37-Auditoria-Trazabilidad-y-Conflictos.md).

## Auditoria para usuarios finales

Modulo y Seccion obligatorios antes de consultar, Catalogo opcional si corresponde, busqueda y paginas acotadas. Tabla: evento legible, actor y roles historicos cuando existen, contexto, registro exacto, accion y fecha. Drawer: motivo, referencia al registro y valores anteriores/nuevos; detalle se solicita al abrir. No descargar snapshots de todos los eventos al entrar.

Los eventos tecnicos se traducen visualmente (por ejemplo Se actualizo la campana); codigos internos no son el titulo principal. Contexto/roles/valores no registrados historicamente se declaran desconocidos. El enlace al destino no evade permisos ni garantiza que el registro siga existiendo.

## Matriz de aceptacion manual

Ejecutar en entorno autorizado con datos de prueba controlados. Guardar evidencia de solicitud/respuesta, captura, identificador y consulta de auditoria sin secretos. Estas filas son casos pendientes de aceptacion, no resultados inventados.

| Caso | Resultado esperado |
| --- | --- |
| Catalogo pagina 100 -> siguiente -> anterior | Next solicita limit/offset correctos; Back cacheado sin solicitud; indicador sin salto/vacio persistente |
| Cambiar tamano a 10/50/200 | Reinicia pagina; solo cantidad solicitada; total y botones correctos |
| Crear/editar/desactivar catalogo autorizado | Motivo obligatorio, identidad/referencias correctas, antes/despues y rollback si falla auditoria |
| Abrir expedientes sin buscar | Ninguna solicitud de inventario |
| Buscar ff/ff03 solo o con proyecto/estado | Coincidencias globales del alcance, cursor coherente, sin payload masivo |
| Proyecto con mas de una pagina | Facetas incluyen opciones de paginas no visitadas y conteos consistentes |
| Filtrar conjunto completo ya conocido | Sin consulta cuando prueba de completitud y limite permiten filtro local |
| Filtrar conjunto incompleto | Servidor resuelve coincidencias faltantes; no ocultarlas por filtrar solo pagina |
| Limpiar multiples paneles / ordenar | Sin duplicar consultas por redraw; seleccion y conteos restaurados |
| Detalle y Planos | Todos los valores, faltantes explicitos y enlace HTTP/HTTPS seguro |
| Comparar dos o mas | Barra visible; menor costo verde, mayor area verde, intermedios amarillos, empate/faltante neutral |
| Selector rol/empleado/modulo/seccion | Solo contenido elegido; no perder cambios de otras secciones; guardar con motivo |
| Conflicto Owner o propiedad de referencia | Una mutacion, explicacion concreta, proteccion intacta |
| Perdida de red al guardar | Sin replay automatico; aviso de resultado incierto, verificar estado |
| Editar nombre y consultar auditoria | Actor, rol historico, seccion, ID de registro, valor previo y nuevo correctos |
| Evento anterior a instrumentacion | Desconocido explicito, sin reconstruccion inventada |
| Perfil sin permiso / revocacion | UI coherente y API rechaza operacion protegida aunque exista cache |
| Desktop y movil | Sin superposiciones, controles alineados, scroll acotado y carga visible |

## Evidencia y pendientes

Suites frontend: `test/catalogs`, `test/unit-files`, `test/administration`, `test/app/api-client-conflicts.spec.ts`. Ultimo check frontend registrado antes de esta consolidacion: 257 pruebas, lint/typecheck/formato/build aprobados; 13 regresiones API de acceso aprobadas. No se reejecutaron esas pruebas por escribir Markdown. Las verificaciones realizadas para esta consolidacion se reportan en la entrega, sin alterar retrospectivamente la evidencia anterior.

Pendientes: aceptacion manual completa, drift externo, mapeos bloqueados/importacion de inventario, EXPLAIN/indices y carga representativa, conectores ERP operativos, captura de cambios fuera del API y despliegue. No convertir pruebas mock o rollback en confirmacion de DML productivo. Advertencia de bundle y bloqueo global de formato se conservan como limites conocidos.
