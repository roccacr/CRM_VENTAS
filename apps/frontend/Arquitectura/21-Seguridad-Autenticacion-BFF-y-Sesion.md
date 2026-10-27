# 21 - Seguridad de Autenticacion BFF y Sesion Frontend

## Remediacion de sesion - 2026-10-23

El cliente HTTP publica la renovacion compartida al estado raiz: relee el perfil y desmonta los consumidores mientras comprueba autorizacion. Un refresh rechazado con 401 retira el shell y vuelve a login. Una generacion invalida respuestas de perfil anteriores, incluso durante checking; un limite de reinicio evita ciclos. El reintento explicito permite una comprobacion nueva. No se comparte un perfil global entre usuarios ni se persisten tokens.

Login, logout y refresh delimitan generaciones del cliente. Un refresh anterior no publica eventos ni reemplaza el CSRF en memoria despues de cambiar de contexto; su cleanup tampoco borra una renovacion posterior. Una operacion antigua que recibe 401/409 no se renueva ni repite bajo la nueva sesion. Login y bootstrap descartan perfiles tardios, y logout pendiente mantiene la UI anonima. Estas barreras de UI no certifican orden de cookies/red en un navegador real.

El arranque conserva query de negocio y hash. Solo elimina `microsoftStatus` reconocido en la ruta de login. El directorio acepta el estado MFA `unknown` y lo muestra como No verificado, sin inferir MFA por proveedor.

Evidencia y limites de la remediacion: [plan F01-F13](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md#plan-central-f01-f13---2026-10-23). Los cortes anteriores permanecen historicos.

## Vigencia documental - 2026-10-22, corte f2dc4f1

Reglas BFF vigentes con recomendaciones futuras de librerias. Runtime HTTP: `fetch` centralizado, sin TanStack Query/Zustand instalados. Solo el `409` explicito de sesion obsoleta usa refresh; conflictos de negocio no se repiten. Navegacion por menu usa `pushState`; auth/correcciones/limpieza usan `replaceState`; `popstate` lee la URL. Recuperacion de render/chunk requiere Reintentar explicito sin autorecarga; no hay esperas artificiales de 900/550 ms y si se conserva el cooldown real. Ver [29](29-Navegacion-Recuperacion-y-Seguimiento.md).

## Regla superior frontend

El frontend React no administra tokens. La sesion se consume mediante cookies seguras emitidas por el backend.

Este documento es obligatorio antes de crear login, logout, refresh, cliente API autenticado, proteccion de rutas o integracion Microsoft 365.

## Prohibido en frontend

Queda prohibido guardar tokens en:

- `localStorage`;
- `sessionStorage`;
- variables globales;
- Zustand;
- TanStack Query;
- React state;
- memoria persistente del navegador.

Aplica a:

- access token;
- refresh token;
- ID token;
- token de Microsoft;
- token interno del CRM;
- cualquier secreto de sesion.

## Patron permitido

El frontend debe:

- iniciar login por una ruta del backend;
- recibir estado de sesion desde el backend;
- enviar requests con cookies seguras;
- usar `credentials: "include"` cuando el cliente HTTP lo requiera;
- leer permisos efectivos desde el API;
- mostrar u ocultar UI solo como ayuda visual.

El frontend nunca decide autorizacion final.

## Permisos durante una sesion abierta

La UI puede mostrar acciones segun los permisos efectivos que devuelve el API, pero esa visibilidad no autoriza la accion.

Regla:

```txt
Si un permiso fue quitado, el API debe bloquear la accion aunque el boton todavia este visible por cache o estado viejo.
```

El frontend debe refrescar permisos efectivos cuando el API indique que la version de permisos cambio, la sesion fue actualizada o una accion fue rechazada por autorizacion.

El frontend no debe guardar permisos como verdad permanente. Los permisos visibles son una ayuda de UX; la autorizacion real vive en el API.

## Proteccion de rutas y URL directa

Regla:

```txt
Conocer o escribir una URL protegida no da acceso a la vista.
```

Antes de renderizar una ruta protegida, el frontend debe validar contra el estado devuelto por el API:

1. sesion activa;
2. usuario activo;
3. contexto operativo permitido;
4. permiso efectivo requerido por la vista;
5. alcance organizacional suficiente.

La ruta se contrasta con el modulo y el item de menu permitidos por el perfil efectivo. El nombre Owner/Jefe General por si solo no concede la vista. Al 2026-10-23 Owner puede recibir roles/modulos virtuales por politica backend; deny individual prevalece. Las etapas de Formalizacion exigen ademas rol efectivo activo Formalizacion y permiso de etapas allow sin deny.

Comportamiento esperado:

- `401`: enviar a login o iniciar flujo de refresh segun la regla BFF;
- `403`: mostrar estado no autorizado y no renderizar la vista;
- `409` explicito de sesion con permisos obsoletos: un unico refresh; otros conflictos de negocio no renuevan ni repiten la mutacion. Un fallo de red/servidor del refresh no demuestra revocacion y conserva el estado de problema recuperable;
- contexto no permitido: enviar al selector de contexto o mostrar estado sin permisos.

Regla critica:

```txt
El menu oculta o muestra por UX, pero el route guard visual bloquea por permiso efectivo y el API bloquea la accion real.
```

## Contexto operativo durante una sesion

Un usuario puede tener mas de un rol, area o contexto operativo disponible.

Regla:

```txt
Cambiar de contexto en navbar/sidebar no cambia la sesion, no cambia el usuario y no crea tokens nuevos.
```

El contexto seleccionado es solo estado visual permitido para organizar home, sidebar, menu y filtros iniciales.

Permitido:

- guardar temporalmente el contexto activo en estado UI;
- limpiar el contexto activo al cerrar sesion;
- recalcular contexto activo cuando cambie `permissionVersion`;
- enviar al usuario a seleccionar otro contexto si pierde permiso sobre el actual.

Prohibido:

- usar el contexto activo como autorizacion final;
- usar un rol hardcodeado para desbloquear pantallas;
- persistir el contexto como fuente permanente de verdad;
- crear una sesion separada por cada rol;
- pedir tokens Microsoft nuevos por cambiar de contexto.

Si el API responde `401`, `403` o `409`, el contexto activo debe considerarse sospechoso o vencido y el frontend debe seguir las reglas de sesion de este documento.

## Microsoft 365

El frontend no debe implementar flujos que expongan tokens en el navegador.

Reglas:

- no usar implicit flow;
- no guardar tokens MSAL en storage;
- no llamar Microsoft Graph directamente si la accion requiere regla CRM, auditoria o permisos internos;
- el backend maneja OIDC, PKCE, callback, estado, cookies y sesion.

## CSRF desde frontend

Para endpoints mutables, el frontend debe enviar el mecanismo CSRF que defina el backend.

Aplica a:

- `POST`;
- `PUT`;
- `PATCH`;
- `DELETE`.

El cliente API debe centralizar el envio del header/token CSRF. No duplicar esta logica en cada componente.

## Cliente React aprobado para login visual

La pantalla real de identidad ya esta autorizada para el corte BFF. El cliente React debe seguir este flujo:

1. `GET /identity/session` al iniciar la aplicacion, siempre con `credentials: "include"`.
2. Guardar en memoria el `csrfToken` devuelto por JSON y enviarlo en `X-CRM-CSRF-Token` para `POST`, `PUT`, `PATCH` y `DELETE`; no leer `crm_csrf` con `document.cookie` porque esa cookie es `HttpOnly`.
3. Consultar `GET /identity/me` para usuario, roles, areas y permisos efectivos.
4. Resolver contextos operativos visibles desde roles, areas y permisos devueltos por el API.
5. Ejecutar login local o Microsoft siempre contra el API, nunca contra Microsoft Graph directo desde componentes.
6. Ante `401`, ejecutar un unico refresh en vuelo contra `POST /identity/refresh`, encolar requests concurrentes y reintentar una sola vez.
7. Ante el `409` explicito de sesion con permisos obsoletos, usar refresh single-flight. No extenderlo a conflictos de negocio; distinguir rechazo explicito de identidad de fallo de transporte/servidor recuperable.
8. En logout, llamar `POST /identity/logout`, limpiar cache de server state y no borrar tokens manualmente porque React no los posee.

En `vite dev`, si la aplicacion se abre desde una IP de red local, el cliente
puede resolver el BFF con ese mismo hostname y el puerto aprobado del API para
que cookies, CSRF y CORS operen sobre la misma maquina de desarrollo. Produccion
sigue requiriendo `VITE_API_ORIGIN` explicito.

Regla:

```txt
El frontend puede coordinar estado visual de sesion, pero no puede custodiar secretos ni decidir autorizacion final.
```

Librerias recomendadas para evolucionar este corte:

| Uso | Decision |
| --- | --- |
| Server state | TanStack Query. |
| Cliente tipado | `openapi-typescript` + `openapi-fetch` cuando exista OpenAPI estable de identidad. |
| Wrapper HTTP inicial | `fetch` nativo centralizado o `ky` si reduce boilerplate sin ocultar CSRF/refresh. |

No usar Auth.js/NextAuth, Clerk, Auth0, Supabase Auth, `passport-jwt` ni MSAL para guardar tokens en el navegador sin una decision nueva de arquitectura.

## Errores y datos sensibles

La UI no debe mostrar:

- stack traces;
- SQL;
- errores internos del servidor;
- tokens;
- configuraciones internas;
- mensajes que permitan enumerar usuarios.

Para login local, el mensaje visible debe ser neutral:

```txt
Credenciales invalidas
```

## Estado local permitido

Zustand, React state y TanStack Query pueden guardar:

- usuario visible;
- preferencias de UI;
- permisos efectivos ya filtrados por API;
- estado de carga;
- filtros;
- layout;
- contexto operativo activo;
- datos de negocio devueltos por API.

No pueden guardar tokens ni secretos.

## Regla de implementacion

### Recuperacion de CSRF desincronizado (2026-10-26)

- El perfil visible no demuestra que las cookies de sesion sigan vigentes.
- Si el POST de renovacion recibe 403, el cliente consulta `/identity/session` para resincronizar CSRF y repite exclusivamente el refresh una vez, compartiendo la renovacion entre peticiones concurrentes. No reintenta mutaciones de negocio por un 403.
- Un 401 definitivo de renovacion invalida el acceso visible. Un segundo 403 o un fallo de red/servidor no se convierte en logout ni provoca un bucle automatico.
- Las respuestas CSRF anteriores a un logout/login no pueden sobrescribir la prueba del nuevo contexto. Se conserva la renovacion por el 409 especifico de permisos obsoletos.
- No se debilita el guard CSRF ni se amplian las ocho horas absolutas de sesion; al agotarlas se requiere iniciar sesion nuevamente.
- Regresiones: `test/app/api-client-expired-csrf.spec.ts`, `test/app/api-client-conflicts.spec.ts` y `test/app/App.spec.tsx`. Estas pruebas usan HTTP simulado; no acreditan una sesion real del navegador ni persistencia MySQL.

Ninguna pantalla, hook, store, cliente API o integracion puede contradecir este documento.

Si una libreria, skill o ejemplo recomienda guardar tokens en storage del navegador, esa parte se rechaza.
