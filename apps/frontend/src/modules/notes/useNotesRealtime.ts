import { createContext, useContext, useEffect, useRef } from "react";

import type { NoteActivity, NotesRealtime } from "../../services/notes/notes-realtime";
export const NotesRealtimeContext = createContext<NotesRealtime | null>(null);
/** Los escuchas estables conservan los borradores del componente y los acuses pendientes mientras se refresca la foto. */
export function useNotesRealtime(phase: "notifications" | "snapshot" | "revoke", listener: (event: NoteActivity | null) => void | Promise<void>, enabled = true) {
    const client = useContext(NotesRealtimeContext);
    const latest = useRef(listener);
    useEffect(() => {
        latest.current = listener;
    }, [listener]);
    useEffect(() => (enabled ? client?.listen(phase, (event) => latest.current(event)) : undefined), [client, phase, enabled]);
    return client;
}
