# 05 - Seguridad, Auditoria y Observabilidad

## Autenticacion

Microsoft Entra ID como metodo corporativo principal.

Tambien se contempla autenticacion por correo y clave para usuarios autorizados por negocio. Este metodo debe implementarse con politica fuerte de contrasenas, hash seguro, bloqueo por intentos, auditoria y recuperacion controlada.

La regla obligatoria de autenticacion, cookies, OIDC, login local, CORS, CSRF, headers y errores vive en:

```txt
24-Seguridad-Autenticacion-BFF-OIDC-Local.md
```

Si este documento contradice a una regla general de seguridad, gana `24-Seguridad-Autenticacion-BFF-OIDC-Local.md` para todo lo relacionado con autenticacion y sesion.

## Autorizacion

RBAC + ABAC con permisos efectivos calculados por usuario.

Ejemplos de atributos:

- sucursal;
- equipo;
- propietario del lead;
- etapa comercial;
- monto;
- canal;
- rol administrativo.

## Modelo de permisos efectivo

Un usuario puede tener:

- uno o varios roles;
- permisos heredados por esos roles;
- permisos directos asignados a nivel de usuario;
- permisos explicitamente denegados a nivel de usuario.

Orden recomendado para calcular permisos:

1. permisos base de todos los roles activos;
2. permisos directos otorgados al usuario;
3. denegaciones explicitas del usuario, que siempre ganan.

Delegacion temporal avanzada queda prevista para fase posterior y fuera de P0-S1A.

Cuando se apruebe en una fase posterior, un permiso delegado debe registrar:

- quien delega;
- quien recibe;
- permiso delegado;
- alcance: global, sucursal, equipo, lead, oportunidad u otro recurso;
- fecha de inicio;
- fecha de expiracion opcional;
- motivo;
- estado: activo, revocado, expirado;
- quien revoca, cuando aplique.

Nadie debe poder delegar un permiso que no posee o fuera de su propio alcance.

## Auditoria

Toda accion sensible debe registrar:

- actor;
- accion;
- entidad;
- valores anteriores cuando aplique;
- valores nuevos cuando aplique;
- IP/user agent si esta disponible;
- correlation id;
- fecha.

## Bitacora comercial

Separada de auditoria tecnica. Debe ser visible para usuarios autorizados y explicar el historial comercial del lead/oportunidad.

## Observabilidad

- Logs JSON.
- Trace id/correlation id.
- Health checks.
- Metricas de latencia.
- Metricas de errores ERP.
- Dashboard de jobs fallidos.

## Reglas de seguridad

- No guardar secretos en codigo.
- No loggear tokens.
- No exponer ids legacy como ids internos.
- Validar DTOs.
- Paginacion obligatoria.
- Sanitizar exports.
- Confirmacion explicita para migraciones destructivas.
- Auditoria obligatoria al otorgar, delegar, denegar o revocar permisos.
