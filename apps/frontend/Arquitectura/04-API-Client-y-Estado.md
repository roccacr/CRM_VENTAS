# 04 - API Client y Estado

Estado implementado 2026-10-27: [30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md). Los ejemplos de fases futuras siguientes no sustituyen los reportes conectados ni los comandos acotados ya presentes.

## Vigencia documental - 2026-10-22, corte f2dc4f1

Contrato mixto: BFF vigente y blueprint de estado remoto/comercial. `src/services/api/api-client.ts` usa `fetch` nativo centralizado; servicios por dominio lo reutilizan. TanStack Query y Zustand, sus query keys y ejemplos de leads/notas son propuestas sin dependencia instalada ni contrato comercial ejecutable. Un `409` solo renueva si identifica expresamente sesion con permisos obsoletos; los conflictos de negocio no repiten mutaciones. Ver [27](27-Entrega-Administracion-y-QA.md).

## Cliente API

Lecturas conectadas al 2026-10-23: `services/formalization/home-summary-service.ts` para seis etapas y `services/marketing/home-summary-service.ts` para leads/citas disponibles; usan `apiRequest`, validacion runtime y hooks React. No instalan TanStack Query ni activan acciones de contratos/calendario. Inventario: [27](27-Entrega-Administracion-y-QA.md).

Mercadeo concentra tipos, `parseMarketingHomeSummary` y `getMarketingHomeSummary` en `src/services/marketing/home-summary-service.ts`; no existe un parser separado. El parser exige version 1, periodo solicitado, zona `America/Costa_Rica`, fechas/rangos validos, conteos enteros no negativos y referencias coherentes. Rechaza totales inconsistentes, eventos duplicados y conversiones duplicadas o superiores a los leads de su cohorte; un payload invalido llega al estado de error, sin publicar un reporte parcial.

`src/modules/home/useMarketingHomeSummary.ts` identifica la lectura por usuario y periodo, comparte la promesa pendiente de esa clave y descarta resultados al desmontar o cambiarla. Al cambiar periodo oculta el valor anterior; Reintentar inicia otra lectura. No tiene polling ni recarga por foco. Vendedor/proyecto filtran localmente los agregados ya autorizados por API; solo el periodo forma parte de la URL HTTP. El directorio combina cohortes y enlaces de citas. La seleccion se reinicia al cambiar usuario y se reconcilia al recibir otro directorio, sin persistir filtros.

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
- manejar solo el `409` explicito de sesion con permisos obsoletos mediante refresh single-flight; otros conflictos no renuevan ni repiten la mutacion. Un fallo de transporte no demuestra revocacion de identidad; distinguirlo del rechazo explicito de sesion;
- limpiar cache visual/server state al cerrar sesion;
- compartir refresh solo dentro de la generacion vigente; login local, inicio Microsoft y logout invalidan el contexto anterior. Un request antiguo que falla no se renueva ni repite bajo otra sesion. Respuestas tardias de `/identity/me` y `/identity/refresh` se rechazan antes de publicar perfil o CSRF; esto no garantiza el orden de cookies de red en un navegador;
- notificar a `App` un refresh valido para releer el perfil y desmontar consumidores durante la comprobacion. Solo el rechazo 401 del refresh publica `rejected` y retira el shell; un fallo de transporte no equivale por si solo a revocacion;
- funciones runtime: `getIdentitySession`, `getIdentityProfile`, `loginWithLocalCredentials`, `startMicrosoftLogin`, `logoutIdentitySession` en auth-service y `refreshAuthenticatedSession` en api-client. No existe cliente de reset local operativo en auth-service; los nombres iniciales de reset eran propuesta, no una capacidad entregada.

Regla:

```txt
Los componentes React nunca llaman `fetch` directo para identidad; consumen hooks/servicios aprobados encima de `services/api`.
```

## TanStack Query - blueprint no instalado

Uso obligatorio para:

- listados;
- detalle;
- busqueda;
- paginacion;
- mutaciones;
- invalidacion;
- reintentos;
- optimistic UI cuando sea seguro.

## Query keys conceptuales futuras

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

Ejemplo historico conceptual para crear lead, no DTO ejecutable ni contrato estable:

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

Los enteros de proyecto/campana/subsidiaria del ejemplo no son identificadores autorizados de UI. El futuro formulario debe usar publicIds y el DTO aprobado entonces; no copiar este payload como contrato vigente.

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

## Zustand - blueprint no instalado

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
