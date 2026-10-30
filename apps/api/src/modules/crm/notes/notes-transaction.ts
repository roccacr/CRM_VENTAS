/** Retries only MySQL deadlocks, which guarantee rollback of the complete victim transaction. */
export async function retryNoteDeadlock<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await run();
        } catch (error) {
            if (attempt >= 3 || !isDeadlock(error)) throw error;
        }
    }
}

function isDeadlock(error: unknown): boolean {
    let current: unknown = error;
    // Driver wrappers may retain the original error as cause. Bound traversal also handles cycles.
    for (let depth = 0; depth < 3; depth++) {
        if (typeof current !== "object" || current === null) return false;
        const fields = current as Record<string, unknown>;
        if (fields.code === "ER_LOCK_DEADLOCK" || fields.errno === 1213) return true;
        current = fields.cause;
    }
    return false;
}
