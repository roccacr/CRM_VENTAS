# 05 - Seguridad, Auditoria y Observabilidad

## Controles contrastados - 2026-11-02

La ampliación de lectura global `mercadeo.reports.read_all` ([69](69-Mercadeo-Lectura-Global.md))
se evalúa además del permiso de cada reporte. Su ausencia/deny conserva el
alcance ordinario; no concede CRUD de Leads, acceso a órdenes ni edición de
eventos/notas. La definición056 no asigna el permiso automáticamente.

Los lookups de calendario y notas revalidan permiso del recurso antes de
ofrecerlo/guardar/mostrar etiquetas. La ACL de la nota y su invitación no permiten
ver datos de un registro restringido. `relatedRecords` se elimina del JSON público
del historial para no filtrar IDs que solo necesita la auditoría interna.

El receptor `POST /integrations/netsuite/local/order-events` tiene clasificación
`public` para no exigir una cookie de usuario, pero **no es anónimo**:
`LocalServiceTokenGuard` exige `NODE_ENV=development`,
`NETSUITE_LOCAL_EVENTS_ENABLED=true` y prueba Bearer contra un secreto configurado
de 64 caracteres hexadecimales. La comparación es de tiempo constante sobre
hashes; la excepción CSRF solo aplica al handler marcado y vuelve a validar esa
prueba de máquina. El cuerpo fija cuenta Sandbox/entorno/tipo, limita campos,
líneas/tamaño y coteja ID del snapshot; desconocidos se rechazan. Recibir no
persiste ni autoriza una escritura: devuelve `persisted:false`. No copiar secretos
en Markdown, logs ni ejemplos, ni confundir este receptor DEV con un webhook
productivo de sincronización. Contrato pendiente durable en [70](70-Plan-Sincronizacion-Ordenes-NetSuite.md).

## Consola local - 2026-10-30

Con `NODE_ENV=development`, Pino imprime JSON indentado y resume cada solicitud
con ID, metodo, ruta sin query, codigo HTTP y duracion, sin cabeceras HTTP.
La redaccion de secretos sigue activa. Fuera de desarrollo conserva JSON de una
linea y los serializadores anteriores. No se agregaron dependencias.
El evento `netsuite_local_order_received` indica recepcion validada y muestra
solo metadatos (ID, tipo, fecha, cantidades y `persisted:false`): no escribe en
ninguna BD ni acredita sincronizacion durable. Este cambio no requiere subir
archivos a NetSuite.

## Permisos y rutas actuales - 2026-10-27

Captacion exige `mercadeo.leads.read`; no exige `mercadeo.home.read` para acceder.
Ambos lectores de Mercadeo resuelven deny/alcance antes de leer las fuentes.
Formalizacion tiene lectura de seguimiento/timing y comandos HTTP registrados:
`formalizacion.contracts.send`, `formalizacion.contracts.revert` y
`formalizacion.orders.stage.update` son permisos diferentes. El selector no crea
grants de negocio automaticamente; una denegacion de send/revert tambien bloquea
el destino equivalente. Las validaciones transaccionales de version, alcance,
aprobaciones, firma e idempotencia siguen siendo necesarias tras AuthGuard.

La migracion 038 retira `mercadeo.appointments.read`, sus relaciones de rol y
excepciones por usuario, e incrementa versiones de permisos. El catalogo del API
omite tambien ese codigo retirado; la auditoria historica no se borra. No se
eliminan eventos, Calendario ni calculos de citas. Definicion/migracion no prueba
por si sola estado vivo; evidencia fechada de ejecucion en [53](53-Captacion-Leads-Reporte-Federado.md).
Fuente: `route-permission.ts`, `contract-transition.service.ts`,
`identity-access-management.repository.ts` y migraciones 037/038.

Estado implementado 2026-10-22: `CsrfGuard` precede al `AuthGuard` global default-deny. Cada handler Nest registrado declara `RouteSecurity`; las rutas publicas forman una allowlist explicita. Los handlers `permission` requieren ademas `RequirePermission`: el guard resuelve el descriptor y rechaza ausencia de grant o deny antes del handler. No sustituye membresia, controles condicionales, de fila o transaccion del servicio. Perfil reutilizado solo dentro del request por AsyncLocalStorage, instancia de servicio y token exacto; no cache global de autorizacion.

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

Orden base para calcular permisos, sujeto a la politica modular vigente:

1. permisos base de todos los roles activos;
2. permisos directos otorgados al usuario;
3. denegaciones explicitas del usuario, que siempre ganan.

El perfil implementado incorpora las politicas de [41 - Owner](41-Owner-Herencia-y-Denegaciones.md)
y [42 - Jefaturas](42-Jefaturas-Modulos-y-Permisos.md): Owner resuelve roles/modulos
activos virtuales y permisos activos base; General aplica la interseccion de su
plantilla editable y los modulos seleccionados para la persona. Los roles de area
conservan su techo modular. Un allow personal no abre modulos fuera de ese techo;
un deny individual prevalece tambien para Owner. Estas politicas no sustituyen
controles de recurso ni habilitan operaciones comerciales pendientes.

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

Separada conceptualmente de auditoria tecnica. La ruta registrada
`GET /audit/records/:recordId/timeline` usa la politica administrativa
`canReadAudit` y lee evidencia nativa de Leads, con paginacion acotada; no otorga
acceso por un permiso comercial de lead ni consulta legacy. La lectura federada
por origen y el flujo comercial siguen pendientes; ver [44](44-Bitacora-Legacy-y-Timeline.md).
No inferir que todo historial legacy esta disponible por existir esta ruta.

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
