import { useEffect, useRef, useState } from "react";

import { type NoteModule, type NotePlacement, saveNotePlacement } from "../../services/notes/notes-service";

export type PlacementSaveState = "saving" | "saved" | "error";
interface PlacementAttempt {
    placement: NotePlacement;
    operationId: string;
}
interface PlacementQueue {
    moduleCode: NoteModule;
    version: number;
    running: boolean;
    desired: NotePlacement | undefined;
    attempt: PlacementAttempt | undefined;
}

/** Serialize each personal layout independently; coalesce gestures without replaying uncertain writes automatically. */
export function useNotePlacements(moduleCode: NoteModule, onSaved: (id: string, placement: NotePlacement) => void) {
    const queues = useRef(new Map<string, PlacementQueue>());
    const alive = useRef(true);
    const [states, setStates] = useState<Record<string, PlacementSaveState>>({});
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const report = (key: string, state: PlacementSaveState) => {
        if (alive.current) setStates((old) => ({ ...old, [key]: state }));
    };
    // eslint-disable-next-line complexity -- Keep per-note ordering, coalescing and uncertain-write recovery in one loop.
    const flush = async (id: string, key: string, queue: PlacementQueue) => {
        if (queue.running) return;
        queue.running = true;
        report(key, "saving");
        try {
            while (queue.attempt || queue.desired) {
                if (!queue.attempt && queue.desired) {
                    queue.attempt = { placement: { ...queue.desired, layoutVersion: queue.version }, operationId: crypto.randomUUID() };
                    queue.desired = undefined;
                }
                const attempt = queue.attempt;
                if (!attempt) break;
                const result = await saveNotePlacement(queue.moduleCode, id, attempt.placement, attempt.operationId);
                queue.version = result.layoutVersion ?? attempt.placement.layoutVersion + 1;
                queue.attempt = undefined;
                if (!queue.desired && alive.current) onSaved(id, { ...attempt.placement, layoutVersion: queue.version });
            }
            report(key, "saved");
        } catch {
            // Keep both the exact uncertain operation and any newer gesture until an explicit retry.
            report(key, "error");
        } finally {
            queue.running = false;
        }
    };
    return {
        states,
        save: (id: string, placement: NotePlacement, originModule: NoteModule = moduleCode) => {
            const key = `${id}:${placement.viewportClass}`;
            const queue = queues.current.get(key) ?? { moduleCode: originModule, version: placement.layoutVersion, running: false, desired: undefined, attempt: undefined };
            queues.current.set(key, queue);
            if (!queue.running && !queue.attempt) queue.version = Math.max(queue.version, placement.layoutVersion);
            queue.desired = { ...placement };
            if (!queue.attempt) void flush(id, key, queue);
        },
        retry: (id: string, viewport: NotePlacement["viewportClass"]) => {
            const key = `${id}:${viewport}`;
            const queue = queues.current.get(key);
            if (queue) void flush(id, key, queue);
        },
    };
}
