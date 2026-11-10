# 33 - Reconciliación del frontend de Habita

Corte documental del 10 de noviembre de 2026 para la rama `temp/crm-tink-api-frontend-inicial`. Compara el corte `06a489c`, la integración `63139a8` y HEAD `4ad7a59`. Los cambios adicionales de la copia de trabajo se describen por separado.

## Commit publicado e historial posterior

| Commit | Alcance contrastado en frontend |
| --- | --- |
| `72c2d52` | La verificación de Habita incorpora controles adversariales y pruebas generativas de NetSuite en el API y su flujo de calidad. |
| `5a667e7` | Protege el cursor de NetSuite de fechas futuras en el API y ajusta el lint de Notas y las regresiones del frontend. |
| `4c7af0a`, `48b7707` | Limpian temporizadores de formularios y callbacks de drawers de Usuarios y Catálogos en jsdom para evitar trabajo tras el desmontaje durante cobertura. |
| `874518e`, `63139a8` | Integran la marca oficial, el login, el identificador de versión, los banners de Formalización y las pruebas de permisos, navegación y paneles. |
| `3f2537c`, `6d38014` | Ajustes del API y sus pruebas de normalización, tiempos, límites y orden. No agregan vistas de frontend. |
| `4ad7a59` | Incorpora `fast-check`, setup global de jest-dom y tiempo máximo de 20 s para pruebas y hooks de Vitest. |

El release `20261109185625-63139a8-local` se publicó el 9 de noviembre. La verificación de ese despliegue confirmó HTTP 200 para el login y readiness del API, el SVG público y la revisión `63139a8` dentro del bundle `v2.0.0`. Se verificó sin iniciar sesión. El estado de los commits posteriores y del árbol local es distinto del release comprobado. Ver el [runbook de Habita](../../../deploy/habita/README.md).

### Marca y acceso

- `public/Logo/logoRDR.svg` es la marca común en favicon, login, estados de autenticación, encabezado y marca de agua. `src/config/branding.ts` concentra ruta y dimensiones para React. El login prioriza Microsoft y ofrece el acceso local autorizado en un panel plegable. Cada método presenta su propio estado de espera o error.
- El logo del login se muestra sobre un plano tenue dentro de la tarjeta. El encabezado tiene su propio patrón y etiqueta de versión junto al logo. En el release publicado, `VITE_HABITA_RELEASE` muestra la revisión corta y el identificador completo en el atributo `title`. La etiqueta se muestra en el shell autenticado.
- Los ocho banners de Formalización usan motivos SVG decorativos por etapa, al lado derecho, con desvanecimiento hacia la izquierda y hacia abajo. Se retiraron los iconos de primer plano. Los grants efectivos y las denegaciones siguen determinando la visibilidad y la lectura.
- El seguimiento está integrado en Inicio. La entrada «Gestión de formalizaciones» se oculta en el menú, mientras `/home/formalization/orders` conserva su autorización específica de lectura. La aprobación distingue éxito, aprobación ya marcada en NetSuite y reconciliación pendiente con Habita. El detalle de calendario separa los datos Habita de un evento exclusivo de Outlook.
- Inicio de Mercadeo permite filtrar por período y proyecto. El ranking por vendedor es de consulta. Captación mantiene sus desgloses por proyecto, campaña y anuncio. Ver [estado contrastado](30-Estado-Frontend-Verificado.md).

## Cambios de la copia de trabajo

### Catálogos y costo de renderizado

- Proyectos, Campañas, Clases, Ubicaciones, Subsidiarias y Corredores usan `CatalogItemsDataTable`. Se solicita un lote de 500 por defecto, con tamaños alternativos de 10, 50, 100 y 200. El API limita a 500 y aplica `offset=(page-1)*pageSize`. La búsqueda, el orden y SearchPanes actúan sobre el lote recibido. El total viene del API.
- `CatalogItemsPage` conserva hasta ocho lotes en memoria por vista y contexto. Al volver a una página en caché se evita la petición. Actualizar, una mutación confirmada o un total distinto invalidan el caché. Una respuesta de otra navegación no sustituye la página vigente.
- SearchPanes muestra conteos del lote sin recalcularlos al combinar filtros. Con paneles cerrados y sin selección activa, el cambio de lote difiere su reconstrucción hasta la siguiente interacción. Con más de 200 filas y sin filtros solicitados ni selecciones guardadas, aparece «Cargar filtros» y el listado monta primero sin los paneles. El menú de acciones se monta al pulsar los tres puntos, con los permisos de la fila. Las celdas estáticas escapan los valores del catálogo.
- Los logs de desarrollo `[Habita Catálogos]` separan petición, caché y redibujado. Registran tamaños y duraciones. Se retiró el log de la respuesta completa.
- Bancos usa Ant Design y pide 500 bancos por página. La lista interna de ejecutivos conserva 25. Expedientes de Unidad usa DataTables con SearchPanes del servidor y cursores, solicita 500 por defecto y conserva los tamaños 10, 50 y 100. Usuarios y Auditoría usan tablas independientes. El menú bajo demanda de Catálogos no se aplica a esas tablas.

Las mediciones locales de Campañas del 9 de noviembre cubrieron 294 registros con el límite de 500. Antes de diferir el trabajo de los paneles, un redibujado de 100 filas en caché tardó 3,12 s. Con filtros cerrados y reconstrucción diferida, el redibujado comparable tardó 0,14 s. Con el menú bajo demanda se observaron aperturas de detalle de 1,24 s y 1,42 s en el lote de 294. Son observaciones del navegador local, no pruebas con 500 filas reales, todos los catálogos o carga concurrente en producción. Abrir los paneles todavía puede requerir trabajo de reconstrucción.

### Formalización, Calendario y release

- La ficha y el drawer pueden presentar checks de NetSuite por grupo con tres estados: marcado, desmarcado y sin dato. La interfaz de seguimiento toma del BFF la elegibilidad, las etapas y sus confirmaciones. Las marcas compactas de Adéndum y Fondos de compra quedan en el encabezado del drawer y abren sus acciones autorizadas. Ver [detalle y orden](32-Detalle-Orden-y-Cliente-Basico.md).
- Ante una búsqueda exacta sin resultado de seguimiento, sin filtros de proyecto ni bandeja, y con lectura de orden y actualización de etapa efectivas, la UI ofrece «Extraer de NetSuite». El usuario inicia la acción y el BFF resuelve la identidad ERP a partir de `tranid`. Esta ruta de la copia local requiere el API correspondiente. Su presencia en la UI no acredita acceso al ERP, migración aplicada ni extracción en producción.
- La confirmación para quitar un lead que tiene órdenes vinculadas y la advertencia de pérdida del borrador al conectar Microsoft sin popup usan el diálogo de Habita. Se conserva el flujo de [Calendario global](Calendario-Global-Frontend.md) por BFF.
- La copia de trabajo muestra `v2.0.1`, reconoce tanto el identificador local de release como un SHA completo y admite `VITE_API_ORIGIN=same-origin`. El workflow de calidad local suministra el SHA de GitHub al build. Estos cambios no acreditan un release productivo nuevo.

## Verificación y mantenimiento

Ver [Testing Frontend](05-Testing-Frontend.md) para los comandos y el alcance de mocks. Los resultados previos de Catálogos, Bancos, Expedientes, Usuarios y Auditoría son históricos y corresponden a las revisiones en que se ejecutaron. El 10 de noviembre, `pnpm exec vitest run test/property` aprobó 15 pruebas de propiedades en dos archivos. La verificación documental y ese resultado focalizado no equivalen a la suite completa ni a un despliegue.
