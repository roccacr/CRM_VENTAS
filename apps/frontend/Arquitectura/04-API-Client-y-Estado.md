# 04 - API Client y Estado

## Cliente API

Todo acceso HTTP debe pasar por `services/api`.

Reglas:

- cliente tipado;
- manejo centralizado de errores;
- refresh/auth por capa comun;
- no repetir fetch/axios en componentes;
- no exponer estructuras legacy.
- no exponer estructuras NetSuite/Odoo.
- consumir permisos efectivos desde el API para mostrar u ocultar acciones.
- usar contratos canonicos del CRM para requests y responses.
- usar `publicId` canonico del CRM para rutas, query keys y acciones; nunca ids de proveedores externos.

## Cliente de identidad BFF

La capa vigente de identidad vive en `services/api` y `services/auth`. Todo login, logout, refresh y lectura de sesion pasa por esa capa:

- enviar siempre `credentials: "include"`;
- no aceptar ni guardar access token, refresh token, ID token ni token Microsoft;
- obtener CSRF desde el campo `csrfToken` que devuelve `/identity/session`; la cookie `crm_csrf` es `HttpOnly` y solo sirve para que el BFF compare cookie/header;
- enviar `X-CRM-CSRF-Token` automaticamente en requests mutables;
- manejar `401` con refresh single-flight: una sola llamada a `/identity/refresh`, cola de requests concurrentes y un unico retry;
- manejar `409` de `permissionVersion` igual que `401`: un solo refresh single-flight y, si tambien falla, limpiar cache/sesion visual y enviar a login nuevo;
- limpiar cache visual/server state al cerrar sesion;
- exponer funciones canonicas como `getSession`, `getMe`, `loginLocal`, `requestLocalReset`, `completeLocalReset`, `refreshSession` y `logout`.

Regla:

```txt
Los componentes React nunca llaman `fetch` directo para identidad; consumen hooks/servicios aprobados encima de `services/api`.
```

## TanStack Query

Uso obligatorio para:

- listados;
- detalle;
- busqueda;
- paginacion;
- mutaciones;
- invalidacion;
- reintentos;
- optimistic UI cuando sea seguro.

## Query keys

Definir query keys por modulo:

```txt
identity.session()
identity.me()
identity.contexts()
identity.contextHome(contextCode)
leads.list(filters)
leads.detail(leadPublicId)
activities.byEntity(entityType, entityPublicId)
calendar.events(range)
notes.byEntity(entityType, entityPublicId)
notes.byView(viewCode, filters)
notes.history(notePublicId)
reports.dashboard(filters)
```

Reglas:

- Las query keys de datos operativos deben incluir el `contextCode` cuando el resultado dependa del home, menu, area, rol activo o alcance visible.
- `contextCode` es un contexto operativo del CRM, no un id de NetSuite, Odoo, Kapso ni legacy.
- Si cambia `permissionVersion`, se invalidan `identity.me`, `identity.contexts` y cualquier cache que dependa del contexto activo.
- No usar `roles[0]` como query key ni como destino inicial.

## Contrato canonico

El frontend debe enviar JSON estandar del CRM. No debe enviar campos con nombres de NetSuite, Odoo o legacy.

Ejemplo conceptual para crear lead:

```json
{
  "nombre": "Cliente Ejemplo",
  "correo": "cliente@empresa.com",
  "telefono": "88888888",
  "proyectoId": 10,
  "campanaId": 25,
  "subsidiariaId": 3,
  "comentario": "Interesado en informacion",
  "origen": "web",
  "estadoInicial": "interesado"
}
```

El API decide si ese contrato se sincroniza con NetSuite, Odoo u otro sistema. El frontend no contiene mappers de ERP.

Si el API devuelve referencias externas por soporte o auditoria, el frontend no debe usarlas como identificadores principales de navegacion, cache o relacion entre entidades.

## Notas adhesivas

Las notas deben consumirse por `services/api` y TanStack Query.

Reglas:

- no guardar notas como fuente de verdad en Zustand;
- no guardar notas como fuente de verdad en localStorage;
- invalidar `notes.byEntity` cuando una nota se crea, edita, comparte, resuelve o elimina;
- invalidar `notes.byView` cuando cambia una nota asociada a la vista;
- persistir posicion visual por API cuando aplique;
- no llamar Kapso, correo ni Microsoft 365 desde componentes de notas.

## Zustand

Usar solo para:

- sidebar;
- contexto operativo activo;
- preferencias de tabla;
- filtros persistentes;
- layout;
- estado UI no remoto.

## Contexto operativo activo

El contexto operativo activo es estado visual temporal. Sirve para decidir que home, sidebar, menu y filtros iniciales se muestran despues de autenticar al usuario.

Fuente:

```txt
/identity/me -> roles + areas/equipos + permisos efectivos + contextos operativos visibles
```

Reglas:

- si el usuario tiene un solo contexto, el shell puede enviarlo directo a ese home;
- si el usuario tiene varios contextos, el shell debe mostrar selector en sidebar/navbar;
- cambiar contexto no cambia sesion, usuario, token, permiso final ni proveedor de autenticacion;
- el contexto activo puede recordarse como preferencia visual, pero debe validarse contra el API al cargar;
- si el API ya no devuelve ese contexto, se limpia la preferencia y se envia al selector o al estado sin permisos;
- cada modulo define su home y menu, pero el API decide si el usuario puede entrar.

Prohibido:

- guardar contexto activo como fuente permanente de autorizacion;
- crear una sesion por rol;
- decidir el home por `roles[0]`;
- depender de ids internos, NetSuite, Odoo, Kapso o legacy para elegir home;
- mezclar menus de modulos no autorizados solo porque el usuario tiene un rol alto.

## Seguridad de estado

- No guardar secretos.
- No guardar tokens en frontend bajo ningun flujo del CRM.
- No persistir datos sensibles innecesariamente.
- Limpiar cache al cerrar sesion.
- No guardar permisos como fuente final de verdad; siempre revalidar por API.
- No guardar payloads de proveedores externos como estado de UI.
- No guardar ids externos como fuente principal de identidad de UI.

## Permisos visibles

El frontend puede usar permisos efectivos para mejorar la experiencia:

- mostrar u ocultar botones;
- deshabilitar acciones;
- explicar por que una accion no esta disponible;
- adaptar menus por rol o permiso.

Pero el backend siempre valida la accion real. Un permiso visible en UI nunca sustituye un guard del API.
