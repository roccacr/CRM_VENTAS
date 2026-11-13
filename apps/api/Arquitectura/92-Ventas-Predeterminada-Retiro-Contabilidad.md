# Ventas predeterminada y retiro de Contabilidad

Solicitud del propietario del 13/11/2026: mantener Ventas solo con Inicio, ofrecer el módulo por defecto a Owner, Jefe General, Jefe de ventas y Ventas; retirar Contabilidad de la base nueva y de todas las opciones actuales. Se conserva la autorización para operar exclusivamente en `CRM_THINK_V2`, sin tocar la otra BD y sin ejecutar tests. No se desplegó código.

## Hallazgos y decisión

Antes de cambiar, las lecturas nativas mostraron 47 permisos activos de Contabilidad, dos membresías activas y ningún evento, nota ni ubicación de nota asociado. De 41 perfiles con rol Ventas, solo uno tenía membresía activa del módulo. Los dos Jefes generales ya la tenían; Owner podía resolverla virtualmente.

Se aplica borrado lógico a la configuración de Contabilidad: módulo inactivo y marcado eliminado, permisos inactivos, relaciones de roles/membresías revocadas y tipos de calendario inactivos. No se borran eventos de auditoría, datos de otros módulos ni las cifras financieras de las órdenes; estas no constituyen un módulo Contabilidad. No quedan opciones ni contratos operativos de ese módulo en el código actual.

## Implementación

- Migración `202611130079_sales_defaults_retire_accounting`, registrada para selección exclusiva en el runner nativo. Verifica destino, requiere la base de 078, atribuye a Owner y ejecuta el DML en una transacción con auditoría de estados previos.
- Completa las membresías activas faltantes de Ventas para los cuatro roles, sin duplicar las vigentes. Conserva historial de membresías y todas las denegaciones personales; no activa cuentas pendientes/inactivas ni cambia contraseñas.
- Alta, edición y reemplazo de acceso agregan Ventas por defecto para esos roles. Se normalizan códigos y se conserva la validación de delegación antes y dentro de la transacción. Añadir un módulo no sustituye un permiso efectivo ni suprime un deny.
- Retirada de Contabilidad en el selector global, rutas, catálogos, calendario, notas, formularios de usuarios, seguridad y navegación desde auditoría. Contratos/validadores actuales rechazan su código.
- Las migraciones/documentos históricos conservan el código retirado como evidencia. En 054 se adapta únicamente una comparación `includes` a `some` con igualdad estricta, para compilar contra el contrato de módulos ahora reducido; no cambia su SQL y no se ejecutó 054.
- Se prepararon regresiones de membresías predeterminadas, normalización, migración y URLs retiradas. Las pruebas genéricas de contextos cruzados usan módulos que siguen vigentes.

## Aplicación y verificación nativa

Se guardó el estado previo de configuración, usuarios/estados y fingerprints de roles/overrides en:

`C:/codex-data/audit-reports/habita-079-before-1794591780600.json`

Comando ejecutado desde `apps/api`, con confirmación de destino temporal y restaurada al terminar:

```powershell
pnpm migrate:identity:schema --only=202611130079_sales_defaults_retire_accounting
```

Salida **0**. Ledger: `2026-11-13T17:43:42.269Z` (11:43 Costa Rica). No se ejecutó otra migración.

Una conexión nueva verificó:

- Ventas mantiene exactamente un permiso activo: `ventas.home.read`.
- 40 nuevas membresías; los 41 perfiles con rol Ventas y los dos Owner/dos Jefes generales tienen Ventas. Estos totales incluyen perfiles que aún no pueden iniciar sesión por su estado. Jefe de ventas conserva cero personas asignadas y sus grants/mapeos están preparados.
- Contabilidad: módulo inactivo/eliminado lógicamente, 47 permisos inactivos, cero membresías, relaciones de rol o tipos de calendario activos.
- Sin cambios en roles asignados, overrides personales, estados de usuarios, permisos/módulos/membresías/tipos de calendario de las demás áreas, según comparación con el snapshot previo.
- Ninguna conexión a la otra BD durante esta operación.

Recibo de comprobación:

`C:/codex-data/audit-reports/habita-079-verified-1794591780600.json`

Log completo en la carpeta temporal del sistema: `habita-079-apply.log`. Las versiones de permisos de los usuarios afectados se invalidaron; renovar sesión y recargar para recibir la configuración nueva.

## Verificación del código

Lint focalizado, typecheck y build de API/frontend: salida 0. Revisión estática independiente: se corrigieron normalización de roles y cobertura de snapshots previos; sin bloqueos concretos pendientes en lo revisado. El build frontend conserva la advertencia de chunks mayores de 500 kB.

No se ejecutaron tests, propiedades, fuzz ni aceptación autenticada de navegador. El despliegue del código local no forma parte de esta operación.

Comandos para que el usuario ejecute las regresiones, desde la raíz:

```powershell
Push-Location apps/api
pnpm exec vitest run test/migrations/sales-defaults-retire-accounting.spec.ts test/migrations/identity-schema-migration.spec.ts test/sales/sales-home.http.spec.ts
$apiExit = $LASTEXITCODE
Pop-Location
Push-Location apps/frontend
pnpm exec vitest run test/home/sales-home-access.spec.tsx test/home/navigation-permissions.spec.tsx test/home/formalization-calendar-quick-create.spec.tsx
$frontendExit = $LASTEXITCODE
Pop-Location
Write-Output "API=$apiExit Frontend=$frontendExit"
```

Compartir salida completa y códigos. Las comprobaciones de persistencia con fixtures deben permanecer en una base desechable, nunca en las bases compartidas. Una reversión requeriría otra migración auditada que restaure solo los estados del snapshot tras comprobar cambios posteriores; no eliminar el ledger ni la auditoría para reejecutar.
