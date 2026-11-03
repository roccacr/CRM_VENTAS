# 43 - Esquema nativo de Leads

## Lectura de perfil autorizada — 2026-11-03

La lectura federada `GET /leads/profile` ya está registrada y exige
`lead.profile.read` efectivo con deny prevaleciente; su contrato está en
[77](77-Perfil-Completo-Lead.md). No importa registros ni habilita el CRUD de
Leads futuro descrito aquí. Resuelve relaciones explícitas, conserva diferencias
por campo y pagina historia/órdenes; un reporte agregado no concede este permiso.
Los cortes anteriores sin endpoints corresponden al alcance de su fecha.

## Revision del modelo instalado en codigo - 2026-10-27

Se contrastaron `202610230031_leads_domain.ts`, tipos Kysely, comandos/lectores
nativos y el reporte conectado. Esta revision no abrio MySQL ni ejecuto DDL o
fixtures: nueve tablas/91 columnas y conteos de cero abajo son evidencia del
2026-10-23. La limpieza posterior [51](51-Limpieza-Datos-Nativos.md) vacio tambien
catalogos auxiliares; no inferir siete etapas disponibles hoy por el ledger 031.

La definicion fisica es el arreglo `leadStatements` de la migracion, con COMMENT
en columnas y tablas, timestamps UTC y FK exclusivamente nativas. No existe un
`SQL/031_leads_domain.sql` separado. El responsable usa `sec_user`; contacto,
proyecto y campana son FK internas. Referencias externas son sistema+ID, nunca
una columna NetSuite/Odoo ni una FK hacia legacy. 035 agrega el vinculo inverso
opcional de la orden al lead; no lo rellena por nombre, correo o numero externo.

El esquema 031 no crea CRUD HTTP. Los lectores de
[Captacion](53-Captacion-Leads-Reporte-Federado.md) y de Inicio ya consumen leads
nativos y legacy sin insertar contactos, eventos de etapa o motivos al leer.
El estado activo/inactivo sigue separado de la etapa perdido; el reporte cuenta
creados en periodo aunque hoy esten inactivos. La foto corresponde al publicId
nativo del vendedor, no al ID ERP. La conciliacion de vendedores del reporte
admite fallback de correo unico bajo sus reglas; no constituye una FK nueva ni
identidad de clientes por correo.

`test/migrations/leads-domain.mysql.spec.ts` es opt-in de lectura, pero incluye
una asercion de las siete etapas iniciales. Esa asercion verifica un dataset
especifico: puede fallar despues de una limpieza administrativa sin que falte la
estructura. No resembrar catalogos ni repetir 031 para fabricar un resultado verde.

## Alcance autorizado - 2026-10-23

El propietario autoriza crear y ejecutar la migracion nativa de contactos,
leads, referencias externas, etapas, motivos e historial. Solo estructura y
las siete etapas aprobadas; sin importar personas, motivos legacy, usuarios,
asignaciones, endpoints, sincronizacion, permisos nuevos ni pantallas.

## Identidad y responsable

`crm_lead.owner_user_id_lead` referencia `sec_user.id_user`, nullable si aun no
hay responsable conciliado. Nunca referencia un numero ERP ni una tabla vieja.
El adaptador resuelve `(sistema externo configurado, ID externo de usuario)`
mediante `int_user_external_identity` y obtiene la identidad interna.
La columna existente es `external_user_id_user_external_identity`.
La resolucion futura debe filtrar sistema y referencia activos, ignorar referencias
borradas logicamente y aplicar las validaciones del usuario interno; nunca buscar
por numero solo. La FK conserva responsables historicos aunque un usuario se inactive.

Para legacy, `leads.id_empleado_lead` corresponde historicamente a
`admins.idnetsuite_admin`, no a `admins.id_admin`. Esa lectura se interpreta
con su sistema de origen conocido; nunca se busca el numero indistintamente
en todos los proveedores. Otro proveedor se resuelve con su propio sistema.
Si falta la vinculacion, no se inventa usuario ni se asigna uno por coincidencia
numerica. La referencia de usuario no concede permisos.

## Modelo y reglas

- `crm_contact`: persona, correo/telefono originales y normalizados; sin
  unicidad por correo/telefono, pues no demuestran una misma persona.
- `conf_lead_status`: etapas comerciales administrables. El orden no impone
  transiciones. `crm_lead.status_lead` es activo/inactivo, independiente.
- `conf_lead_source`, `conf_lead_interest`: origen y clasificacion opcional.
  No se inventan equivalencias para los numeros legacy.
- `conf_action_reason`, `conf_action_reason_status`: motivos y etapas de
  destino en que se permite usarlos; no copiar la tabla `caidas` mezclada.
- `crm_lead`: contacto, usuario responsable, proyecto/campana propios,
  subsidiaria/corredor opcionales, etapa actual y version para concurrencia.
- `crm_lead_external_reference`: un lead puede existir en varios sistemas.
  Unicidad por sistema registrado e ID externo, sin columnas de proveedores.
- `audit_lead_status_event`: cada cambio y cada perdida ocupan filas distintas.
  Secuencia y operacion unicas por lead. Motivo obligatorio en transiciones,
  aplicable al destino mediante FK compuesta. Los snapshots iniciales no
  inventan etapa anterior ni fecha de un cambio historico desconocido.
- Fechas locales UTC con milisegundos: creacion y ultima modificacion. Triggers
  actualizan esta ultima independientemente de la zona horaria de la conexion.
  Fechas conocidas del origen se guardan separadas, una vez normalizadas a UTC.
- FK e indices son nativos, borrado fisico restringido. No existe FK cruzada
  hacia legacy. No se migra ningun lead con estado legacy ambiguo `2`.
- Anuncio conserva un nombre opcional hasta aprobar su catalogo. Contribucion,
  flags de calendario y valores ambiguos quedan fuera: no hay importador que
  descarte estos datos. El comentario inicial no sustituye futuras actividades.

La operacion comercial autorizada futura debe bloquear/versionar el lead, resolver motivos activos,
actualizar etapa, insertar evento y registrar auditoria central en una misma
transaccion. El corte de esquema 031 solo prepara almacenamiento. La inspeccion
posterior encuentra `LeadHistoryCommands`, registrado y exportado en
`AuditModule`, con comandos internos de actividad/etapa, bloqueo/version,
idempotencia y auditoria atomica. No se localizo consumidor comercial ni endpoint
HTTP de esos comandos; el llamador futuro debe autorizar actor y recurso.
Las tablas de eventos no tienen trigger de modificacion ni borrado en cascada;
la cuenta compartida no permite afirmar inmutabilidad frente a SQL administrativo.

## Ejecucion y verificacion

Migracion: `202610230031_leads_domain`, seleccionada con el runner existente.
Rechaza otra BD o tablas destino ya existentes sin registro; ante DDL parcial
requiere diagnostico y recuperacion explicita, no borrar tablas automaticamente.
El runner omite una migracion ya registrada. No se ejecutan migraciones al iniciar API.

Comandos desde `apps/api`:

```powershell
pnpm exec vitest run test/migrations/leads-domain.spec.ts
pnpm typecheck
pnpm lint
pnpm build
$env:MIGRATION_CONFIRM_SCHEMA_ONLY='CRM_THINK_V2'
pnpm migrate:identity:schema --only=202610230031_leads_domain
```

Pruebas: aislamiento del destino, rechazo de tablas previas, FK del responsable,
motivos por transicion, multiples perdidas, identidad externa, comentarios y UTC.
En BD compartida se verifican estructura, comentarios, FK y catalogos mediante
lecturas; no se insertan leads/contactos ficticios. Pruebas reales de restricciones
con escrituras deben usar una BD aislada, no registros comerciales compartidos.

## Resultado verificado - 2026-10-23

- Migracion 031 aplicada y registrada en `CRM_THINK_V2` a las
  `2026-10-23T19:55:31.542Z`. Segunda invocacion del runner finalizo sin error.
- Nueve tablas InnoDB, 91 columnas con comentario y ocho triggers de ultima
  modificacion UTC. FK responsable confirmada hacia `sec_user.id_user`.
- Siete etapas iniciales. Cero contactos, leads, eventos y motivos: no hubo
  importacion comercial ni motivos ficticios. Legacy no fue modificado.
- 43 pruebas enfocadas aprobadas y cinco verificaciones MySQL reales aprobadas
  con `LEAD_SCHEMA_MYSQL_TESTS=1`, exclusivamente consultas de lectura. Estas
  ultimas fallaron antes de aplicar el esquema y pasaron despues.
- API completo: formato, lint, typecheck, 5.366 pruebas aprobadas, 118 omitidas y
  build aprobado mediante `check-all.cmd`. Las cinco verificaciones de esquema
  MySQL se ejecutaron aparte y estan entre las omitidas por defecto del conjunto.
- La validacion general se detuvo en formato frontend: seis archivos de
  Mercadeo ajenos a esta entrega. No se corrigieron cambios concurrentes.
- No se ejecutaron escrituras comerciales para probar transiciones, concurrencia
  ni actualizaciones de fechas. Se verifico la estructura instalada; el escritor
  transaccional interno existe como codigo, sin consumidor comercial localizado
  ni evidencia de escritura real. Los lectores posteriores de Mercadeo
  ya consultan leads y citas por origen para resumenes (46/48); no son CRUD de
  Leads, importador comercial ni timeline HTTP federada. El timeline registrado
  consulta evidencia nativa (44). La lectura metadata comunicada por el coordinador
  el 2026-10-23 confirma 031/032/034 presentes y 033 NO aplicada; no inferir su
  ejecucion del archivo de migracion. Estado consolidado: [49](49-Estado-Actual-y-Cierre-Documental.md).

### Perfil: ampliación comercial y dependencia condicional (03/11/2026)

El perfil nativo sin vínculos explícitos puede leerse con legacy deshabilitado. Si se solicita legacy o una referencia explícita exige resolverlo, su indisponibilidad produce `503`; no se presenta un vínculo requerido como ausencia de datos. `opportunities` y `estimates` consultan registros comerciales reales por `idinterno_lead`, con `items`, `total`, `hasMore`, `page` y `available`, en páginas de 50 compartiendo `orderPage`. Sin identidad legacy resuelta, `available:false` distingue falta de consulta de ausencia de registros. La bitácora no determina su existencia. Contrato y límites de QA: [perfil completo](77-Perfil-Completo-Lead.md).
