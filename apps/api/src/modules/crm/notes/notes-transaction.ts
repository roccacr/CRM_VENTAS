/** Reintenta solo interbloqueos de MySQL, que revierten la transacción víctima por completo. Al tercer intento el error sigue su curso. */
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
    // El controlador puede guardar el error original en `cause`. El recorrido tiene tope de tres y corta un ciclo.
    for (let depth = 0; depth < 3; depth++) {
        if (typeof current !== "object" || current === null) return false;
        const fields = current as Record<string, unknown>;
        if (fields.code === "ER_LOCK_DEADLOCK" || fields.errno === 1213) return true;
        current = fields.cause;
    }
    return false;
}
