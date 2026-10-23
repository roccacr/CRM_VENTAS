import { BadRequestException } from "@nestjs/common";

/** JSON numbers are checked at runtime for finiteness and safe integer precision. */
export type RecordAuditJson = null | string | boolean | number | RecordAuditJson[] | { [key: string]: RecordAuditJson };

/** Upper bound for a whole snapshot (before + after + diff) so audit rows cannot grow unbounded. */
const MAX_BYTES = 256 * 1024;
/** Secrets must never be persisted in audit evidence; prototype-pollution keys are also refused. */
const forbiddenKey = (key: string): boolean => /password|passwd|secret|token|credential|authorization|cookie|privatekey|apikey|sessionid/i.test(key.replaceAll(/[_-]/g, "")) || ["__proto__", "prototype", "constructor"].includes(key);
/** Only plain data objects are accepted; class instances, Maps and the like are rejected. */
const isPlainObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null);
/** Array or plain object. */
const isJsonContainer = (value: unknown): value is unknown[] | Record<string, unknown> => Array.isArray(value) || isPlainObject(value);
/** Single failure path with a generic message so snapshot contents are never echoed back. */
const invalid = (): never => {
    throw new BadRequestException("Invalid record audit snapshot");
};
/** Strings, booleans, null and numbers that survive JSON without precision loss. */
const isJsonPrimitive = (value: unknown): value is null | string | boolean | number => {
    if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
    return value === null || typeof value === "string" || typeof value === "boolean";
};
/** Reads own enumerable data properties only; getters and accessors could run code or hide values. */
const dataValue = (value: object, key: PropertyKey): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return invalid();
    return descriptor.value;
};

/** Validate and detach partial audit evidence; arrays retain their business ordering. */
export const prepareRecordAuditChange = (input: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; allowedFields: readonly string[] }): { before: Record<string, RecordAuditJson> | null; after: Record<string, RecordAuditJson> | null; changes: { path: string; beforeExists: boolean; afterExists: boolean; before: RecordAuditJson; after: RecordAuditJson }[] } => {
    if (!isPlainObject(input)) invalid();
    if (!Array.isArray(input.allowedFields) || input.allowedFields.some((field) => typeof field !== "string" || forbiddenKey(field))) invalid();
    const allowed = new Set(input.allowedFields);
    const ancestors = new Set<object>();
    let bytes = 0;
    /** Accumulates snapshot size and fails once the global limit is exceeded. */
    const count = (size: number): void => {
        bytes += size;
        if (bytes > MAX_BYTES) invalid();
    };
    // Deep-copy with depth, size, cycle and key checks; top-level keys must be in the allow-list.
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
    /** Top-level snapshots must be plain objects or null. */
    const snapshot = (value: unknown): Record<string, RecordAuditJson> | null => {
        if (value !== null && !isPlainObject(value)) invalid();
        return clone(value, 0) as Record<string, RecordAuditJson> | null;
    };
    const before = snapshot(input.before);
    const after = snapshot(input.after);
    const changes: { path: string; beforeExists: boolean; afterExists: boolean; before: RecordAuditJson; after: RecordAuditJson }[] = [];
    // JSON-Pointer style diff (RFC 6901 escaping) that distinguishes a missing field from an explicit null.
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
    // Record existence is carried by snapshots; field existence remains explicit even for null.
    compare(before ?? {}, after ?? {}, "", { beforeExists: true, afterExists: true });
    const result = { before, after, changes };
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_BYTES) invalid();
    return result;
};
