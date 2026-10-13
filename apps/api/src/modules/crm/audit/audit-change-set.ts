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

const SAFE_FIELDS = new Set(["name", "displayName", "email", "detail", "description", "status", "deleted", "roleCodes", "orgUnitCodes", "accessMethods", "permissionCodes", "permissionOverrides", "externalReferences"]);
const RELATION_FIELDS = new Set(["systemCode", "externalId", "externalUserId", "externalUsername", "status", "permissionCode", "code", "effect"]);

const normalizeValue = (value: unknown): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
    if (Array.isArray(value)) return value.map(normalizeValue).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    if (typeof value === "object")
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => RELATION_FIELDS.has(key))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeValue(item)]),
        );
    return null;
};

const snapshot = (value: Record<string, unknown> | null): Record<string, unknown> | null =>
    value === null
        ? null
        : Object.fromEntries(
              Object.entries(value)
                  .filter(([key]) => SAFE_FIELDS.has(key))
                  .map(([key, item]) => [key, normalizeValue(item)]),
          );

/** Compare detached safe snapshots while ignoring collection ordering. Call inside the mutation transaction. */
export const buildAuditChangeSet = (input: Omit<AuditChangeSet, "version" | "changes">): AuditChangeSet => {
    const before = snapshot(input.before);
    const after = snapshot(input.after);
    const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
    const changes = fields.flatMap((field) => {
        const previous = before?.[field] ?? null;
        const current = after?.[field] ?? null;
        return JSON.stringify(previous) === JSON.stringify(current) ? [] : [{ field, before: previous, after: current }];
    });
    return { version: 1, entity: input.entity, recordId: input.recordId, action: input.action, before, after, changes };
};
