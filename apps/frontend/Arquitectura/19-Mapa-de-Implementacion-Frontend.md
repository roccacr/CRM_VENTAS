# 19 - Mapa de Implementacion Frontend

## Proposito

Este documento responde una pregunta practica:

```txt
Si voy a construir una pantalla, componente, hook o cliente API, en que carpeta va?
```

Debe usarse antes de crear pantallas, formularios, tablas, filtros, modales, estados locales o integraciones visuales.

Actualizacion de orden: antes de implementar el vertical de leads, se debe cerrar `22-UX-Identidad-Usuarios-Roles-P0-S1.md`.

El primer corte ejecutable actual es identidad. `20-Alcance-P0-Vertical-Leads-Frontend.md` aplica despues de cerrar la compuerta de identidad, no antes.

## Regla principal

El frontend es una experiencia operativa para usuarios de Costa Rica.

El frontend:

- muestra datos canonicos del API;
- captura formularios canonicos;
- muestra permisos efectivos recibidos del API;
- ayuda al usuario a ejecutar acciones;
- nunca calcula la autorizacion final;
- nunca conoce el proveedor ERP activo;
- nunca usa ids de proveedor externo como identidad principal de UI;
- nunca usa estructuras legacy como contrato visual.

## Mapa de carpetas

| Carpeta | Que va aqui | Que no va aqui | Leer antes |
| --- | --- | --- | --- |
| `src/modules/auth` | Compuerta visual de identidad, sesion, usuario actual y permisos visibles. | Reglas finales de autorizacion del backend. | `21`, `22`. |
| `src/modules/home` | Shell global autenticado aprobado para `/home/global`, selector visual de perfiles/contextos, menu dinamico y vista tecnica de sesion/permisos devueltos por API. | Mostrar dashboards comerciales reales, decidir autorizacion final o crear acciones de negocio. | `00`, `14`, `24`. |
| `src/modules/sales/dashboard` | Dashboard de ventas, tarjetas, filtros y drill-down. | Reglas de conteo calculadas en UI. | `03`, `17`, `18`. |
| `src/modules/sales/leads` | Lista, detalle, formularios y acciones de leads. | Oportunidades, estimaciones u ordenes completas. | `10`, `11`, `12`, `17`, `18`, `23`. |
| `src/modules/sales/opportunities` | Pipeline y vistas de oportunidad. | Formularios de lead puro. | `13`. |
| `src/modules/sales/estimates` | Pantallas de estimaciones. | Ordenes de venta. | `13`. |
| `src/modules/sales/sales-orders` | Pantallas de ordenes de venta, pre-reserva y reserva. | Formalizacion operativa completa. | `13`, `14`. |
| `src/modules/marketing` | Home y flujos de mercadeo cuando se aprueben. | Seguimiento operativo de ventas o llamadas directas a proveedores. | `14`, `23`. |
| `src/modules/formalizations` | Flujo de formalizacion cuando se apruebe alcance. | Leads iniciales o dashboard de ventas. | `14`. |
| `src/modules/collections` | Home y flujos financieros/cobros cuando se aprueben. | Cobros directos contra ERP o NetSuite desde React. | `14`, `23`. |
| `src/modules/management` | Home de jefatura, supervision y acceso consolidado por permisos. | Duplicar pantallas operativas de cada area. | `14`, `21`, `24`. |
| `src/modules/support` | Home de TI/soporte y herramientas aprobadas. | Acceso total por nombre de rol o secretos de infraestructura. | `14`, `21`, `24`. |
| `src/modules/calendar` | Calendarios por dominio, eventos, citas y estados de sync. | Llamadas directas a Microsoft Graph para reglas CRM. | `15`. |
| `src/modules/notes` | Notas adhesivas, paneles, editor y canvas. | Envio directo por proveedores externos. | `16`. |
| `src/modules/permissions` | Componentes para mostrar/ocultar acciones segun permisos efectivos. | Reglas finales de autorizacion. | `09`. |
| `src/components/ui` | Botones, inputs, badges, dialogs, tooltips genericos. | Logica de negocio. | `03`. |
| `src/components/data-table` | Tabla generica server-side. | Consultas directas a API especificas de un modulo. | `03`, `04`. |
| `src/services/api` | Cliente HTTP tipado y funciones API por contrato canonico. | Transformaciones de proveedores externos, SDKs de ERP o queries directas. | `04`, `10`, `23`. |
| `src/services/auth` | Helpers frontend de sesion visual aprobados. | Guardias backend, tokens persistidos, reglas finales de permisos o llamadas directas a Microsoft Graph. | `09`, `21`, `22`. |
| `src/stores` | Estado UI pequeno: filtros, layout, preferencias. | Cache de servidor o permisos finales. | `04`. |
| `src/types` | Tipos canonicos compartidos en frontend. | Tipos de proveedores externos. | `10`, `23`. |

## Shell, home y sidebar por contexto

La aplicacion vigente tiene un shell comun despues de `auth` para identidad. Las pantallas comerciales por contexto siguen bloqueadas hasta una fase posterior.

Ese shell debe resolver:

1. sesion actual;
2. usuario actual;
3. roles visibles;
4. areas/equipos visibles;
5. permisos efectivos;
6. contextos operativos disponibles;
7. contexto inicial;
8. home y menu del contexto.

Regla:

```txt
El shell decide que home mostrar; el modulo decide como se ve ese home; el API decide si el usuario puede entrar.
```

Comportamiento esperado:

- si el usuario solo tiene `sales`, entra a home de ventas;
- si tiene `marketing` y `formalizations`, aparece selector y menus separados;
- si tiene `management`, puede ver vistas consolidadas y enlaces a modulos permitidos;
- si tiene `support`, puede acceder a herramientas de soporte solo con permisos efectivos;
- si un permiso desaparece durante la sesion, el API bloquea y el frontend refresca/limpia segun `21`.

No se permite:

- elegir home solo por `roles[0]`;
- hardcodear que `owner`, `jefe_general` o `support` ven todo;
- copiar el mismo componente en carpetas por rol;
- guardar el contexto como verdad permanente;
- navegar por ids de NetSuite, Odoo, legacy CRM o Kapso.

Regla de rutas protegidas:

```txt
El usuario puede conocer la URL, pero la ruta solo renderiza si el API confirma sesion, contexto, permiso efectivo y alcance.
```

Si la ruta pertenece a una vista global, solo `owner`, `jefe_general` o un rol equivalente con permiso efectivo vigente puede verla. Si no cumple, la UI debe responder como no autorizado y el API debe bloquear cualquier accion real.

## Flujo permitido de datos

```mermaid
flowchart TD
  Page[Page/module] --> Hook[Query/mutation hook]
  Hook --> ApiClient[services/api]
  ApiClient --> Backend[API canonico]
  Backend --> Page
```

Regla:

```txt
UI -> services/api -> API
```

Nunca:

```txt
UI -> base de datos
UI -> ERP
UI -> proveedor de mensajeria
UI -> reglas de autorizacion final
UI -> CRM viejo
UI -> Microsoft Graph para reglas CRM
```

Regla de carpetas prohibidas:

```txt
No crear services/netsuite, services/odoo, services/kapso, services/legacy-crm ni adapters de proveedor en frontend.
```

Si una vista necesita una accion relacionada con NetSuite, Odoo, Kapso, Microsoft 365 o CRM viejo, la vista llama `src/services/api` usando contrato canonico. El API enruta hacia el adapter correcto.

Pantallas visuales futuras de integraciones, si se aprueban, deben vivir bajo `management` o `support` como vistas CRM canonicas. No son adapters frontend.

## Primer vertical slice aprobado ahora

El desarrollo real aprobado de frontend acompana la compuerta de identidad:

1. Leer `24-Contrato-Visual-Identidad-P0-S1.md`.
2. Mantener login real en `src/modules/auth`, siempre expuesto en la ruta publica `/auth/login`.
3. Mantener shell global autenticado en `src/modules/home`, expuesto en `/home/global`, con datos de sesion, usuario, roles, areas y permisos devueltos por API.
4. Mantener layout base de identidad sin KPIs comerciales reales.
5. Mostrar estados de usuarios, autenticacion, areas/equipos, roles y permisos recibidos por el API.
6. Centralizar cliente de sesion/usuario actual en `services/api` y `services/auth`.
7. Mostrar permisos visibles solo como UX; el API decide autorizacion final.

El API ya tiene aplicado y validado `SQL/003` en `CRM_THINK_V2`. La version `0.3.17` del addendum visual autoriza la compuerta conectada de identidad y el shell global `/home/global`, con selector visual de perfiles asignados, menus por perfil y datos de sesion/permisos. Todavia no autoriza crear home comercial operativo por contexto ni pantallas de leads.

No entra todavia:

- pantallas de leads;
- home operativo por contexto;
- formalizacion completa;
- cobros;
- modificaciones;
- perdida automatica;
- integraciones directas desde componentes.
- dashboard/pausa/perdida hasta P0-S2;
- calendarios y notas.

## Vertical comercial futuro

Despues de cerrar identidad, el siguiente corte comercial sera:

1. Listar leads desde API.
2. Crear lead con formulario canonico.
3. Ver detalle basico de lead.
4. Ver timeline basico del lead.
5. Mostrar permisos visibles devueltos por API.

## Checklist para cualquier cambio frontend

Antes de tocar codigo:

1. Confirmar modulo correcto.
2. Leer documento de arquitectura relacionado.
3. Confirmar contrato API canonico.
4. Confirmar permisos visibles.
5. Confirmar estados de carga, vacio y error.
6. Confirmar accesibilidad basica.
7. Confirmar que no hay nombres legacy/proveedor.
8. Confirmar que rutas, query keys y acciones usan public ids canonicos del CRM.
9. Implementar con pnpm.
10. Ejecutar `pnpm run typecheck` y `pnpm run build`.

## Estado actual

| Elemento | Estado |
| --- | --- |
| Esqueleto React/Vite | Creado. |
| Pantalla comercial real | No aprobada todavia. |
| Cliente API identidad | Implementado para BFF, CSRF, refresh, login local, Microsoft y logout. |
| Contrato visual identidad | Creado; manda antes de cualquier pantalla comercial. |
| Compuerta de identidad | Implementada y conectada al BFF. |
| Listado real de leads | Pendiente. |
| Formulario real de crear lead | Pendiente. |
| Timeline visual | Pendiente. |
| Login Microsoft OIDC | Implementado via API/BFF con selector de cuenta; produccion depende de configuracion aprobada. |
