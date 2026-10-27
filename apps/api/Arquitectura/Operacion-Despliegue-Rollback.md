# Operacion, despliegue y rollback

## Revision de operacion - 2026-10-27

Codigo registrado: seguimiento/timing y send/revert/set-stage de Formalizacion,
Captacion de leads e inspeccion GET NetSuite. Los flags false de la tabla inferior
son defaults del validador/ejemplo, no una lectura de `.env` ni de produccion.
La autorizacion local de escrituras legacy del2026-10-26 esta fechada en
[52](52-Etapas-Responsables-y-Tiempos.md); no autoriza encenderlas en otro destino.
Credenciales NetSuite son opcionales al bootstrap y obligatorias solo para su
consulta: ver [04](04-Integraciones-ERP.md). No imprimirlas en logs/preflight.

Migracion038 retira exclusivamente el permiso Eventos y citas, con borrado de
relaciones dependientes e invalidacion de versiones. Un rollback de frontend no
lo debe recrear automaticamente ni ejecutar otra vez028: la secuencia de
migraciones conserva el retiro. No ejecutar scripts de importacion o fixtures
para verificar esta documentacion. El reporte y los resumenes no requieren DML.

La revision actual no ensaya despliegue, restauracion, migraciones ni llamadas
externas. Las evidencias de checks anteriores no son un gate nuevo. En la
revision documental actual, `check-all.cmd` se detuvo en `format:check` de API
antes de lint/typecheck/tests/build por tres archivos TypeScript con formato
pendiente (038 y dos tests de identidad/etapas). Ver cierre central49/55 para
el resultado de esta corrida; no corregir codigo o declarar CI verde desde este
runbook.

Corte documental O03/P01: 2026-10-22. Describe el checkout compartido inspeccionado, no una instalacion productiva verificada. Este documento no autoriza despliegues, arranques, migraciones ni escrituras. No requiere Docker.

Revision vigente 2026-10-23: [49 - Estado consolidado](49-Estado-Actual-y-Cierre-Documental.md).
Se actualiza la matriz de producto con ampliaciones acotadas de Home, perfiles,
esquemas y Mercadeo; no se ha ensayado despliegue/restore de este checkout.

## Prerrequisitos y arranque

- Node.js 22 compatible con `engines` y pnpm 10.28.2 (version fijada en `packageManager` y CI). API y frontend tienen instalaciones y lockfiles independientes; no hay workspace Node raiz.
- Desde `apps/api`, `pnpm install --frozen-lockfile` instala la version congelada; `pnpm build` compila TypeScript a `dist/`. El artefacto inspeccionado contiene `dist/main.js`; verificar esa salida en el build limpio del release.
- `pnpm dev` ejecuta `tsx watch src/main.ts` para desarrollo. No hay script `start` ni configuracion PM2/systemd/supervisor en el inventario inspeccionado. Para produccion, el responsable debe configurar el supervisor para ejecutar Node sobre `dist/main.js`, con directorio de trabajo `apps/api`, entorno explicito y dependencias de runtime disponibles. Estos son requisitos de entrega, no un supervisor instalado.
- Definir servicio/cuenta de privilegios minimos, reinicio con backoff, captura/rotacion de stdout/stderr, cierre por SIGTERM/SIGINT y tiempo de gracia. `main.ts` habilita shutdown hooks y `DatabaseService.onModuleDestroy` cierra Kysely/pool. El supervisor, proxy, certificados HTTPS y tiempos de gracia aun requieren validacion operacional.
- `API_BIND_HOST` predeterminado `127.0.0.1`, `PORT` 3000. Publicar solo mediante la infraestructura aprobada; `TRUSTED_PROXY_IPS` debe contener exclusivamente proxies reales, nunca confianza global.

## Configuracion

Contrato efectivo: [`env.validation.ts`](../src/config/env.validation.ts), [`database-env.schema.ts`](../src/config/database-env.schema.ts) y [`.env.example`](../.env.example). No copiar secretos al documento ni imprimir `.env`.

| Variable/grupo | Politica operacional |
| --- | --- |
| `NODE_ENV` | `development` local; `production` solo en el destino autorizado. |
| `ENABLE_LEGACY_FALLBACK=false` | Default del ejemplo/validador: deshabilita acceso legacy y su pool. El snapshot local autorizado posterior registra true, no es estado productivo confirmado. Nativo `CRM_THINK_V2` sigue siendo primario. |
| `ENABLE_LEGACY_WRITES=false` | Default seguro local y produccion. Para los seis writers de catalogos, el opt-in exige `NODE_ENV=production`, `ENABLE_LEGACY_FALLBACK=true` y `LEGACY_CRM_DB_NAME=crmdatabase-api`. El escritor contractual preparado exige flags y destino exacto sin exigir produccion, y sus comandos HTTP acotados ya estan registrados. Habilitar lectura no habilita escritura. No activar ninguna de estas compuertas desde este runbook sin autorizacion del dominio. |
| `ENABLE_RECORD_AUDIT=false` | Default del ejemplo/validador. Activacion explicita y preflight 023/024 segun apartado siguiente; no habilita comandos ni escritura legacy. |
| `DB_*` | Destino nativo validado `CRM_THINK_V2`, conectividad y permisos necesarios para runtime. Host remoto exige `DB_SSL=true`; CA solo con TLS activo. No usar permisos de migracion como requisito general del runtime. |
| `COOKIE_SECRET`, `AUDIT_HASH_SECRET`, `AUTH_TOKEN_HASH_SECRET` | Obligatorios, minimo 32 caracteres. Conservar secretos compatibles durante rollback; no rotar credenciales compartidas como parte de un reinicio. |
| `FRONTEND_ORIGIN`, `FRONTEND_ALLOWED_ORIGINS` | Origen canonico y allowlist exacta, compatibles con cookies BFF y HTTPS productivo. |
| `MICROSOFT_*` | Configuracion OIDC completa o ausente; cache MSAL cifrada con clave propia. Presencia de adapter no acredita Entra ID operativo. |
| `OPENAPI_ENABLED`, `LOG_LEVEL` | Swagger deshabilitado por default; logging `info` por default. Exposicion y verbosidad segun destino aprobado. |

La configuracion se valida al bootstrap. Crear el pool no acredita acceso real ni disponibilidad de tablas; `/health/ready` comprueba conectividad nativa, no esquema ni migraciones. No ejecutar automaticamente `migrate:identity:schema` ni `recover:owner` al arrancar.

## Auditoria central: activacion y apagado

`ENABLE_RECORD_AUDIT` vale false por defecto en [`.env.example`](../.env.example) y [`env.validation.ts`](../src/config/env.validation.ts). Es distinta de la auditoria de seguridad anterior `audit_security_event` y de los historiales especializados, que se conservan. Con false no se captura mediante los escritores centrales conectados; no implica ausencia de toda auditoria.

Procedimiento para una activacion posterior autorizada, no ejecutado por esta remediacion:

1. Revisar respaldo, ventana y esquema con el responsable. Verificar destino nativo `CRM_THINK_V2`, ledger `202610220023_record_audit` y `202610220024_record_audit_identifier_collation`, estructura compatible e InnoDB. Seguir el [procedimiento de migraciones](03-Base-Datos-y-Migracion.md) si falta preparacion; el runtime no aplica DDL automaticamente.
2. Revisar transacciones y privilegios dedicados para la evidencia (SELECT/INSERT, sin UPDATE/DELETE). No revocar credenciales compartidas. Ledger presente no prueba ausencia de drift ni inmutabilidad con grants amplios.
3. Configurar explicitamente `ENABLE_RECORD_AUDIT=true` en el destino autorizado y reiniciar el API por su procedimiento aprobado. [`RecordAuditService`](../src/modules/crm/audit/record-audit.service.ts) verifica DATABASE() y ambos registros 023/024 al iniciar y en cada append; falla cerrado si falta preparacion. No usar `/health/ready` como prueba del esquema.
4. Comprobar arranque/preflight y, solo con autorizacion separada, una operacion de negocio permitida y su evidencia transaccional. Sin esa operacion no afirmar captura real, rollback ni concurrencia MySQL. No insertar fixtures en BD compartidas ni activar list/send/revert para comprobarlo.
5. Para apagar la captura central, configurar `ENABLE_RECORD_AUDIT=false` y reiniciar. No elimina eventos, no deshace DDL ni mutaciones previas, no impide mutaciones nativas y no revierte las auditorias anteriores. Evaluar la perdida de captura futura con el responsable.

El [snapshot local autorizado del 2026-10-22](38-Ordenes-Venta-Estados-Auditoria.md#alcance-final-corregido-solo-home---2026-10-22) registra fallback/auditoria true y legacy writes false; los tres defaults del ejemplo son false. Es evidencia documental fechada, sin releer `.env` ni comprobar produccion en este trabajo. Los snapshots parciales de auditoria no permiten prometer restore generico; restauracion integral y ensayo de backup permanecen pendientes.

## Salud y observabilidad

Rutas implementadas en [`HealthModule`](../src/common/health/health.module.ts), con `@RouteSecurity("public")` por handler y `Cache-Control: no-store`:

| Ruta | Contrato implementado / uso |
| --- | --- |
| `GET /health/live` | 200 con `{ "status": "ok" }`; sin consultas DB ni llamadas a servicios externos. Supervisor puede detectar proceso trabado. |
| `GET /health/ready` | 200 con `{ "status": "ready" }` tras `SELECT 1` nativo; fallo o plazo de 1000 ms devuelve 503 con `{ "statusCode": 503, "error": "Service Unavailable", "message": "Servicio no disponible." }`. El balanceador retira trafico si falla; no reiniciar en bucle por una caida de DB. |

Readiness comparte una sola consulta pendiente por proceso. El plazo limita la respuesta HTTP, no cancela la operacion del driver: si la consulta queda bloqueada, conserva su espacio y las peticiones siguientes reciben 503 sin crear consultas adicionales hasta que termine. No comprueba tablas, migraciones, legacy, Microsoft ni otros proveedores; no hay dependencia legacy incluso con fallback habilitado.

Verificacion O01/O02: `test/health/health.spec.ts` cubre modulo/controlador HTTP con DB sustituida, liveness sin consultas, readiness exitosa/fallida y timeout/concurrencia/recuperacion del probe. `test/common/sanitized-error.http.spec.ts` usa bootstrap HTTP sintetico para preservar 4xx y sanitizar 5xx. Junto con las dos suites `approval-summary`, 30 pruebas aprobadas; lint enfocado, formato, typecheck y build API aprobados. No se leyo `.env`, no hubo conexion DB real ni smoke productivo. Antes de conectar probes en infraestructura, confirmar registro de `HealthModule` por composicion y disponibilidad en el destino autorizado; estas pruebas no acreditan despliegue. No sustituir salud con `/identity/session`, login Microsoft ni respuestas DEMO.

[`SanitizedErrorFilter`](../src/common/filters/sanitized-error.filter.ts), registrado por `configureHttpApp`, conserva contratos 4xx y reemplaza detalles de excepciones 5xx por respuestas estaticas. Para 503 utiliza [`SERVICE_UNAVAILABLE_RESPONSE`](../src/common/http-error.responses.ts), compartida con respuestas tempranas de indisponibilidad; otros 5xx conservan status y devuelven `Internal server error`. Genera `x-correlation-id` propio y registra solo `correlation_id` y `statusCode`, sin excepcion original, SQL, stack ni identificadores enviados por el cliente. Los hooks que responden directamente no pasan por filtros Nest y deben usar la misma constante 503; su verificacion pertenece a las pruebas de identidad/reset.

Pino/nestjs-pino emite logging estructurado con nombre `crm-tink-api`; [`app-logging.constants.ts`](../src/config/app-logging.constants.ts) censura authorization, cookies, CSRF, passwords y tokens. Infraestructura debe capturar salida, definir retencion/acceso, correlacionar requests y alertar por 5xx, readiness, reinicios y saturacion de pool. No registrar cuerpos completos, secretos, SQL sensible ni cache MSAL. Logging HTTP no sustituye auditoria de negocio/seguridad persistida.

## Freeze, CI y criterio de entrega

- Congelar commit, ambos `pnpm-lock.yaml`, version Node/pnpm, artefactos y manifiesto de configuracion sin secretos. No actualizar dependencias al desplegar ni regenerar lockfiles para resolver una instalacion fallida.
- Criterio de clon limpio: checkout nuevo del commit, sin `node_modules`, `dist` ni archivos locales heredados; instalacion `--frozen-lockfile` en cada app, `pnpm check` de ambas apps con salida 0 y sin modificar archivos versionados. En Windows, `.\check-all.cmd` delega a `scripts/check-all.ps1`; no acepta argumentos.
- [`quality.yml`](../../../.github/workflows/quality.yml) ejecuta Node 22, pnpm 10.28.2, instalacion frozen y `pnpm check` por app. Sus jobs MySQL son informativos (`continue-on-error`), condicionados a infraestructura aislada: CI verde de calidad no equivale a persistencia MySQL validada.
- `test:mysql:ci` y suites MySQL requieren autorizacion e infraestructura preparada; pueden escribir fixtures. No ejecutarlos contra una DB compartida como comprobacion de despliegue. Registrar por separado suite, destino aislado y resultado; omitido/bloqueado no significa aprobado.
- El corte `f2dc4f1` tuvo clon limpio y checks aprobados, segun [reauditoria](Reauditoria-54-Plan-y-Resultados.md). Cambios documentales posteriores no estan incluidos en esa medicion. No certifica CI remoto, release desplegado ni smoke productivo; repetir el criterio sobre el commit candidato autorizado antes de entregar.

## Backup, recuperacion y rollback

1. Antes de una entrega autorizada, conservar artefacto/version previa y configuracion compatible en almacenamiento protegido. El responsable DBA debe disponer de backup nativo consistente, cifrado, con timestamp, integridad, retencion y prueba de restauracion aislada; acordar RPO/RTO. Si se autorizan escrituras legacy, cubrir tambien ese destino y su consistencia con el nativo.
2. Revisar por separado migraciones pendientes y compatibilidad del binario anterior con el esquema nuevo. El runner [`run-schema-migrations.ts`](../scripts/run-schema-migrations.ts) registra migraciones `up`; no ofrece un rollback destructivo `down` automatizado. No borrar tablas/columnas, truncar, resetear ledger ni ejecutar SQL inverso improvisado.
3. Ante una regresion, retirar trafico y detener nuevas mutaciones mediante el procedimiento del supervisor/proxy aprobado. Preservar logs, version y evidencia. Mantener escrituras legacy apagadas; no asumir que el flag revierte datos ya escritos ni que desactiva mutaciones nativas.
4. Si el esquema es compatible, restaurar artefacto y configuracion anteriores, permitir cierre ordenado y validar live/ready, sesion, permisos y lecturas aprobadas antes de devolver trafico. Si no es compatible, bloquear el rollback binario y preparar correccion hacia adelante o restauracion DBA autorizada en destino controlado, con reconciliacion de cambios posteriores al backup.
5. [`restore-owner-from-backup.ts`](../scripts/restore-owner-from-backup.ts) es una recuperacion excepcional de identidad Owner desde snapshot con checksum fijo y configuracion de identidad vacia; escribe datos. No es backup general, recuperacion comercial ni mecanismo habitual de rollback. No ejecutarlo en este trabajo.

## Matriz de producto

Implementado significa codigo inspeccionado; no prueba despliegue, datos reales ni aceptacion del propietario. La [ley de producto](00-Producto-CRM-TINK-y-P0.md) y sus autorizaciones prevalecen sobre menus o maquetas.

| Superficie | Estado y limite verificado |
| --- | --- |
| Identidad, sesiones BFF, permisos, administracion y auditoria | Implementado en modulos API y paginas administrativas; integraciones/configuracion real y QA del destino se validan aparte. |
| Catalogos y expedientes de unidades | Implementado en modulos propios (`catalogs`, `projects`, `campaigns`, `classes`, `locations`, `subsidiaries`, `brokers`, `unit-files`); no equivale a expediente contractual completo de Formalizacion. |
| Inicio Formalizacion / resumenes reales | Aprobaciones requiere `formalizacion.home.approvals.read`; contratos y cinco etapas posteriores requieren rol efectivo `formalizacion` y `formalizacion.home.stages.read`. Owner hereda rol pero respeta denies. Un agregado de etapas, sin cache de contadores; bandejas vacias y list/send/revert no registrados. Solo cierres limita al ano. |
| Gestion/orden detallada, calendario y resumen de Formalizacion | DEMO local (`FormalizationFollowUpPreview`, `FormalizationOrderPreview`, `FormalizationCalendarPage`, `FormalizationSummaryPage`); escenarios y acciones simuladas no son operaciones persistidas ni correo enviado. |
| Ciclo de vida de ordenes de venta | Persistencia interna y auditoria en `sales-order-lifecycle.repository.ts`; no confundir con API habilitada de mutaciones/aprobaciones. |
| Solicitud de recuperacion de clave | Deshabilitada honestamente: 503 uniforme, proveedor de correo pospuesto. Finalizacion con tokens existentes conserva su contrato; no se acredita envio. |
| Leads y bitacora | Esquemas 031/032, lectura de timeline y comandos internos; no CRUD HTTP general ni copia historica. 033 no aplicada en el snapshot 49. |
| Inicio de Mercadeo | GET /marketing/home/summary registrado; lecturas protegidas de agregados leads/citas nativo y legacy bajo fallback. No calendario de gestion ni importaciones. Ver 46/48. |
| Usuarios creados por correo / Ventas | 43 perfiles nuevos, rol Ventas sin permisos, sin credenciales; 30 pending y 13 inactive. Operaciones autorizadas y auditadas anteriores, no repetir para validar un release. Ver 45. |
| Calendario compartido | 034 aplicada: ocho tablas vacias. Sin tipos configurados, comandos HTTP, workers de notificaciones o integracion Outlook. Su instalacion no habilita calendario operativo. Ver 47. |
| Contratos/firmas, supervision/cartera y automatizaciones comerciales | Flujos completos pendientes de implementacion autorizada y evidencia; una clase preparada o placeholder no demuestra operacion disponible. |

Fuentes adicionales: [`main.ts`](../src/main.ts), [`AppModule`](../src/app.module.ts), [`package.json`](../package.json), [`identity-rate-limit.ts`](../src/modules/crm/identity/identity-rate-limit.ts), [rutas frontend](../../frontend/src/routes/app-routes.ts) y [CI MySQL](CI-MySQL-Pruebas.md).
