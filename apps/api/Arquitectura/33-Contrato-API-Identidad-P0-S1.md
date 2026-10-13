# 33 - Contrato API de Identidad P0-S1

## Veredicto

Este documento define el contrato conceptual minimo que el API debe exponer en el runtime minimo de identidad autorizado por la ley vigente.

No es OpenAPI ejecutable por si solo.

Este documento no autoriza alcance por si mismo: la autorizacion vive en `00-Producto-CRM-TINK-y-P0.md`. La ley vigente `0.3.28` permite convertir este contrato en runtime minimo de identidad, endurecer login seguro en API, conectar la compuerta frontend de identidad contra el BFF, crear el primer owner real por bootstrap controlado, fijar crosswalk de proveedores externos, implementar Microsoft OIDC con cache MSAL cifrado y fijar ventana absoluta de sesion de 8 horas. Credenciales seed y modulos comerciales siguen fuera.

La finalidad es evitar improvisar mientras se construye identidad.

## Regla superior

```txt
El frontend nunca decide identidad, sesion ni permisos finales.
```

El API debe responder siempre con identidad canonica del CRM:

- usuario interno;
- sesion backend;
- roles activos;
- areas operativas/modulos activos;
- permisos efectivos;
- version de permisos;
- estado operativo del usuario.

## Lectura obligatoria

Antes de convertir este contrato en OpenAPI o codigo, leer:

```txt
00-Producto-CRM-TINK-y-P0.md
24-Seguridad-Autenticacion-BFF-OIDC-Local.md
27-Identidad-Usuarios-Roles-P0-S1.md
28-Matriz-Roles-Permisos-Areas-P0-S1.md
29-Modelo-Fisico-MySQL-Identidad-P0-S1.md
30-Identidad-Canonica-y-Referencias-Externas.md
31-Contrato-Identidad-y-Permisos-P0-S1.md
32-Seeds-Identidad-P0-S1.md
```

## Alcance autorizado

Entra en este contrato:

- consultar estado de sesion;
- consultar usuario actual;
- consultar roles visibles del usuario actual;
- consultar areas operativas/modulos del usuario actual;
- consultar permisos efectivos del usuario actual;
- refrescar sesion bajo patron BFF;
- cerrar sesion;
- preparar login Microsoft;
- preparar login local por invitacion/reset seguro.

No entra:

- leads;
- clientes;
- oportunidades;
- estimaciones;
- ordenes de venta;
- calendarios;
- notas;
- dashboard comercial;
- administracion completa de usuarios;
- CRUD completo de roles;
- CRUD completo de permisos;
- sincronizacion ERP;
- passwords en seeds.

## Endpoints conceptuales

Estos endpoints son nombres de contrato conceptual para el runtime minimo de identidad. No autorizan endpoints comerciales.

| Metodo | Ruta conceptual | Proposito |
| --- | --- | --- |
| `GET` | `/identity/session` | Indicar si existe sesion backend valida. |
| `GET` | `/identity/me` | Devolver usuario actual, roles, areas y permisos efectivos. |
| `GET` | `/identity/me/photo` | Servir foto cacheada del usuario actual desde almacenamiento interno del CRM. |
| `GET` | `/identity/sessions` | Listar sesiones activas del usuario actual sin exponer tokens. |
| `POST` | `/identity/sessions/:sessionPublicId/revoke` | Revocar una sesion activa propia. |
| `POST` | `/identity/logout` | Cerrar sesion backend y revocar cookies/sesion. |
| `POST` | `/identity/refresh` | Refrescar sesion BFF cuando exista refresh token valido. |
| `POST` | `/identity/microsoft/start` | Iniciar login Microsoft con PKCE/state. |
| `GET` | `/identity/microsoft/callback` | Recibir callback Microsoft y crear sesion backend. |
| `POST` | `/identity/local/login` | Login local solo si la identidad local esta activa. |
| `POST` | `/identity/local/request-reset` | Solicitar activacion/reset seguro de clave local. |
| `POST` | `/identity/local/complete-reset` | Completar activacion/reset seguro de clave local. |

Reglas:

- las rutas finales pueden cambiar al crear OpenAPI;
- el significado no debe cambiar sin actualizar este documento;
- ningun endpoint devuelve access token, refresh token ni id token al frontend;
- el frontend solo recibe datos de sesion y permisos, no secretos.

## Decision de token del contrato actual

Este contrato usa BFF con tokens opacos en cookies. No usa access token JWT entregado al frontend.

Regla vigente:

```txt
El frontend no guarda tokens. El API mantiene sesion, refresh, CSRF, permisos y auditoria.
```

Implicacion practica:

- `/identity/local/login` no devuelve JWT en JSON;
- `/identity/refresh` no devuelve JWT en JSON;
- `/identity/session` y `/identity/me` devuelven estado de sesion y datos de usuario/permisos;
- la cookie `crm_session` representa la sesion corta;
- la cookie `crm_refresh` representa la continuidad de sesion;
- la cookie `crm_csrf` `HttpOnly` y el `csrfToken` devuelto por JSON permiten probar que las mutaciones vienen del navegador que recibio el token CSRF del BFF.

Si en una fase futura se aprueba access token JWT efimero en memoria del frontend, este documento debe cambiar antes de tocar codigo.

## Regla de validacion por proveedor de autenticacion

Microsoft y login local son formas distintas de demostrar identidad antes de crear sesion CRM. Despues de autenticar, ambos terminan en la misma sesion BFF opaca del CRM.

Regla:

```txt
Microsoft se valida solo durante el flujo Microsoft OIDC. Login local no valida Microsoft. Requests normales validan sesion CRM, CSRF, permisos efectivos y estado interno, no tokens Microsoft.
```

Implicaciones:

- `/identity/microsoft/start` y `/identity/microsoft/callback` deben validar PKCE, `state`, issuer, audience, expiracion y claims del proveedor Microsoft antes de crear o vincular una identidad `microsoft`.
- La identidad `microsoft` no se crea con correo solamente; necesita el identificador estable del proveedor, por ejemplo `sub`/`oid`, cuando Entra ID real este configurado.
- `/identity/local/login` valida correo normalizado, estado de la identidad local, Argon2id, lockout, rate limit y auditoria interna. No consulta Microsoft.
- `/identity/refresh` rota tokens propios del CRM. Si la sesion fue creada por Microsoft y toca revalidacion/renovacion, el backend usa cache MSAL cifrado para `acquireTokenSilent`; si Microsoft exige interaccion, la sesion CRM se revoca y el usuario vuelve a `/identity/microsoft/start`.
- Un tercer proveedor futuro sigue la misma regla: valida su protocolo dentro de `src/integrations/<proveedor>` y luego emite sesion CRM propia, sin cambiar el contrato del frontend.

## Flujo operativo de Microsoft

1. El navegador llama `POST /identity/microsoft/start`.
2. El API genera `state`, `nonce`, PKCE verifier/challenge y guarda solo lo necesario del challenge en storage servidor/cookie firmada de corta vida.
3. El API redirige a Microsoft con scopes minimos `openid profile email offline_access`.
4. Microsoft vuelve a `GET /identity/microsoft/callback` con authorization code.
5. El API valida `state`, PKCE, `nonce`, issuer, audience, expiracion, tenant permitido y claims.
6. El API resuelve la identidad por identificador estable (`oid`/`sub` + tenant o `homeAccountId`), no por correo solamente.
7. Si la identidad existe y esta activa, el API crea sesion CRM propia y refresh CRM propio.
8. El API persiste cache MSAL cifrado en servidor, particionado por la cuenta Microsoft estable.
9. El controller redirige al `FRONTEND_ORIGIN` configurado sin entregar access token, refresh token, ID token ni cache Microsoft.

Regla de continuidad:

```txt
Refrescar la pagina no debe romper Microsoft. La cookie CRM mantiene la sesion; si la sesion requiere renovacion, el API usa MSAL silencioso desde cache cifrado.
```

La continuidad Microsoft no elimina el vencimiento absoluto del CRM: despues de 8 horas desde el login, la sesion CRM expira y el usuario debe iniciar login de nuevo para regenerar sesion, refresh, CSRF y revalidar Microsoft.

Si MSAL silencioso falla por `interaction_required`, cuenta revocada, consentimiento perdido o refresh Microsoft vencido/revocado:

- revocar la sesion CRM creada por Microsoft;
- revocar refresh tokens CRM asociados;
- auditar el evento sin guardar tokens;
- responder de forma neutral para que el frontend reinicie login Microsoft.

## Contrato de sesion

Respuesta conceptual de `/identity/session`:

```json
{
  "authenticated": true,
  "session": {
    "publicId": "01KCRM00000000000000000001",
    "status": "active",
    "expiresAt": "2026-09-25T22:00:00.000Z",
    "expiresInSeconds": 28800,
    "permissionVersion": 7
  },
  "user": {
    "publicId": "01KCRM00000000000000000002",
    "displayName": "<nombre-oficial>",
    "email": "<correo-oficial>",
    "profileImageUrl": null,
    "status": "active",
    "permissionVersion": 7
  }
}
```

Si no hay sesion:

```json
{
  "authenticated": false,
  "session": null,
  "user": null
}
```

Los valores entre `<...>` son placeholders documentales. No son datos reales y no deben seedearse.

Reglas:

- `publicId` es identificador canonico para API/frontend;
- no se usa `id_user` interno en respuestas publicas;
- no se usa id de NetSuite, Odoo, legacy CRM ni Kapso;
- `profileImageUrl` sera `null` cuando no exista foto cacheada; cuando Microsoft sincronice Graph, la foto se expone solo como referencia interna controlada por el API, no como URL temporal de Microsoft;
- `expiresInSeconds` es informativo para UI; la autoridad real es `expiresAt` validado por backend;
- `permissionVersion` sirve para detectar permisos desactualizados;
- si la version de permisos cambia, la sesion queda obsoleta; el cliente debe intentar un refresh single-flight y, si no obtiene sesion vigente, limpiar cache visual y pedir login nuevo.
- la cookie de sesion no guarda `publicId` plano como secreto; usa un token opaco criptograficamente aleatorio, guardado solo como HMAC en `token_hash_auth_session`.

## Cookies del contrato

| Cookie | Path | HttpOnly | Secure | SameSite | Persistencia | Regla |
| --- | --- | --- | --- | --- | --- | --- |
| `crm_session` | `/` | Si | Si | `Strict` | Maximo 8 horas absolutas desde el login. | Token opaco de sesion, hasheado en `sec_auth_session`. |
| `crm_refresh` | `/identity/refresh` | Si | Si | `Strict` | Rota dentro de la misma ventana maxima de 8 horas. | Token opaco de refresh, hasheado en `sec_refresh_token`; no extiende la sesion. |
| `crm_csrf` | `/` | Si | Si | `Strict` | Mientras sea valido para el estado de sesion. | Token `nonce.firma`; el BFF lo compara con `X-CRM-CSRF-Token`. El frontend recibe el valor vigente en JSON como `csrfToken`. |
| `crm_ms_oidc` | `/identity/microsoft/callback` | Si | Si | `Lax` | Corta vida, solo durante callback Microsoft. | Challenge OIDC firmado con PKCE verifier/state/nonce; usa `Lax` porque Microsoft vuelve al API desde otro sitio. |

Ninguna cookie debe guardar correo, nombre, rol, permisos, ids de proveedor externo ni ids internos de MySQL.

## Flujo operativo de login local

1. El navegador llama `GET /identity/session`.
2. El API responde sesion anonima/autenticada, emite `crm_csrf` firmado si falta o no corresponde al estado actual, y devuelve el valor vigente como `csrfToken`.
3. El navegador llama `POST /identity/local/login` con body `{ email, password }`, cookie `crm_csrf` y header `X-CRM-CSRF-Token`.
4. El rate limit revisa dos contadores independientes: IP efectiva y HMAC del correo.
5. El DTO normaliza correo con `trim` + lowercase y valida limites de longitud/formato.
6. El repository busca una identidad local `active` de un usuario `active`.
7. El service verifica password con Argon2id.
8. Si falla, audita `local_login_failed` con HMAC del correo y responde `401` neutral.
9. Si pasa, emite token de sesion opaco, refresh opaco y familia de refresh.
10. El repository crea `sec_auth_session` y `sec_refresh_token`.
11. El service audita `local_login_succeeded`.
12. El controller responde JSON de sesion/usuario/`csrfToken` y setea `crm_session`, `crm_refresh` y `crm_csrf`.

No se permite:

- devolver token en JSON;
- guardar password plano;
- diferenciar mensaje entre correo inexistente y clave incorrecta;
- crear usuarios reales inventados;
- seedear passwords.

## Flujo operativo de refresh

1. El navegador llama `POST /identity/refresh` con cookie `crm_refresh` y prueba CSRF.
2. El service hashea el refresh recibido con `AUTH_TOKEN_HASH_SECRET`.
3. El repository busca el refresh y cruza sesion, usuario e identidad.
4. Si no existe o no puede rotar, responde `401`.
5. Solo un refresh en estado `rotated` o `reused` se trata como reuso real: se revoca la familia y todas las sesiones activas del usuario.
6. Un refresh `revoked`, `expired` o ya consumido por una carrera normal responde `401` sin revocar sesiones ajenas.
7. Si el refresh activo esta vencido, se marca `expired`.
8. Si la sesion, usuario o identidad ya no esta activa, se revoca la familia y la sesion asociada.
9. Si `permissionVersion` no coincide, responde `409`; el cliente debe intentar un refresh single-flight y, si falla, cerrar sesion visual y pedir login nuevo.
10. Si todo es valido, marca el refresh anterior como `rotated`, actualiza hash de sesion e inserta un nuevo refresh activo sin extender el vencimiento absoluto de 8 horas.
11. El service audita `refresh_rotated` con el usuario canonico asociado.
12. El controller devuelve JSON de sesion/usuario/`csrfToken` y setea nuevas cookies.

Decision vigente: el sistema permite varias sesiones abiertas por usuario, pero el reuso real de refresh token (`rotated` o `reused`) es senal de robo y revoca todas las sesiones activas del usuario.

## Flujo operativo de logout

1. El navegador llama `POST /identity/logout` con `crm_session` y prueba CSRF.
2. El service hashea el token de sesion recibido.
3. El repository revoca la sesion activa si existe.
4. El repository revoca refresh tokens activos asociados a esa sesion.
5. El repository registra auditoria de logout dentro de la misma transaccion.
6. El controller limpia `crm_session`, `crm_refresh` y `crm_csrf`.

Logout es idempotente: si no hay sesion valida, responde exito para permitir limpiar el navegador.

## Contrato de usuario actual

Respuesta conceptual de `/identity/me`:

```json
{
  "session": {
    "publicId": "01KCRM00000000000000000001",
    "status": "active",
    "expiresAt": "2026-09-25T22:00:00.000Z",
    "expiresInSeconds": 28800,
    "permissionVersion": 7
  },
  "user": {
    "publicId": "01KCRM00000000000000000002",
    "displayName": "<nombre-oficial>",
    "email": "<correo-oficial>",
    "profileImageUrl": null,
    "status": "active",
    "permissionVersion": 7
  },
  "auth": {
    "primaryProvider": "microsoft",
    "availableProviders": ["microsoft", "local"],
    "currentProvider": "microsoft",
    "localStatus": "pending",
    "microsoft": {
      "homeAccountId": "home.tenant",
      "tenantId": "tenant",
      "lastSyncedAt": "2026-09-28T18:00:00.000Z",
      "interactionRequired": false
    }
  },
  "roles": [
    {
      "code": "jefe_general",
      "name": "Jefe General",
      "status": "active"
    }
  ],
  "orgUnits": [
    {
      "publicId": "01KCRM00000000000000000001",
      "code": "empresa",
      "name": "Empresa",
      "membership": "leader",
      "scope": "all_areas",
      "status": "active"
    }
  ],
  "permissions": [
    {
      "code": "user.view_self",
      "effect": "allow",
      "source": "role",
      "scope": "self"
    }
  ]
}
```

## Campos canonicos

### Usuario

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `publicId` | string | Public id canonico del usuario. |
| `displayName` | string | Nombre visible. |
| `email` | string | Correo principal. |
| `status` | string | `active`, `inactive`, `blocked`, `pending` o `archived`. |
| `permissionVersion` | number | Version actual de permisos del usuario. |

### Auth

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `primaryProvider` | string | `microsoft` por defecto. |
| `availableProviders` | string[] | Proveedores permitidos para el usuario. |
| `currentProvider` | string | Proveedor que creo la sesion actual: `local`, `microsoft` u otro futuro. |
| `localStatus` | string | `active`, `pending`, `inactive` o `blocked`. |
| `microsoft` | object/null | Estado seguro Microsoft: `homeAccountId`, `tenantId`, `lastSyncedAt`, `interactionRequired`. No contiene tokens. |

Regla P0-S1A:

- `availableProviders` solo anuncia login local cuando `localStatus` sea `active` o `pending`;
- una identidad local bloqueada/inactiva no debe mostrarse como proveedor disponible;
- la revocacion retroactiva de sesiones al bloquear una identidad debe mantenerse como regla obligatoria del runtime real, junto con token opaco, version de permisos y refresh seguro.

### Rol

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `code` | string | Codigo canonico del rol. |
| `name` | string | Nombre visible. |
| `status` | string | Estado del rol. |

### Area operativa / modulo

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `publicId` | string | Public id canonico del area operativa/modulo. |
| `code` | string | Codigo canonico del area operativa/modulo. |
| `name` | string | Nombre visible. |
| `membership` | string | `member`, `leader` o `assistant_leader`; `supervisor` solo puede aparecer por compatibilidad legacy, no como rol nuevo. |
| `scope` | string | `self`, `assigned`, `own_area`, `own_area_and_children` o `all_areas`. |
| `status` | string | Estado de la asignacion. |

### Permiso efectivo

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `code` | string | Codigo atomico del permiso. |
| `effect` | string | `allow` o `deny`. |
| `source` | string | `role`, `override` o `system`. |
| `scope` | string/null | Alcance efectivo del permiso. Debe ser `null` cuando `effect` sea `deny`, porque un deny directo niega el permiso completo y no representa alcance operativo. |

Regla:

```txt
deny gana sobre allow.
```

## Estados permitidos

Estados de usuario:

```txt
active
inactive
blocked
pending
archived
```

Estados de sesion:

```txt
active
expired
revoked
```

Estados de login local:

```txt
active
pending
inactive
blocked
```

## Errores conceptuales

| Codigo HTTP | Caso | Regla |
| --- | --- | --- |
| `401` | No autenticado. | No revelar si el correo existe. |
| `403` | Sin permiso efectivo. | Respuesta clara sin exponer reglas internas completas. |
| `409` | `permissionVersion` desactualizada. | El frontend debe intentar refresh una vez; si no obtiene sesion vigente, limpia cache, cierra sesion visual y pide login nuevo. |

Mensaje visible recomendado:

```txt
No se pudo completar la accion con los permisos actuales.
```

No usar mensajes como:

```txt
El usuario no existe.
La clave es incorrecta para este correo.
El rol X no tiene permiso Y por tabla Z.
```

## Reglas de seguridad

- BFF obligatorio.
- Cookies `HttpOnly`, `Secure`, `SameSite`.
- Prohibido tokens en frontend.
- Microsoft OIDC con PKCE y `state`.
- Login local con Argon2id. No se acepta bcrypt en este corte.
- Login local por invitacion/reset seguro.
- Correos locales normalizados con `trim` + lowercase y maximo 254 caracteres antes de validar, auditar, aplicar rate limit o autenticar.
- Password local con minimo 12 y maximo 128 caracteres antes de hashear.
- Token opaco de activacion/reset local con minimo 32 y maximo 256 caracteres.
- `POST /identity/local/login` y `POST /identity/local/request-reset` deben tener rate limit local por proceso con dos contadores independientes por endpoint: IP efectiva y HMAC del correo. Si cualquiera se excede, el request no llega al caso de uso.
- `POST /identity/local/complete-reset` debe tener rate limit por IP efectiva y HMAC del token opaco de reset, sin guardar el token crudo.
- El rate limit actual es por memoria de proceso; si se opera mas de una instancia del API detras de un balanceador, se debe configurar un store compartido antes de considerar equivalentes las cuotas globales.
- Las cuotas por IP y por correo deben configurarse por separado: `LOCAL_LOGIN_RATE_LIMIT_IP_MAX`, `LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX`, `LOCAL_RESET_RATE_LIMIT_IP_MAX` y `LOCAL_RESET_RATE_LIMIT_EMAIL_MAX`. El valor por IP debe ser mayor para soportar oficinas con NAT o proxy compartido.
- Todo endpoint `/identity/*` debe responder `Cache-Control: no-store` para evitar cachear sesion, correo, roles, areas o permisos efectivos. Esto incluye respuestas tempranas de guard, rate limit y rutas inexistentes bajo `/identity/*`.
- Refresh token rotado y guardado como HMAC.
- Reuso real de refresh token (`rotated` o `reused`) revoca la familia y las sesiones activas del usuario; tokens cerrados por logout/revocacion propia/expiracion responden como invalidos sin castigar otras sesiones.
- Endpoints mutables protegidos contra CSRF firmado; cookie/header deben coincidir, tener formato `nonce.firma` base64url y validar contra `COOKIE_SECRET`; si existe sesion, la firma queda ligada al token de sesion. Si falta, no coincide o no valida, responde `403`. `/identity/logout` limpia sesion, refresh y CSRF.
- CORS solo desde origen exacto del frontend.
- Errores sin stack traces ni SQL.

## Reglas de auditoria

Debe generar auditoria:

- login exitoso;
- login fallido;
- logout;
- refresh token reutilizado;
- usuario bloqueado;
- cambio de rol;
- cambio de area operativa/modulo;
- cambio de permiso personal;
- delegacion temporal queda prevista para una fase posterior, no para P0-S1A;
- denegacion aplicada;
- cambio de `permissionVersion`.

Regla de ubicacion:

- el caso de uso de aplicacion decide que evento se audita;
- si la accion necesita atomicidad con cambios de base de datos, el repository puede ejecutar la escritura de auditoria dentro de la misma transaccion, pero no decide por su cuenta eventos nuevos.

Cada evento debe poder responder:

```txt
quien, cuando, desde donde, que cambio, a quien afecto, con que motivo
```

## Pendientes reales

No bloquean este contrato conceptual, pero bloquean bootstrap real adicional:

1. Primer `owner` Roberto queda autorizado por la ley `0.3.21` y su crosswalk externo por la ley `0.3.22`, con login local `pending` hasta activacion/reset seguro.
2. Correo oficial del primer `jefe_general`.
3. Nombre visible del primer `jefe_general`.
4. Canal aprobado para entregar tokens de activacion/reset local.

## Bloqueantes antes de login productivo

Estos puntos bloquean declarar el login como productivo aunque el flujo local ya este implementado y probado contra el BFF:

1. Crear/bootstrap usuarios reales con correos oficiales aprobados; el primer `owner` Roberto queda autorizado por la ley `0.3.21` y su crosswalk externo por la ley `0.3.22`; no inventar usuarios.
2. Aprobar canal de entrega para tokens de activacion/reset local; el backend ya guarda solo HMAC y completa Argon2id.
3. Confirmar Microsoft productivo con redirect URI oficial, app registration de Entra ID, variables `MICROSOFT_*`, `SQL/004` aplicado y cache MSAL cifrado persistente en servidor.
4. Mantener la compuerta frontend conectada al BFF sin tokens en navegador; el corte actual ya implementa `/auth/login`, `/home/global`, login local, Microsoft, logout y foto/avatar.
5. Validar login exitoso, refresh exitoso, reuso de refresh y lockout con las identidades reales aprobadas para produccion.
6. Validar Microsoft en ambiente productivo: callback exitoso, refresh CRM con renovacion silenciosa MSAL, cache persistido tras reinicio del API y fallo controlado cuando Microsoft exige login interactivo.

## Prohibido

- inventar usuarios reales;
- usar correos ficticios;
- devolver ids internos de MySQL al frontend;
- devolver ids de NetSuite/Odoo/legacy como identidad principal;
- guardar tokens en frontend;
- crear permisos comerciales de lead antes de cerrar identidad;
- crear OpenAPI comercial;
- crear OpenAPI de identidad sin revisar este contrato y la ley vigente.

## Criterio de salida

Este contrato queda listo para convertirse en OpenAPI minimo de identidad cuando:

- `31-Contrato-Identidad-y-Permisos-P0-S1.md` siga vigente;
- `32-Seeds-Identidad-P0-S1.md` este aceptado como seed conceptual;
- no existan usuarios inventados;
- el frontend tenga contrato visual alineado;
- seguridad BFF siga siendo obligatoria;
- el alcance se mantenga dentro de la ley vigente `0.3.28`.

## Consulta paginada de auditoria

### Escritura transaccional del historial

Se reutiliza la columna JSON `audit_security_event.metadata_security_event`;
no se requiere una migracion ni modificar logs existentes. Las escrituras de
usuarios (alta, edicion, estado y acceso), roles (edicion, permisos y baja logica)
y catalogos (alta, edicion y estado) guardan `metadata.changeSet` version 1.
La identidad canonica del registro se guarda en `recordId`; el catalogo y el
modulo autorizado viajan fuera del snapshot como contexto del evento.

`before` y `after` son snapshots seguros completos de los campos de negocio del
agregado. Creacion usa `before:null`; `changes` contiene solo los campos que
cambiaron, con sus valores anterior y nuevo. Las relaciones se ordenan para no
registrar diferencias debidas solo al orden. Roles, areas, metodos de acceso,
excepciones y referencias externas forman parte del historial cuando aplican.
Nunca se copian contrasenas, hashes, tokens, cookies ni metadata arbitraria de
proveedores. Los eventos de autenticacion existentes siguen siendo eventos de
seguridad, no snapshots de credenciales.

El snapshot anterior se captura antes de mutar, bajo bloqueo del agregado.
Las lecturas de referencias de catalogos son lecturas actuales con bloqueo para
evitar antecesores obsoletos bajo REPEATABLE READ. Cambio y evento usan el mismo
executor transaccional: si falla cualquiera, ambos se revierten. No hay endpoint
de edicion o borrado de eventos. La inmutabilidad es del contrato del API; no se
afirma que un administrador de MySQL no pueda alterar la tabla.

La cobertura corresponde a los writers implementados de este API. Cambios
directos por SQL, integraciones u otros APIs no quedan capturados automaticamente:
requieren instrumentar esos writers o una estrategia CDC/outbox autorizada.
Expedientes de unidades es actualmente una consulta; no se inventan acciones CRUD.
Logs historicos sin snapshots no pueden recuperar valores anteriores perdidos.

Validacion MySQL opt-in, limitada a fixtures con rollback en `CRM_THINK_V2`:
`AUDIT_MYSQL_TESTS=1 pnpm exec vitest run test/audit/catalog-changelog.mysql.spec.ts test/audit/identity-changelog.mysql.spec.ts --maxWorkers=1`.
No ejecuta DDL, migraciones, adaptadores legacy ni deja registros de negocio.

- actorName en lista, detalle y busqueda prioriza metadata.actor.name solo si
  JSON_TYPE es STRING. El snapshot conserva el nombre al momento del evento
  aunque el usuario se renombre despues. Eventos antiguos sin snapshot o con
  nombre JSON no string usan el join actual de sec_user como fallback; ese
  fallback no garantiza un nombre historico inmutable. No se expone actor ni
  metadata cruda ni se modifica el historial existente.

- GET /audit/:publicId carga un detalle bajo demanda, con sesion y role.assign
  u Owner activo. Valida ULID antes del SELECT; devuelve 400 si es invalido y
  404 si no existe. /audit/options conserva su ruta estatica.
- Detalle: publicId, eventType, summary, reason, actorName, targetName,
  createdAt ISO, contexto publico descrito abajo y changeSet. Extrae campos
  especificos de contexto y metadata.changeSet, nunca metadata
  cruda, IP, User-Agent, HMAC o credenciales. Acepta JSON objeto/texto, valida
  version 1, entity, recordId, action y snapshots; reconstruye los cambios con
  buildAuditChangeSet y su whitelist de campos de negocio y relaciones.
- changeSet incluye version, entity, recordId, action, before, after y changes
  [{field,before,after}]. Sin snapshots validos devuelve changeSet:null; no
  reconstruye historia desde datos actuales. La lista no descarga snapshots.

- GET /audit/options requiere sesion y role.assign (o Owner activo). Devuelve
  modulos, secciones y catalogos, sin consultar filas de audit_security_event.
- GET /audit exige moduleCode y sectionCode; catalogCode y search son opcionales.
  limit es 100 por defecto y como maximo 200. No hay consulta global sin alcance.
- Respuesta: items con publicId, eventType, summary, reason, actorName, targetName,
  actorPublicId, actorRoles, recordedModule, recordedSection, moduleName,
  sectionName, catalogCode, catalogName, contextKnown, record, action, actionLabel
  y createdAt ISO; pagination contiene
  limit, returned, hasNext y nextCursor. No expone PK, metadata cruda, IP, HMAC ni
  User-Agent.
- Cursor base64url validado y ligado al alcance; seek por id_security_event
  descendente, LIMIT limit+1, sin COUNT ni OFFSET. No es un token de autorizacion:
  cada pagina vuelve a validar sesion y permiso.
- El modulo/seccion registrados tienen prioridad. Usuarios/Roles/Auditoria usan
  tipos de evento antiguos solo cuando falta sectionCode y el modulo es nulo o
  administracion. user_access_replaced con sectionCode=roles aparece en Roles,
  no en Usuarios. El fallback nunca inventa etiquetas de ubicacion historica.
  Auditoria y sistema incluye login, refresh, sesiones, logout y preparacion de identidades.
  Catalogos usa metadata.catalogCode; el modulo explicito debe coincidir. Una
  fila antigua sin modulo se muestra en los contextos compartidos de catalogos
  con contextKnown=false. No se reconstruye ni inventa su modulo historico.
- moduleCode y catalogCode se extraen con NULLIF(JSON_UNQUOTE(...), 'null'):
  JSON null y campos ausentes se leen como SQL NULL. Un modulo desconocido no
  se excluye por compararse con el texto 'null' ni se marca como conocido por
  la conversion booleana de ese texto. No se modifica metadata almacenada.
- Las demas secciones operativas requieren metadata.moduleCode y sectionCode.
  Un writer sin auditoria no genera filas ficticias en esta consulta.
- actorRoles proviene exclusivamente de metadata.actor.roles: pares code/name
  validados y sin claves adicionales. null significa no registrado/malformado;
  [] significa que no habia roles. Nunca se consultan membresias actuales.
  actorPublicId prefiere snapshot y admite fallback al ID canonico por FK.
- record={id,entity,name} usa referencias escalares de changeSet version 1 y
  nombre after.name/displayName o before.name/displayName; lista no descarga
  before/after completos. Sin snapshot, itemPublicId solo identifica catalogos,
  roleCode solo eventos role_*, o targetPublicId canonico por FK identifica
  usuario. roleCode de user_created es un rol asignado, no el registro afectado.
  Sin nombre historico se devuelve name:null; no se consulta nombre actual.
- action/actionLabel describen la mutacion registrada o el tipo de evento
  conocido; catalog_item_status_changed se presenta como Cambio de estado.
  search incluye ID/nombres historicos escalares y referencias antiguas, sin
  descargar snapshots ni metadata cruda. No se genera URL de registro.
- Consulta limitada con MAX_EXECUTION_TIME(1500). EXPLAIN local verificado:
  backward index scan de PRIMARY, joins actor/target eq_ref. Los predicados JSON
  no tienen un indice de alcance dedicado: un resultado pequeno no garantiza un
  escaneo pequeno en historiales grandes. Medir antes de agregar indices
  compuestos/generados por modulo/seccion/catalogo; no se ejecuta DDL ni backfill
  de logs en este cambio.
