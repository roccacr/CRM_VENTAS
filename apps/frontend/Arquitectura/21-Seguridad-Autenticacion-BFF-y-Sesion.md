# 21 - Seguridad de Autenticacion BFF y Sesion Frontend

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
- datos de negocio devueltos por API.

No pueden guardar tokens ni secretos.

## Regla de implementacion

Ninguna pantalla, hook, store, cliente API o integracion puede contradecir este documento.

Si una libreria, skill o ejemplo recomienda guardar tokens en storage del navegador, esa parte se rechaza.
