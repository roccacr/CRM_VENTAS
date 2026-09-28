# 00 - Ley de Producto CRM TINK y P0 Frontend

| Campo | Valor |
| --- | --- |
| Version | `0.3.7` |
| Fecha | `2026-09-28` |
| Estado | Addendum visual firmado, subordinado a la ley canonica de producto; frontend sigue como stub congelado y documenta la arquitectura de homes por contexto operativo. |
| Fuente canonica | `apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md` |
| Dueno de producto | CRM TINK <soporte@roccacr.com> |
| Aprobado por | CRM TINK <soporte@roccacr.com> |
| Ultimo cambio | Define que una URL/ruta directa nunca autoriza acceso: toda vista se valida contra sesion, contexto operativo y permisos efectivos del API. |

## Regla superior

Este documento se lee primero dentro del frontend.

Este documento no redefine el producto. Solo agrega reglas visuales del frontend.

Si este documento contradice a `apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md`, gana la ley canonica del producto.

Si este documento contradice a `AGENTS.md`, skills, mapas de implementacion, documentos de UX, componentes futuros o notas largas, gana este documento dentro del frontend hasta que la ley canonica de producto apruebe una nueva version.

Mientras este documento no apruebe construir una pantalla o flujo, esta prohibido crear nuevas pantallas, modulos, rutas, clientes API, flujos de login o experiencias fuera del P0-S1.

Regla de no duplicacion:

- no copiar decisiones de producto si ya viven en la ley canonica;
- si cambia el producto, primero cambia la ley canonica del API;
- este archivo solo puede ajustar traduccion visual, estados de UI y prohibiciones especificas del frontend.

## Que UI estamos construyendo

Estamos construyendo la interfaz operativa del CRM interno para manejar el expediente comercial del cliente desde lead hasta contrato.

La primera compuerta visual no es lead. Es identidad: usuarios, autenticacion, roles y permisos.

La UI habla el idioma del vendedor y la jefatura. No habla NetSuite, Odoo, Kapso ni estructuras del CRM viejo.

La UI tampoco usa ids de proveedores externos para navegar, relacionar o ejecutar acciones. Siempre usa `publicId` y contratos canonicos del CRM.

## Ley de aislamiento frontend

El frontend no tiene adapters de proveedores externos.

Regla:

```txt
React -> services/api -> API canonica -> adapters backend
```

Separacion aprobada:

| Area frontend | Carpeta permitida | Responsabilidad | Prohibido |
| --- | --- | --- | --- |
| Auth global | `src/modules/auth`, `src/services/auth` | Sesion visual, estado de autenticacion y helpers frontend aprobados. | Guardar tokens, decidir permisos finales o llamar Microsoft Graph directo para reglas CRM. |
| API canonica | `src/services/api` | Cliente HTTP tipado contra el API del CRM. | Mappers de NetSuite, Odoo, Kapso o CRM viejo. |
| Modulos visuales | `src/modules/**` | Pantallas y flujos del dominio aprobado. | Conectarse a DB, ERP, Kapso, legacy CRM o Microsoft Graph directo. |
| UI reutilizable | `src/components/**`, `src/hooks`, `src/stores`, `src/types` | Piezas visuales, composicion UI, estado local y tipos canonicos. | Reglas de negocio finales o payloads de proveedores. |

Si se agrega Kapso, Odoo, NetSuite u otro proveedor, el frontend no recibe carpeta de proveedor. La integracion vive en el API. El frontend solo ve acciones y estados canonicos devueltos por `services/api`.

## Ley de homes por contexto operativo

Despues de autenticarse, el usuario no entra a una pagina generica unica para todos. Entra a un contexto operativo permitido por el API.

Regla:

```txt
auth global -> sesion/me -> contextos operativos permitidos -> home del contexto -> menus del contexto
```

Un contexto operativo es la combinacion visible de:

- rol o roles activos;
- area/equipo donde participa;
- permisos efectivos;
- alcance organizacional.

No es una segunda cuenta, no es otro login y no es un token diferente.

Ejemplos esperados:

| Contexto operativo | Home esperado | Menu esperado |
| --- | --- | --- |
| `sales` | Home de vendedor/ventas. | Leads, seguimiento, oportunidades y acciones comerciales aprobadas. |
| `finance` / `collections` | Home financiero/cobros cuando se apruebe. | Bandejas financieras, pagos, vencimientos y estados permitidos. |
| `marketing` | Home de mercadeo cuando se apruebe. | Campanas, origenes, reportes de captacion y acciones aprobadas. |
| `formalizations` | Home de formalizaciones cuando se apruebe. | Contrato, banco, traspaso, documentos y timeline de formalizacion. |
| `management` | Home de jefatura/gerencia. | Supervision, vistas consolidadas, filtros por area y accesos al modulo propietario. |
| `support` / `it` | Home de sistemas/soporte. | Identidad, diagnostico autorizado, configuracion visible y herramientas aprobadas. |

Regla para usuarios con varios roles:

```txt
Si una persona tiene mas de un contexto permitido, la UI muestra un selector de contexto en navbar/sidebar.
```

Ese selector permite cambiar de home sin cerrar sesion. Ejemplo: una persona puede operar `marketing` y `formalizations`; el sidebar debe mostrar ambos contextos separados si el API devuelve permisos para ambos.

Regla para jefatura superior o TI:

```txt
Jefatura superior y TI pueden ver varios contextos solo si el API devuelve permisos efectivos para esos contextos.
```

No se debe hardcodear que un rol ve todo por el nombre del rol. El API manda permisos y alcance; React solo renderiza.

Regla de URL directa:

```txt
Tener la URL de una vista no autoriza acceso a esa vista.
```

Toda ruta protegida debe validar, antes de renderizar:

1. sesion activa;
2. usuario activo;
3. contexto operativo permitido;
4. permiso efectivo requerido para esa vista;
5. alcance organizacional suficiente.

Si falla cualquiera de esas validaciones, la UI no renderiza la vista y debe mostrar estado de no autorizado, redirigir al selector permitido o enviar a login segun corresponda. El API siempre vuelve a validar la accion real.

Regla para jefe global:

```txt
Solo `owner`, `jefe_general` o un rol equivalente devuelto por el API con permisos efectivos vigentes puede acceder a vistas globales.
```

Si una persona no tiene ese rol/permiso vigente, no entra aunque conozca la URL, aunque tenga el menu cacheado o aunque haya entrado antes.

Regla de carpetas:

```txt
Crear modulos por contexto operativo/dominio, no duplicar una pantalla completa por cada rol literal.
```

Correcto:

- `src/modules/sales`;
- `src/modules/marketing`;
- `src/modules/formalizations`;
- `src/modules/collections`;
- `src/modules/management`;
- `src/modules/support`;
- `src/modules/auth`;
- `src/modules/permissions`.

Incorrecto:

- copiar la misma pantalla en `src/modules/vendedor`, `src/modules/jefe_ventas` y `src/modules/supervisor`;
- crear reglas finales de autorizacion en React;
- crear `services/netsuite`, `services/odoo` o `services/kapso`;
- crear un home que dependa de ids de proveedor.

Regla para integraciones:

NetSuite, Odoo, Kapso, Microsoft 365 y el CRM viejo se aislan en el API. Si algun dia existe una pantalla administrativa para ver estado de integraciones, sera una vista CRM canonica autorizada, no un adapter frontend ni una llamada directa al proveedor.

## Para quien

| Usuario | Que necesita en la UI |
| --- | --- |
| Vendedor | Ver sus leads, abrir detalle, entender historial y registrar acciones cuando el API lo permita. |
| Jefatura | Ver trazabilidad y supervisar motivos, pausas, perdidas y responsables cuando el alcance lo permita. |
| Formalizacion | No opera en P0-S1. Entra despues. |
| Cobros | No opera en P0-S1. NetSuite sigue siendo el sistema principal de cobros. |
| Sistemas/soporte | Ver una UI alineada al contrato canonico, sin nombres de proveedores ni reglas duplicadas. |

## Que problema mata

El frontend nuevo debe evitar que el usuario dependa de codigos, tablas viejas o reglas mezcladas con proveedores externos.

Debe mostrar una experiencia clara, auditable y en espanol Costa Rica para entender:

- que lead existe;
- quien lo atiende;
- que historial tiene;
- que permisos visibles devuelve el API;
- que informacion pertenece al CRM y no al ERP.

## Que no somos

Este frontend no es:

- landing page;
- HubSpot;
- Odoo;
- Salesforce Platform;
- Bitrix;
- marketing automation;
- calendario empresarial;
- cliente directo de NetSuite/Odoo/Kapso;
- suite de notas, chat, documentos o WhatsApp.

Si una pantalla empuja el frontend hacia suite completa antes de cerrar P0-S1, queda fuera.

## Ley de P0-S1 Frontend

P0-S1 existe para preparar la experiencia minima del CRM en orden. Nada mas.

No se debe avanzar a pantallas de leads hasta cerrar primero identidad, usuarios, roles y permisos minimos.

## Estado actual del runtime frontend

El frontend puede tener `package.json`, `src/` y `pnpm-lock.yaml` porque existe un esqueleto React/Vite minimo.

Eso no significa producto funcional.

Regla:

```txt
El frontend actual es stub congelado hasta que esta ley autorice el siguiente corte visual.
```

Permitido:

- mantener el stub;
- correrlo para validar que abre;
- ajustar documentacion de arquitectura.

Prohibido:

- crear pantallas comerciales;
- crear leads;
- crear rutas nuevas de negocio;
- crear administracion avanzada;
- conectar integraciones externas;
- usar el stub como prueba de que P0-S1 esta construido.

La diferencia con el API es intencional:

- API: runtime comercial prohibido; el runtime minimo de identidad lo regula la ley canonica del API;
- frontend: stub React/Vite congelado, no CRM operativo.

El stub no autoriza nuevas pantallas. Su unico valor permitido ahora es validar que el proyecto frontend abre y que la futura compuerta de identidad podra montarse sin mezclar leads.

La pantalla real de login/identidad no queda autorizada por el hardening del API. Antes de crearla, este addendum debe aprobar un corte visual explicito que defina pantalla, estados, errores, consumo del contrato canonico y reglas BFF sin tokens en frontend.

| Numero | Si entra | Dueno principal |
| --- | --- | --- |
| 1 | Compuerta visual de identidad: usuarios, autenticacion, roles y permisos. | Sistemas / Jefatura |
| 2 | Reglas de sesion segura BFF sin tokens en frontend. | Sistemas |
| 3 | Permisos visibles simples recibidos del API. | Jefatura / Sistemas |
| 4 | Contrato visual basado en campos canonicos del lead, cuando identidad este cerrada. | Vendedor / Sistemas |
| 5 | Lista conceptual de leads, cuando identidad este cerrada. | Vendedor |
| 6 | Detalle conceptual de lead, cuando identidad este cerrada. | Vendedor |
| 7 | Timeline/bitacora basica visible, cuando identidad este cerrada. | Vendedor / Jefatura |

P0-S1 frontend no autoriza programar pantallas de leads si identidad/usuarios/roles, contrato canonico y modelo minimo no estan cerrados.

Identidad P0-S1A visual queda cerrada en papel cuando la UI se limite a:

- sesion;
- usuario actual;
- roles visibles;
- areas/equipos visibles;
- permisos efectivos recibidos del API;
- mensaje claro de que leads sigue bloqueado.

## Prohibido ahora

Hasta que P0-S1 quede cerrado por producto, queda prohibido:

- crear nuevas pantallas fuera de la compuerta de identidad aprobada;
- crear pantallas de lead antes de cerrar identidad/usuarios/roles;
- crear modulo de calendario;
- crear notas adhesivas;
- crear Kapso o WhatsApp en UI;
- crear formalizaciones;
- crear cobros;
- crear modificaciones;
- crear dashboard ejecutivo completo;
- crear flujos avanzados de delegacion o aprobacion fuera del contrato API de identidad;
- guardar tokens en frontend;
- llamar NetSuite, Odoo, Kapso o Microsoft Graph directo desde componentes;
- usar ids de NetSuite, Odoo, legacy CRM o Kapso como ids principales de UI;
- duplicar autorizacion del backend;
- ampliar el alcance por parecer "enterprise".

## Definition of Done visual minima

Cuando se apruebe construir UI real, ninguna pantalla se considera lista si no cumple:

1. Usa solo contratos canonicos del API.
2. No guarda tokens en `localStorage`, `sessionStorage` ni variables globales.
3. Oculta acciones por UX, pero nunca decide autorizacion final.
4. Muestra estados de carga, error, sin sesion y permiso denegado.
5. No muestra ids internos de MySQL ni ids de proveedores externos.
6. No llama NetSuite, Odoo, Kapso, Microsoft Graph ni legacy CRM directo desde componentes.
7. Todo texto visible operativo esta en espanol Costa Rica.
8. Cada pantalla nueva tiene camino claro a permisos, auditoria o contrato API.
9. Cada archivo, componente, hook o servicio tiene una responsabilidad clara.
10. Los comentarios de codigo explican reglas de negocio, seguridad, accesibilidad o decisiones no obvias; no comentan obviedades.
11. Los valores repetidos, rutas, labels, permisos, storage keys y contratos visuales viven en constantes o contratos nombrados.
12. Si una funcion o componente mezcla concerns, se divide en piezas enfocadas y la pieza publica queda como orquestador.
13. Si la logica se reutiliza entre vistas, se mueve a `hooks`, `services`, `components`, `stores` o `types` segun corresponda; no se crea un `utils` generico.
14. La configuracion critica de frontend falla rapido; no se aceptan valores vacios silenciosos para API, seguridad o proveedores.

## Orden obligatorio

El orden del frontend es:

```txt
producto -> identidad/usuarios/roles -> contrato visual canonico -> pantallas React
```

Invertir el orden se considera volver a empujar UI antes de entender el producto.

## Criterio de salida

Se puede avanzar a pantallas React solo cuando:

- esta ley este aceptada;
- P0-S1 frontend este cerrado sin ambiguedades;
- cada "si" tenga dueno;
- cada "no" este escrito;
- el indice frontend apunte a este documento como lectura cero;
- identidad/usuarios/roles este cerrado;
- el contrato canonico minimo del API este listo para consumo visual.

Mientras tanto, el stub React/Vite no autoriza construir pantallas de lead ni administracion avanzada.
