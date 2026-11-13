import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

import { CALENDAR_EVENT_TYPES } from "../../src/modules/crm/calendar/calendar-event-types.catalog.js";

const modules = ["formalizacion", "mercadeo", "ventas", "contabilidad"] as const;
const tables = ["conf_schema_migration", "conf_calendar_event_type", "sec_org_unit", "sec_user", "sec_user_role", "sec_role", "audit_security_event"];
type Module = { id: number; code: (typeof modules)[number]; status: string; deleted: Date | null };
type EventType = { id: number; publicId: string; moduleId: number; code: string; label: string; color: string; formKey: string; status: string };
type Change = { module: Module; code: string; label: string; color: string; formKey: string; before: EventType | null };

/** Require the exact native destination, transactional tables and registered calendar foundation. */
async function preflight(tx: Kysely<unknown>): Promise<Module[]> {
    const destination = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0]?.name;
    if (destination !== "CRM_THINK_V2") throw new Error("Calendar event types require exactly CRM_THINK_V2");
    const inventory = (await sql<{ name: string; engine: string; kind: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)})`.execute(tx)).rows;
    if (inventory.length !== tables.length || !tables.every((name) => inventory.some((t) => t.name === name && t.engine === "InnoDB" && t.kind === "BASE TABLE"))) throw new Error("Calendar event types require native InnoDB configuration/audit tables");
    const foundation = (await sql<{ name: string }>`SELECT migration_name_schema_migration AS name FROM conf_schema_migration WHERE migration_name_schema_migration='202610280051_global_calendar'`.execute(tx)).rows;
    if (foundation.length !== 1 || foundation[0]?.name !== "202610280051_global_calendar") throw new Error("Calendar event types require registered migration 051");
    return readActiveModules(tx);
}

/** Missing or deleted modules are not silently recreated or inferred from roles. */
async function readActiveModules(tx: Kysely<unknown>): Promise<Module[]> {
    const rows = (await sql<Module>`SELECT id_org_unit AS id,code_org_unit AS code,status_org_unit AS status,deleted_at_org_unit AS deleted FROM sec_org_unit WHERE code_org_unit IN (${sql.join(modules)}) ORDER BY id_org_unit FOR UPDATE`.execute(tx)).rows;
    if (rows.length !== modules.length || !modules.every((code) => rows.filter((m) => m.code === code && m.deleted === null).length === 1)) throw new Error("Calendar event types require all four existing modules");
    return rows.filter((m) => m.status === "active");
}

async function readTypes(tx: Kysely<unknown>): Promise<EventType[]> {
    return (await sql<EventType>`SELECT id_calendar_event_type AS id,public_id_calendar_event_type AS publicId,module_id_calendar_event_type AS moduleId,code_calendar_event_type AS code,name_calendar_event_type AS label,color_calendar_event_type AS color,form_key_calendar_event_type AS formKey,status_calendar_event_type AS status FROM conf_calendar_event_type ORDER BY module_id_calendar_event_type,code_calendar_event_type FOR UPDATE`.execute(tx)).rows;
}

/** Existing general configuration and inactive status are independently managed. */
function planChanges(active: Module[], existing: EventType[]): Change[] {
    return active.flatMap((module) =>
        CALENDAR_EVENT_TYPES.filter((type) => type.modulos.some((code) => code === module.code)).flatMap((definition): Change[] => {
            const matches = existing.filter((type) => type.moduleId === module.id && type.code === definition.codigo);
            if (matches.length > 1) throw new Error("Calendar event type identity conflict requires reconciliation");
            const before = matches[0] ?? null;
            if (before?.code === "general") return [];
            const fields = { label: definition.tipo, color: definition.color, formKey: `${module.code}.general.v1` };
            if (before && JSON.stringify({ label: before.label, color: before.color, formKey: before.formKey }) === JSON.stringify(fields)) return [];
            return [{ module, code: definition.codigo, ...fields, before }];
        }),
    );
}

/** Only these three configurable values may change on an existing type; identity/status never do. */
async function applyChanges(tx: Kysely<unknown>, changes: Change[]): Promise<void> {
    for (const change of changes) {
        if (change.before) await sql`UPDATE conf_calendar_event_type SET name_calendar_event_type=${change.label},color_calendar_event_type=${change.color},form_key_calendar_event_type=${change.formKey} WHERE id_calendar_event_type=${change.before.id}`.execute(tx);
        else await sql`INSERT INTO conf_calendar_event_type (public_id_calendar_event_type,module_id_calendar_event_type,code_calendar_event_type,name_calendar_event_type,color_calendar_event_type,form_key_calendar_event_type,status_calendar_event_type) VALUES (${ulid()},${change.module.id},${change.code},${change.label},${change.color},${change.formKey},'active')`.execute(tx);
    }
}

/** Apply only catalog configuration with atomic before/after audit, without grants or event writes. */
export const calendarEventTypesMigration = {
    name: "202610290054_calendar_event_types",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const active = await preflight(tx);
            const changes = planChanges(active, await readTypes(tx));
            if (!changes.length) return;
            const actor = (
                await sql<{
                    id: number;
                    publicId: string;
                    name: string;
                }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
            ).rows[0];
            if (!actor) throw new Error("Calendar event type changes require active Owner audit attribution");
            await applyChanges(tx, changes);
            const current = await readTypes(tx);
            const after = changes.map((change) => current.find((type) => type.moduleId === change.module.id && type.code === change.code));
            if (after.some((type) => !type)) throw new Error("Calendar event type persistence verification failed");
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'calendar_event_types_synced',${actor.id},'Tipos de evento configurados desde el catalogo de calendario.','Catalogo autorizado por modulo; identidades, tipos inactivos y configuracion general conservados.',${JSON.stringify({ migration: calendarEventTypesMigration.name, moduleCode: "administration", sectionCode: "calendar_event_types", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "calendar_event_type", recordId: "calendar-event-types", action: "update", before: { eventTypes: changes.map((change) => change.before) }, after: { eventTypes: after } } })})`.execute(
                tx,
            );
        });
    },
};
