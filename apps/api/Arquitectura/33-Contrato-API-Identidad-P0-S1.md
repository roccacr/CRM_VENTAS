# 33 - Contrato API de Identidad P0-S1

## Veredicto

Este documento define el contrato conceptual minimo que el API debe exponer en el runtime minimo de identidad autorizado por la ley `0.3.14`.

No es OpenAPI ejecutable por si solo.

Este documento no autoriza alcance por si mismo: la autorizacion vive en `00-Producto-CRM-TINK-y-P0.md`. La ley `0.3.14` permite convertir este contrato solo en runtime minimo de identidad; usuarios reales, credenciales seed y modulos comerciales siguen fuera.

La finalidad es evitar improvisar mientras se construye identidad.

## Regla superior

```txt
El frontend nunca decide identidad, sesion ni permisos finales.
```

El API debe responder siempre con identidad canonica del CRM:

- usuario interno;
- sesion backend;
- roles activos;
- areas/equipos activos;
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
- consultar areas/equipos del usuario actual;
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

## Contrato de sesion

Respuesta conceptual de `/identity/session`:

```json
{
  "authenticated": true,
  "session": {
    "publicId": "01KCRM00000000000000000001",
    "status": "active",
    "expiresAt": "2026-09-25T22:00:00.000-06:00",
    "permissionVersion": 7
  },
  "user": {
    "publicId": "01KCRM00000000000000000002",
    "displayName": "<nombre-oficial>",
    "email": "<correo-oficial>",
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
- `permissionVersion` sirve para detectar permisos desactualizados;
- si la version de permisos cambia, la siguiente accion protegida debe validar permisos nuevamente.
- cuando se implemente login real, la cookie de sesion no debe guardar `publicId` plano como secreto; debe usar un token opaco criptograficamente aleatorio, guardado solo como hash en base de datos.

## Contrato de usuario actual

Respuesta conceptual de `/identity/me`:

```json
{
  "user": {
    "publicId": "01KCRM00000000000000000002",
    "displayName": "<nombre-oficial>",
    "email": "<correo-oficial>",
    "status": "active",
    "permissionVersion": 7
  },
  "auth": {
    "primaryProvider": "microsoft",
    "availableProviders": ["microsoft", "local"],
    "localStatus": "pending"
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
| `localStatus` | string | `active`, `pending`, `inactive` o `blocked`. |

Regla P0-S1A:

- `availableProviders` solo anuncia login local cuando `localStatus` sea `active` o `pending`;
- una identidad local bloqueada/inactiva no debe mostrarse como proveedor disponible;
- la revocacion retroactiva de sesiones al bloquear una identidad debe existir antes de activar login real, segun condicion 10 de la ley vigente, junto con token opaco, version de permisos y refresh seguro.

### Rol

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `code` | string | Codigo canonico del rol. |
| `name` | string | Nombre visible. |
| `status` | string | Estado del rol. |

### Area/equipo

| Campo API | Tipo | Regla |
| --- | --- | --- |
| `publicId` | string | Public id canonico del area/equipo. |
| `code` | string | Codigo canonico del area/equipo. |
| `name` | string | Nombre visible. |
| `membership` | string | `member`, `leader`, `assistant_leader` o `supervisor`. |
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
| `409` | `permissionVersion` desactualizada. | El frontend debe refrescar `/identity/me`. |
| `423` | Usuario bloqueado. | No permitir operar CRM. |

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
- Login local con Argon2id preferido; bcrypt solo si se resuelve explicitamente su limite efectivo de 72 bytes antes de activar login real.
- Login local por invitacion/reset seguro.
- Correos locales normalizados con `trim` + lowercase y maximo 254 caracteres antes de validar, auditar, aplicar rate limit o autenticar.
- Password local con minimo 12 y maximo 128 caracteres antes de hashear.
- Token opaco de activacion/reset local con minimo 32 y maximo 256 caracteres.
- `POST /identity/local/login` y `POST /identity/local/request-reset` deben tener rate limit local por proceso con dos contadores independientes por endpoint: IP efectiva y HMAC del correo. Si cualquiera se excede, el request no llega al caso de uso.
- Las cuotas por IP y por correo deben configurarse por separado: `LOCAL_LOGIN_RATE_LIMIT_IP_MAX`, `LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX`, `LOCAL_RESET_RATE_LIMIT_IP_MAX` y `LOCAL_RESET_RATE_LIMIT_EMAIL_MAX`. El valor por IP debe ser mayor para soportar oficinas con NAT o proxy compartido.
- Todo endpoint `/identity/*` debe responder `Cache-Control: no-store` para evitar cachear sesion, correo, roles, areas o permisos efectivos. Esto incluye respuestas tempranas de guard, rate limit y rutas inexistentes bajo `/identity/*`.
- Refresh token rotado y guardado como hash.
- Reuso de refresh token revoca la familia.
- Endpoints mutables protegidos contra CSRF; cookie/header deben coincidir y tener formato `base64url` de 43 caracteres o responder `403`. `/identity/session` solo conserva cookie CSRF con ese formato y `/identity/logout` limpia sesion, refresh y CSRF.
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
- cambio de area/equipo;
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

No bloquean este contrato conceptual, pero bloquean bootstrap real:

1. Correo oficial del primer `owner`.
2. Nombre visible del primer `owner`.
3. Correo oficial del primer `jefe_general`.
4. Nombre visible del primer `jefe_general`.

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
- el alcance se mantenga dentro de la ley `0.3.14`.
