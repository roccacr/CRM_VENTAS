# 16 - UX Notas Adhesivas y Anotaciones

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
