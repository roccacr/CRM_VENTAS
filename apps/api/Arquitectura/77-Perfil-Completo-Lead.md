# 77 — Perfil completo del lead

Implementación local solicitada el 2026-11-02. No acredita despliegue ni aplicación de la migración060.

## Análisis y decisiones

- La ficha existente es `FormalizationClientDrawer`, abierta desde la orden de Formalización. Su servicio lee el lead efectivamente relacionado con esa orden; el ID de la orden no identifica al cliente.
- Identidad calcula permisos por roles y excepciones personales en `sec_permission`, `sec_role_permission` y `sec_user_permission_override`. Un deny explícito prevalece. Los guards y el servicio revalidan el permiso; React solo controla visibilidad.
- El lead nativo usa `crm_lead.public_id_lead`. Legacy distingue `leads.id_lead` (PK para URL) de `idinterno_lead` (referencia usada por perfil ampliado, historial y órdenes). La FK de `info_extra_lead.id_lead_fk` fue contrastada en metadatos en modo lectura.
- La unificación usa referencias externas activas y calificadas por sistema o vínculos históricos explícitos. No se relacionan clientes por nombre, correo, teléfono o igualdad de PK. Ambigüedad:409; no se selecciona arbitrariamente una coincidencia.
- Nativo prevalece para cada valor informado; un valor vacío se completa desde legacy. `legacyValue` conserva el valor antiguo cuando discrepa. `sources` identifica las fuentes consultadas y `source` la autoridad principal. La lectura no copia ni modifica datos.

## Permiso y activación

`lead.profile.read`, módulo **Lead**, sección **Perfil del lead**, lectura global independiente del módulo operativo, vendedor y rol del solicitante. Se conservan roles efectivos, sesión y denies. El permiso global se incluye en validaciones de delegación y en el editor por persona; no exige crear una unidad organizacional Lead.

La migración `202611020060_lead_profile_permission` crea la definición, asigna solo al rol Formalización, invalida versiones y registra auditoría transaccional. No reactiva grants previamente retirados ni sustituye overrides. Owner conserva la política de herencia ya existente.

La migración está preparada y registrada, **no aplicada**. Comando dirigido para ejecutar únicamente tras autorización del entorno:

```powershell
# Desde apps/api, revisar primero destino y aprobación.
pnpm migrate:identity:schema --only=202611020060_lead_profile_permission
```

No ejecutar todas las migraciones por defecto. El runner valida el destino nativo y mantiene su bloqueo. Una reversión operativa debe retirar la asignación/definición por los mecanismos auditados, sin borrar historial ni excepciones.

## Contrato

Frontend: `/perfil?source=legacy&id=123` o `/perfil?source=native&id=<publicId>`.
Botón: **Ver perfil del cliente**, visible solo con permiso efectivo y una identidad de lead resuelta.

API: `GET /leads/profile?source=native|legacy&id=...&cursor=...&orderPage=1`.

Respuesta canónica v1: `schemaVersion`, `observedAt`, `id`, `source`, `sources`, `sections`, `history`, `orders`.

Cada campo expone `code`, `label`, `value`, `source`, `legacyValue`. No devuelve filas completas, credenciales, estructuras ERP ni snapshots arbitrarios de auditoría. Secciones: datos generales, contacto, captación/seguimiento, perfil/calificación y persona adicional. El esquema nativo actual no tiene perfil ampliado equivalente: esos campos se completan desde legacy cuando hay vínculo inequívoco.

Historial:50 filas por cursor, vinculado a la identidad resuelta; conserva fechas y procedencia, sin expandir nuevamente relaciones históricas. Órdenes:50 por fuente y página, sin excluir una orden legacy salvo que su copia nativa esté incluida en la relación consultada. Son resúmenes de lectura; no conceden autorización para abrir o modificar una orden.

Errores:400 parámetros inválidos,401 sesión inválida,403 acceso denegado,404 lead no encontrado,409 relación ambigua,503 fuente no disponible. Si una fuente requerida falla no se presenta un perfil parcial como completo. `Cache-Control:no-store`.

## Verificación y límites

Se añadieron pruebas del mapper, permiso/deny, resolución legacy/nativa y ambigüedad, migración idempotente/auditoría, botón y acceso directo. El inventario HTTP añade el endpoint a las pruebas de denegación y revocación. Los resultados finales se informan en la entrega; no inferir aprobación de checks por esta lista.

Se verificó una lectura real de un perfil legacy desde una transacción read-only, sin imprimir datos personales; devolvió cinco secciones y cuatro entradas históricas. También se ejecutaron las consultas de identidad nativa y legacy con un ID inexistente. Esto no prueba una unificación real con un lead nativo poblado ni el flujo del navegador con dos usuarios reales. No se insertaron fixtures en bases compartidas.

Archivos de la funcionalidad: `src/modules/crm/leads/lead-profile.*`, adaptador `src/integrations/legacy-crm/legacy-lead-profile.reader.ts`, migración060, integración de identidad/guards/snapshot, cliente y vista frontend `services/leads/lead-profile-service.ts` y `modules/leads/LeadProfilePage.tsx`, rutas, ficha de cliente y editor de permisos. Pruebas en `test/leads`, `test/migrations/lead-profile-permission.spec.ts` y regresiones de seguridad/ficha.

## Inventario de archivos de esta entrega

API (rutas relativas a `apps/api`):

- Nuevos: `src/modules/crm/leads/lead-profile.contract.ts`, `lead-profile.controller.ts`, `lead-profile.mapper.ts`, `lead-profile.module.ts`, `lead-profile.port.ts`, `lead-profile.repository.ts`, `lead-profile.service.ts`.
- Nuevo adaptador: `src/integrations/legacy-crm/legacy-lead-profile.reader.ts`.
- Wiring: `src/app.module.ts`, `src/integrations/legacy-crm/legacy-crm.module.ts`.
- Permisos: `src/modules/crm/identity/identity-profile.repository.ts`, `identity-access-management.repository.ts`.
- Historial reutilizado: `src/modules/crm/sales/sales-orders/order-client-context.query.ts`.
- Migración: `migrations/schema-only/202611020060_lead_profile_permission.ts`, `scripts/run-schema-migrations.ts`.
- Pruebas: `test/leads/lead-profile.spec.ts`, `lead-profile.repository.spec.ts`, `test/migrations/lead-profile-permission.spec.ts`, `identity-schema-migration.spec.ts`, `test/security/route-permission.http.spec.ts`, `test/identity/general-manager-profile.spec.ts`.

Frontend (rutas relativas a `apps/frontend`):

- Nuevos: `src/services/leads/lead-profile-service.ts`, `src/modules/leads/LeadProfilePage.tsx`, `test/leads/lead-profile.spec.tsx`.
- Ficha y enlace: `src/services/formalization/order-client-service.ts`, `src/modules/home/FormalizationClientDrawer.tsx`, `FormalizationRecordSummary.tsx`, `FormalizationOrderPreview.tsx`.
- Rutas: `src/routes/app-routes.ts`, `auth-state.ts`.
- Editor de permisos: `src/modules/administration/pages/RolesSecurityPage.tsx`, `src/modules/administration/user-module-scope.ts`.
- Regresiones: `test/home/formalization-client-drawer.spec.tsx`, `test/administration/user-module-scope.spec.ts`.

Documentación: este contrato, índice y ley de producto API, índice frontend. Los demás cambios locales de NetSuite, catálogos, Notas, Calendario o expedientes pertenecen a trabajos ajenos y no forman parte de esta entrega.

## Resultado final de verificación — 2026-11-02

| Control | Resultado |
| --- | --- |
| API lint (después de ordenar el import del runner) | Aprobado |
| API typecheck / build | Aprobados |
| API suite general | 7030 aprobadas, 177 omitidas, 4 fallidas de `test/integrations/netsuite-order-field-mapping.spec.ts` |
| Frontend suite general | 95 archivos y 1308 pruebas aprobadas |
| Frontend pruebas focalizadas de ficha/perfil | 20 aprobadas, incluidos ambos orígenes y permisos de rol/personales |
| Frontend typecheck / build final | Aprobados; advertencia existente de tamaño de chunks |
| Lint de archivos frontend de esta funcionalidad | Aprobado |
| Frontend lint global | Falló en Calendario/Notas: imports de CalendarEventDrawer, CalendarGuestFields y PersonalNotes, y complejidad de NotesInbox |
| Comando oficial check-all | Falló en format:check de `SS2_1_LIB_CRM_EjecutarAccion.js`; se ejecutaron los demás controles por separado |
| Diff de esta funcionalidad | Revisado; sin errores de whitespace |
| Lectura real final read-only | Perfil legacy: cinco secciones y cuatro entradas de historial; sin cambios de datos |

La lectura final de configuración encontró cero definiciones de `lead.profile.read`, cero grants activos de ese permiso para Formalización y cero registros de la migración060. Por tanto, la funcionalidad queda preparada en código, **todavía no habilitada en esa BD**. No se ejecutaron migraciones, deploy, commits ni cambios de datos comerciales. La aceptación con un lead nativo poblado y dos usuarios reales sigue sin verificarse; las pruebas sintéticas no la sustituyen.

## Cierre de la matriz de aceptación — 2026-11-02

Se completó la matriz con consultas SQL reales en una instancia local exclusiva MariaDB10.4.32/InnoDB (`127.0.0.1:3311`). Su datadir se verifica antes de cualquier DDL; las pruebas no cargan `.env`, no aceptan hosts configurables y no conectan al servidor compartido. Se usó el DDL nativo existente de Leads y se aplicó060 únicamente en esta instancia descartable.

La autenticación/emisión de sesiones se controla mediante cuentas ficticias del fixture; el permiso por rol y el permiso personal se leen desde tablas SQL y los calcula el `EffectivePermissionService` real. Controller, guards, servicio, repositorio, adaptador legacy y queries son los de la aplicación. Esto valida el flujo HTTP y SQL del perfil; no certifica Microsoft/OIDC, sesiones productivas ni una compra/operación externa.

| Escenario solicitado | Resultado verificado |
| --- | --- |
| Usuario con permiso, lead legacy | HTTP200, origen legacy, datos generales/contacto, perfil ampliado, historial y órdenes desde la BD de prueba legacy. Probado por rol y concesión personal. |
| Usuario con permiso, lead nuevo | HTTP200, ambas fuentes, prioridad nativa, discrepancia legacy conservada, datos complementarios antiguos, historial mixto y órdenes nativas/legacy sin duplicar la copia nativa. Probado por rol y concesión personal. |
| Usuario sin permiso | Guard HTTP403 antes del repositorio; ruta frontend prohibida; enlace no renderizado. Un deny personal prevalece sobre el grant del rol. |
| Lead inexistente | HTTP404 y mensaje no encontrado para ambos orígenes; la interfaz muestra Lead no encontrado. |
| Acceso directo por URL sin permiso | HTTP403 con el mismo identificador válido, sin leer el perfil; el control de ruta y la propia página impiden la consulta y muestran acceso denegado. |

También se verificaron: URL legacy de un lead ya nativo conserva la unificación; revocar el grant del rol bloquea la siguiente solicitud y conserva una concesión personal independiente; sesión inválida401; origen/paginación inválidos400; esquema OpenAPI de entrada/salida disponible bajo tsx; y retiro de datos ya visibles en la interfaz después de un403 al paginar.

La aceptación detectó una falla real: los decoradores del DTO no garantizaban validación bajo tsx/Vitest. Se reprodujeron respuestas404/503 ante origen/página inválidos y se corrigió con `plainToInstance` + `validateSync` en el servicio, siguiendo `contract-orders.dto.ts`. La autorización sigue ocurriendo antes de la validación y antes de consultar los perfiles.

Archivos de este cierre:

- API: `test/leads/lead-profile.acceptance.local-sql.spec.ts`, `test/leads/lead-profile.sql-fixture.ts`, `src/modules/crm/leads/lead-profile.contract.ts`, `lead-profile.controller.ts`, `lead-profile.service.ts`.
- Regresión de migración: `test/migrations/lead-profile-permission.spec.ts`; la selección de060 ya no asume que deba seguir siendo la última migración del repositorio.
- UI: `apps/frontend/test/leads/lead-profile.spec.tsx`, incluidos perfil mixto y revocación después de mostrar datos.

Resultados de este cierre: **502 pruebas de API aprobadas** en seis archivos focalizados de perfil, seguridad HTTP, migración y permisos; dentro de ellas, **15 pruebas HTTP/OpenAPI/SQL real** de aceptación. **39 pruebas de interfaz aprobadas** en perfil, ficha y alcance de permisos. Los resultados globales anteriores conservan su alcance y sus fallos ajenos; estas cifras no son una nueva ejecución completa del repositorio.

Para repetir la aceptación local se requiere la instancia descartable preparada en el puerto3311 y datadir `C:/codex-data/tmp/lead-profile-acceptance-20261102/data-sensitive/`, con `lower_case_table_names=2` en Windows para conservar el nombre nativo exacto. Sin el flag, la suite SQL se omite; omitida no significa aprobada:

```powershell
# Desde apps/api. Nunca apuntar este fixture al RDS o al XAMPP de uso diario.
$env:LEAD_PROFILE_LOCAL_SQL_TESTS='1'
pnpm exec vitest run test/leads/lead-profile.acceptance.local-sql.spec.ts
Remove-Item Env:/LEAD_PROFILE_LOCAL_SQL_TESTS
```

La matriz queda validada en pruebas aisladas. La activación en la BD compartida sigue requiriendo autorización para aplicar060; no se ejecutó esa migración allí ni se insertaron leads de prueba en las bases reales.

Verificación final adicional: lint API, typecheck y build API aprobados; typecheck y build frontend aprobados; lint focalizado de los archivos nuevos aprobado. La instancia SQL de prueba se detuvo al finalizar; solo quedaron sus datos ficticios en el datadir exclusivo para reproducibilidad.
