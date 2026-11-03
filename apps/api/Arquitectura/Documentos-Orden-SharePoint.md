# Documentación de órdenes de venta — SharePoint / OneDrive

## Alcance implementado
Se sustituye el marcador de la pestaña OneDrive de Formalización por un gestor documental de la orden. Reproduce la biblioteca y el vínculo del CRM VENTAS anterior: Microsoft 365, grupo `46b0a57a-45ab-4534-8dde-cd4ba39e29b7`, raíz de órdenes `01QPXOKIF43B3PZFOW4VFIPCME4QKXURLE` y subcarpeta nombrada por el ID de NetSuite. No usa la raíz del cliente ni el enlace de planos del expediente de unidad.

Ejemplo verificado por consulta de BD: orden local legacy `78`, número `LV208`, referencia NetSuite `10518461`. Se busca la carpeta `10518461`. No se han creado carpetas ni subido archivos reales como parte de la implementación.

## Arquitectura y autorización
`FormalizationOrderDocuments` → BFF → `OrderDocumentsService` → `NetsuiteOrderRepository.resolve` → `IdentityService.withMicrosoftAccess` → Graph.

Se reutiliza la resolución de autoridad nativa/legacy y la política de acceso a la orden. Todos los endpoints exigen sesión y `formalizacion.orders.read` con rol efectivo; el servicio exige además `formalizacion.orders.documents.read`. Crear carpetas, iniciar cargas y enviar fragmentos requieren también `formalizacion.orders.documents.write`. Las denegaciones personales prevalecen. Los archivos se validan como hijos directos de la carpeta autorizada antes de dar enlaces de vista previa o descarga.

Los tokens OAuth permanecen en el servidor. El uploadUrl de Graph se cifra con AES-256-GCM, clave derivada por HKDF con propósito propio y ticket ligado a usuario, ID NetSuite, carpeta, tamaño y vencimiento (máximo 1 hora). Se rechazan rangos incorrectos, alteraciones y destinos externos fuera de los hosts Microsoft permitidos. Las solicitudes de escritura se auditan antes de Graph. Su resultado también se registra; si falla esa auditoría después de una escritura confirmada se informa por separado, sin inducir una repetición del archivo.

## API
Prefijo: `/formalization/orders/:source/:id/documents`.

| Método | Sufijo | Operación |
|---|---|---|
| GET | vacío | Carpeta y listado completo paginado desde Graph |
| POST | `/folder` | Crear carpeta si no existe, sin generar sufijos duplicados |
| POST | `/link` | Vista previa o descarga de un archivo de la carpeta |
| POST | `/uploads` | Inicio de carga: nombre, tamaño, conflicto (`fail`, `rename`, `replace`) |
| POST | `/uploads/chunk` | Fragmento base64, offset y ticket cifrado |

POST usa la protección CSRF global. Las escrituras no se reintentan automáticamente. La UI permite seleccionar/arrastrar varios archivos, muestra progreso y pregunta cancelar/renombrar/reemplazar ante duplicados conocidos. Un conflicto concurrente de Microsoft exige actualizar el listado. Cerrar la pestaña documental aborta los fragmentos pendientes; no revierte una escritura que Microsoft ya confirmó.

Límite de archivo 250 MiB; fragmentos 320 KiB. Los fragmentos base64 caben en el límite HTTP existente. No se almacena el archivo completo en memoria en el servidor. Lista Graph hasta 50 páginas de 200 entradas; si se excede, se devuelve error explícito en vez de un listado parcial. La navegación por subcarpetas no forma parte del flujo anterior que se replica.

## Activación autorizada — 3 de noviembre de 2026
La migración aplicada es `202611030070_order_documents_permissions`: crea ambos permisos y grants reales para Owner, Formalización, Jefe de Formalizaciones y Jefe General. Es transaccional e idempotente, conserva grants inactivos y excepciones individuales, actualiza versiones de permisos y registra auditoría. No altera la BD vieja. Está registrada en el runner para ejecución exclusiva con `--only=202611030070_order_documents_permissions`.

Se aplicó únicamente esa migración en `CRM_THINK_V2` y se habilitó el API local con esta configuración validada:

```
ENABLE_ORDER_DOCUMENTS=true
MICROSOFT_DOCUMENTS_GROUP_ID=46b0a57a-45ab-4534-8dde-cd4ba39e29b7
MICROSOFT_ORDER_DOCUMENTS_ROOT_ID=01QPXOKIF43B3PZFOW4VFIPCME4QKXURLE
```

El flag conserva el valor predeterminado deshabilitado; el `.env` del API local quedó habilitado con aprobación explícita. Con él activo, el login Microsoft solicita consentimiento delegado `Files.ReadWrite.All`, además de los scopes base. El administrador del tenant debe autorizarlo cuando corresponda y el usuario debe tener acceso a la biblioteca compartida. La UI reutiliza el login popup del BFF y comprueba que la cuenta CRM no cambió; no pide tokens a React. No se modifican credenciales de la integración existente.

## Aceptación externa pendiente
Con el API local habilitado: entrar con cuenta Microsoft autorizada y comprobar primero, en solo lectura, que LV208 abre la carpeta `10518461` y muestra sus archivos. Las pruebas reales de crear carpeta, subir, duplicar, renombrar y reemplazar deben hacerse con archivos de prueba y autorización explícita en el destino acordado. Las pruebas automatizadas usan Graph simulado; no acreditan consentimiento ni acceso efectivo al tenant.

## Reversión
Deshabilitar `ENABLE_ORDER_DOCUMENTS` y reiniciar el API bloquea nuevas operaciones de esta integración. No se elimina ni mueve ningún documento. Los grants se administran desde Roles y seguridad con sus versiones y auditoría; no se borran eventos históricos ni se altera la biblioteca anterior. Las cargas ya confirmadas por Microsoft permanecen en SharePoint.

## Verificación del 3 de noviembre de 2026
- Backend:122 pruebas aprobadas en integración de servicio/Graph/HTTP, migración de permisos, autenticación Microsoft, inventario de migraciones y configuración.
- Frontend:20 pruebas aprobadas en documentos, fragmentación/cancelación y conservación de la ficha original de orden.
- Lint de archivos del alcance, typecheck y build de ambos proyectos aprobados. Build frontend mantiene la advertencia de tamaño de bundles existente.
- Revisión independiente estática: sin hallazgos concretos de seguridad o corrección en el alcance. No ejecutó operaciones externas.
- La suite amplia de permisos se ejecutó adicionalmente y detectó expectativas sin actualizar de rutas de calendario ajenas al cambio. El inventario registra la ruta documental y las pruebas HTTP propias verifican sesión, CSRF, permisos y asociación antes de Graph. No se afirma que toda la suite del monorepo esté verde.
- Antes de la activación autorizada posterior, no se había ejecutado070 ni cambiado el .env operativo. No se hicieron escrituras reales en SharePoint.

## Evidencia de activación autorizada
Se verificaron ocho asignaciones activas: lectura y escritura para Owner, Formalización, Jefe de Formalizaciones y Jefe General; un registro del runner para070 y dos eventos de auditoría. Las excepciones personales existentes se conservaron. La prueba de migración aprobó dos casos antes de ejecutarla.

Se cambió únicamente ENABLE_ORDER_DOCUMENTS a true en el .env local y se reinició el proceso hijo del API mediante su watcher. GET /health/live y GET /health/ready respondieron200. POST /identity/microsoft/start, con un CSRF anónimo válido y sin iniciar una sesión de usuario, respondió200 y su URL de autorización incluyó Files.ReadWrite.All. No se imprimieron tokens, secretos ni URLs de autorización. No se abrieron enlaces de Microsoft ni se crearon carpetas o subieron archivos reales. La cuenta corporativa debe completar Conectar Microsoft y el consentimiento del tenant si aún no existe.
