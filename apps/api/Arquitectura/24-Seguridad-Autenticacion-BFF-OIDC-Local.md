# 24 - Seguridad de Autenticacion BFF, OIDC y Login Local

## Regla superior de autenticacion

El CRM debe usar un patron BFF. El frontend no administra tokens. El backend NestJS es responsable de recibir, custodiar, rotar, validar y revocar tokens.

Esta regla aplica a Microsoft 365 OIDC, correo/clave local y cualquier proveedor futuro de autenticacion.

## Sesiones y tokens

Queda prohibido guardar en el frontend:

- access token;
- refresh token;
- ID token;
- tokens de Microsoft;
- tokens internos del CRM;
- secretos de sesion.

Prohibido usar:

- `localStorage`;
- `sessionStorage`;
- variables globales de JavaScript;
- Zustand, TanStack Query, React state o memoria del navegador como almacen de tokens.

La sesion del navegador se maneja con cookies emitidas por el backend.

Las tablas base de sesion y rotacion quedan definidas en:

```txt
sec_auth_session
sec_refresh_token
```

Ver `29-Modelo-Fisico-MySQL-Identidad-P0-S1.md` y `31-Contrato-Identidad-y-Permisos-P0-S1.md`.

## Autorizacion durante la sesion

La sesion abierta no congela permisos.

Regla:

```txt
El usuario puede seguir autenticado, pero cada accion protegida debe validar permiso efectivo actual.
```

El backend no debe autorizar acciones sensibles solo porque la sesion fue creada cuando el usuario tenia permiso.

Cuando un permiso, rol, denegacion, area o estado de usuario cambie:

- se debe invalidar o refrescar la autorizacion efectiva del usuario;
- se debe incrementar la version de permisos del usuario;
- se debe registrar auditoria;
- el siguiente request sensible debe usar permisos actuales.

No guardar permisos como verdad permanente dentro de tokens largos.

Para acciones criticas, el guard de autorizacion debe revalidar contra la version de permisos actual antes de ejecutar la accion.

Decision P0-S1A:

- bloquear o inactivar una identidad de autenticacion local/Microsoft no se anuncia como proveedor disponible;
- la revocacion retroactiva de sesiones ya abiertas por bloqueo de identidad debe existir antes de activar login real, segun condicion 10 de la ley vigente, junto con token opaco hasheado, rotacion de refresh y validacion de version de permisos;
- mientras tanto, el corte autorizado sigue revalidando usuario activo y permisos efectivos en cada request protegido.

## Cookies obligatorias

Toda cookie de sesion o token debe usar:

| Directiva | Regla |
| --- | --- |
| `HttpOnly` | Obligatoria. JavaScript no puede leer el token. |
| `Secure` | Obligatoria. Solo HTTPS. |
| `SameSite=Strict` | Regla por defecto. |
| `SameSite=Lax` | Solo si existe flujo cross-domain controlado y documentado. |
| `Path` | Debe ser el minimo necesario para cada cookie. |

La cookie de refresh token debe tener ruta restringida, por ejemplo:

```txt
/auth/refresh
```

## Vida util y rotacion

| Elemento | Regla |
| --- | --- |
| Access token | Maximo 15 minutos. |
| Refresh token | Rotacion obligatoria. |
| Reuso de refresh token | Invalida el token anterior y toda la familia de tokens. |
| Logout | Revoca la sesion activa y limpia cookies. |

## Microsoft 365 / Entra ID

El login con Microsoft debe cumplir:

- OAuth 2.1 / OIDC con Authorization Code + PKCE;
- `code_challenge` y `code_verifier` obligatorios;
- parametro `state` aleatorio, criptograficamente seguro y validado en callback;
- `redirect_uri` allowlist exacta en backend y Azure;
- prohibido usar comodines `*` en redirect URI;
- scopes minimos: `openid`, `profile`, `email`, `User.Read`;
- no pedir permisos que no tengan uso aprobado.

## Login local correo/clave

El login local es alternativa controlada, no atajo inseguro.

Reglas:

- Argon2id recomendado para hash de password;
- si se usa bcrypt, costo minimo 12 y debe resolverse explicitamente su limite efectivo de 72 bytes antes de activar login real;
- normalizar correo con `trim` + lowercase antes de validar, auditar, aplicar rate limit o autenticar;
- limitar correo a 254 caracteres;
- limitar password local a 128 caracteres antes de hashear para evitar payloads abusivos;
- limitar token opaco de activacion/reset local a 256 caracteres;
- nunca guardar ni procesar claves en texto plano;
- errores neutrales: `Credenciales invalidas`;
- no revelar si existe correo, usuario o dominio;
- rate limit por IP efectiva, con cuota mayor para no castigar oficinas bajo NAT o proxy compartido;
- rate limit por cuenta/correo, usando HMAC y cuota mas estricta;
- auditoria de intentos relevantes;
- bloqueo temporal o friccion progresiva ante abuso.

## CORS

La API solo puede aceptar origenes exactos aprobados.

Prohibido:

```txt
Access-Control-Allow-Origin: *
```

Reglas:

- origin allowlist exacta del frontend;
- `credentials: true` cuando se usen cookies;
- no reflejar automaticamente el `Origin` recibido;
- no habilitar origenes comodin por ambiente.

## CSRF

Todo endpoint mutable debe protegerse contra CSRF.

Aplica a:

- `POST`;
- `PUT`;
- `PATCH`;
- `DELETE`.

Patrones permitidos:

- Double Submit Cookie;
- token CSRF firmado;
- header personalizado obligatorio validado por backend.

Reglas de emision:

- `GET /identity/session` emite cookie CSRF solo si el navegador no trae una vigente con formato `base64url` de 43 caracteres;
- todo endpoint mutable responde `403` si cookie/header CSRF faltan, no coinciden o no tienen formato `base64url` de 43 caracteres;
- `POST /identity/logout` limpia cookie de sesion, refresh y CSRF;
- no rotar CSRF en cada lectura anonima porque rompe formularios abiertos y tabs simultaneas.

No se permite confiar solo en `SameSite` como unica defensa si el endpoint cambia estado.

## Headers HTTP

El backend debe usar cabeceras de seguridad equivalentes a Helmet.

Obligatorio:

| Header | Regla |
| --- | --- |
| HSTS | Forzar HTTPS. |
| CSP | Restrictivo, sin scripts no autorizados. |
| `X-Frame-Options` | `DENY`. |
| `X-Content-Type-Options` | `nosniff`. |
| `Referrer-Policy` | Restrictiva. |
| `Cache-Control` | `no-store` obligatorio para todo `/identity/*`. |

Las respuestas de identidad no deben quedar cacheadas por navegador ni proxy.
Esto aplica aunque el endpoint sea de lectura, porque puede devolver correo,
sesion, roles, areas o permisos efectivos. La cabecera debe aplicarse antes de
guards, rate limit y resolucion de rutas, para cubrir tambien `401`, `403`,
`429` y `404` bajo `/identity/*`.

## Validacion y sanitizacion

Toda entrada HTTP debe validarse contra DTOs o esquemas rigidos.

Reglas:

- eliminar propiedades no declaradas;
- rechazar payloads inesperados cuando aplique;
- validar ids, fechas, montos, enums y paginacion;
- prevenir SQL injection mediante consultas parametrizadas/Kysely;
- prevenir prototype pollution;
- no aceptar objetos libres sin contrato.

## Manejo de errores

Las respuestas al frontend o usuario final nunca deben exponer:

- stack traces;
- SQL;
- nombres internos de tablas;
- detalles de infraestructura;
- secrets;
- tokens;
- configuracion interna;
- informacion que permita enumerar usuarios.

El detalle tecnico va a logs internos sanitizados con `correlation_id`.

## Regla de implementacion

Ningun endpoint de autenticacion, sesion, refresh, logout, callback OIDC, CORS o CSRF puede implementarse si contradice este documento.

Si otra documentacion o skill propone guardar tokens en el frontend, usar implicit flow, relajar CORS con `*`, exponer errores internos o saltar CSRF, esa instruccion queda rechazada.
