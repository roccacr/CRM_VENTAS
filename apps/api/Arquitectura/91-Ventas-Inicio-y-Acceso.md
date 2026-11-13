# Ventas: primera etapa, solo Inicio

> **Estado operativo vigente — 13/11/2026:** el usuario confirmó que `CRM_THINK_V2` es producción de la nueva versión y autorizó expresamente aplicar únicamente 078 allí, sin tocar la otra BD. Se aplicó `202611130078_sales_home_only` mediante el runner con selección exclusiva, salida 0. Verificación independiente por SELECT: un permiso activo en Ventas (`ventas.home.read`), 55 anteriores inactivos y grants activos para Owner, Jefe General, Jefe de ventas y Ventas. No se ejecutaron tests ni se desplegó código. Los apartados que describen 078 pendiente o la prohibición inicial de producción conservan el estado anterior a esta autorización puntual.

Revisión y cambios locales del 13 de noviembre de 2026. No se aplicó la migración, no se desplegó y no se ejecutaron tests. Los datos de diagnóstico siguientes se obtuvieron antes de modificar código mediante SELECT en `CRM_THINK_V2`.

## Hallazgos anteriores al cambio

- `sec_org_unit` contiene un único módulo `ventas`, activo, llamado Ventas y dependiente de Empresa.
- `sec_role_module` relaciona Ventas con `ventas` y `jefe_general`. Owner recibe módulos virtuales por su política global; no requiere una fila física por módulo.
- El rol `ventas` existe. `jefe_ventas` no existe en el catálogo consultado. No había `ventas.home.read`.
- El menú contenía Resumen, Leads, Oportunidades, Estimaciones, Calendario y Catálogos. Resumen/Leads compartían `lead.read`; varias opciones apuntaban a `/home/sales`. Calendario y los catálogos tenían rutas propias.
- Los permisos comerciales y de catálogos estaban concedidos principalmente a Owner/Jefe General. Ventas tenía calendario, pero no permiso propio de Inicio.
- No hay tablas de secciones: menú y rutas se definen en React; el editor de seguridad agrupa las vistas desde `sec_permission`.
- Las validaciones existentes no expresaban una lista cerrada de roles para entrar a Ventas. Un grant no sustituye la nueva condición de rol.
- Existen perfiles activos Owner, Jefe General y Ventas, y perfiles de otros roles. No existe un usuario de Jefe de ventas porque falta el rol. No se inició sesión ni se suplantaron cuentas para probarlos.

## Contrato local nuevo

Acceso a `/home/sales` y `GET /sales/home` exige simultáneamente:

1. Sesión/usuario válidos, mediante el flujo BFF existente.
2. Al menos un rol efectivo activo: `owner`, `jefe_general`, `jefe_ventas` o `ventas`.
3. Membresía efectiva activa del módulo `ventas`.
4. `ventas.home.read` efectivo, sin deny del mismo código.

Owner mantiene sus membresías virtuales, sujeto a deny. Jefe General conserva la intersección de su plantilla y módulos seleccionados para la persona. No se selecciona Ventas ni se asignan roles a usuarios automáticamente. Un jefe ajeno no hereda Ventas simplemente por una membresía residual.

La única sección es **Inicio**, sin métricas ni datos comerciales migrados. El API devuelve `{ module: "ventas", sections: ["home"] }`. El frontend confirma esta autorización antes de presentar el contenido. Las URLs antiguas de Calendario/Catálogos ya no se registran. Calendario, Bancos, catálogos y expedientes rechazan el contexto Ventas también en servidor; otros contextos conservan sus operaciones.

Ventas queda con un único permiso activo: `ventas.home.read`, presentado como **Ver Inicio**. Los permisos históricos de leads, oportunidades, estimaciones, calendario, catálogos y notas de Ventas quedan inactivos; no se trasladan ni se agrupan bajo Inicio. Se conservan sus registros, historial y overrides para trazabilidad, sin habilitar acciones. Las notas y permisos de otros módulos, incluido `lead.profile.read`, permanecen intactos.

## Archivos del cambio

Nuevos:

- `apps/api/migrations/schema-only/202611130078_sales_home_only.ts`.
- `apps/api/src/modules/crm/sales/sales-access.ts` y `sales-home.module.ts`.
- `apps/frontend/src/modules/sales/SalesHomePage.tsx`.
- `apps/api/test/sales/sales-home.http.spec.ts` y `test/migrations/sales-home-only.spec.ts`.
- `apps/frontend/test/home/sales-home-access.spec.tsx` y este contrato.

Ajustados: composición API, runner/inventario de migraciones, guard/política de permisos, resolución de perfil y herencia modular, agrupación de vistas de seguridad, contexto de notas, autorizadores de Bancos/Calendario/Catálogos/Expedientes; menú, registro de rutas, recuperación de rutas y adaptadores de calendario del frontend. Las pruebas existentes de esos contratos se adaptaron a la retirada de secciones de Ventas. Se conservaron cambios ajenos de Formalización y NetSuite presentes/en curso en el checkout compartido.

## Migración 078 — preparada inicialmente y aplicada con autorización posterior

`202611130078_sales_home_only`, registrada en el runner existente:

- Rechaza esquemas distintos de `CRM_THINK_V2` y tablas de seguridad no InnoDB.
- Exige el módulo existente activo; crea `jefe_ventas` si no existe.
- Comprueba los cuatro roles activos, registra el permiso y las relaciones/grants faltantes.
- Conserva grants revocados y todos los overrides personales; no reactiva configuraciones deshabilitadas silenciosamente.
- Inactiva permisos de secciones retiradas solo en el módulo `ventas`, conservando únicamente `ventas.home.read`. Revoca grants activos de Inicio y relaciones de módulo de roles ajenos a la lista.
- Incrementa versiones de permisos de las personas potencialmente afectadas y registra auditoría con estados previos de permisos/grants y relaciones rol–módulo.
- No inserta asignaciones de usuarios, no toca legacy y no elimina historia. Todo el DML comparte transacción; el runner conserva su ledger y selección exclusiva.

No ejecutar esta migración sobre la conexión compartida actual ni sobre producción como parte de esta tarea. Para aplicarla posteriormente, primero preparar una instancia no productiva con esquema `CRM_THINK_V2`, verificar su configuración, respaldo y destino. Solo entonces, desde `apps/api`:

```powershell
$env:MIGRATION_CONFIRM_SCHEMA_ONLY = 'CRM_THINK_V2'
pnpm migrate:identity:schema --only=202611130078_sales_home_only
$migrationExit = $LASTEXITCODE
Write-Output "migration=$migrationExit"
Remove-Item Env:MIGRATION_CONFIRM_SCHEMA_ONLY
```

Rollback requiere otra migración versionada y el snapshot previo: restaurar únicamente las configuraciones modificadas tras comprobar cambios administrativos posteriores, invalidar permisos afectados y auditar. No borrar el ledger, overrides ni eventos; no reactivar todos los permisos por nombre. La versión anterior de aplicación y la configuración deben revertirse coordinadamente.

## Comandos de tests para el usuario

Los comandos siguientes no fueron ejecutados por el asistente. Las suites focalizadas nuevas usan identidades sintéticas/dobles y no requieren conectarse a las bases compartidas. Ejecutar desde la raíz del repositorio:

```powershell
Push-Location apps/api
pnpm exec vitest run test/sales/sales-home.http.spec.ts test/migrations/sales-home-only.spec.ts test/migrations/identity-schema-migration.spec.ts test/security/route-permission.http.spec.ts test/identity/module-access-policy.spec.ts test/identity/general-manager-profile.spec.ts test/identity/owner-effective-profile.spec.ts test/identity/notes-baseline-profile.spec.ts test/banks/banks-authorization-mirror.spec.ts test/catalogs/catalog-authorization.http.spec.ts
$apiExit = $LASTEXITCODE
Pop-Location
Push-Location apps/frontend
pnpm exec vitest run test/home/sales-home-access.spec.tsx test/home/navigation-permissions.spec.tsx test/home/mobile-navigation.spec.tsx test/app/route-recovery.spec.tsx
$frontendExit = $LASTEXITCODE
Pop-Location
Write-Output "API=$apiExit Frontend=$frontendExit"
```

Las suites nuevas cubren los cuatro roles, rol ajeno con grant personal, deny incluso Owner, ausencia/revocación de rol/módulo/permiso, anónimo, URLs retiradas, otra área preservada y límites de migración. Las propiedades/fuzz usan semilla `130078`. Compartir salida completa y ambos códigos; si falla una propiedad, conservar semilla, path y caso reducido.

Antes de integrar, el comando oficial completo desde raíz es `./check-all.cmd`, que también ejecuta tests. Debe ejecutarlo el usuario, sin habilitar fixtures sobre bases compartidas.

## Pendientes de aceptación

- Ejecutar los tests preparados y revisar sus resultados; no se acredita verde ni comportamiento HTTP ejecutado.
- 078 ya aplicada exclusivamente a `CRM_THINK_V2` por autorización posterior expresa; no repetirla ni aplicar otras migraciones por esta entrega.
- En ese entorno, usar cuentas de prueba de los cuatro roles y una ajena, con membresías/grants controlados. Jefe General necesita Ventas seleccionado; Jefe de ventas debe ser asignado explícitamente a una cuenta de prueba por un administrador autorizado.
- Verificar Inicio, URL directa, llamada al API y rechazo de URLs/APIs retirados; repetir después de un deny/revocación y comprobar que Mercadeo/Formalización/Administración continúan funcionando.
- El despliegue, aplicación a producción y asignaciones reales quedan fuera de esta entrega.

## Verificación estática de la entrega

- Lint focalizado del alcance API/frontend: salida 0, tras corregir los errores iniciales de complejidad/imports y tipos.
- Typecheck de ambos proyectos: salida 0 en el corte revisado; comprende los archivos de tests preparados, sin ejecutarlos.
- Build de API y frontend: salida 0. El frontend mantiene la advertencia de chunks mayores de 500 kB; no se modificó su límite.
- Revisión estática independiente de autorización: sin bypass concreto pendiente en los archivos revisados. La referencia antigua de notas, una condición duplicada y los metadatos previos de auditoría fueron corregidos durante la revisión.
- `git diff --check`: salida 0.
- Tests, propiedades, fuzz, aceptación con usuarios, persistencia/concurrencia MySQL y migración: **no ejecutados**. Los checks estáticos no acreditan los criterios de aceptación en ejecución.
- Logs completos de checks en la carpeta temporal del sistema, con prefijo `habita-sales-`.

## Resultados compartidos por el usuario y corrección del fixture

El usuario ejecutó las cuatro suites focalizadas API: 857 pruebas aprobadas y una fallida; frontend: cuatro suites y 58 pruebas aprobadas. El fallo de `route-permission.http.spec.ts` esperaba 403, pero su fixture había quedado con Mercadeo tanto en query como en body y con el grant correcto de Mercadeo. El 200 era coherente con esos datos.

Se corrigió solamente ese fixture: query Mercadeo/body Formalización exige 403 sin llamadas al dominio; query Formalización/body Mercadeo exige 200 con el mismo grant de Mercadeo. El segundo caso es un control positivo para demostrar que el body, no el query, selecciona la autorización. No se modificó runtime ni permisos. Esta corrección no tiene tests ejecutados por el asistente ni resultado posterior del usuario; corresponde repetir la suite API.

## Corrección de alcance: Ventas desde cero

El 13/11/2026 el usuario mostró 55 permisos bajo Inicio y el módulo ausente del selector. La nueva consulta SELECT confirmó: 078 no registrada en ledger, `ventas.home.read` ausente, 55 permisos Ventas activos y `jefe_ventas` ausente. La falta del permiso explica por qué el menú nuevo no muestra Ventas, incluso para Owner; el nuevo código no autoriza por nombre saltándose el permiso.

La primera implementación agrupaba todos los permisos históricos bajo `home` y conservaba notas, lo que no cumplía el inicio desde cero. Se corrigió la migración 078 aún no aplicada: ahora inactiva todos los permisos de Ventas salvo `ventas.home.read`. Se retiró la excepción de notas. La política efectiva también excluye esos permisos y el API de Roles y seguridad publica solo el permiso real `ventas.home.read`, con nombre `Ver Inicio`, dentro de una sola sección `Inicio`. No se inventa el permiso en la vista si todavía no existe en la BD.

La vista genérica de roles consume ese catálogo limpio; se añadió una regresión sobre `RolesSecurityPage` que exige una sola fila en `Permisos de Inicio`. La prueba del catálogo API incluye permisos antiguos de leads/calendario/notas y exige que solo se entregue Ver Inicio, conservando los módulos restantes. No se ejecutaron tests ni se aplicó la migración o desplegó esta corrección.

Comprobación focalizada adicional, desde raíz, a ejecutar por el usuario:

```powershell
Push-Location apps/api
pnpm exec vitest run test/identity/formalization-home-catalog.spec.ts test/migrations/sales-home-only.spec.ts test/sales/sales-home.http.spec.ts
$apiExit = $LASTEXITCODE
Pop-Location
Push-Location apps/frontend
pnpm exec vitest run test/administration/RolesSecurityPage.spec.tsx test/home/sales-home-access.spec.tsx
$frontendExit = $LASTEXITCODE
Pop-Location
Write-Output "API=$apiExit Frontend=$frontendExit"
```

La base consultada no se modificó: aplicar 078 solo será admisible tras confirmar una instancia no productiva. El `NODE_ENV` local no demuestra por sí solo que el destino MySQL sea no productivo. Después de aplicarla en el entorno autorizado, comprobar que únicamente `ventas.home.read` permanezca activo en el módulo, refrescar la sesión y verificar Owner/Jefe General/Jefe de ventas/Ventas y un rol ajeno.

Verificación estática posterior al ajuste de un solo permiso: lint focalizado API/frontend, typecheck de ambos proyectos y formato aprobados (salida 0). Se solicitó confirmar si la instancia `CRM_THINK_V2` configurada es exclusivamente no productiva antes de aplicar 078, por la restricción expresa de no cambiar producción. No se ejecutaron tests, migraciones ni operaciones con usuarios reales.

## Aplicación autorizada de 078 y verificación real

Autorización posterior del usuario: la conexión configurada de `CRM_THINK_V2` corresponde a producción de la nueva versión y 078 debe aplicarse allí; la otra BD no se modifica. Esta autorización sustituye la restricción inicial únicamente para esta migración. No autoriza otras migraciones, asignaciones de personas, cambios en legacy, despliegues ni tests.

Preflight sobre una conexión nativa con TLS verificado: `DATABASE()=CRM_THINK_V2`, 078 ausente, 55 permisos Ventas activos, permiso Inicio y rol Jefe de ventas ausentes. No había triggers sobre las tablas de seguridad que modifica la migración. Se guardó snapshot local de la configuración y fingerprints de asignaciones/overrides, sin credenciales de autenticación:

`C:/codex-data/audit-reports/habita-sales-078-before-1794590365716.json`

Se ejecutó exactamente `pnpm migrate:identity:schema --only=202611130078_sales_home_only`, con confirmación de destino acotada al proceso y restaurada al terminar. Salida 0. El runner usó su plugin de bloqueo de acceso legacy y registró únicamente 078. El ledger registra `2026-11-13T17:19:45.725Z` (11:19 Costa Rica).

Verificación posterior mediante una conexión nueva:

- Único permiso activo de Ventas: `ventas.home.read`, descripción `Permite ver Inicio de Ventas.`.
- 55 permisos anteriores inactivos; no se eliminaron registros ni datos comerciales.
- Cuatro grants activos: `owner`, `jefe_general`, `jefe_ventas`, `ventas`.
- Mapeos activos de Ventas para General, Jefe de ventas y Ventas; Owner conserva membresía virtual según su política.
- Un evento `sales_home_only_configured` y un registro de 078 en el ledger.
- 43 versiones de permisos de usuarios potencialmente afectados incrementadas. No se asignaron personas a roles nuevos.
- Comparación de fingerprints/filas previas: permisos y grants de otros módulos, unidades organizativas, roles anteriores, asignaciones de roles/módulos de usuarios y overrides permanecen iguales.
- Ninguna conexión a otra base ni escritura legacy durante la operación.

Recibo local de comprobación: `C:/codex-data/audit-reports/habita-sales-078-verified-1794590365716.json`. Log completo de ejecución: carpeta temporal del sistema, `habita-sales-078-apply.log`.

Para observar los permisos nuevos, renovar la sesión y recargar el cliente. General sigue necesitando el módulo seleccionado; Jefe de ventas no tiene personas asignadas por esta migración. No se acredita prueba de interfaz autenticada por rol ni publicación del código local: esas comprobaciones siguen separadas. No se ejecutaron tests de aplicación.

## Ampliación posterior: Ventas por defecto y retiro de Contabilidad

La solicitud posterior del mismo día y su migración 079 se documentan en [92](92-Ventas-Predeterminada-Retiro-Contabilidad.md). Se completan las membresías predeterminadas de los cuatro roles sin activar cuentas ni omitir denegaciones; las nuevas altas/ediciones también agregan Ventas. Contabilidad deja de formar parte de la configuración activa y de los contratos/opciones actuales. Este corte sustituye la afirmación anterior de que no se asignaban membresías automáticamente; no habilita más secciones de Ventas.
