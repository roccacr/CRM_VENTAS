# 37 - Auditoria, trazabilidad y conflictos

## Asignacion de clave inicial en alta - 2026-10-13

`POST /identity/users` admite `password` opcional de solo escritura; OpenAPI
marca writeOnly/password y limites 12-128. Solo `CreateSystemUserDto` lo admite;
no existe cambio de clave por el DTO de edicion. El actor necesita ambos
permisos `user.create` y `user.assign_password`, y el destino debe tener metodo
local. Password ausente conserva la activacion pendiente; vacio, null, solo
espacios, comun o fuera de limites se rechaza, sin recortar una clave valida.

La clave se hashea antes de llegar al repositorio. Persistencia recibe solamente
`passwordHash` e inserta la identidad local activa en la misma transaccion que
usuario, roles, modulos y auditoria. El usuario pending pasa a active si se
asigna clave; inactive explicito no se activa. Sin clave no cambia el flujo
anterior. La respuesta publica no incluye clave ni hash. Auditoria registra
`localPasswordAssigned: true/false`, actor, motivo y snapshot seguro del alta;
no se incluye el secreto en cambios antes/despues. Pino ya censura
`req.body.password`; no registrar cuerpos ni inputs del repositorio manualmente.

Migracion `202610130018_user_assign_password_permission`: permiso sensible en
Usuarios, grant inicial solo Owner, version de permisos de titulares Owner
incrementada una vez para revalidacion, auditoria transaccional y rerun no-op.
No agrega grants al rol Formalizacion. Rechaza semantica incompatible de un
codigo preexistente; no reemplaza seeds ni modifica claves existentes.

Pruebas: `identity.service.spec.ts` verifica privilegios separados, hash y
politica; `local-auth-dto.spec.ts` entradas invalidas;
`test/audit/identity-changelog.mysql.spec.ts` con AUDIT_MYSQL_TESTS=1 comprueba
hash verificable, identidad local elegible para login, exclusiones de auditoria
y respuesta, y rollback de usuario/credencial ante fallo de auditoria.
`test/migrations/user-password-permission.mysql.spec.ts` con
PASSWORD_PERMISSION_MYSQL_TESTS=1 comprueba grant exclusivo, versiones,
idempotencia y rollback. Son fixtures revertidos, no cuentas duraderas.

No se implementa aqui clave temporal, caducidad especial o cambio forzado. Si
se requieren despues, deben disenarse como flujo restringido propio; no simular
que ya existen por llamar temporal a una clave inicial.

Evidencia 2026-10-13: migracion 018 aplicada exclusivamente en CRM_THINK_V2;
consulta posterior confirma grant activo solo Owner. API: 404 pruebas aprobadas,
typecheck/build y lint/formato de archivos modificados aprobados. MySQL: dos
casos de migracion y dos de credencial/auditoria aprobados, todos rollback-only.
Frontend check completo: 273 pruebas y formato/lint/typecheck/build aprobados.
Check global sigue bloqueado por formato preexistente de
`test/unit-files/unit-files-search.spec.ts`; no se corrigio ese archivo ajeno.
El primer typecheck simultaneo con la suite API encontro un fixture temporal
ya eliminado por la prueba; reejecutado despues de terminar la suite aprobo.

Navegador real Owner: campo Contraseña inicial visible al abrir Nuevo usuario,
sin ingresar secretos ni enviar el formulario. Captura:
`C:/codex-data/visualizations/initial-password/authorized-input.png`. Revision
de seguridad independiente sin hallazgos bloqueantes tras corregir blancos y
versionado de permisos. Login real con una cuenta nueva queda a prueba manual
del propietario; ninguna cuenta real ni contrasena existente fue modificada.

Actualizado: 2026-10-13. Implementacion: `src/modules/crm/audit`, repositorios de identidad y de catalogos; UI en `apps/frontend/src/modules/administration/pages`. Alcance: escritores instrumentados del nuevo API, no un registro universal de todas las escrituras externas a MySQL.

## Que se registra y por que

El evento responde quien actuo, bajo que roles en ese momento, en que modulo/seccion, sobre que registro, que accion realizo y cuales fueron los valores anterior/nuevo. El motivo del operador se conserva separado del tipo tecnico del evento.

Se reutiliza `audit_security_event` y su columna JSON `metadata_security_event`; no se necesita una tabla paralela por catalogo para el changelog. La metadata guarda contexto y `changeSet` versionado. Los endpoints no exponen metadata arbitraria, tokens, IP o User-Agent. El servicio existente puede conservar datos de red internos con limites de longitud, pero no forman parte de la respuesta publica de consulta.

`SecurityAuditService.captureActor` captura identidad, nombre y roles activos/no revocados antes de modificar accesos. Asi un cambio del propio actor no reescribe la atribucion. Eventos anteriores sin snapshot no permiten conocer con certeza los roles historicos; la UI no usa roles actuales como sustituto. El nombre historico tiene precedencia; en eventos antiguos el lector admite fallback al usuario relacionado, que puede haber cambiado de nombre.

## Escritura transaccional

1. Autorizar y validar la operacion; resolver el actor real en backend.
2. Bloquear el registro pertinente antes de leer el snapshot, evitando un antes obsoleto bajo REPEATABLE READ.
3. Leer valores previos y capturar actor/contexto.
4. Aplicar mutacion, referencias y cambios de acceso necesarios.
5. Leer estado final y construir `buildAuditChangeSet`.
6. Insertar evento en la misma transaccion; cualquier fallo revierte los cambios.

En creacion `before` es null. Una actualizacion conserva ambos snapshots y diferencias por campo. Desactivacion/reactivacion usa acciones expresas. La eliminacion logica de rol conserva su estado anterior y marca el posterior eliminado. Este vocabulario no crea permisos o endpoints de borrado nuevos.

Campos admitidos: name, displayName, email, detail, description, status, deleted, roleCodes, orgUnitCodes, accessMethods, permissionCodes, permissionOverrides y externalReferences. Relaciones usan un subconjunto seguro de claves; arrays se normalizan para evitar diferencias falsas por orden. Credenciales y metadata arbitraria quedan fuera. Por ello, "todos los detalles" significa datos de negocio permitidos, no passwords, hashes, cookies o secretos.

Ejemplo ilustrativo del cambio guardado, no un evento real ni una respuesta completa:

```json
{
    "version": 1,
    "entity": "user",
    "recordId": "ID_PUBLICO_CRM",
    "action": "update",
    "before": { "displayName": "Roberto" },
    "after": { "displayName": "Roberto Carlos" },
    "changes": [{ "field": "displayName", "before": "Roberto", "after": "Roberto Carlos" }]
}
```

Escritores cubiertos: creacion/edicion/estado de usuarios, reemplazo de acceso del usuario, renombrado/eliminacion logica/permisos del rol y mutaciones de los seis catalogos dedicados mas persistencia generica instrumentada. Los expedientes no tienen mutaciones de inventario en esta fase. No se inventa un antes/despues para un evento de login ni para un registro historico que nunca lo guardo.

## Contrato de lectura y rendimiento

| Endpoint                                                           | Funcion                                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `GET /audit/options`                                               | Modulos, secciones y catalogos; no descarga eventos                     |
| `GET /audit?moduleCode=administration&sectionCode=users&limit=100` | Pagina obligatoriamente scoped; search, catalogCode y cursor opcionales |
| `GET /audit/:publicId`                                             | Detalle bajo demanda y changeSet seguro, o null cuando no existe        |

Autorizacion: Owner activo o permiso efectivo `role.assign`. Modulo/seccion se validan juntos; catalogCode solo aplica a catalogs. Limite default 100, maximo 200. El cursor vincula modulo, seccion, catalogo y busqueda; cambiar el alcance invalida el cursor. El lector ordena por PK descendente, obtiene limit+1, devuelve `items` y `pagination: {limit, returned, hasNext, nextCursor}`. No ejecuta COUNT global ni trae todo el historial.

La lista incluye publicId, eventType, summary, reason, actorName, targetName, createdAt, actorPublicId, actorRoles, recordedModule, recordedSection, nombres visibles de contexto, catalogCode, contextKnown, record `{id, entity, name}`, action y actionLabel. El detalle agrega changeSet; no trae snapshots completos en cada fila. Consultas parametrizadas; hint MAX_EXECUTION_TIME(1500). Esto limita exposicion y tiempo solicitado, pero no demuestra un indice eficiente para filtros JSON o busqueda substring: medir EXPLAIN antes de optimizar produccion.

Historial antiguo: se admite clasificacion compatible por tipo de evento/codigo donde falta contexto. La coincidencia con el filtro no prueba que el evento guardo ese contexto; contextKnown permanece falso si no esta registrado. Nunca reconstruir valores previos por suposicion.

## Presentacion y referencia al registro

La vista exige elegir modulo y seccion antes de buscar. Tabla y drawer separan actor/roles, ubicacion, registro, accion, fecha, motivo y comparacion anterior/nuevo. El frontend usa `audit-event-description.ts`: "Se actualizo la campana" en vez de "Campaign catalog_item_updated.". Los codigos tecnicos se conservan para trazabilidad interna; las etiquetas no modifican eventos guardados.

El drawer muestra el ID y nombre historico del registro exacto, pero el enlace actual Abrir seccion navega solo a una ruta de seccion conocida: no es un deep link que abra automaticamente ese registro. La navegacion directa al registro queda pendiente si se requiere. No asumir que el registro aun existe ni que su nombre actual es el historico. La autorizacion del destino se vuelve a comprobar; un enlace no concede acceso. Cuando faltan datos historicos, mostrarlo explicitamente.

## Conflictos de Roles y seguridad

La causa confirmada del doble 409 fue `services/api/api-client.ts`: trataba todo 409 como sesion obsoleta y repetia la solicitud. Ahora distingue:

| Respuesta                                                             | Comportamiento                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| 401                                                                   | Flujo existente de renovacion compartida y un solo reintento |
| 409 con mensaje exacto `La sesion requiere revalidacion de permisos.` | Revalida/renueva una vez y reintenta                         |
| Otro 409                                                              | No renueva ni repite; muestra el mensaje controlado del API  |
| Error nativo de red/reset                                             | No repite la mutacion; resultado de guardado no confirmado   |

La coincidencia de mensaje es un acoplamiento explicito al contrato actual: cambiarlo en API exige actualizar cliente y regresiones. Se preservan CSRF y la renovacion compartida entre solicitudes. No se implemento idempotency key ni se garantiza exactly-once ante cortes de red.

Owner sigue protegido: no degradar sus permisos base ni permitir autoquitarse Owner o auto-denegar permisos protegidos. Un rechazo legitimo permanece rechazado; el arreglo mejora manejo y explicacion, no elimina reglas. El cuerpo exacto del 409 historico de la captura no se recupero, por lo que no se atribuye ese caso concreto a una proteccion especifica.

RolesSecurityPage usa Notification.title de Ant Design, eliminando la advertencia por message. Errores fetch conocidos muestran que se debe verificar el estado antes de volver a intentar. Los resets historicos no se reprodujeron en la revision anterior y su causa servidor/red sigue sin confirmar.

## Pruebas y extension futura

- `test/audit/audit-change-set.spec.ts`: snapshots seguros y diferencias.
- `test/audit/catalog-changelog-locking.spec.ts`: orden de bloqueo y snapshot.
- `test/audit/identity-change-history.spec.ts`: historial de cambios de identidad.
- `test/audit/audit-read.spec.ts`: alcance, permisos, contexto y lectura segura.
- `test/audit/catalog-changelog.mysql.spec.ts` y `identity-changelog.mysql.spec.ts`: suites opt-in de transaccion/rollback; no habilitar sin revisar condiciones.
- Frontend `test/administration/SecurityAuditPage.spec.tsx` y `audit-event-description.spec.ts`: lectura y texto visible.
- Frontend `test/app/api-client-conflicts.spec.ts`: conflicto de negocio sin replay, version obsoleta con un reintento, fallo de red sin replay.

Pendiente: pruebas manuales autorizadas end-to-end, politica de retencion y volumen, captura de cambios de otras APIs, evaluacion de indices y cualquier nuevo escritor. El historial anterior a la instrumentacion no puede completarse retroactivamente sin una fuente de evidencia real. Append-only es el comportamiento del servicio; no equivale a almacenamiento criptografico inalterable ni proteccion contra un administrador de base de datos.
