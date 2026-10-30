import { createContext, useContext, useEffect, useRef } from "react";

import type { NoteActivity, NotesRealtime } from "../../services/notes/notes-realtime";
export const NotesRealtimeContext = createContext<NotesRealtime | null>(null);
/** Stable listeners retain component drafts and pending receipts during snapshot refreshes. */
export function useNotesRealtime(phase: "notifications" | "snapshot" | "revoke", listener: (event: NoteActivity | null) => void | Promise<void>, enabled = true) {
    const client = useContext(NotesRealtimeContext);
    const latest = useRef(listener);
    useEffect(() => {
        latest.current = listener;
    }, [listener]);
    useEffect(() => (enabled ? client?.listen(phase, (event) => latest.current(event)) : undefined), [client, phase, enabled]);
    return client;
}
