import { BadRequestException } from "@nestjs/common";

/** Un numero tiene que ser finito y, si es entero, caber en un entero seguro. */
export type RecordAuditJson = null | string | boolean | number | RecordAuditJson[] | { [key: string]: RecordAuditJson };

/** Tope de 256 KiB para antes, despues y el diff juntos. */
const MAX_BYTES = 256 * 1024;
/** No se guardan secretos. `__proto__`, `prototype` y `constructor` tambien se rechazan. */
const forbiddenKey = (key: string): boolean => /password|passwd|secret|token|credential|authorization|cookie|privatekey|apikey|sessionid/i.test(key.replaceAll(/[_-]/g, "")) || ["__proto__", "prototype", "constructor"].includes(key);
/** Solo un objeto plano. Una instancia, un Map o un objeto con otro prototipo no entra. */
const isPlainObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null);
/** Arreglo u objeto plano. */
const isJsonContainer = (value: unknown): value is unknown[] | Record<string, unknown> => Array.isArray(value) || isPlainObject(value);
/** Un solo mensaje. El contenido del snapshot no vuelve en el error. */
const invalid = (): never => {
    throw new BadRequestException("Invalid record audit snapshot");
};
/** Texto, booleano, nulo, o un numero que sobrevive a JSON sin perder precision. */
const isJsonPrimitive = (value: unknown): value is null | string | boolean | number => {
    if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
    return value === null || typeof value === "string" || typeof value === "boolean";
};
/** Solo propiedades propias y enumerables con valor. Un getter no se ejecuta ni se guarda. */
const dataValue = (value: object, key: PropertyKey): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return invalid();
    return descriptor.value;
};

/** Copia el snapshot permitido. El orden de un arreglo se conserva. Profundidad, ciclos y claves fuera de la lista cortan con el mismo error. */
export const prepareRecordAuditChange = (input: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; allowedFields: readonly string[] }): { before: Record<string, RecordAuditJson> | null; after: Record<string, RecordAuditJson> | null; changes: { path: string; beforeExists: boolean; afterExists: boolean; before: RecordAuditJson; after: RecordAuditJson }[] } => {
    if (!isPlainObject(input)) invalid();
    if (!Array.isArray(input.allowedFields) || input.allowedFields.some((field) => typeof field !== "string" || forbiddenKey(field))) invalid();
    const allowed = new Set(input.allowedFields);
    const ancestors = new Set<object>();
    let bytes = 0;
    /** Suma el tamano y corta al pasar de 256 KiB. */
    const count = (size: number): void => {
        bytes += size;
        if (bytes > MAX_BYTES) invalid();
    };
    // Copia con tope de profundidad, tamano, ciclos y claves. En la raiz solo entran las claves permitidas.
    const clone = (value: unknown, depth: number): RecordAuditJson => {
        if (depth > 16) invalid();
        if (isJsonPrimitive(value)) {
            count(Buffer.byteLength(JSON.stringify(value), "utf8"));
            return value;
        }
        if (!isJsonContainer(value)) return invalid();
        if (ancestors.has(value)) invalid();
        ancestors.add(value);
        count(2);
        let result: RecordAuditJson;
        if (Array.isArray(value)) {
            if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
            count(Math.max(0, value.length - 1));
            result = Array.from({ length: value.length }, (_, index) => clone(dataValue(value, String(index)), depth + 1));
        } else {
            const entries = Reflect.ownKeys(value);
            if (entries.some((key) => typeof key !== "string")) invalid();
            entries.sort();
            count(Math.max(0, entries.length - 1));
            result = Object.fromEntries(
                entries.map((key) => {
                    if (typeof key !== "string" || forbiddenKey(key) || (depth === 0 && !allowed.has(key))) invalid();
                    count(Buffer.byteLength(JSON.stringify(key), "utf8") + 1);
                    return [key, clone(dataValue(value, key), depth + 1)];
                }),
            );
        }
        ancestors.delete(value);
        return result;
    };
    /** La raiz es un objeto plano o nulo. */
    const snapshot = (value: unknown): Record<string, RecordAuditJson> | null => {
        if (value !== null && !isPlainObject(value)) invalid();
        return clone(value, 0) as Record<string, RecordAuditJson> | null;
    };
    const before = snapshot(input.before);
    const after = snapshot(input.after);
    const changes: { path: string; beforeExists: boolean; afterExists: boolean; before: RecordAuditJson; after: RecordAuditJson }[] = [];
    // Diff al estilo JSON Pointer. Un campo ausente no es lo mismo que un nulo explicito.
    const compare = (previous: RecordAuditJson, current: RecordAuditJson, path: string, existence: { beforeExists: boolean; afterExists: boolean }): void => {
        const { beforeExists, afterExists } = existence;
        if (beforeExists === afterExists && JSON.stringify(previous) === JSON.stringify(current)) return;
        if (isPlainObject(previous) && isPlainObject(current)) {
            for (const key of [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort()) {
                compare(previous[key] ?? null, current[key] ?? null, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, { beforeExists: Object.hasOwn(previous, key), afterExists: Object.hasOwn(current, key) });
            }
            return;
        }
        changes.push({ path, beforeExists, afterExists, before: previous, after: current });
    };
    // La existencia del registro la llevan los snapshots. La de cada campo sigue explicita, tambien si el valor es nulo.
    compare(before ?? {}, after ?? {}, "", { beforeExists: true, afterExists: true });
    const result = { before, after, changes };
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_BYTES) invalid();
    return result;
};
