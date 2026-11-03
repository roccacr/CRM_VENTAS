# 89 — Distribución de Formalización por proyecto

Estado: implementación local y lectura real verificadas, 2026-11-03. Sin migraciones, escrituras comerciales ni despliegue.

## Experiencia y conteos

El botón de la bienvenida reaparece como **Ver distribución por proyecto**. Abre un modal dentro de Inicio; no navega al listado ni altera proyectos, búsqueda o bandejas de la tabla. Muestra barras horizontales por proyecto, proyectos ordenados por cantidad de órdenes únicas de mayor a menor, con nombre e ID como desempate, cantidades por estado, leyenda y tabla desplegable con los valores exactos. Consulta toda la distribución autorizada, independientemente de la página y filtros abiertos en Inicio. Los estados sin órdenes conservan su leyenda autorizada y no inventan segmentos.

Colores y orden: aprobación azul; contratos por enviar naranja y pendientes de firma naranja oscuro; gestión bancaria sin iniciar violeta y en proceso índigo; saldo cian; traspaso pendiente verde azulado; firmado verde; cerradas este año verde oscuro. Adéndum pendiente se presenta en columna violeta independiente: es marca de la orden y no una etapa. Las condiciones son exactamente las de los banners; una orden puede coincidir en varias bandejas (incluido cierre anual), por lo que el total único no se obtiene sumando segmentos. La nota visible explica esa diferencia. Pasar el mouse o enfocar un segmento muestra proyecto, estado y cantidad; la tabla proporciona valores también sin depender del color.

## API y autorización

`GET /formalization/home/project-distribution`, autenticado, `Cache-Control: no-store`, sin filtros ni paginación; parámetros extra se rechazan. Comparte acceso de Formalización, permisos efectivos/denegaciones y snapshot de seguimiento. El botón necesita alguna bandeja de lectura autorizada. Cambios parciales de permisos alteran la key de FormalizationHomeContent y desmontan el modal, incluidos datos y respuestas pendientes.

Respuesta: `{schemaVersion:1, observedAt, totalOrders, series, projects:[{id,name,total,counts}]}`. Series ordenadas: approvals, send, signature, bank_not_started, bank_in_progress, balance, transfer, signed, closed, addendum. Solo se publican series y claves de conteo autorizadas. Cada proyecto.total y totalOrders cuentan órdenes únicas, no membresías. Sin proyecto se agrupa bajo id NULL y etiqueta Sin proyecto. La suma de totales por proyecto coincide con totalOrders.

FollowUpRepository.projectDistribution une las proyecciones nativa y legacy con la autoridad/exclusión de aliases existentes. projectDistributionQuery reutiliza followUpMatches y la clasificación del listado; aplica OR de bandejas autorizadas y agrupa la cartera completa en SQL, sin cargar páginas ni registros de contacto al navegador. Mantiene el switch legacy y la misma normalización de collation de la federación. Una fuente fallida no devuelve un total parcial. Cliente valida enteros, límites por proyecto, claves anunciadas, proyectos únicos y suma global; respuestas inválidas muestran error/reintento, nunca un cero ficticio.

## Verificación y límites

- Lectura real en transacción de solo lectura:243 órdenes en14 proyectos; aprobación5, por enviar238, restantes0. La suma por proyecto coincide con243 y los conteos con los banners. No se modificaron órdenes ni preferencias de filtros.
- API:58 pruebas de seguimiento y6 del inventario centrado en la ruta/descriptores aprobadas; lint, typecheck y build aprobados. El inventario completo mantiene fallos ajenos Calendar/NetSuite/finiquito, no se presenta como verde.
- Frontend:14 pruebas de servicio/modal, incluidas respuestas parciales/malformadas, solapamiento de Adéndum, error/reintento, revocación total y parcial real desde el padre. Typecheck y build aprobados en el corte, con advertencia de tamaño de chunks. Además,75 regresiones de Inicio/banners/seguimiento aprobaron junto a las primeras13 pruebas del modal (88 casos); la prueba adicional de tooltip por teclado aprobó después.
- Navegador: modal real abierto con243 órdenes/14 proyectos, colores y totales comprobados; ajuste al z-index compartido1400 mantiene el panel por encima de la máscara1299. No se crearon eventos ni se envió correo.

Archivos: API project-distribution.contract.ts, follow-up.query/repository/service.ts y home-summary.module.ts; frontend FormalizationProjectDistribution.tsx/.css, project-distribution-service.ts e integración en FormalizationHomePage.tsx. Se conserva oculto el menú Gestión de formalizaciones y permanece la ruta directa con sus permisos.

Actualización solicitada: se retiró la tabla desplegable «Ver cantidades por estado». El modal conserva únicamente el gráfico, sus cantidades y ayudas al pasar el mouse o enfocar los segmentos. Las menciones anteriores a la tabla describen la versión inicial.
