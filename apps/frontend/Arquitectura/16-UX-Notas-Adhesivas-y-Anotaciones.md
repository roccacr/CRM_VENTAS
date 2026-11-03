# 16 - UX Notas Adhesivas y Anotaciones

## Corte contrastado - 2026-11-02

El runtime incluye las capacidades descritas abajo y los vínculos adicionales
de [68 API](../../api/Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md).
Cliente/lead y Orden de venta se eligen en Select con búsqueda/paginación remota,
sin listas permanentes de candidatos ni selector de BD. Enter selecciona con el
desplegable abierto y no envía accidentalmente la nota. La relación secundaria
se administra aparte del contexto original, con versión e identificador estable.
Tarjeta, hoja y conversación reciben el mismo resumen reautorizado.

Los vínculos restringidos se conservan sin exponer nombres, fuente, IDs o URLs.
El autor gestiona relaciones con su capacidad vigente y nota pendiente; un
participante no obtiene edición por recibir una invitación. La sugerencia del
cliente de una orden requiere confirmación explícita. La ficha futura de lead
no se crea por el hecho de poder relacionarlo a una nota.

El QA registrado en67/68 conserva su fecha. Redis multinodo, benchmark, copia
legacy, adjuntos y aceptación con dos cuentas reales no se certifican mediante
esta revisión documental ni se activan para completar un texto.

## Implementación vigente - 2026-10-29

Este corte sustituye las recomendaciones del blueprint conservado más abajo.
La implementación usa React, Ant Design, estado/hooks locales, servicios fetch
canónicos y Socket.IO. Tiptap, dnd-kit, TanStack Query y Zustand no son dependencias
requeridas por las notas actuales. No se almacena texto de notas en localStorage.
Contratos: [60 - Colaboración](../../api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md),
[62 - Tiempo real](../../api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md)
y [66 - Seguimiento](../../api/Arquitectura/66-Notas-Enterprise-Seguimiento.md).

### Entrada, bandejas y acciones

El icono de documento «Mis notas» está junto a la campana, en escritorio/móvil,
y abre el Drawer compartido del shell cuando existe permiso efectivo de notas.
Una nota nueva es personal por defecto. El checkbox «Vincular esta nota a la
vista actual» muestra el destino reconocido; vincular no invita a nadie.

- Bandejas visibles: Todas, En esta vista, Creadas por mí, Compartidas conmigo,
  Menciones y Asignadas a mí. Todas es la entrada inicial.
- Mostrar: Pendientes (`open`), Completadas, Archivadas y Todas; Todas por defecto.
- Tarjetas y conversación ofrecen completar/reabrir/archivar según capacidades
  del API. No existe edición/eliminación de notas ajenas ni bypass por Owner.
- El autor crea/edita contenido de texto plano, color y prioridad; el servidor
  controla autoría, permiso efectivo y versiones. Cada comentario puede editarse
  o retirarse únicamente por su autor con su capacidad vigente.
- Buscar en las bandejas globales consulta API sobre notas autorizadas y sus
  comentarios; filtros de módulo, autor y fechas de creación
  se aplican antes de paginar. En esta vista conserva búsqueda local del contexto.
- El directorio de autores no se limita a la página actual de resultados.

La bandeja consulta todos los orígenes de orden por defecto. No muestra opciones
Nativa/Legacy ni pide un ID interno: la procedencia técnica permanece en el
contrato y en la identidad del registro, sin exigir que el usuario conozca las BD.

Las fechas iniciales de la bandeja cubren el mes local actual completo: desde
el día 1 a las 00:00 hasta el último día a las 23:59. Se aplican desde la primera
consulta, sin pulsar Aplicar. El límite superior incluye todo el minuto elegido
(segundos 59 y milisegundos 999) antes de convertir a UTC. Las fechas siguen
siendo editables; Limpiar fechas quita ambos límites para consultar sin periodo.

### Invitar, mencionar y conservar privacidad

`NoteParticipantsPicker` precarga todas las páginas autorizadas del directorio,
ordena en español, busca por nombre y admite selección múltiple con publicId.
Incluye cuentas activas, inactivas y pendientes no eliminadas; muestra su estado.
No exige compartir módulo o rol con el autor. Las cuentas inactivas/pendientes
no obtienen sesión o acceso inmediato: la entrega se valida al activarse.

Invitar concede lectura o respuesta a la conversación según el acceso otorgado;
no autoriza una orden ni una vista de negocio. Mencionar avisa a una persona que
ya participa: no sustituye la invitación. Retirarla revoca la conversación y sus
avisos. Sin invitados, solo el autor ve la nota. La UI usa capacidades devueltas
por API y no decide acceso por nombres de roles.

### Identidad de orden y ubicaciones

Crear una nota permite relacionar Cliente/lead y Orden de venta mediante Select
con búsqueda remota y paginación, sin elegir BD ni escribir IDs. El autor puede
gestionar vínculos secundarios desde la conversación mientras la nota esté
pendiente y conserve permiso. La selección del cliente sugerido de una orden
requiere confirmación; no se guarda una asociación deducida automáticamente.
Tarjetas, hojas y conversación muestran nombres/folios solo con acceso actual;
sin acceso se presenta un vínculo restringido. El contexto original no se cambia.
Contrato, fuentes y límites: [68 API](../../api/Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md).

Una orden se identifica por `sales_order` + `native|legacy` + ID; el publicId
nativo y el ID legacy no son intercambiables. `netsuiteId` es referencia externa,
no identidad de la nota. La misma identidad permite recuperar la nota desde un
contexto compatible de otro módulo sin copiarla ni depender de la URL de origen.

El shell reconoce parámetros de orden en Formalización, Ventas, Mercadeo y
Contabilidad, pero esto no acredita una ficha comercial implementada en cada
módulo. El autorizador de órdenes actualmente reutilizado sigue siendo el de
Formalización. No se inventan rutas, permisos ni una apertura automática de la
orden por recibir una invitación. Si el invitado puede leer la nota pero no el
registro, la conversación permanece disponible en campana/Mis notas con contexto
restringido y sin exponer información del recurso.

«Mostrar también en estos inicios» permite al autor guardar Homes adicionales
que API ofrece como autorizados. No sustituye el vínculo principal, no duplica
la nota y no agrega participantes. El mismo lector debe tener autorización de
la nota y de la ubicación para verla allí. No es un editor de URLs arbitrarias.

### Movimiento y peticiones en segundo plano

Las notas flotantes abiertas permiten mover, cambiar tamaño, ocultar, plegar y
PIN por usuario y clase de viewport. PIN distingue anclaje a ventana de anclaje
al contexto. El guardado de layout se encola, serializa y conserva la última
posición deseada sin bloquear el siguiente arrastre. Estado/error/reintento
hacen visible una persistencia pendiente; no se finge que se guardó.

Marcar avisos leídos, completar/reabrir/archivar, retirar un comentario y seguir
o silenciar respuestas emplean proyección local y peticiones en segundo plano
según cada consumidor, con reconciliación y feedback de fallo. Crear/editar nota
y enviar/editar comentarios esperan confirmación; operaciones de seguimiento,
recordatorio y ubicaciones también muestran guardado confirmado. No describir
«todo asíncrono» como ausencia de control de errores o como guardado asegurado.
Respuestas inciertas conservan operationId y borrador para reintentar sin duplicar.

### Responsable, vencimiento, recordatorio e historial

`NoteWorkflowPanel` muestra responsable opcional, vencimiento compartido y
recordatorio exclusivo del lector. El responsable se elige entre autor y
participantes ya invitados; asignar no comparte con una persona nueva. Solo
el autor con permiso de edición y nota pendiente puede cambiar responsable/vencimiento.
Si la nota sigue pendiente y API devuelve gestión deshabilitada, un div de alerta
explica la regla con el nombre del autor y los campos quedan de consulta.
En notas completadas o archivadas se oculta el formulario Responsable y vencimiento.
Las ubicaciones también muestran un aviso de autoría y permiso para compartir.
El recordatorio personal se gestiona por separado; no concede edición de la tarea.

«Avisarme (hora local)» permite fecha/hora, En 1 hora, Mañana a esta hora,
posponer y cancelar mi recordatorio. El servicio convierte a UTC; el vencimiento
no es el mismo campo que el recordatorio. La bandeja muestra Asignadas a mí,
Vencen hoy y Vencidas con zona horaria explícita del resumen. Completar/archivar
y revocar acceso cancelan/suprimen entregas según las reglas del contrato66.
El historial paginado muestra actividad saneada, respetando la privacidad de
recordatorios y preferencias personales. Cambios remotos no sobrescriben un
borrador sucio: la UI permite releer descartando explícitamente el borrador.

### Campana y tiempo real

Un provider por sesión autentica Socket.IO, escucha invalidaciones y reconsulta
REST autorizado para campana/bandejas/conversación. No confía en payloads del
socket como permiso de lectura ni entrega cuerpos privados por ese canal.
Reconexión/foco y fallback desconectado reconcilian datos; eventId deduplica.
Solo forbidden/access_denied/revoked se tratan como revocación; errores
transitorios/rate limit reintentan y reconcilian sin retirar una sala válida.

Abrir la campana no marca avisos leídos. Se pueden leer individualmente, por
grupo y todos, con agrupación opcional por nota. Seguir/silenciar controla avisos
de respuestas; no equivale a cancelar recordatorios o avisos de responsabilidad.
Invitación, respuesta, mención y avisos de seguimiento se presentan con quién,
nota y fecha. Recibir un aviso no permite editar la nota ajena.

### Evidencia y límites

El [QA del 29](../../api/Arquitectura/67-Plan-QA-Regresiones-20261029.md) registra
1233 pruebas frontend aprobadas, 259 focalizadas de API/esquema de notas y 32
SQL/sockets aprobadas por separado; las suites se solapan y no deben sumarse.
Ambos proyectos aprobaron formato/lint/tipos/build. El primer check-all conservó
exit1 por un error de tipado de tests corregido antes del check frontend final.
Este corte documental referencia esa ejecución; no vuelve a ejecutar pruebas.

Siguen pendientes copia compatible legacy, adjuntos (excluidos del alcance),
aceptación Redis con dos servidores, benchmark de carga/latencia y aceptación
visual con dos cuentas reales. Sockets reales con identidades sintéticas y SQL
local no prueban esos tres últimos puntos ni cobertura completa de producción.

## Antecedente y blueprint - cortes del 22 al 27 de octubre

Propuesta posterior solicitada el2026-10-27: [56 - notas colaborativas](../../api/Arquitectura/56-Plan-Notas-Colaborativas-y-Convivencia-Legacy.md).
Investiga la tabla legacy real, autoria exclusiva, respuestas, inbox, posiciones
personales y convivencia de fuentes. Las etapas1/2 de backend ya estan implementadas: [contrato57](../../api/Arquitectura/57-Notas-Etapa2-API.md). La UI personal ya esta implementada: [58](../../api/Arquitectura/58-Notas-Etapa3-Interfaz-Personal.md); compartir y campana interna implementados en etapa4 (contrato60), copia legacy pendiente.
las tablas, librerias y permisos de este blueprint anterior no son decisiones
ejecutadas. En particular, edit_any/delete_any no forman parte de la propuesta56.


## Vigencia documental - 2026-10-22, corte f2dc4f1

Blueprint historico: el editor personal vigente es la etapa3 documentada en58. Tiptap, dnd kit, TanStack Query y Zustand son recomendaciones de blueprint, no dependencias actuales. Las fases descritas no abren alcance por si mismas.

## Veredicto

El frontend debe permitir notas adhesivas y anotaciones contextuales en vistas clave del CRM, pero sin convertirlas en desorden visual.

Las notas deben ayudar a trabajar mejor: recordar, advertir, coordinar, documentar y dar contexto.

## Librerias recomendadas

Stack recomendado:

```txt
@tiptap/react
@tiptap/starter-kit
@dnd-kit/core
```

Uso:

- Tiptap: editor de contenido de la nota.
- dnd kit: mover y posicionar notas en vistas tipo tablero/detalle.
- TanStack Query: cargar, guardar, invalidar y sincronizar notas con API.
- Zustand: preferencias visuales no criticas, por ejemplo panel abierto/cerrado.

No usar localStorage como fuente de verdad. Puede usarse solo para preferencias temporales de UI.

## Por que no usar una libreria completa de sticky notes

El CRM necesita:

- permisos por usuario, equipo y rol;
- auditoria;
- timeline de entidad;
- busqueda;
- notas privadas y compartidas;
- menciones;
- integracion con tareas, calendario, correo o Kapso;
- persistencia en MySQL;
- control de datos sensibles.

Una libreria visual de sticky notes normalmente resuelve arrastrar y pintar notas, pero no resuelve el negocio del CRM.

## Vision UX

Cada vista puede tener notas cuando aporte valor operativo:

```txt
detalle de lead
detalle de oportunidad
detalle de estimacion
detalle de orden de venta
detalle de contrato
calendario
vista gerencial
formalizaciones
cobros futuro
modificaciones futuro
```

Tipos visibles:

```txt
Nota privada
Nota del equipo
Nota de jefatura
Recordatorio
Advertencia
Entrega de contexto
```

## Reglas de experiencia

- Las notas no deben tapar acciones criticas.
- El usuario puede ocultar/mostrar panel de notas.
- En pantallas densas, usar panel lateral antes que notas flotantes.
- En vistas tipo tablero o seguimiento, se permiten notas flotantes si no rompen la lectura.
- Toda nota debe mostrar autor, fecha y visibilidad.
- Una nota compartida debe indicar quien puede verla.
- Una nota resuelta debe quedar visible en historial si el usuario tiene permiso.
- La UI no calcula permisos finales; usa `canEdit`, `canShare`, `canDelete`, `canResolve` devueltos por API.

## Componentes esperados

```txt
NotesPanel
NoteCard
StickyNoteCanvas
NoteEditor
NoteVisibilitySelector
NoteShareDialog
NoteMentionList
NoteHistoryDrawer
NoteSearch
```

Regla de separacion:

- `components/ui` puede tener piezas genericas como `NoteCardShell` o `RichTextEditorShell`.
- `modules/notes` contiene reglas de notas.
- `modules/sales` decide donde se muestran notas de leads.
- `modules/formalizations` decide donde se muestran notas de Formalizaciones.

## Estructura frontend esperada

```txt
src/modules/notes/
+-- components/
|   +-- NotesPanel.tsx
|   +-- NoteCard.tsx
|   +-- StickyNoteCanvas.tsx
|   +-- NoteEditor.tsx
|   +-- NoteShareDialog.tsx
|   +-- NoteHistoryDrawer.tsx
+-- hooks/
|   +-- useNotesQuery.ts
|   +-- useCreateNoteMutation.ts
|   +-- useUpdateNoteMutation.ts
|   +-- useMoveNoteMutation.ts
+-- api/
|   +-- notes.api.ts
+-- types/
|   +-- note.types.ts
+-- notes.routes.tsx
```

## Contrato visual

La UI consume notas con forma canonica:

```json
{
  "id": "01J...",
  "entityType": "lead",
  "entityId": "01J...",
  "viewCode": "sales.lead.detail",
  "noteType": "sticky_note",
  "visibility": "team",
  "status": "active",
  "title": "Revisar llamada",
  "content": {
    "type": "doc",
    "content": []
  },
  "plainText": "Revisar llamada",
  "color": "yellow",
  "position": {
    "x": 24,
    "y": 80,
    "width": 280,
    "height": 180
  },
  "permissions": {
    "canEdit": true,
    "canShare": true,
    "canDelete": false,
    "canResolve": true
  }
}
```

## Editor de nota

Extensiones permitidas en P0:

```txt
paragraph
bold
italic
bullet_list
ordered_list
link
mention
history
```

No permitir en P0:

```txt
html crudo
script
iframe
embed externo
imagenes pegadas sin politica
archivos adjuntos dentro del editor
```

Si se necesitan adjuntos, deben vivir como modulo de documentos/archivos, no dentro del contenido rich text.

## Menciones y notificaciones

Las menciones deben usar usuarios reales del CRM.

Flujo:

```txt
usuario escribe @nombre
frontend consulta usuarios permitidos
API valida permiso para mencionar
API guarda nota
API crea notificacion interna
API puede crear evento de comunicacion si aplica
```

La UI no debe enviar mensajes directos a Kapso, correo o Microsoft 365 desde componentes de nota. Debe llamar el API.

## Integracion con Kapso y comunicaciones

Las notas pueden disparar comunicaciones, pero siempre por backend.

Ejemplos futuros:

```txt
nota con accion de WhatsApp -> API -> communications port -> Kapso adapter
nota con accion de correo -> API -> communications port -> email adapter
nota con seguimiento -> API -> calendario/actividad
```

Regla:

El frontend no debe importar SDKs ni clientes de Kapso. Kapso es proveedor externo y vive fuera de la UI.

## Estados visuales

Toda experiencia de notas debe soportar:

```txt
cargando
sin notas
sin permiso
guardando
guardado
error recuperable
conflicto de edicion
nota resuelta
nota eliminada
```

## Accesibilidad

Reglas:

- una nota debe poder abrirse, editarse y cerrarse con teclado;
- el area de arrastre debe tener nombre accesible;
- arrastrar no debe ser la unica forma de reposicionar cuando sea critico;
- los colores no deben ser el unico indicador de tipo o prioridad;
- cada accion debe tener tooltip o etiqueta clara.

## Rendimiento

Reglas:

- cargar notas por entidad/vista, no todas las notas del CRM;
- paginar historial;
- debounce al guardar borradores;
- evitar re-renderizar toda la vista por cada tecla;
- lazy load del editor si la pantalla no lo necesita de inicio.

## Fases

### P0

- notas en lead detail;
- notas privadas, de equipo y de jefatura;
- crear, editar, resolver, eliminar logico;
- auditoria y timeline;
- panel lateral;
- Tiptap basico;
- sin colaboracion en tiempo real.

### P1

- sticky notes flotantes por vista;
- drag and drop con dnd kit;
- menciones;
- busqueda;
- compartir por usuario/equipo;
- vincular nota a evento de calendario.

### P2

- plantillas de notas;
- notas con tareas derivadas;
- integracion con Kapso/correo como accion controlada;
- comentarios/hilos por nota;
- colaboracion avanzada si el negocio lo requiere.

## Regla final

Las notas deben sentirse ligeras para el usuario, pero ser serias para el sistema.

Nada importante debe quedar perdido en una pantalla, un navegador o una sesion local.

Correccion vigente de notas: [59 API](../../api/Arquitectura/59-Notas-Contexto-Opcional-y-Vistas.md). Creacion desde cualquier pantalla, personal por defecto, checkbox opcional para vista registrada/orden native o legacy; vincular no comparte. Contexto incluye source+id y siempre revalida acceso; sin URLs arbitrarias/imports.

Estado vigente etapa4 (27 octubre2026): interfaz de invitaciones, conversación, menciones y campana interna conectada; [contrato60 API](../../api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md). Copia legacy pendiente. Compartir advierte acceso al historial; los avisos solo se leen mediante acción explícita.

Estado vigente de notas 2026-10-28: [implementación realtime y límites](../../api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md). Provider único por sesión, campana y conversación actualizadas, preservación de borradores, lectura explícita y revocación. La invitación no concede acceso al registro: contexto restringido se recibe como null. Reconciliación REST al reconectar; copia legacy inactiva.
