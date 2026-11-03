# 19 - Mapa de Implementacion Frontend

## Estado contrastado - 2026-11-02

El árbol real contiene `modules/auth`, `administration`, `home`, `marketing`,
`calendar` y `notes`. No existen todavía las carpetas comerciales propuestas
para cada fase de Sales ni una capa Zustand/TanStack. El inventario completo de
rutas, servicios y documentos está en [30](30-Estado-Frontend-Verificado.md).
El componente común de calendario se reutiliza en cuatro módulos; el de notas
vive en el shell, no se duplica por rol o URL.

Formalización tiene ficha y capítulos NetSuite confirmados, cliente, unidad,
bitácora, seguimiento, etapa y aprobación. Los modelos preview y rutas sin Page
no acreditan otras operaciones. Resumen está retirado; nunca reconstruir su ruta
para hacer coincidir el snapshot histórico de cuatro vistas más abajo.

## Antecedente contrastado - 2026-10-27

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría las rutas, contratos y límites actuales: Captación conectada, seguimiento y cambio protegido de etapa de Formalización. Los cortes fechados siguientes son antecedentes; sus cifras de QA no se reejecutaron en esta revisión documental.


## Captacion conectada - 2026-10-26

La pagina usa API/reportes y directorios reales, sin constantes de demo en
produccion. Servicio validado y hook por periodo/identidad, carga/error/reintento,
filtros multiples sin ampliar seleccion silenciosamente y fotos por publicId.
Se conservan tablas/graficos/descarga con medidas de cohortes; no volumen de eventos.
Ver [53 API](../../api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md).

## Antecedente: Captacion de leads, maqueta UX - 2026-10-26

Ampliacion visual: KPIs personalizables, paneles de embudo, vendedores, citas,
ordenes/contratos, perdidas e inversion/tiempos. Constructor con metricas y
columnas dinamicas. Solo muestra local; no acredita integracion comercial.
Definiciones y limites: [27 - Entrega y QA](27-Entrega-Administracion-y-QA.md).

`/home/marketing/leads` monta de forma diferida MarketingLeadCapturePage desde
`src/modules/marketing`. Analisis interactivo con datos ficticios locales,
filtros dependientes, medidas y desgloses; permiso existente sin cambios.
Sustituye el H1 inicial. Sin API/BD, importaciones, exportacion o CRUD comercial.


## Antecedente entrada Captacion de leads - 2026-10-26

Ruta registrada `/home/marketing/leads`, menu `marketing-leads`, permiso
`mercadeo.leads.read`. Solo renderiza H1; no es CRUD, listado, reporte ni consulta
comercial. Menu/URL aplican el control existente por permisos efectivos y denies.


## Inventario vigente - 2026-10-23

El runtime contiene identidad bajo `src/modules/auth`, Administracion bajo `src/modules/administration` y Formalizacion parcial/Home de Mercadeo bajo `src/modules/home`; servicios tipados bajo `src/services`, rutas bajo `src/routes` y componentes de feedback recuperable. Usa React/Vite, Ant Design, DataTables, fetch y CSS. History API, rutas diferidas y limite de errores estan implementados. Ver [resumen](01-Resumen-Frontend.md) y [navegacion/seguimiento](29-Navegacion-Recuperacion-y-Seguimiento.md).

Aprobaciones es lectura protegida independiente; seis banners de etapas usan un solo `GET /formalization/home/summary` con rol efectivo activo Formalizacion y permiso de etapas sin deny. Owner puede heredar ese rol desde backend. Mercadeo / Inicio lee resumen de leads y citas disponibles mediante `src/services/marketing/home-summary-service.ts` y `useMarketingHomeSummary.ts`; no usa muestra ficticia de respaldo. No hay seguimiento de ordenes operacional ni list/send/revert activos. Los arboles comerciales y herramientas descritos debajo son direccion futura, no carpetas/dependencias existentes ni nueva autorizacion. Ver [27](27-Entrega-Administracion-y-QA.md) y [49](../../api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).

## Proposito

Este documento responde una pregunta practica:

```txt
Si voy a construir una pantalla, componente, hook o cliente API, en que carpeta va?
```

Debe usarse antes de crear pantallas, formularios, tablas, filtros, modales, estados locales o integraciones visuales.

Actualizacion de orden: antes de implementar el vertical de leads, se debe cerrar `22-UX-Identidad-Usuarios-Roles-P0-S1.md`.

El primer corte ejecutable fue identidad. El alcance vigente incorpora las ampliaciones indicadas arriba; `20-Alcance-P0-Vertical-Leads-Frontend.md` sigue siendo un vertical futuro.

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

## Mapa de carpetas vigentes y direccion futura

`app-routes.ts` registra Inicio y Captación de Mercadeo; Inicio, Gestión y
Calendario de Formalización; calendarios de Ventas/Mercadeo/Contabilidad;
Administración, Usuarios, Roles, Auditoría y las siete páginas de catálogo en
cinco contextos. Resumen de Formalización no está registrado. Las portadas de
Ventas/Contabilidad, Expedientes/Contratos de Formalización, integraciones y la
portada de catálogos conservan placeholder. `/home/global` no está registrado.
El destino depende del perfil efectivo; `DEFAULT_HOME_PATH` es
`/home/administration`, sin conceder acceso a esa ruta.

Los catalogos reutilizan las mismas paginas en Administracion, Ventas, Mercadeo, Formalizacion y Contabilidad mediante contexto modular; no son copias de registros por area. Las carpetas comerciales de la tabla siguiente son futuras salvo `auth`, `home`, servicios y componentes realmente existentes. No crear ni trasladar carpetas para igualar este blueprint.

| Carpeta | Que va aqui | Que no va aqui | Leer antes |
| --- | --- | --- | --- |
| `src/modules/auth` | Compuerta visual de identidad, sesion, usuario actual y permisos visibles. | Reglas finales de autorizacion del backend. | `21`, `22`. |
| `src/modules/home` | Shell, menús, Home de Formalización/Mercadeo, seguimiento/ficha y lecturas de orden; conserva previews históricos separados. | Decidir autorización final, importar datos o convertir una simulación en comando. | `00`, `14`, `24`, `27`, `30`. |
| `src/modules/sales/dashboard` | Dashboard de ventas, tarjetas, filtros y drill-down. | Reglas de conteo calculadas en UI. | `03`, `17`, `18`. |
| `src/modules/sales/leads` | Lista, detalle, formularios y acciones de leads. | Oportunidades, estimaciones u ordenes completas. | `10`, `11`, `12`, `17`, `18`, `23`. |
| `src/modules/sales/opportunities` | Pipeline y vistas de oportunidad. | Formularios de lead puro. | `13`. |
| `src/modules/sales/estimates` | Pantallas de estimaciones. | Ordenes de venta. | `13`. |
| `src/modules/sales/sales-orders` | Pantallas de ordenes de venta, pre-reserva y reserva. | Formalizacion operativa completa. | `13`, `14`. |
| `src/modules/marketing` | Reporte conectado de Captación, controles, KPIs, gráfico, tablas, carga y exportaciones; Home permanece en `src/modules/home/MarketingHomePage.tsx`. | Seguimiento operativo de ventas o llamadas directas a proveedores. | `14`, `23`. |
| `src/modules/formalizations` | Flujo de formalizacion cuando se apruebe alcance. | Leads iniciales o dashboard de ventas. | `14`. |
| `src/modules/collections` | Home y flujos financieros/cobros cuando se aprueben. | Cobros directos contra ERP o NetSuite desde React. | `14`, `23`. |
| `src/modules/management` | Home de jefatura, supervision y acceso consolidado por permisos. | Duplicar pantallas operativas de cada area. | `14`, `21`, `24`. |
| `src/modules/support` | Home de TI/soporte y herramientas aprobadas. | Acceso total por nombre de rol o secretos de infraestructura. | `14`, `21`, `24`. |
| `src/modules/calendar` | Calendario API compartido, overlays, formularios, participantes/relaciones CRM, panel diario y agenda. | Graph, envío de invitaciones, escritura legacy o certificación de sincronización. | `15`, `Calendario-Global-Frontend`. |
| `src/modules/notes` | Canvas/Drawer, bandejas, conversación, avisos, workflow, realtime y Select de vínculos comerciales. | Conceder acceso comercial al invitar, adjuntos no activados o envío por proveedores. | `16`. |
| `src/modules/permissions` | Componentes para mostrar/ocultar acciones segun permisos efectivos. | Reglas finales de autorizacion. | `09`. |
| `src/components/ui` | Botones, inputs, badges, dialogs, tooltips genericos. | Logica de negocio. | `03`. |
| `src/components/data-table` | Tabla generica server-side. | Consultas directas a API especificas de un modulo. | `03`, `04`. |
| `src/services/api` | Cliente HTTP tipado y funciones API por contrato canonico. | Transformaciones de proveedores externos, SDKs de ERP o queries directas. | `04`, `10`, `23`. |
| `src/services/auth` | Helpers frontend de sesion visual aprobados. | Guardias backend, tokens persistidos, reglas finales de permisos o llamadas directas a Microsoft Graph. | `09`, `21`, `22`. |
| `src/stores` | Estado UI pequeno: filtros, layout, preferencias. | Cache de servidor o permisos finales. | `04`. |
| `src/types` | Tipos canonicos compartidos en frontend. | Tipos de proveedores externos. | `10`, `23`. |

## Shell, home y sidebar por contexto

La aplicacion tiene un shell comun despues de `auth`, con Administracion y los homes acotados anteriores. El CRUD comercial de leads sigue futuro.

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

## Primer vertical slice historico - identidad 2026-09-30

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

## Estado del corte inicial de identidad, salvo ampliaciones del inventario superior

| Elemento | Estado |
| --- | --- |
| Esqueleto React/Vite | Creado. |
| Pantalla comercial real | Home de Formalizacion/Mercadeo con resumen de lectura; CRUD de leads pendiente. |
| Cliente API identidad | Implementado para BFF, CSRF, refresh, login local, Microsoft y logout. |
| Contrato visual identidad | Creado; manda antes de cualquier pantalla comercial. |
| Compuerta de identidad | Implementada y conectada al BFF. |
| Listado real de leads | Pendiente. |
| Formulario real de crear lead | Pendiente. |
| Timeline visual | Pendiente. |
| Login Microsoft OIDC | Implementado via API/BFF con selector de cuenta; produccion depende de configuracion aprobada. |
