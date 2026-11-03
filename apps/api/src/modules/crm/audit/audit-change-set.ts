/** Versioned business snapshots. Credentials and arbitrary metadata are never accepted. */
export interface AuditChangeSet {
    version: 1;
    entity: string;
    recordId: string;
    action: "create" | "update" | "deactivate" | "reactivate" | "delete";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    changes: { field: string; before: unknown; after: unknown }[];
}

const SAFE_FIELDS = new Set(["name", "displayName", "email", "detail", "description", "status", "deleted", "roleCodes", "orgUnitCodes", "moduleCodes", "moduleScoped", "permissionInheritance", "accessMethods", "permissionCodes", "permissionOverrides", "externalReferences"]);
const BANK_FIELDS = new Set(["phone", "area", "version", "bankPublicId"]);
const RELATION_FIELDS = new Set(["systemCode", "externalId", "externalUserId", "externalUsername", "status", "permissionCode", "code", "effect"]);
/** The part of a changeset the record-audit bridge reads. */
type RecordAuditSourceChange = Readonly<Pick<AuditChangeSet, "entity" | "recordId" | "action" | "before" | "after">>;
/** Server-built changesets are tracked here so client-made lookalikes are rejected. */
const sourceChanges = new WeakMap<AuditChangeSet, RecordAuditSourceChange>();
/** Scalars allowed in snapshots: null, string, boolean and finite number. */
const isSafeScalar = (value: unknown): boolean => value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));

/** Reduces nested values to allowed relation fields and sorts arrays for stable comparison. */
const normalizeValue = (value: unknown, sortArrays = true): unknown => {
    if (isSafeScalar(value)) return value;
    if (Array.isArray(value)) {
        const items = value.map((item) => normalizeValue(item, sortArrays));
        return sortArrays ? items.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) : items;
    }
    if (value !== null && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => RELATION_FIELDS.has(key))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeValue(item, sortArrays)]),
        );
    return null;
};

/** Keeps only allow-listed fields so secrets and unknown data never reach the audit. */
const snapshot = (value: Record<string, unknown> | null, sortArrays = true, entity?: string): Record<string, unknown> | null =>
    value === null
        ? null
        : Object.fromEntries(
              Object.entries(value)
                  .filter(([key]) => SAFE_FIELDS.has(key) || ((entity === "bank" || entity === "bank_advisor") && BANK_FIELDS.has(key)))
                  .map(([key, item]) => [key, normalizeValue(item, sortArrays)]),
          );

/** Only server-built objects carry captured identity/action and partial safe evidence; serialized lookalikes do not. */
export const getRecordAuditSourceChange = (value: unknown): RecordAuditSourceChange | undefined => {
    if (value === null || typeof value !== "object") return undefined;
    const source = sourceChanges.get(value as AuditChangeSet);
    return source ? Object.freeze({ entity: source.entity, recordId: source.recordId, action: source.action, before: snapshot(source.before, false, source.entity), after: snapshot(source.after, false, source.entity) }) : undefined;
};

/** Compare detached safe snapshots while ignoring collection ordering. Call inside the mutation transaction. */
export const buildAuditChangeSet = (input: Omit<AuditChangeSet, "version" | "changes">): AuditChangeSet => {
    const before = snapshot(input.before, true, input.entity);
    const after = snapshot(input.after, true, input.entity);
    const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
    const changes = fields.flatMap((field) => {
        const previous = before?.[field] ?? null;
        const current = after?.[field] ?? null;
        return JSON.stringify(previous) === JSON.stringify(current) ? [] : [{ field, before: previous, after: current }];
    });
    const changeSet: AuditChangeSet = { version: 1, entity: input.entity, recordId: input.recordId, action: input.action, before, after, changes };
    sourceChanges.set(changeSet, Object.freeze({ entity: changeSet.entity, recordId: changeSet.recordId, action: changeSet.action, before: snapshot(input.before, false, input.entity), after: snapshot(input.after, false, input.entity) }));
    return changeSet;
};
