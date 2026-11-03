# 68 - Notas vinculadas a clientes/leads y órdenes: contrato y plan histórico

Revisión de código 2026-11-02: están registrados los tres endpoints de selección,
lectura y reemplazo, el campo opcional de creación y la presentación de resúmenes
en las lecturas existentes. La UI utiliza Select con búsqueda. El texto por etapas
conserva el plan aprobado y se interpreta junto al contrato implementado inferior,
no como una afirmación de que todavía falte desarrollar todo el vínculo.
Los pendientes de conectividad/SQL y aceptación real del29 no se cierran sin una
prueba nueva; esta revisión documental no la ejecuta ni importa registros.

Fecha: 2026-10-29. Estado: implementado y verificado localmente, con aceptación
comercial y SQL adicional pendientes por conectividad. El plan aprobado se
implementó sobre `crm_note_link`, sin migración adicional ni importación de
registros comerciales. Los resultados de verificación se registran al cierre.

## Objetivo

Desde cualquier pantalla, permitir vincular una nota a un cliente/lead y una
orden de venta, juntos o por separado, sin elegir BD ni escribir IDs internos.
Mostrar vínculos reconocibles en creación/edición, tarjeta, conversación y hoja
flotante. Mantener las mismas invitaciones y permisos de la nota.

La nota puede seguir siendo personal o pertenecer a una vista. Ese contexto,
los registros relacionados, los Homes adicionales y los invitados son conceptos
distintos. Vincular un registro no invita usuarios ni concede acceso comercial.

## Hallazgos verificados

| Área | Estado actual |
| --- | --- |
| Identidad nativa | crm_lead, crm_contact y crm_sales_order tienen publicId único |
| Cliente de una orden nativa | crm_sales_order.lead_id_sales_order → crm_lead → primary_contact_id_lead → crm_contact |
| Cliente de una orden antigua | ordenventa.id_ov_lead → leads.idinterno_lead; este último no es único y los lectores existentes rechazan ambigüedad |
| PK antigua del lead | leads.id_lead; no sustituirla por el identificador de proveedor idinterno_lead |
| PK antigua de orden | ordenventa.id_ov; id_ov_tranid es etiqueta comercial, no identidad global |
| Correspondencia de orden | crm_sales_order.id_old_produccion_sales_order es único; el lector actual ya intenta ese puente nativo antes de legacy |
| Correspondencia de lead | crm_lead_external_reference identifica sistema + ID externo de forma única; debe conocerse qué identidad representa cada sistema |
| Vínculos de notas | crm_note_link ya tiene FK nativas para lead, contacto y orden, referencia externa y unicidad por nota/destino |
| Contexto principal | NoteContext conserva personal/view/sales_order; context() valida un único vínculo principal, admitiendo secundarios tipados |
| Presentación | Tarjeta, hoja y conversación reciben resúmenes comerciales reautorizados; referencias restringidas no exponen identidad ni nombre |

La metadata consultada no muestra una tabla comercial clientes en legacy.
api_clients no debe interpretarse como clientes comerciales por su nombre.
En los lectores actuales, «cliente» proviene del lead y sus datos personales.
Para esta entrega, el selector Cliente/lead se apoyará en esa identidad comercial;
crm_contact representa a la persona nativa. No fabricar un contacto legacy con
el mismo número ni crear un dominio nuevo de clientes por inferencia.

## Etapa 1 - Identidad y autorización

1. Representar toda referencia como tipo + origen + ID de esa fuente. El origen
   es dato interno, nunca un selector Nativa/Legacy para el usuario.
2. Resolver primero la identidad nativa o una correspondencia explícita válida.
   Si no existe, consultar el adaptador legacy habilitado y confirmar existencia.
   Ausencia significa lookup sin resultado, no timeout, 503, deny o registro
   nativo inactivo/eliminado; estos casos no habilitan fallback a datos antiguos.
3. Reutilizar el puente único de orden y referencias externas de lead. No unir
   por nombre, email, teléfono, número ERP suelto ni coincidencia de dos enteros.
   Si falta una correspondencia confirmada, conservar identidades distintas.
4. Mantener la referencia original guardada. El resolvedor aporta identidad
   canónica y aliases confirmados para encontrar la misma nota desde cualquiera
   de las fuentes, sin reescribir silenciosamente su contexto principal.
5. Comprobar acceso al registro antes de ofrecerlo, vincularlo, mostrar su nombre
   o abrirlo. Reutilizar la política de órdenes; definir expresamente el acceso
   individual a lead/contacto donde aún no exista un resolvedor autorizado.
   El permiso del reporte agregado de Mercadeo no concede lectura individual.
6. Separar autorización de nota y recurso: un invitado puede conservar nota y
   conversación sin ver nombres, números, proyecto ni enlaces restringidos.
   Presentar «Registro vinculado sin acceso», sin filtrar datos por los chips.

Si hay múltiples candidatos o correspondencias incompatibles, devolver conflicto
y pedir una selección comercial inequívoca; nunca escoger la primera fila.

## Etapa 2 - Persistencia sin duplicación

- Reutilizar crm_note_link para relaciones de negocio adicionales; una fila por
  referencia y una sola nota. Conservar el contexto principal y su is_primary.
- Eliminar la suposición de exactamente un vínculo en decodificación/listados,
  reemplazándola por validación de un único principal y secundarios tipados,
  autorizados y sin duplicados. No quitar validaciones para aceptar cualquier fila.
- Mantener compatibilidad con target_key actuales, que incluyen módulo/contexto.
  La búsqueda por recurso debe comparar aliases y módulos de notas autorizados,
  no depender exclusivamente del hash de un módulo ni de su URL.
- Registrar altas/bajas de relaciones con autor, fecha UTC, bitácora y recibo
  idempotente en la misma transacción nativa. Usar control de versión existente
  de colaboración para evitar pisar cambios simultáneos de relaciones.
- Gestionar relaciones existentes exige autoría y edit_own, además de acceso al
  destino. Crear exige create. No agregar edit_any ni ampliar roles por defecto.
- Primero comprobar si basta el esquema actual. Solo crear migración aditiva
  si falta una restricción/índice demostrable; documentar cada campo y rollback.
- No copiar leads, clientes, órdenes ni historia legacy a la BD nueva. Guardar
  una referencia a un registro antiguo no importa su contenido.

Al elegir una orden, sugerir su cliente/lead real y permitir confirmar el vínculo
adicional. La relación se obtiene por FK/lector validado; no por el texto mostrado.
Si los registros elegidos son independientes, no presentarlos como cliente y orden
del mismo negocio. Una asociación deducida no debe guardarse como si fuera explícita.

## Etapa 3 - API común

Rutas implementadas:

- GET /notes/related-record-options: búsqueda paginada por tipo y texto, con
  sesión, permisos, límites, fuentes consultadas y resultado parcial explícito.
- GET /note-collaboration/notes/:id/related-records: relaciones reautorizadas.
- PUT /note-collaboration/notes/:id/related-records: reemplazo controlado por
  autor con operationId y expectedCollaborationVersion.

Ampliar creación con relatedRecords opcional; clientes actuales sin ese campo
conservan su comportamiento. Añadir el mismo resumen autorizado a listado,
conversación y lectura personal para no hacer una petición por tarjeta.

Una búsqueda consulta nativa primero y agrega resultados legacy autorizados,
deduplicando solo aliases demostrados. Si legacy no está disponible, el resultado
debe advertir que no pudo consultarse todo; no convertirlo en cero coincidencias.
Si falla nativa, no asumir ausencia para preferir legacy. Validar cada referencia
otra vez al guardar: no confiar en nombres o permisos enviados por el cliente.

## Etapa 4 - UX en las tres ubicaciones solicitadas

**Crear o editar:** sección «Relacionar con» con selectores de Cliente/lead y
Orden de venta, búsqueda por datos comerciales, carga, vacío y reintento. Mostrar
nombre, folio y proyecto autorizado; permitir quitar vínculos y conservar los
seleccionados al fallar el guardado. No mostrar BD ni IDs internos como elección.
El checkbox «Vincular a la vista actual» queda separado de estas relaciones.

**Tarjeta y hoja:** chips «Cliente: Ana Pérez» y «Orden: OV-123», solo con acceso
actual. Si hay varios vínculos, resumir y permitir ver el resto sin desbordar la
tarjeta. Estos nombres son ejemplos de diseño, no registros consultados.

**Conversación:** bloque «Registros relacionados» junto al contenido original,
con cliente/lead, orden y acción «Abrir» únicamente cuando existe una ruta
implementada y autorizada. El autor gestiona vínculos desde allí. No permitir
que un participante edite relaciones ajenas ni mostrar enlaces ficticios de
Ventas/Mercadeo/Contabilidad antes de tener sus fichas de detalle.

Al abrir un lead u orden desde un contexto compatible, buscar notas con cualquiera
de sus vínculos autorizados, aunque se hayan creado desde otro módulo. Ver el
registro no concede acceso a notas donde no se invitó a esa persona.

## Etapa 5 - Actualizaciones, retirada de legacy y QA

Una modificación de relaciones genera invalidación realtime para lectores
vigentes y refresca tarjeta/conversación sin duplicar nota ni crear invitaciones.
Al retirar legacy, los registros nativos y sus vínculos siguen operando. Una
referencia antigua sin equivalente nativo confirmado queda «Registro no
disponible»; la nota privada y conversación se conservan. No prometer recuperar
un registro desaparecido sin importarlo ni tener un equivalente existente.

Casos mínimos de aceptación:

1. Lead/orden solo nativos, solo legacy, y combinación de fuentes en una nota.
2. Nativo con alias legacy confirmado: una identidad visible y la misma nota.
3. IDs iguales entre fuentes, idinterno_lead duplicado y aliases incompatibles:
   sin unión falsa ni selección por orden de filas.
4. Nativo ausente frente a nativo caído, eliminado, inactivo o sin permiso:
   distinguir resultados y no eludir autorización con fallback.
5. Lead/cliente asociado a la orden correcto, inexistente o ambiguo.
6. Autor con/sin capacidad, invitado de otro módulo, lector de recurso no invitado,
   deny y permiso revocado durante búsqueda, guardado o entrega por socket.
7. Chips, nombres y navegación restringidos sin exponer metadata comercial;
   acceso al hilo conservado cuando corresponde.
8. Notas actuales con un vínculo, personales, vistas y Homes adicionales:
   compatibles después de admitir secundarios; sin duplicar resultados de JOIN.
9. Crear/editar/quitar vínculos con versión, doble clic, respuesta perdida,
   rollback de auditoría y replay idempotente.
10. Listas paginadas, búsquedas cruzadas sin N+1 y baja de legacy sin afectar
    notas nativas. Pruebas SQL en esquema temporal, nunca importación comercial.

Cierre: pruebas nuevas primero en rojo y luego verde; regresión notas API/UI,
contratos, permisos, SQL aislado, sockets y comprobación visual autorizada.
Ejecutar formato/lint/tipos/build y registrar fallos/omisiones por separado.

## Código que se debe reutilizar y ampliar

- API notas: notes.contract.ts, notes-context.ts, notes.repository.ts,
  notes.service.ts, note-collaboration.contract/service/repository y módulo.
- Lecturas existentes: order-record.query.ts, order-timing.repository.ts,
  legacy-order-timing.reader.ts y referencias externas de lead/orden.
- Autorización: políticas individuales de orden y capacidades/ACL de notas;
  ampliar resolvedores de lead/contacto, sin tratar un reporte como ficha.
- UI: PersonalNotes.tsx, NotesInbox.tsx, NoteCard.tsx, NoteSheet.tsx,
  NoteCollaborationDrawer.tsx y servicios tipados de notas.
- Esquema: migración039 y DDL existente de crm_note_link; ubicaciones052 siguen
  siendo Homes, no una tabla alternativa de clientes/órdenes.

No se necesita una librería nueva para este vínculo de dominio. La propuesta
reutiliza los repositorios, Ant Design, auditoría e idempotencia existentes.

## Contrato implementado y límites

- La referencia enviada es `{kind: "lead" | "sales_order", source: "native" |
  "legacy", id: string}`. IDs nativos públicos y PK legacy se validan por
  separado. El servidor no acepta nombres, permisos ni aliases del navegador.
- La búsqueda recibe `moduleCode`, `kind`, `search` y `page`; páginas de 25,
  máximo 120 caracteres de búsqueda y aviso `partial` ante indisponibilidad
  legacy. Un fallo nativo no activa fallback.
- Crear admite `relatedRecords` opcional. Reemplazar exige `operationId`,
  `expectedCollaborationVersion` y `relatedRecords`; hasta 20 referencias.
  Se preservan el principal inmutable y secundarios cuyo acceso se restringió.
- Las relaciones se guardan dentro de la transacción existente, con auditoría,
  recibo idempotente e invalidación realtime. El historial público elimina las
  identidades de relaciones del JSON de auditoría para no filtrar recursos.
- Si un destino seleccionado coincide mediante alias confirmado con el contexto
  principal, se conserva solo el principal. Las referencias efectivas derivadas
  por el servidor no alteran el hash de la petición original ni el replay.
- La interfaz utiliza dos Select con búsqueda, Cliente/lead y Orden de venta;
  no presenta una lista permanente de botones ni exige elegir base de datos.
  El cliente de una orden se sugiere para confirmación explícita.
- El contexto de orden admite vínculos principales y secundarios y aliases
  confirmados sin duplicar notas. El contexto `lead` y una ruta de detalle de
  lead no se inventan en esta entrega: sus vínculos aparecen en Mis notas y en
  la conversación; integrar una futura ficha de lead requiere su consumidor.
- Navegar a una orden utiliza la ficha existente de Formalización y su permiso.
  Recibir una nota nunca concede acceso comercial. No se certifica con estos
  cambios una ficha de órdenes de Ventas, Mercadeo o Contabilidad inexistente.

## Aceptación visual y SQL pendiente

Check completo API final (`pnpm check`): formato, lint, tipos, 6.668 pruebas
aprobadas, 161 omitidas condicionales y compilación aprobados. Frontend actual:
formato/lint del cambio y compilación con TypeScript aprobados; 192 pruebas
de notas aprobadas, incluidas selección por teclado y paginación en el Select.
Los avisos de tamaño de bundle de Vite se conservan como advertencia.

La suite general frontend repetida aprobó 1.271 pruebas en 93 archivos. La
primera ejecución había fallado dos pruebas de movimiento (1.269 aprobadas):
se explicitó el viewport del fixture sin modificar arrastre productivo y la
repetición pasó. No se atribuye con certeza la causa del primer desplazamiento
a ese cambio. Se aisló además `saveNotePlacement.mockReset()` para que respuestas
once pendientes no contaminen otra prueba; después aprobaron las 25 del archivo.
La suite general no se repitió una tercera vez por ese cambio exclusivo de test.

Regresión enfocada de notas API, después de prevenir duplicación del principal
por alias: 312 pruebas aprobadas y 42 omitidas condicionales. QA verificó que
crear/reemplazar deriva los vínculos efectivos sin alterar la petición usada
para el recibo y que campos internos de persistencia enviados por el navegador
son rechazados. Formato y lint de los archivos QA aprobaron. Estos resultados
no equivalen a ejecutar los casos SQL condicionales ni a aceptación multinodo.

Se abrió una pestaña independiente del CRM con la sesión existente de Roberto:
Mis notas → Nueva nota → Relacionar con cliente u orden. Se comprobó que ambos
controles son Select y que Cliente/lead se despliega. No se creó ni editó una
nota. La búsqueda real no pudo completarse: las consultas del API mostraron
error, junto a consultas de calendario/notas de esa sesión. Esto no acredita
selección, guardado ni entrega realtime con registros comerciales reales.

Los nuevos casos SQL de aliases, creación atómica e historial redactado quedaron
sin ejecución por `ETIMEDOUT` antes de crear el esquema temporal. No se importaron
datos ni se modificaron tablas comerciales para realizar estas comprobaciones.
