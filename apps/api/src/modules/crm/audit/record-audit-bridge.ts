import { BadRequestException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { AuditActorSnapshot } from "./audit-actor.js";
import { getRecordAuditSourceChange } from "./audit-change-set.js";
import type { RecordAuditService } from "./record-audit.service.js";
import type { SecurityAuditEvent } from "./security-audit.service.js";

/** Server-built changeset attached to the security event; client input never reaches this type. */
type SourceChange = NonNullable<ReturnType<typeof getRecordAuditSourceChange>>;
/** Fixed registry entry: [table, primary-key column, public lookup column]. Only these names reach SQL. */
type Definition = readonly [string, string, string];
/** Catalog code -> physical table, so the audited source row can be locked and identified. */
const catalogTables: Record<string, Definition> = {
    projects: ["crm_project", "id_project", "public_id_project"],
    campaigns: ["crm_campaign", "id_campaign", "public_id_campaign"],
    classes: ["crm_class", "id_class", "public_id_class"],
    locations: ["crm_location", "id_location", "public_id_location"],
    subsidiaries: ["crm_subsidiary", "id_subsidiary", "public_id_subsidiary"],
    brokers: ["crm_broker", "id_broker", "public_id_broker"],
    files: ["crm_catalog_item", "id_catalog_item", "public_id_catalog_item"],
};
/** Maps administrative verbs to the record-audit action vocabulary; deactivate/reactivate/delete are all state changes. */
const actions = { create: "create", update: "update", deactivate: "state_change", reactivate: "state_change", delete: "state_change" } as const;

/** Rejects catalog codes outside the registry (own-property check blocks prototype keys). */
function catalogDefinition(code: unknown): Definition {
    if (typeof code !== "string" || !Object.hasOwn(catalogTables, code)) throw new BadRequestException("Unsupported commercial audit entity");
    return catalogTables[code] as Definition;
}

/** Resolves which table backs an audited entity (catalog item, user or role). */
function businessDefinition(change: SourceChange, catalogCode: unknown): Definition {
    switch (change.entity) {
        case "catalog":
            return catalogDefinition(catalogCode);
        case "user":
            return ["sec_user", "id_user", "public_id_user"];
        case "role":
            return ["sec_role", "id_role", "code_role"];
        default:
            throw new BadRequestException("Unsupported commercial audit entity");
    }
}

/** Native canonical PK is obtained from the locked source row, never from client ID formatting. */
async function resolveSource(tx: Transaction<CrmDatabase>, change: SourceChange, catalogCode: unknown) {
    const [table, primaryKey, lookup] = businessDefinition(change, catalogCode);
    // Identifiers are fixed by the server registry, not interpolated from request data.
    const identity = await sql<{ id: string }>`SELECT CAST(${sql.ref(primaryKey)} AS CHAR) AS id FROM ${sql.table(table)} WHERE ${sql.ref(lookup)} = ${change.recordId} FOR UPDATE`.execute(tx);
    if (identity.rows.length !== 1) throw new BadRequestException("Audit source record is unavailable");
    const id = identity.rows[0]?.id;
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) throw new BadRequestException("Audit source identity is invalid");
    return { schema: "CRM_THINK_V2" as const, entity: change.entity, table, id };
}

/** Truncates caller metadata to the column widths of the audit table. */
const networkContext = (event: SecurityAuditEvent) => ({ ipAddress: event.ipAddress?.slice(0, 80), userAgent: event.userAgent?.slice(0, 500) });

/** Existing administrative snapshots are explicitly partial, not full restoration images. */
export async function appendSecurityBusinessChange(records: RecordAuditService, tx: Transaction<CrmDatabase>, context: { event: SecurityAuditEvent; actor: AuditActorSnapshot; operationId: string }): Promise<void> {
    const { event, actor, operationId } = context;
    const change = getRecordAuditSourceChange(event.metadata?.changeSet);
    if (!change) throw new BadRequestException("Commercial audit requires a server-built changeset");
    const source = await resolveSource(tx, change, event.metadata?.catalogCode);
    await records.append(tx, {
        source,
        actor,
        action: actions[change.action],
        module: typeof event.metadata?.moduleCode === "string" ? event.metadata.moduleCode : "administration",
        before: change.before,
        after: change.after,
        allowedFields: Object.keys({ ...change.before, ...change.after }),
        operationId,
        correlationId: operationId,
        reason: event.reason ?? null,
        snapshotScope: "partial",
        ...networkContext(event),
    });
}
