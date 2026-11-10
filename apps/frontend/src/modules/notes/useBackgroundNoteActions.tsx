import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";

interface Command<T, R> {
    key: string;
    label: string;
    request: () => Promise<R>;
    project: (value: T) => T;
    commit: (result: R) => void;
}
interface Action<T> {
    key: string;
    label: string;
    request: () => Promise<void>;
    project: (value: T) => T;
    state: "queued" | "saving" | "error";
    retryable: boolean;
}

/** Las acciones optimistas de metadatos no bloquean los editores de contenido. Su petición exacta sobrevive a un resultado incierto. */
export function useBackgroundNoteActions<T>(value: T, onChanged: () => void) {
    const active = useRef(new Map<string, Action<T>>());
    const alive = useRef(true);
    const changed = useRef(onChanged);
    const [actions, setActions] = useState<Action<T>[]>([]);
    useEffect(() => {
        changed.current = onChanged;
    }, [onChanged]);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const publish = () => {
        if (alive.current) setActions([...active.current.values()]);
    };
    const execute = async (action: Action<T>) => {
        if (action.state === "saving") return;
        action.state = "saving";
        publish();
        try {
            await action.request();
            active.current.delete(action.key);
        } catch (reason) {
            action.state = "error";
            action.retryable = !(reason instanceof ApiClientError && reason.status < 500 && reason.status !== 429);
        } finally {
            publish();
            if (alive.current) changed.current();
        }
    };
    return {
        value: actions.filter((action) => action.state === "saving").reduce((current, action) => action.project(current), value),
        pending: (key: string) => actions.some((action) => action.key === key),
        run: <R,>(command: Command<T, R>) => {
            if (active.current.has(command.key)) return;
            const action: Action<T> = {
                ...command,
                state: "queued",
                retryable: true,
                request: async () => {
                    const result = await command.request();
                    if (alive.current) command.commit(result);
                },
            };
            active.current.set(command.key, action);
            void execute(action);
        },
        feedback: actions
            .filter((action) => action.state === "error")
            .map((action) => (
                <div key={action.key} className="personal-notes-panel__error" role="alert">
                    <p>
                        No pudimos confirmar «{action.label}». {action.retryable ? "Reintenta la misma operación." : "Revisa el estado y tus permisos antes de volver a intentarlo."}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            if (action.retryable) {
                                void execute(action);
                                return;
                            }
                            active.current.delete(action.key);
                            publish();
                            changed.current();
                        }}
                    >
                        {action.retryable ? `Reintentar: ${action.label}` : "Revisar cambios"}
                    </button>
                </div>
            )),
    };
}

export type BackgroundNoteActions<T> = ReturnType<typeof useBackgroundNoteActions<T>>;
