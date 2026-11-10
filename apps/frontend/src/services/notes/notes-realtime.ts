/** El metadato es una señal para volver a leer fotos HTTP autorizadas. No es el contenido de la nota. */
export interface NoteActivity {
    readonly schemaVersion: 1;
    readonly eventId: string;
    readonly kind: "notification.created" | "notifications.changed" | "note.changed" | "note.access_revoked" | "sync.required";
    readonly occurredAt: string;
    readonly noteId?: string;
    readonly notificationId?: string;
    readonly version?: number;
    readonly collaborationVersion?: number;
}
const idPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const kinds = new Set(["notification.created", "notifications.changed", "note.changed", "note.access_revoked", "sync.required"]);
/** Rechaza campos desconocidos, para que un payload privado no llegue a los escuchas de la interfaz. */
export function parseNoteActivity(value: unknown): NoteActivity | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some((key) => !["schemaVersion", "eventId", "kind", "occurredAt", "noteId", "notificationId", "version", "collaborationVersion"].includes(key))) return null;
    if (!validEnvelope(v)) return null;
    if (!["noteId", "notificationId"].every((key) => validOptionalId(v[key]))) return null;
    if (!["version", "collaborationVersion"].every((key) => validOptionalVersion(v[key]))) return null;
    return value as NoteActivity;
}
export interface RealtimeSocket {
    readonly connected: boolean;
    on: (name: string, listener: (...args: unknown[]) => void) => unknown;
    off: (name: string, listener: (...args: unknown[]) => void) => unknown;
    emit: (name: string, ...args: unknown[]) => unknown;
    disconnect: () => unknown;
}
type Phase = "notifications" | "snapshot" | "revoke";
type Listener = (event: NoteActivity | null) => void | Promise<void>;
/** Es dueño de la deduplicación acotada, de la unión de eventos y de limpiar los escuchas de una conexión autenticada. */
export function createNotesRealtime(socket: RealtimeSocket) {
    const listeners: Record<Phase, Set<Listener>> = { notifications: new Set(), snapshot: new Set(), revoke: new Set() };
    const seen = new Set<string>();
    const rooms = new Map<string, number>();
    const retries = new Map<string, ReturnType<typeof setTimeout>>();
    const attempts = new Map<string, number>();
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const clearRoom = (noteId: string) => {
        clearTimeout(retries.get(noteId));
        clearTimeout(pending.get(noteId));
        retries.delete(noteId);
        pending.delete(noteId);
        attempts.delete(noteId);
    };
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let notificationTimer: ReturnType<typeof setTimeout> | undefined;
    let queuedEvent: NoteActivity | null = null;
    const notify = (phase: Phase, event: NoteActivity | null) => Promise.allSettled([...listeners[phase]].map((fn) => Promise.resolve().then(() => fn(event))));
    const snapshot = () => {
        if (disposed || timer !== undefined) return;
        timer = setTimeout(() => {
            timer = undefined;
            void notify("snapshot", null);
        }, 100);
    };
    const invalidate = (event: NoteActivity | null) => {
        if (disposed) return;
        if (event?.kind === "notification.created" || queuedEvent === null) queuedEvent = event;
        if (notificationTimer !== undefined) return;
        notificationTimer = setTimeout(() => {
            notificationTimer = undefined;
            const latest = queuedEvent;
            queuedEvent = null;
            void notify("notifications", latest).then(snapshot);
        }, 25);
    };
    const reconcile = () => {
        invalidate(null);
    };
    const activity = (value: unknown) => {
        const event = parseNoteActivity(value);
        if (!event || seen.has(event.eventId) || disposed) return;
        seen.add(event.eventId);
        if (seen.size > 512) {
            const first = seen.values().next().value;
            if (first) seen.delete(first);
        }
        if (event.kind === "note.access_revoked" && event.noteId) {
            clearRoom(event.noteId);
            rooms.delete(event.noteId);
            socket.emit("unsubscribe", { noteId: event.noteId });
            void notify("revoke", event);
        }
        invalidate(event);
    };
    // Después del retroceso exponencial, el reintento queda en un intento por minuto.
    // Una suscripción rechazada igual necesita reconciliarse por REST mientras el socket sigue conectado.
    const retry = (noteId: string, rateLimited = false) => {
        reconcile();
        if (disposed || !rooms.has(noteId) || retries.has(noteId)) return;
        const attempt = Math.min(7, (attempts.get(noteId) ?? 0) + 1);
        attempts.set(noteId, attempt);
        retries.set(
            noteId,
            setTimeout(
                () => {
                    retries.delete(noteId);
                    if (disposed || !rooms.has(noteId)) return;
                    if (socket.connected) subscribe(noteId);
                    else retry(noteId);
                },
                rateLimited ? 60000 : Math.min(60000, 1000 * 2 ** (attempt - 1)),
            ),
        );
    };
    const subscribe = (noteId: string) => {
        if (disposed || pending.has(noteId)) return;
        clearTimeout(retries.get(noteId));
        retries.delete(noteId);
        const timeout = setTimeout(() => {
            pending.delete(noteId);
            retry(noteId);
        }, 5000);
        pending.set(noteId, timeout);
        socket.emit("subscribe", { noteId }, (ack: unknown) => {
            if (pending.get(noteId) !== timeout) return;
            clearTimeout(timeout);
            pending.delete(noteId);
            if (disposed || !rooms.has(noteId)) return;
            const result = subscriptionAck(ack);
            if (!result) {
                retry(noteId);
                return;
            }
            if (result.ok === false) {
                const code = result.code;
                if (!["forbidden", "access_denied", "revoked"].includes(String(code))) {
                    retry(noteId, code === "rate_limited");
                    return;
                }
                clearRoom(noteId);
                rooms.delete(noteId);
                socket.emit("unsubscribe", { noteId });
                void notify("revoke", { schemaVersion: 1, eventId: noteId, kind: "note.access_revoked", noteId, occurredAt: new Date().toISOString() });
            } else if (result.ok === true) {
                attempts.delete(noteId);
                reconcile();
            } else retry(noteId);
        });
    };
    const connect = () => {
        for (const noteId of rooms.keys()) subscribe(noteId);
        reconcile();
    };
    const disconnect = () => {
        /* HTTP fallback below runs only while disconnected. */
    };
    socket.on("activity", activity);
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("connect_error", disconnect);
    const visible = () => {
        if (document.visibilityState !== "hidden") reconcile();
    };
    document.addEventListener("visibilitychange", visible);
    const fallback = setInterval(() => {
        if (!socket.connected && document.visibilityState !== "hidden") reconcile();
    }, 60000);
    return {
        listen: (phase: Phase, fn: Listener) => {
            listeners[phase].add(fn);
            return () => {
                listeners[phase].delete(fn);
            };
        },
        watch: (noteId: string) => {
            const existing = rooms.has(noteId);
            rooms.set(noteId, (rooms.get(noteId) ?? 0) + 1);
            if (socket.connected && !existing) subscribe(noteId);
            return () => {
                const count = (rooms.get(noteId) ?? 1) - 1;
                if (count > 0) rooms.set(noteId, count);
                else {
                    clearRoom(noteId);
                    rooms.delete(noteId);
                    socket.emit("unsubscribe", { noteId });
                }
            };
        },
        reconcile,
        dispose: () => {
            disposed = true;
            if (timer !== undefined) clearTimeout(timer);
            if (notificationTimer !== undefined) clearTimeout(notificationTimer);
            clearInterval(fallback);
            for (const noteId of rooms.keys()) clearRoom(noteId);
            document.removeEventListener("visibilitychange", visible);
            socket.off("activity", activity);
            socket.off("connect", connect);
            socket.off("disconnect", disconnect);
            socket.off("connect_error", disconnect);
            socket.disconnect();
            for (const group of Object.values(listeners)) group.clear();
            rooms.clear();
            seen.clear();
        },
    };
}
export type NotesRealtime = ReturnType<typeof createNotesRealtime>;

/** Un acuse desconocido exige reconciliar. No se infiere que el permiso fue revocado. */
function subscriptionAck(value: unknown): { ok: unknown; code: unknown } | null {
    if (!value || typeof value !== "object" || !("ok" in value)) return null;
    return { ok: value.ok, code: "code" in value ? value.code : undefined };
}

/** Valida el sobre obligatorio aparte del metadato opcional del recurso. */
function validEnvelope(v: Record<string, unknown>): boolean {
    return v.schemaVersion === 1 && typeof v.eventId === "string" && idPattern.test(v.eventId) && typeof v.kind === "string" && kinds.has(v.kind) && validTimestamp(v.occurredAt);
}
function validTimestamp(value: unknown): boolean {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
function validOptionalId(value: unknown): boolean {
    return value === undefined || (typeof value === "string" && idPattern.test(value));
}
function validOptionalVersion(value: unknown): boolean {
    return value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value >= 1);
}
