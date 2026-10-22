# 05 - Seguridad, Auditoria y Observabilidad

Estado implementado 2026-10-22: `CsrfGuard` precede al `AuthGuard` global default-deny. Cada handler Nest registrado declara `RouteSecurity`; las rutas publicas forman una allowlist explicita. La clasificacion `permission` no sustituye el permiso exacto y las validaciones del servicio. Perfil reutilizado solo dentro del request por AsyncLocalStorage, instancia de servicio y token exacto; no cache global de autorizacion.

GET/HEAD protegidos: defaults 120 consultas/usuario y 600/IP por 60 segundos, cache 5000 por store, por proceso; respuesta 429 con Retry-After. No es cuota distribuida. `/health/live` no hace IO; `/health/ready` prueba SELECT 1 nativo con plazo de respuesta de 1 segundo y una sonda pendiente compartida, sin cancelar el driver. Legacy no determina readiness. Errores 5xx usan respuestas publicas sanitizadas. Metricas ERP, jobs y atributos comerciales siguientes son direccion futura, no capacidades verificadas en produccion.

## Autenticacion

Microsoft Entra ID como metodo corporativo principal.

El login local esta implementado con Argon2id, bloqueo persistente, cuotas y auditoria. La solicitud de recuperacion sigue deshabilitada: con CSRF y DTO validos responde 503 uniforme, incluso al exceder cuota; no emite tokens ni envia correo. `complete-reset` conserva tokens existentes de un solo uso.

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
