import { type ReactNode, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { API_ORIGIN } from "../../config/frontend-env";
import { getAuthenticatedCsrfToken, subscribeToSessionRefresh } from "../../services/api/api-client";
import { createNotesRealtime, type NotesRealtime } from "../../services/notes/notes-realtime";
import { NotesRealtimeContext } from "./useNotesRealtime";
/** One socket belongs to the authenticated shell, shared by both header variants and drawers. */
export function NotesRealtimeProvider({ children }: { readonly children: ReactNode }) {
    const [client, setClient] = useState<NotesRealtime | null>(null);
    useEffect(() => {
        let active = true;
        let retry: ReturnType<typeof setTimeout> | undefined;
        const socket = io(`${API_ORIGIN}/notes`, {
            autoConnect: false,
            transports: ["websocket"],
            withCredentials: true,
            auth: (done) => {
                void getAuthenticatedCsrfToken()
                    .then((csrfToken) => {
                        if (active) done({ csrfToken });
                    })
                    .catch(() => {
                        if (active) {
                            socket.disconnect();
                            retryHandshake();
                        }
                    });
            },
        });
        const retryHandshake = () => {
            if (retry !== undefined) clearTimeout(retry);
            retry = setTimeout(() => {
                if (active) socket.connect();
            }, 15000);
        };
        const disconnected = (reason: string) => {
            if (reason === "io server disconnect") retryHandshake();
        };
        const connected = () => {
            if (retry !== undefined) clearTimeout(retry);
            retry = undefined;
        };
        socket.on("connect_error", retryHandshake);
        socket.on("disconnect", disconnected);
        socket.on("connect", connected);
        const realtime = createNotesRealtime(socket);
        const stop = subscribeToSessionRefresh((outcome) => {
            socket.disconnect();
            if (outcome === "refreshed" && active) socket.connect();
        });
        void Promise.resolve().then(() => {
            // StrictMode can discard an effect before this microtask; never open its abandoned socket.
            if (active) {
                setClient(realtime);
                socket.connect();
            }
        });
        return () => {
            active = false;
            stop();
            if (retry !== undefined) clearTimeout(retry);
            socket.off("connect_error", retryHandshake);
            socket.off("disconnect", disconnected);
            socket.off("connect", connected);
            realtime.dispose();
        };
    }, []);
    return <NotesRealtimeContext.Provider value={client}>{children}</NotesRealtimeContext.Provider>;
}
