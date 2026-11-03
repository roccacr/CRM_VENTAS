# Calendario: participantes y vínculos — 2026-10-29

## Ampliación vigente — 2026-11-03

El corte29 inferior conserva su evidencia; el contrato actual de
[64](64-Calendario-Global-API-y-Contexto.md) incorpora Graph conectado, publicación
condicionada de invitaciones/Teams y entrega independiente del guardado CRM.
No implica aceptación externa nueva. Notas admite propias/compartidas accesibles,
abiertas o completadas, sin exigir asignación de tarea. El lookup admite filtro
`leads` con hasta20 identidades autorizadas; orden solo expone su cliente si es
único y legible. Guardar revalida las relaciones y pertenencia orden/cliente.
Adéndum exige exactamente una orden y su cliente y congela sus identidades;
[83](83-Adendum-Migracion-065-y-Rollback.md) documenta el marcador y bloqueo de otro
evento futuro. El permiso `formalizacion.calendar.assign_lead` protege nuevas
asignaciones incluso por API directa; notas y otros módulos conservan su regla.

El selector carga una lista inicial acotada de leads autorizados. Tras elegir un lead, consulta sus órdenes autorizadas sin exigir texto adicional. Solo una orden en la consulta sin filtro permite selección automática; con varias, la elección es manual, incluso si una búsqueda posterior devuelve una única coincidencia. Las respuestas tardías no cambian el lead actual ni sustituyen una orden ya seleccionada. Una búsqueda escrita de un carácter pide al menos dos; buscar órdenes sin lead también requiere dos caracteres. Se mantienen límites, ACL y validación al guardar.

## Contraste del código - 2026-11-02

`CalendarController` registra `GET /calendar/lookup` y `CalendarLookupService`
revalida relaciones en la transacción de guardado. Los tipos de evento se filtran
por el catálogo JSON y la configuración activa; un tipo retirado no habilita
PATCH directo. Las selecciones persistidas se hidratan solo cuando el lector
conserva capacidad de editar el evento y acceso a sus recursos. Invitar no
autoriza etiquetas de notas/leads/órdenes privadas; no se inventan matches por nombre.

`participants` y `links` admiten hasta100 entradas cada uno en el contrato; las
fuentes/IDs se validan y notas solo admite origen nativo. El lookup de lead/orden
sin dos caracteres devuelve una lista vacía, no una lectura global comercial.
La evidencia de aplicación/lectura y las pruebas del29 de abajo mantienen su
fecha. Esta revisión no prueba altas reales, Outlook, Teams o notificaciones
de eventos, ni cambia el contenido de las BD.

## Alcance autorizado

El propietario aprobó completar crear/editar eventos con tipo obligatorio sin selección inicial, nombre, fechas, ubicación, descripción, participantes internos/correos externos y preferencia de Teams. Se agregan vínculos opcionales a notas pendientes propias o asignadas, leads por nombre/correo y órdenes por número de transacción. Outlook, correo y creación de enlaces Teams quedan fuera de este corte.

Los eventos nuevos se guardan únicamente en CRM_THINK_V2. Vincular una entidad legacy no la copia ni la modifica. Los vínculos conservan entidad, origen e identidad: ID público nativo o ID local legacy; un correo, tranid o ID de NetSuite no sustituye esa identidad. Una correspondencia explícita prioriza el registro nativo sin deducir equivalencias por texto.

## Implementación y aceptación

1. Ampliar el contrato estricto de calendario con participantes, vínculos y preferencia Teams. Mantener origen de módulo, versión y operación idempotente.
2. Reutilizar autorización de notas y políticas de lectura de leads/órdenes para búsquedas acotadas y validación al guardar. El selector no concede acceso.
3. Migración nativa aditiva para calificar vínculos por fuente; conservar datos anteriores. Guardar evento, participantes, vínculos y antes/después auditados en una transacción.
4. Invitaciones internas visibles sin conceder acceso global al módulo de origen; denegación explícita prevalece. Los vínculos privados no se divulgan por invitación.
5. Formulario común ordenado en evento, participantes y relaciones, con búsqueda diferida y descarte de respuestas obsoletas, sin enviar invitaciones externas.

Verificación: typecheck, lint, pruebas de calendario/autorización/migración y build en cada app. No ejecutar fixtures en bases compartidas. La aplicación de esquema y la lectura real se reportan por separado de pruebas con dobles; este documento no certifica por sí mismo aceptación visual ni invitaciones Outlook.

## Contrato de selección

`GET /calendar/lookup?moduleCode=formalizacion&kind=notes|users|leads|orders&search=...` devuelve `{items:[{id,source,label,secondary?}]}`. Las búsquedas de personas comerciales requieren texto mínimo y límite de resultados. La selección se valida otra vez al guardar; un resultado antiguo no autoriza un vínculo.

`participants` contiene identidades de usuario o correo externo, nunca ambos en una entrada. `links` contiene `{entityType: note|lead|sales_order, source: native|legacy, id}`. Las notas pertenecen al CRM nuevo. `details.teamsRequested` registra una preferencia, no una reunión creada.

Una nota vinculada conserva su estado y sus participantes. Completar un evento no completa automáticamente una nota ni acredita asistencia a una cita.

## Evidencia de este corte

- Migración `202610290055_calendar_relations` aplicada y registrada en `CRM_THINK_V2`. Verificados el origen, identidad única y CHECK de los vínculos. La comprobación de solo lectura `pnpm exec tsx scripts/verify-calendar-relations.ts` encontró cero eventos, participantes y vínculos; no se crearon fixtures ni se escribieron entidades legacy.
- Navegador con sesión existente: las cuatro búsquedas devolvieron HTTP 200. Se encontraron un usuario y una nota nativos, un lead legacy por nombre y cuatro órdenes legacy por prefijo del número. Se seleccionaron nota, lead y orden sin guardar el formulario. Esto prueba lectura y selección reales; no certifica todavía un alta/edición real confirmada en MySQL.
- API: 581 pruebas aprobadas en calendario, migraciones e inventario de autorización; ESLint y formato del alcance aprobados. La corrida global anterior tuvo 6664 aprobadas, 160 omitidas y un fallo de inventario por faltar las migraciones 054/055 en su expectativa; se actualizó y pasó en la corrida enfocada posterior.
- Frontend: 38 pruebas de calendario aprobadas, ESLint y formato del alcance aprobados. Enter en los buscadores o correos no envía el formulario; los resultados tienen altura acotada y las selecciones conservan sus etiquetas.
- Revisión independiente estática sin hallazgos en autorización de vínculos, presentación de etiquetas, transacción, replay y separación de fuentes. No sustituye la prueba de persistencia real.

En la última verificación pasaron `pnpm typecheck`, `pnpm build` y `pnpm lint` del API, además de `pnpm build` del frontend, que incluye TypeScript. Vite conserva una advertencia de tamaño del chunk compartido de Ant Design. Las primeras compilaciones habían fallado por errores de Notas en archivos concurrentes; tras modificarse esos archivos se repitieron las compilaciones y quedaron aprobadas, sin editar Notas desde este corte. La corrida global frontend previa había detectado una regresión de Enter en su buscador de Notas; no se repitió esa corrida global ni se declara resuelta desde las 38 pruebas enfocadas de calendario.

Outlook, envíos de correo y creación de reuniones Teams siguen pendientes deliberadamente. La preferencia y los correos se registran solamente en el CRM.

### Avisos y autoria vigentes (03/11/2026)

Los avisos internos de invitacion/actualizacion ya se escriben junto al evento y se consultan/marcan leidos por destinatario de sesion; no equivalen a envio o respuesta de Exchange. La participacion vigente y los denies se revalidan en cada lectura. Solo el organizador edita el evento, incluso con alcance amplio. Correos de clientes vinculados se resuelven bajo ACL al guardar, sin confiar en datos de contacto del navegador. Contrato y limites de validacion: [avisos nativos](64-Calendario-Global-API-y-Contexto.md). Este corte es revision estatica del desarrollo concurrente, sin pruebas de notificaciones ejecutadas.

### Cruce frontend del corte 2026-11-03 16:02:13.527338 UTC

Los avisos tienen consumidor en `NoteNotifications.tsx`: hook, contador y lista de calendario funcionan independientemente de `enabled` de notas. No se certificó entrega real. La edición propia de Outlook tiene API/editor implementados, pero el parser `calendar-service.ts:231` aún rechaza `source=outlook` con `canEdit:true`; el servidor puede emitir esa combinación autorizada. Esa incompatibilidad bloquea el recorrido afectado al corte y evita afirmar aceptación E2E. Véase [contrato y brecha](64-Calendario-Global-API-y-Contexto.md). Cambios posteriores quedan excluidos.

