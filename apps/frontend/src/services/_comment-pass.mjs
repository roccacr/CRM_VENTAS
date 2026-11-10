import { readFileSync, writeFileSync } from "node:fs";

const root = new URL(".", import.meta.url);
const jobs = [
    ["notes/note-related-records-service.ts", "/** Storage identity is transport data; the user selects a business name, not a database. */", "/** La identidad de almacenamiento es dato de transporte. La persona elige un nombre de negocio, no una base de datos. */"],
    ["notes/note-related-records-service.ts", "/** Restricted summaries have no source ID or commercial metadata. */", "/** Un resumen restringido no trae id de origen ni metadatos comerciales. */"],
    ["notes/note-related-records-service.ts", "/** Searches a bounded authorized page from the federated record selector. */", "/** Busca una página acotada y autorizada del selector federado de registros. */"],
    ["notes/note-related-records-service.ts", "/** Reads summaries and the current collaboration version without granting record access. */", "/** Lee resúmenes y la versión actual de colaboración. No concede acceso al registro. */"],
    ["notes/note-related-records-service.ts", "/** Exact operation IDs are retained by the editor when a mutation has an uncertain outcome. */", "/** El editor conserva los ids exactos de operación cuando una mutación tiene un resultado incierto. */"],
    ["notes/notes-service.ts", "/** Validates a plain-text note while retaining compatibility with private note responses. */", "/** Valida una nota de texto plano y conserva la compatibilidad con las respuestas de notas privadas. */"],
    ["notes/notes-service.ts", "/** The legacy list uses a presentation alias; native public IDs and malformed IDs must never be rewritten. */", "/** La lista anterior usa un alias de presentación. Un id público nativo y un id mal formado no se reescriben. */"],
    ["notes/notes-service.ts", "/** Reads the authorized context, using bounded pages and validating all displayed fields. */", "/** Lee el contexto autorizado, con páginas acotadas, y valida todos los campos que se muestran. */"],
    ["notes/notes-service.ts", "/** Creates a private note with an explicit operation identifier; ambiguous writes never replay automatically. */", "/** Crea una nota privada con un identificador de operación explícito. Una escritura ambigua no se repite sola. */"],
    ["notes/notes-service.ts", "/** Edits only against the version displayed to the author. */", "/** Edita solo contra la versión que se le mostró al autor. */"],
    ["notes/notes-service.ts", "/** Applies a lifecycle transition without deleting persisted content. */", "/** Aplica una transición del ciclo de vida y no borra el contenido persistido. */"],
    ["notes/notes-service.ts", "/** Personal layout concurrency is independent of the note content version. */", "/** La concurrencia del layout personal es independiente de la versión del contenido de la nota. */"],
    ["notes/notes-service.ts", "/** Null preserves server redaction; it never becomes a guessed record link. */", "/** Un nulo conserva lo que el servidor ocultó. No se convierte en un vínculo adivinado. */"],
    ["notes/notes-realtime.ts", "/** Metadata is a signal to re-read authorized HTTP snapshots, never note content. */", "/** El metadato es una señal para volver a leer fotos HTTP autorizadas. No es el contenido de la nota. */"],
    ["notes/notes-realtime.ts", "/** Rejects unknown fields so private payloads cannot reach UI listeners. */", "/** Rechaza campos desconocidos, para que un payload privado no llegue a los escuchas de la interfaz. */"],
    ["notes/notes-realtime.ts", "/** Owns bounded dedupe, coalescing and listener cleanup for one authenticated connection. */", "/** Es dueño de la deduplicación acotada, de la unión de eventos y de limpiar los escuchas de una conexión autenticada. */"],
    ["notes/notes-realtime.ts", "// Retry frequency is capped at one attempt per minute after exponential backoff.", "// Después del retroceso exponencial, el reintento queda en un intento por minuto."],
    ["notes/notes-realtime.ts", "// A rejected subscription still needs REST reconciliation while the socket is connected.", "// Una suscripción rechazada igual necesita reconciliarse por REST mientras el socket sigue conectado."],
    ["notes/notes-realtime.ts", "/** Unknown acknowledgements require reconciliation, never an inferred permission revocation. */", "/** Un acuse desconocido exige reconciliar. No se infiere que el permiso fue revocado. */"],
    ["notes/notes-realtime.ts", "/** Validates the mandatory envelope independently from optional resource metadata. */", "/** Valida el sobre obligatorio aparte del metadato opcional del recurso. */"],
    ["notes/note-collaboration-service.ts", "/** Reads one authorized thread; replies use an explicit bounded page. */", "/** Lee un hilo autorizado. Las respuestas usan una página acotada y explícita. */"],
    ["notes/note-collaboration-service.ts", "/** Lists only server-authorized collaborative notes without browser persistence. */", "/** Lista solo las notas colaborativas que el servidor autorizó. No las persiste en el navegador. */"],
    ["notes/note-collaboration-service.ts", "/** Searches the authorized user directory for an existing note. */", "/** Busca en el directorio autorizado de usuarios para una nota que ya existe. */"],
    ["notes/note-collaboration-service.ts", "/** Searches invitees before creating a private note in its explicit context. */", "/** Busca invitados antes de crear una nota privada en su contexto explícito. */"],
    ["notes/note-collaboration-service.ts", "/** Replaces sharing atomically against the collaboration version displayed. */", "/** Reemplaza el uso compartido de forma atómica, contra la versión de colaboración que se mostró. */"],
    ["notes/note-collaboration-service.ts", "/** Replaces explicit note mentions without changing the caller operation ID. */", "/** Reemplaza las menciones explícitas de la nota y no cambia el id de operación de quien llama. */"],
    ["notes/note-collaboration-service.ts", "/** Adds a plain-text reply; ambiguous failures remain the caller's pending command. */", "/** Agrega una respuesta de texto plano. Un fallo ambiguo sigue siendo el comando pendiente de quien llama. */"],
    ["notes/note-collaboration-service.ts", "/** Edits an author's reply against its displayed version. */", "/** Edita la respuesta del autor contra la versión que se mostró. */"],
    ["notes/note-collaboration-service.ts", "/** Withdraws a reply without deleting its history. */", "/** Retira una respuesta y no borra su historial. */"],
    ["notes/note-collaboration-service.ts", "/** Changes only the current user's following preference. */", "/** Cambia solo la preferencia de seguimiento de la persona actual. */"],
    ["notes/note-collaboration-service.ts", "/** Fetches all bounded directory pages; never silently truncates the selection list to its first100 users. */", "/** Trae todas las páginas acotadas del directorio. No recorta en silencio la lista de selección a los primeros 100 usuarios. */"],
    ["notes/note-collaboration-service.ts", "/** All authors of currently authorized notes; independent of the selected inbox page. */", "/** Todos los autores de las notas autorizadas ahora. No depende de la página de bandeja elegida. */"],
    ["notes/note-workflow-service.ts", "/** Reads only the caller's reminder and authorized task metadata. */", "/** Lee solo el recordatorio de quien llama y el metadato autorizado de la tarea. */"],
    ["notes/note-workflow-service.ts", "/** The original operation key must survive uncertain responses. */", "/** La clave original de la operación sobrevive a una respuesta incierta. */"],
    ["notes/note-workflow-service.ts", "/** Null cancels only the current reader's reminder. */", "/** Un nulo cancela solo el recordatorio de quien está leyendo. */"],
    ["notes/note-workflow-service.ts", "/** Display locations never replace the note's canonical record identity or share access. */", "/** Los lugares donde se muestra no reemplazan la identidad canónica del registro ni comparten el acceso. */"],
    ["notes/note-workflow-service.ts", "/** Atomically replaces display references against the shown collaboration version. */", "/** Reemplaza de forma atómica las referencias de presentación, contra la versión de colaboración mostrada. */"],
    ["notes/note-workflow-service.ts", "/** Reads sanitized event metadata; no previous note text is exposed. */", "/** Lee metadato saneado del evento. No expone el texto anterior de la nota. */"],
    ["notes/note-workflow-service.ts", "/** Counts use the requested IANA time zone returned by the server. */", "/** Los conteos usan la zona IANA pedida que devolvió el servidor. */"],
    ["notes/note-notifications-service.ts", "/** Which note the notice is about. */", "/** De qué nota es el aviso. */"],
    ["notes/note-notifications-service.ts", "/** What the actor wrote, for replies and mentions; null for invitations. */", "/** Lo que escribió quien actuó, en respuestas y menciones. Nulo en una invitación. */"],
    ["notes/note-notifications-service.ts", "/** Reads metadata only; opening the bell never marks notifications read. */", "/** Lee solo metadatos. Abrir la campana no marca los avisos como leídos. */"],
    ["notes/note-notifications-service.ts", "/** The optional server flag explicitly identifies a bounded lower-bound count. */", "/** La bandera opcional del servidor identifica de forma explícita un conteo que es un límite inferior. */"],
    ["notes/note-notifications-service.ts", "/** Marks one current-recipient notification read only after explicit user action. */", "/** Marca como leído un aviso del destinatario actual solo después de una acción explícita. */"],
    ["notes/note-notifications-service.ts", "/** Uses the list's observedAt cutoff so later events cannot be marked read accidentally. */", "/** Usa el corte `observedAt` de la lista, para que un evento posterior no se marque leído por accidente. */"],
];

const misses = [];
for (const [file, from, to] of jobs) {
    const target = new URL(file, root);
    const source = readFileSync(target, "utf8");
    const count = source.split(from).length - 1;
    if (count !== 1) misses.push(`${file} x${count}: ${from.slice(0, 110)}`);
    else writeFileSync(target, source.replace(from, to));
}
if (misses.length) {
    console.error(misses.join("\n"));
    process.exit(1);
}
console.log(`updated ${jobs.length}`);
