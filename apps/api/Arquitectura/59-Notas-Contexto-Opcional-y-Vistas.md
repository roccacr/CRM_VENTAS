# 59 - Notas desde cualquier vista y relacion opcional

Actualizacion de contexto 2026-10-29: la nota se identifica por el registro
canónico (tipo/origen/ID), no por su URL ni por un numero ERP. La invitacion
permite consultar y responder en Mis notas/campana aunque no se pueda abrir
la ficha. Mostrarla dentro del registro exige acceso a esa ficha; actualmente
el resolvedor de orden implementado es Formalizacion. Las ubicaciones extra
son Homes autorizados, sin duplicar contenido ni conceder acceso a registros.
Contrato actual en [66](66-Notas-Enterprise-Seguimiento.md), QA en
[67](67-Plan-QA-Regresiones-20261029.md).

Fecha:2026-10-27. Correccion autorizada de la etapa3: crear notas no se limita a Home ni exige vincular una transaccion.

## Comportamiento vigente

El icono Mis notas sigue junto a la campana y abre el panel derecho. En cualquier pantalla del shell autenticado puede crearse una nota personal dentro de un modulo habilitado. En Todos se utiliza un modulo de notas permitido; no se inventa acceso a otro modulo.

Al crear aparece el check **Vincular esta nota a la vista actual**, desmarcado inicialmente. Muestra el destino y su tipo: Vista o Orden de venta. Sin marcar se guarda en Mis notas personales, sin asociarla al registro abierto. Marcado guarda la referencia contextual; la nota autorizada vuelve a aparecer al abrir ese mismo destino. La relacion existente no cambia al editar el texto.

Las bandejas actuales son Todas, En esta vista, Creadas por mi, Compartidas conmigo, Menciones y Asignadas a mi. Todas y el estado Todas son los valores iniciales; Pendientes filtra `open`. Los reintentos conservan identificador, payload y destino. El antiguo selector personal/vista pertenece al corte inicial de etapa3.

Ejemplo solicitado: `/home/formalization?orderSource=legacy&orderId=208` ofrece **Orden de venta208** (o su numero real una vez cargado el detalle). El origen legacy y el ID208 se conservan como identidad compuesta. No se trata208 como ULID nativo ni como identificador de un proveedor ERP. El URL sirve para reconocer el destino visible; no se almacena un URL arbitrario como autorizacion.

Vincular NO comparte la nota ni la hace publica. Autoria, invitaciones y autorizacion del destino siguen separadas. Compartir/menciones/respuestas/campana ya estan implementados; la copia compatible legacy permanece pendiente.

## Contrato API

Contextos aceptados:

```json
{"kind":"personal"}
```

```json
{"kind":"view","code":"formalization-contracts"}
```

```json
{"kind":"sales_order","source":"legacy","id":"208"}
```

Las ordenes nativas usan source=native e id=ULID. `{kind:view}` conserva el Inicio del modulo y su hash anterior; ahora siempre exige la autorizacion de esa vista, incluso omitido o reconstruido desde la BD. Codigos explicitos de Inicio se normalizan al mismo contexto. Las vistas permitidas provienen del registro notes-context.ts (menus y catalogos conocidos), con permisos propios y modulo; no acepta URLs, vistas inventadas o codigos de otro modulo.

Listado: `GET /notes?moduleCode=formalizacion&contextType=personal`, o `contextType=view&viewCode=formalization-contracts`, o `contextType=sales_order&recordSource=legacy&recordId=208`. Paginacion/estado y comandos versionados conservan contrato57. Omitir recordSource conserva native por compatibilidad. El cliente siempre conserva el origen cuando es legacy.

El servicio revalida cada orden mediante OrderTimingService, incluyendo autoria/alcance/aprobaciones. Su lectura antigua devuelve la identidad canonica legacy:208; la referencia persistida conserva el ID208 separado del sistema. Una colision que resuelva a otra identidad no adjunta la nota silenciosamente a otro registro.

## Persistencia y migracion041

Las notas viven en CRM_THINK_V2. Personal y vistas usan crm_note_link de tipo view; personal tiene codigo `<modulo>.personal`. Orden nativa usa FK nativa; orden antigua usa enlace external con el sistema registrado legacy_crm y external_id=208. Se comprueban enlace primario unico, tipo, modulo, sistema activo y hash canonico. Sin copiar registros comerciales.

La comprobacion de metadatos encontro solo NetSuite/Odoo en int_external_system. La041 registro unicamente (`legacy_crm`,`CRM Legacy`,`active`) mediante el runner. Rechaza configuracion existente incompatible/inactiva; nunca reactiva, actualiza o importa datos de forma implicita. No crea tablas ni activa escritor legacy. Postcondicion: origen activo y041 registrada.

## Verificacion

Pruebas frontend de checkbox opt-in, personal desde vista distinta a Home/Todos, deteccion del URL legacy antes de completar el detalle, vistas registradas y payload con origen. API: contratos, filtros, autoria, acceso a destinos, Home omitido/explicito/persistido, sistema inactivo, clave forjada y colisiones. Migracion041 probada con destino equivocado, conflicto, registro e idempotencia.

MySQL real en base temporal aislada:9 casos aprobados, incluidos personal, legacy, replay y rollback. El primer intento detecto un alias SQL reservado (`system`); se corrigio con escape de identificador y la suite completa posterior paso. Se eliminaron ambas bases temporales. No hubo fixtures en la base compartida. La auditoria SQL usa un doble transaccional; no equivale a un guardado autenticado de extremo a extremo en la BD compartida.

Revision independiente cerro el bypass de autorizacion de Inicio; sin P1/P2 restantes en la revision final. Las entregas de notificaciones/legacy no forman parte de esta comprobacion.
## Correccion del identificador de presentacion legacy

Se reprodujo el400 al abrir el detalle real: FollowUpItem usa id=legacy:208, pero el contrato de Notas exige source=legacy,id=208. Otros servicios de Formalizacion ya convertian este alias; Notas no lo hacia. No era un cambio del ID guardado en BD.

Plan ejecutado: prueba con el ID real prefijado; conversor unico normalizeNoteContext en el cliente de Notas; reutilizacion en URL/NotesTarget y en GET/POST; pruebas de ambas fuentes y continuidad del borrador. El servidor mantiene la misma validacion estricta.

Solo convierte el alias exacto legacy:<entero positivo valido> cuando source=legacy. Conserva el texto del ID, sin cambiar el objeto original, y verifica el rango2147483647 de la BD antigua. No convierte ULID nativos, prefijos repetidos, ceros iniciales o cadenas malformadas. No decide si dos ordenes coinciden por numero ni cambia la resolucion autorizada existente en la API.

La identidad normalizada tambien evita remontar el editor al pasar del URL208 al detalle legacy:208, conservando el borrador y su destino. Consulta y creacion mandan el mismo par origen/ID. Sin migraciones, cambios de permisos, imports ni escrituras de negocio en esta correccion.

Validacion de esta correccion: se observo el fallo con el ID real prefijado antes de implementar; despues pasaron55 pruebas focalizadas de Notas y1008 pruebas frontend completas (72 archivos). Typecheck, build y lint de los archivos modificados aprobados; el servidor Vite sirve el conversor actualizado. Revision independiente sin P1/P2; se cubrieron tambien limites, prefijos malformados y continuidad del borrador. check-all.cmd sigue bloqueado por formato de tres archivos API ajenos a esta correccion; el lint global frontend detecto dos no-null assertions ajenas. No se hizo guardado autenticado contra la base compartida ni se cambio el contrato del servidor.
