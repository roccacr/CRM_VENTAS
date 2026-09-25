# 00 - Ley de Producto CRM TINK y P0

| Campo | Valor |
| --- | --- |
| Version | `0.3.15` |
| Fecha | `2026-09-25` |
| Estado | Ley vigente firmada de producto y alcance; P0-S1A aprobado en base de datos, runtime minimo de identidad autorizado y wiring tecnico legacy aislado aprobado para futura sync. |
| Dueno de producto | CRM TINK <soporte@roccacr.com> |
| Aprobado por | CRM TINK <soporte@roccacr.com> |
| Ultimo cambio | Agrega regla operativa obligatoria: queda prohibido rotar, alterar o revocar credenciales productivas compartidas como `usuario_master_compartido` mientras existan servicios vivos que dependan de ellas; primero se debe inventariar, migrar servicios a usuarios dedicados y aprobar ventana/rollback. |

## Regla superior

Este documento se lee primero.

Si este documento contradice a `AGENTS.md`, skills, modelos de datos, mapas de implementacion, documentos largos o notas futuras, gana este documento hasta que el dueno del producto apruebe una nueva version.

Mientras este documento no apruebe ampliar runtime, esta prohibido crear API comercial, instalar dependencias fuera de identidad, agregar modulos comerciales, generar OpenAPI comercial o ampliar skills. Las unicas excepciones autorizadas por esta version son validar estructura de identidad, ejecutar el seed de catalogos S1A, construir el runtime minimo de identidad del API y preparar el wiring tecnico opcional de conexion legacy aislada para futura sync, sin usuarios inventados, sin credenciales seed, sin datos reales de negocio, sin queries contra `crmdatabase-api`, sin dual-read y sin escritura sobre la base vieja.

## Gobierno documental

La respuesta a una duda no debe ser crear mas markdown por defecto.

Reglas:

- no se crea un documento nuevo sin retirar, fusionar o degradar otro documento existente;
- una correccion de alcance primero se aplica aqui;
- los documentos largos son soporte, no autoridad;
- los indices deben apuntar a lectura corta;
- si un documento repite esta ley y se desactualiza, pierde contra esta ley;
- ningun documento nuevo puede ampliar P0-S1A sin cambiar version, fecha y aprobacion en esta ley.

Regla de autoridad:

```txt
Fuente canonica de producto = este documento.
```

Frontend, API, SQL, skills y mapas de implementacion obedecen esta ley.

## Que estamos construyendo

Estamos construyendo un CRM interno para manejar el expediente comercial del cliente desde lead hasta contrato.

El CRM nuevo tendra datos propios, historial propio y reglas propias. NetSuite, Odoo u otros sistemas externos entran como proveedores conectados por integracion; no son el idioma del vendedor, no son el modelo de datos core y no aparecen en el frontend.

Las relaciones internas del CRM usan identidad propia del CRM. Ningun vendedor, lead, oportunidad, estimacion, orden o contrato debe relacionarse internamente usando ids de NetSuite, Odoo, legacy CRM u otro proveedor.

## Ley de aislamiento por modulo/proveedor

La separacion por carpeta es obligatoria. No es opcional ni estetica.

Regla:

```txt
Cada dominio, fuente de datos y proveedor externo vive en su propio modulo. Si se deja de usar, se desconecta o elimina ese modulo sin romper el core del CRM.
```

Separacion aprobada:

| Area | Carpeta obligatoria | Responsabilidad | Prohibido |
| --- | --- | --- | --- |
| CRM nuevo / `CRM_THINK_V2` | `src/database` + repositorios del modulo en `src/modules/crm/**` | Conexion Kysely, tipos DB, queries sobre datos propios del CRM nuevo. | Leer tablas del CRM viejo o mapear payloads de proveedores. |
| CRM viejo / legacy | `src/integrations/legacy-crm` | Lectura temporal, mapeo y extraccion controlada desde la base vieja. | Escribir reglas nuevas de negocio o contaminar contratos canonicos. |
| NetSuite | `src/integrations/netsuite` | Cliente, DTOs, mappers, errores y sincronizacion especifica de NetSuite. | Aparecer en frontend, tablas core o modulos comerciales como dependencia directa. |
| Odoo | `src/integrations/odoo` | Cliente, DTOs, mappers, errores y convivencia futura con Odoo. | Reemplazar nombres canonicos del CRM por nombres de Odoo. |
| Kapso / WhatsApp | `src/integrations/kapso` | Mensajeria, templates, webhooks y mappers de Kapso cuando se apruebe. | Ser llamado directo desde componentes React o desde reglas core de lead. |
| Microsoft 365 / Graph | `src/integrations/microsoft365` | Entra ID, Graph, calendario externo y adapters tecnicos aprobados. | Decidir reglas CRM de calendario o permisos. |
| Puertos comunes | `src/integrations/common/ports` | Interfaces estables que el core puede conocer. | Implementaciones concretas de proveedor. |
| Configuracion global | `src/config`, `src/common`, `src/database` | Configuracion, seguridad, bootstrap, conexion a `CRM_THINK_V2` y utilidades transversales reales. | Reglas de negocio de leads, ERP, legacy, Kapso u Odoo. |

El core del CRM solo habla contratos canonicos y puertos. El core no importa adapters concretos.

Permitido:

- crear carpetas vacias de frontera para dejar clara la arquitectura;
- crear interfaces/ports cuando un caso de uso aprobado los necesite;
- agregar un proveedor nuevo creando su propio adapter, por ejemplo `src/integrations/<proveedor>`.

Prohibido:

- crear `netsuiteId`, `odooId`, `legacyId` o equivalentes como identidad principal en tablas core;
- importar `src/integrations/netsuite`, `src/integrations/odoo`, `src/integrations/legacy-crm` o `src/integrations/kapso` desde controllers o dominio core;
- mezclar queries del CRM viejo con repositories de `CRM_THINK_V2`;
- poner payloads de proveedor externo en DTOs publicos del frontend/API;
- crear carpetas genericas tipo `external`, `misc`, `helpers` o `providers` para tirar ahi todo.

Si manana se apaga el CRM viejo, solo debe retirarse `src/integrations/legacy-crm` y su wiring autorizado. Si se cambia NetSuite por Odoo, el core y el frontend no deben cambiar de idioma ni de identidad.

Regla de conexion legacy aprobada:

```txt
DB_NAME siempre apunta a CRM_THINK_V2. La base vieja solo se nombra con LEGACY_CRM_DB_NAME dentro de src/integrations/legacy-crm.
```

El wiring legacy queda apagado si `LEGACY_CRM_DB_NAME` esta vacio. Cuando se active, puede reutilizar `DB_HOST`, `DB_PORT`, `DB_SSL` y `DB_SSL_CA` si ambas bases viven en el mismo servidor MySQL, pero debe usar `LEGACY_CRM_DB_USER` y `LEGACY_CRM_DB_PASSWORD` de un usuario MySQL separado y solo lectura, distinto de `DB_USER`. El pool legacy debe marcar cada conexion con `SET SESSION TRANSACTION READ ONLY`; esto es defensa adicional y no sustituye permisos MySQL de solo lectura. Eso no autoriza queries, dual-read ni sync activa; solo deja preparada la frontera tecnica aislada.

## Ley de credenciales productivas compartidas

Esta regla nace por incidente operativo confirmado el `2026-09-25`: rotar la clave de un usuario master compartido corto servicios productivos que aun dependian de esa credencial.

Regla obligatoria:

```txt
Queda prohibido rotar, alterar, revocar o reemplazar credenciales productivas compartidas mientras existan servicios vivos que las usen.
```

Aplica especialmente a usuarios master/admin de RDS/MySQL como `usuario_master_compartido`.

Antes de tocar una credencial productiva compartida se debe cumplir todo:

- inventariar los servicios vivos que la usan, incluyendo CRM viejo, Kapso, jobs, scripts, PM2, Prisma, backend Node y cualquier proceso externo;
- crear usuarios dedicados por servicio con privilegios minimos;
- migrar cada servicio a su usuario dedicado y verificar arranque/conexion;
- confirmar que ningun servicio vivo usa ya la credencial compartida;
- aprobar una ventana operativa y un rollback explicito con el dueno;
- documentar el resultado sin guardar secretos.

Mientras esa lista no este cerrada, tareas tipo "rotar password master", "probar que la clave vieja no conecta" o "bloquear la clave anterior" quedan prohibidas. Lo correcto es preparar usuarios dedicados sin cortar el usuario compartido existente.

## Para quien

| Usuario | Que necesita en este CRM |
| --- | --- |
| Vendedor | Ver sus leads, entender que debe atender, registrar acciones y dejar evidencia. |
| Jefatura | Supervisar leads, equipos, motivos, perdidas, pausas y trazabilidad sin depender de explicaciones verbales. |
| Formalizacion | Entra despues del flujo comercial inicial, cuando el alcance lo apruebe. |
| Cobros | No opera en P0-S1. NetSuite sigue siendo el sistema principal de cobros. |
| Sistemas/soporte | Mantener integraciones y trazabilidad sin mezclar proveedores con reglas del CRM. |

## Que problema mata

El CRM actual no permite gobernar bien el proceso comercial porque:

- mezcla datos comerciales con nombres y estructuras del sistema viejo;
- mezcla reglas del CRM con NetSuite;
- no deja una bitacora completa, clara y confiable de todo lo que pasa con el lead;
- dificulta cambiar o convivir con otro ERP;
- obliga a entender tablas y codigos heredados para explicar decisiones comerciales.

El nuevo CRM debe resolver eso con un expediente comercial claro, auditable y propio.

## Que no somos

Este proyecto no es:

- HubSpot;
- Odoo;
- Salesforce Platform;
- Bitrix;
- marketing automation;
- ERP;
- plataforma generica de modulos;
- suite de calendario, chat, WhatsApp o documentos.

Si una idea empuja el proyecto hacia una suite completa antes de cerrar P0-S1, queda fuera.

## Ley de P0-S1

P0-S1 existe para cerrar el nucleo minimo del CRM en orden. Nada mas.

La primera compuerta de P0-S1 no es lead. Es identidad: usuarios, autenticacion, roles y permisos minimos.

No se debe avanzar a tablas, pantallas o endpoints de lead hasta cerrar quien entra al sistema, con que rol y con que permiso.

## Ley de P0-S1A Identidad

P0-S1A identidad queda cerrado como producto y base de datos inicial.

Esto significa:

- el SQL de identidad existente es un artefacto controlado de diseno y validacion;
- `SQL/001_identity_schema_p0_s1.sql` fue aplicado manualmente solo como validacion schema-only en `CRM_THINK_V2`, sin datos, sin seeds y sin runtime;
- esa aplicacion no equivale a migracion productiva registrada ni autoriza datos reales;
- `SQL/002_identity_seed_p0_s1.sql` fue autorizado y ejecutado solo como catalogos S1A;
- el API NestJS queda autorizado solo para el runtime minimo de identidad definido en esta version;
- no se abren mas documentos de vision para identidad salvo correccion de contradicciones.

Validacion SQL autorizada:

- se autoriza validar `SQL/001_identity_schema_p0_s1.sql` como migracion controlada de estructura;
- se autoriza crear un runner de migracion solo cuando sea necesario para validar estructura; esta regla no autoriza modulos comerciales, pero la version `0.3.14` si autoriza el runtime minimo de identidad descrito en este documento;
- se autoriza ejecutar `SQL/002_identity_seed_p0_s1.sql` una vez como seed de catalogos S1A, exclusivamente en `CRM_THINK_V2`;
- `SQL/002_identity_seed_p0_s1.sql` solo puede insertar catalogos de identidad: permisos, roles, matriz rol-permiso, areas, sistemas externos y eventos tecnicos de auditoria de seed;
- `SQL/002_identity_seed_p0_s1.sql` no puede crear usuarios, identidades de autenticacion, asignaciones de usuario, contrasenas, tokens, datos personales, datos de negocio ni datos del CRM viejo;
- el objetivo exclusivo es validar que el esquema compila contra un motor MySQL 8 real;
- la base `CRM_THINK_V2` usada para esta prueba no puede contener datos reales ni datos del CRM viejo;
- como excepcion unica de la version `0.3.4`, se regulariza la validacion schema-only ya ejecutada en el servidor `mysql_crm_ventas`, exclusivamente sobre la base nueva y vacia `CRM_THINK_V2`, sin tocar `crmdatabase-api`;
- esta excepcion no convierte `mysql_crm_ventas` en ambiente oficial del CRM nuevo y no autoriza datos reales, datos del CRM viejo, integraciones operativas ni runtime;
- sigue prohibido ejecutar estos SQL contra produccion, ambientes compartidos o bases con datos reales, salvo excepcion escrita en esta ley y limitada a una base vacia de validacion;
- esta autorizacion SQL no permite crear runtime API comercial, migraciones operativas de producto, OpenAPI comercial, jobs, integraciones reales ni pantallas;
- las credenciales nunca se guardan en documentos, codigo, commits, logs ni capturas; deben vivir solo en variables de entorno locales o gestor de secretos;
- las migraciones no deben ejecutarse automaticamente al iniciar NestJS; deben ejecutarse por comando explicito, revisable y separado del arranque de la aplicacion.

Conteos esperados de `SQL/002_identity_seed_p0_s1.sql`:

| Tabla | Conteo esperado |
| --- | --- |
| `sec_permission` | 17 |
| `sec_role` | 8 |
| `sec_role_permission` | 80 |
| `sec_org_unit` | 6 |
| `int_external_system` | 3 |
| `audit_security_event` | 4 |
| `sec_user` | 0 |
| `sec_auth_identity` | 0 |
| `sec_user_role` | 0 |
| `sec_user_org_unit` | 0 |

Regla de validacion:

```txt
Si cualquier conteo posterior a `SQL/002` difiere del esperado, se reporta como desviacion y no se ajusta el registro para esconderla.
```

## Runtime minimo de identidad autorizado

La version `0.3.14` mantiene autorizado el runtime minimo de identidad y completa condiciones previas de seguridad. No autoriza login real productivo ni Microsoft operativo.

Alcance permitido:

- bootstrap NestJS minimo dentro de `apps/api`, usando `pnpm`;
- conexion MySQL/Kysely a `CRM_THINK_V2`;
- configuracion segura de variables de entorno sin guardar secretos reales en documentos, codigo ni logs;
- modulo de identidad/autenticacion;
- patron BFF con cookies `HttpOnly`, `Secure` y `SameSite`;
- contrato/stubs de Microsoft Entra ID / OIDC como login principal futuro, sin flujo real todavia;
- login local preparado solo por invitacion/reset seguro, sin passwords en seed;
- endpoints minimos de identidad: sesion actual, usuario actual, logout, refresh, inicio/callback Microsoft y flujo local de invitacion/reset;
- calculo de permisos efectivos con rol, area/jerarquia, `allow` directo y `deny` directo;
- auditoria de seguridad para login, logout, refresh, errores relevantes y cambios sensibles de identidad;
- HMAC-SHA256 con `AUDIT_HASH_SECRET` dedicado para correlacionar identificadores sensibles en auditoria sin guardar PII cruda;
- rate limit local acotado para reset local y login local, con dos contadores independientes por endpoint: IP efectiva y HMAC del correo; se bloquea si cualquiera se excede; el limite por IP debe ser mas alto que el limite por correo para no castigar oficinas bajo NAT; en P0 es por proceso y se reinicia al arrancar;
- `OPENAPI_ENABLED` apagado por defecto hasta decision explicita de exposicion;
- `API_BIND_HOST` explicito, con `127.0.0.1` como default seguro;
- `TRUSTED_PROXY_IPS` opcional y explicito; queda prohibido confiar todos los proxies con `trustProxy: true`;
- contrato OpenAPI minimo o contrato equivalente solo para identidad, si se necesita para integrar frontend;
- pruebas minimas de sesion, permisos efectivos y auditoria.

Sigue prohibido:

- leads;
- oportunidades;
- estimaciones;
- ordenes de venta;
- calendarios;
- notas;
- dashboard comercial;
- ERP operativo;
- NetSuite/Odoo/Kapso operativos;
- dual-read con CRM viejo;
- usuarios reales inventados;
- correos ficticios;
- passwords o tokens en seeds;
- datos de negocio;
- datos reales de clientes;
- Microsoft OIDC real antes de tener token de sesion opaco hasheado, UTC definido para vencimientos, rotacion de refresh-token y frontend de identidad autorizado;
- pantalla real de login frontend antes de que el addendum frontend autorice ese corte visual;
- bootstrap de usuarios reales sin correos oficiales del owner y jefe_general;
- frontend comercial;
- OpenAPI comercial;
- jobs operativos;
- Redis;
- RabbitMQ;
- tocar `crmdatabase-api`.

Criterio de salida del runtime minimo de identidad:

```txt
El API puede decir quien soy, que roles/areas tengo, que permisos efectivos tengo, cerrar sesion y auditar eventos de seguridad, sin exponer tokens al frontend y sin crear ningun endpoint comercial.
```

P0-S1A identidad incluye:

- usuario interno del CRM;
- autenticacion Microsoft como principal;
- login local como alternativa controlada por invitacion/reset seguro;
- roles;
- areas/equipos y jerarquia;
- permiso efectivo basico;
- permiso directo por usuario tipo `allow`;
- denegacion directa por usuario tipo `deny`;
- auditoria de cambios de seguridad.

P0-S1A identidad no incluye:

- delegacion temporal avanzada;
- pantallas completas de administracion de usuarios;
- flujos de aprobacion complejos;
- permisos sobre leads;
- leads, calendarios, dashboard comercial, notas o integraciones reales.

Regla:

```txt
Permiso efectivo P0-S1A = rol + area/jerarquia + allow directo - deny directo.
```

Las delegaciones temporales quedan previstas para una fase posterior, pero no son obligatorias ni construibles en P0-S1A.

## Condiciones antes de activar login real

Antes de convertir los stubs de identidad en login real, deben estar cerradas estas condiciones:

1. Token de sesion opaco: la cookie no debe contener `public_id` como secreto; debe usar token aleatorio, hash persistido y expiracion controlada.
2. Fechas en UTC para sesiones, refresh-token y vencimientos.
3. Rotacion de refresh-token con deteccion de reuso y revocacion de familia.
4. CSRF double-submit firmado y atado a sesion.
5. Rate limit activo para login local y reset local.
6. Microsoft OIDC implementado solo dentro de `src/integrations/microsoft365`, detras de puertos en `src/integrations/common/ports`.
7. Addendum frontend aprobado para pantalla visual de identidad; mientras eso no exista, el frontend sigue como stub congelado.
8. Correos oficiales del primer owner y del primer jefe_general definidos para bootstrap manual; no se permiten usuarios inventados.
9. Politica de retencion de datos personales de auditoria, incluyendo IP y metadatos seudonimizados.
10. Revocacion de sesiones activas cuando una identidad de autenticacion quede `blocked`, `inactive` o eliminada logicamente.
11. Crear una sesion nueva en cada login exitoso para evitar fijacion de sesion.
12. Responder `409` cuando el `permissionVersion` de la sesion no coincida con la version actual del usuario y obligar a refrescar/revalidar sesion.

S1A debe ser flaco. Su primer valor visible para negocio es:

```txt
entrar -> saber quien soy -> ver rol/area/permisos efectivos -> saber que leads sigue bloqueado
```

Si S1A intenta construir administracion completa de usuarios, IAM empresarial, flujos complejos o pantallas comerciales, fallo el alcance.

| Numero | Si entra | Dueno principal |
| --- | --- | --- |
| 1 | Identidad, usuarios, autenticacion, roles y permisos minimos. | Sistemas / Jefatura |
| 2 | Contrato canonico minimo de lead. | Sistemas / API |
| 3 | Modelo minimo de contacto y lead. | Sistemas / API |
| 4 | Bitacora obligatoria para acciones del lead. | Vendedor / Jefatura |
| 5 | Timeline basico del lead. | Vendedor / Jefatura |
| 6 | Reglas minimas de lista y detalle conceptual del lead. | Vendedor |
| 7 | Reglas de auditoria basica para cambios sensibles. | Jefatura / Sistemas |

P0-S1 no autoriza programar todo el CRM. Identidad P0-S1A queda cerrada en base de datos; el siguiente paso permitido es construir solo el runtime minimo de identidad definido en la version `0.3.14`, no abrir modulos comerciales ni mas vision.

## Prohibido ahora

Hasta que P0-S1 quede cerrado por producto, queda prohibido:

- programar API fuera del runtime minimo de identidad autorizado;
- recrear `package.json`, `src/`, migraciones de producto u OpenAPI fuera del alcance de identidad;
- instalar mas skills;
- crear nuevos modulos comerciales;
- agregar calendarios;
- agregar Kapso;
- agregar notas adhesivas;
- agregar delegaciones avanzadas;
- agregar dual-read con el CRM viejo;
- agregar sincronizacion real con ERP;
- agregar Redis, RabbitMQ o jobs operativos;
- crear leads antes de cerrar identidad/usuarios/roles;
- ampliar el alcance por parecer "enterprise".

## Definition of Done minima

En el runtime minimo de identidad autorizado, ninguna pieza se considera lista si no cumple estas reglas:

1. Todo endpoint mutable de negocio valida permiso efectivo en backend. Los endpoints propios de autenticacion/sesion (`/identity/session`, `/identity/logout`, `/identity/refresh`, Microsoft OIDC y reset local) se protegen con sesion, CSRF, cookies BFF, auditoria y reglas de autenticacion; no dependen de permisos CRM porque existen para crear, leer, renovar o cerrar identidad.
2. Ningun permiso se decide solo en frontend.
3. Toda accion sensible genera auditoria en la misma transaccion logica. El caso de uso de aplicacion decide que se audita; el repository solo puede registrar auditoria cuando la frontera transaccional lo exige para conservar atomicidad.
4. OpenAPI o contrato equivalente se actualiza antes de consumir desde frontend.
5. DTOs validan entrada con whitelist y rechazan propiedades no declaradas.
6. MySQL mantiene columnas comentadas, nombres canonicos y relaciones internas por IDs propios.
7. Kysely se usa para consultas SQL; no se aceptan strings SQL improvisados en controladores.
8. Los errores al usuario no exponen stack traces, SQL ni detalles internos.
9. Los comentarios de codigo explican reglas de negocio, seguridad o decisiones no obvias; no comentan obviedades.
10. Cada cambio trae verificacion minima: typecheck/build cuando exista runtime, prueba del caso principal y prueba del permiso/auditoria cuando aplique.
11. Cada archivo y funcion debe respetar SOLID practico: una responsabilidad clara, nombres entendibles, duplicacion evitada, constantes para valores repetidos y fail-fast ante configuracion critica.
12. Cuando una funcion empiece a mezclar concerns, se divide en funciones privadas enfocadas y la funcion publica queda como orquestador sin romper su contrato.

## Riesgos nombrados, no resueltos en P0-S1A

Estos temas no autorizan nueva implementacion ahora, pero deben estar visibles:

| Riesgo | Por que importa | Momento de decision |
| --- | --- | --- |
| Duplicados de lead | Un mismo cliente puede entrar por telefono, correo, campana o proyecto distinto. | Antes de P0-S1B leads. |
| PII y Ley 8968 Costa Rica | Telefonos, correos, cedula, WhatsApp y datos comerciales requieren retencion y consentimiento claros. | Antes de datos reales de leads. |
| Idempotencia al crear lead | Reintentos desde CRM, ERP o integracion no deben crear duplicados involuntarios. | Antes de crear lead. |
| IDOR | Un vendedor no debe ver registros de otro cambiando un `publicId`. | Primer endpoint real con recurso. |
| No-produccion | Usar la misma infraestructura del CRM viejo aumenta riesgo operativo. | Antes de ejecutar migraciones o pruebas con datos reales. |
| Convivencia y apagado del CRM viejo | El mayor riesgo de migracion es saber cuando se deja de usar el viejo. | Antes de P1 dual-read o migracion historica. |

## Orden obligatorio

El orden del proyecto es:

```txt
producto -> identidad/usuarios/roles -> contrato canonico minimo -> modelo MySQL minimo -> NestJS
```

Invertir el orden se considera volver a empujar codigo antes de entender el producto.

## Criterio de salida

Se puede avanzar al modelo MySQL minimo solo cuando:

- esta ley este aceptada;
- P0-S1A identidad este cerrado sin ambiguedades;
- cada "si" tenga dueno;
- cada "no" este escrito;
- el indice apunte a este documento como lectura cero;
- no existan documentos diciendo que el API comercial ya esta creado;
- quede claro que `SQL/001` fue aplicado solo como validacion schema-only, no como migracion productiva;
- quede claro que `conf_schema_migration` fue registrada por marca manual equivalente porque no existia `.env` seguro para probar el runner end-to-end;
- quede claro que `SQL/002` solo fue autorizado como seed de catalogos S1A, sin usuarios ni inserts de negocio;
- quede claro que solo el runtime minimo de identidad queda autorizado en la version `0.3.14`;
- quede claro que NestJS/API comercial sigue prohibido hasta aprobacion explicita posterior.
