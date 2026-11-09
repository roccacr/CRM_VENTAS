# Permisos efectivos por rol y por persona

Alcance solicitado: un permiso individual funciona aunque el rol del usuario no lo conceda. Esta corrección sustituye los requisitos históricos de nombres de rol en capacidades operativas; no concede módulos nuevos ni altera plantillas protegidas.

## Regla común

El perfil autenticado resuelve grants de roles activos y excepciones personales vigentes dentro del módulo permitido. Una denegación explícita prevalece. La caducidad, revocación, estado de usuario/módulo y permissionVersion permanecen. UI y endpoints consumen ese resultado; no exigen además que el rol tenga el mismo permiso.

## Correcciones

- Bancos: eliminada lista Owner/Jefe General del perfil, menú, ruta y servicio. Crear/editar/inactivar requieren lectura y acción exacta, además de módulo activo.
- Formalización: órdenes, bandejas, banners, aprobación, contratos, fondos de compra y resumen de adéndum se autorizan por sus permisos específicos, sin añadir nombre fijo de rol. Alcance propio/global y validación de recursos se conservan.
- Notas contextuales de Formalización: se usa acceso efectivo al módulo y permiso de vista; invitación, propiedad, ACL y enlaces comerciales siguen independientes.
- Decoradores de aprobaciones y sincronización manual usan requisitos de permisos explícitos. La sincronización no acepta payload del proveedor desde el navegador.
- El catálogo de pruebas HTTP incluye detalle/edición/estado de Calendario y operaciones recientes de fondos/finiquito. La integración NetSuite de producción mantiene su guard de token de servicio; no usa permisos de empleados.

## Límites conservados

Los grants personales no conceden membresía en otro módulo, no evitan denies, no sustituyen propiedad/participación ni amplían el alcance del dato. La configuración de la plantilla protegida Owner/Jefe General y la delegación administrativa conservan sus reglas estructurales; esta tarea no asigna roles ni escribe permisos de usuarios.

## Verificación

Se añadieron casos de grant personal y deny para cada ruta protegida del inventario HTTP, perfiles de sesión/internos sin grants del rol y catálogos de frontend. Los resultados finales y cualquier bloqueo se comunican por separado; código local y pruebas no acreditan publicación ni una sesión real de Kenneth.

### Evidencia del corte local

- Inventario HTTP: 771 pruebas aprobadas, incluyendo 115 rutas con grant personal sin rol nombrado y deny posterior.
- API ampliada: 1741 pruebas aprobadas en identidad, permisos, notas, Bancos y acciones de Formalización; 80 condicionales omitidas más 16 de AppModule que excedieron el timeout bajo carga. AppModule se repitió aisladamente: 16/16 aprobadas.
- Frontend focalizado final: 155/155 en 10 archivos (catálogos, permisos personales, navegación y editor de seguridad).
- Typecheck de API y build de ambas aplicaciones aprobados. ESLint focal y revisión independiente sin hallazgos de autorización.
- La suite completa de frontend conserva fallos de interfaz/expectativas históricas fuera de estos accesos; no se acredita verde global. check-all se detiene en formato de archivos ajenos de NetSuite/Finiquito. Los logs viven en C:/codex-data/tmp/permission-review-20261103-*.log.
- No se escribió en las asignaciones de usuarios ni se desplegó. No se inició sesión como Kenneth ni se comprobó una cuenta ajena por suplantación.

## Archivos de implementación revisados

API: `common/security/route-permission.ts`, `integrations/netsuite/netsuite.module.ts`, `modules/crm/banks/banks.permissions.ts`, `modules/crm/banks/banks.service.ts`, `modules/crm/identity/identity-profile.repository.ts`, `modules/crm/notes/notes-context.ts`, `modules/crm/sales/sales-orders/contract-orders.service.ts`, `contract-transition.service.ts`, `formalization-approval.ts`, `sales-order-addendum.ts` y `approval-summary.module.ts`.

Frontend: `modules/administration/catalogs/catalog-permissions.ts`, `modules/administration/banks/BanksPage.tsx`, `modules/home/GlobalHomeShell.tsx`, `formalization-read-policy.ts`, `FormalizationHomePage.tsx`, `FormalizationRecordSummary.tsx`, `FormAssignBank.tsx` y `routes/auth-state.ts`.

La ejecución completa inicial de frontend terminó con 2012 aprobadas y 44 fallidas, antes de actualizar expectativas antiguas de rol y catálogo. El corte focalizado final de permisos/navegación/editor es 155/155. Los fallos adicionales de UI/fixtures anteriores no se presentan como corregidos por esta tarea.

## Revisión de Formalización — 4 de noviembre de 2026

- Perfiles reales revisados: Kattya (`jefe_formalizaciones`, con rol operativo heredado) y Milena (`formalizacion`), activas y con módulo Formalización. Sus permisos de lectura de órdenes y banners están presentes; no requieren una excepción individual de lectura global como Mercadeo.
- Seguimiento, distribución por proyecto y acciones de orden usan alcance del módulo; el metadato `self` no restringe las órdenes al vendedor o responsable. En un snapshot nativo/legacy de solo lectura: Owner331, Kattya331 y Milena327 órdenes. Las cuatro restantes corresponden a pendientes de aprobación, permiso supervisor que Milena no tiene. Ambas consultan239 contratos pendientes. Los conteos son observaciones, no constantes.
- La revisión encontró un límite adicional en calendario: ambas tenían lectura `self`, por lo que no consultaban eventos de otros organizadores. El ajuste central de `calendarAccess` amplía únicamente la población de lectura de Formalización para los roles activos `formalizacion` y `jefe_formalizaciones`. Continúa exigiendo membresía activa, permiso ordinario y ausencia de una denegación explícita; un rol por sí solo no concede acceso.
- Crear y editar eventos mantiene su alcance anterior. Ver eventos de otro organizador no concede `canEdit`; tampoco abre Mercadeo/Administración, notas privadas o buzones ajenos de Outlook. Las excepciones personales y los permisos específicos de aprobación, Adéndum y bancos conservan sus diferencias.
- Regresión: dos fallos reproducidos para calendario por rol y corregidos. Ocho suites API,182 pruebas aprobadas. Se corrigieron cinco fixtures de pruebas antiguas que revocaban etiquetas de rol pero conservaban sus permisos efectivos: ahora simulan la retirada real de los permisos heredados, sin añadir un bloqueo por nombre de rol al Home. No se cambió la política de lectura de órdenes.
- No se modificaron usuarios, concesiones, catálogos, esquema ni datos de negocio en esta revisión. La corrección de calendario es código local hasta su publicación autorizada; no debe inferirse despliegue por las lecturas de la BD compartida.
- Hallazgo adicional de UI: `auth-state.ts` derivaba la autorización de la ruta de órdenes del menú filtrado. Ocultar el menú «Gestión de formalizaciones» había bloqueado también `/home/formalization/orders`. La ruta ahora reutiliza `canReadFormalizationOrder` después de comprobar módulo visible/membresía; el menú permanece oculto. Se prueban ambos roles, denegación explícita, ausencia de membresía y rechazo de Mercadeo.

Publicación de esta revisión confirmada en Habita: release `20261104065246-06a489c-local`,
4 de noviembre de2026. Ambos perfiles reales verificaron lectura de órdenes y
calendario completo del módulo; edición propia y diferencia de aprobación entre
jefatura y operativo conservadas. Se publicó también la corrección de autorización
de la ruta de órdenes independiente del menú oculto.234pruebas focalizadas aprobadas;
recibo en [DEPLOYMENT-20261104](../../../deploy/habita/DEPLOYMENT-20261104.md).
