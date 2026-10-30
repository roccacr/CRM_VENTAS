# Formalización: permiso independiente para ver una orden

Regla confirmada por el propietario el 2026-10-28: **«Ver orden de venta» basta para abrir el detalle, sin necesitar permisos de los banners**. Se exige sesión vigente y uno de los dos roles efectivos activos de [65](65-Formalizacion-Correcciones-Roles-y-Recuperacion.md): Formalización o Jefe de Formalizaciones. Una denegación explícita prevalece.

| Operación | Autorización |
| --- | --- |
| Banner, contador, filtros y listado por categoría | Permiso específico del banner, según [63](63-Formalizacion-Lectura-Por-Banner.md) |
| Abrir una orden por selección o URL directa | `formalizacion.orders.read`, «Ver orden de venta» |
| Consultar ficha, tiempos, historial e inspección ERP de esa orden | Mismo permiso de detalle; se conserva la identidad y disponibilidad del registro |
| Aprobar, cambiar etapa o modificar | Permisos y alcances de escritura independientes, sin cambios |

Tener acceso a un banner no concede acceso al detalle. Tener acceso al detalle tampoco concede listados, contadores ni proyectos de categorías no autorizadas. La orden se identifica por fuente y clave (`legacy / 208` o `native / publicId`); el identificador del ERP no sustituye esa identidad.

La restauración de una URL usa `GET /formalization/orders/:source/:id/record`, que devuelve un único `FollowUpItem` con la proyección existente, sin contadores ni directorio de proyectos. Consulta la fuente nativa primero y conserva su autoridad sobre alias legacy. No llama al ERP ni copia órdenes entre bases. Las órdenes activas sin clasificación también pueden consultarse con el permiso de detalle.

La migración048 crea el permiso nativo y lo ofrece en Administración → Roles y seguridad → Formalización → Orden de venta. Provisiona los roles base Formalización y Owner, respeta configuraciones independientes existentes y conserva las excepciones individuales. Invalida versiones de permisos y registra auditoría. No importa datos comerciales ni modifica legacy.

La interfaz mantiene separadas las capacidades de listado y detalle. Al revocar el permiso de detalle, descarta la ficha y sus respuestas pendientes; no mantiene un acceso por tener un banner. Las notas vinculadas conservan sus propias invitaciones y no conceden acceso a la orden.

Esta regla sustituye únicamente los apartados de documentos anteriores que atribuían el detalle al permiso del banner. La ejecución de migración, las pruebas y la revisión visual se registran por separado.

## Verificación del 2026-10-28

- Migración `202610280048_formalization_order_read_permission` aplicada con selección explícita en el runner; sin otras migraciones ni escritura legacy.
- Lectura real con perfil de Formalización: `legacy:208` recuperada correctamente y listado conservado en 189 órdenes.
- Perfil reducido en memoria a «Ver orden de venta»: ficha de `legacy:208` disponible, listado 403; todos los banners denegados. La respuesta contiene un solo registro, sin contadores ni catálogo de proyectos.
- Perfil reducido en memoria a banners: listado disponible y ficha 403. No se alteraron permisos reales ni registros comerciales para estas pruebas.
- API: suite general con 6283 pruebas aprobadas y 141 omitidas por compuertas de entorno; suite focalizada posterior con 805 aprobadas y 6 omitidas, y regresiones finales con 19 aprobadas. Tipos, lint, formato y compilación aprobados.
- Frontend: suite general con 1134 pruebas aprobadas; el ajuste posterior de estilo de una prueba volvió a aprobar sus 32 casos. Formato, lint, tipos y compilación aprobados; sin llamadas ERP de escritura en estas pruebas.
- El comando oficial `check-all.cmd` se detuvo inicialmente por formato del catálogo de permisos. Se corrigió ese archivo y se verificaron los controles de ambos proyectos por separado; no se atribuye una segunda ejecución completa al comando oficial.
- Revisión independiente de código sin hallazgos. La revisión visual con una identidad concreta es distinta de estas pruebas: no se da por completada por inferencia. No se ejecutaron aprobaciones, transiciones, imports ni despliegues.
