import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const additions = [
    { code: "formalizacion_bancaria", label: "Formalización bancaria", color: "#0369A1" },
    { code: "adendum", label: "Adéndum", color: "#7C3AED" },
] as const;
type EventType = { id: number; code: string; label: string; color: string; status: string; formKey: string };

/** Fail closed before writing to the approved native module. */
async function requireModule(tx: Kysely<unknown>): Promise<number> {
    const destination = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0]?.name;
    if (destination !== "CRM_THINK_V2") throw new Error("Formalization calendar types require CRM_THINK_V2");
    const foundation = (await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610290054_calendar_event_types'`.execute(tx)).rows;
    if (foundation.length !== 1) throw new Error("Formalization calendar types require migration 054");
    const modules = (await sql<{ id: number }>`SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit='formalizacion' AND status_org_unit='active' AND deleted_at_org_unit IS NULL FOR UPDATE`.execute(tx)).rows;
    const moduleId = modules[0]?.id;
    if (modules.length !== 1 || !moduleId) throw new Error("An active Formalización module is required");
    return moduleId;
}

/** Existing managed definitions require explicit reconciliation if they differ. */
function validateExistingTypes(before: EventType[]): void {
    for (const definition of additions) {
        const existing = before.find((type) => type.code === definition.code);
        if (existing && (existing.label !== definition.label || existing.color !== definition.color || existing.status !== "active" || existing.formKey !== "formalizacion.general.v1")) throw new Error("Formalization calendar type configuration conflict");
    }
}

/** Only Formalización configuration changes; historical event identities and all other modules survive. */
export const formalizationCalendarTypesMigration = {
    name: "202611020061_formalization_calendar_types",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const moduleId = await requireModule(tx);
            const readTypes = async () => (await sql<EventType>`SELECT id_calendar_event_type AS id,code_calendar_event_type AS code,name_calendar_event_type AS label,color_calendar_event_type AS color,status_calendar_event_type AS status,form_key_calendar_event_type AS formKey FROM conf_calendar_event_type WHERE module_id_calendar_event_type=${moduleId} ORDER BY id_calendar_event_type FOR UPDATE`.execute(tx)).rows;
            const before = await readTypes();
            const missing = additions.filter((definition) => !before.some((type) => type.code === definition.code));
            validateExistingTypes(before);
            const retireCita = before.some((type) => type.code === "cita" && type.status === "active");
            if (!missing.length && !retireCita) return;
            const actor = (await sql<{ id: number }>`SELECT u.id_user AS id FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
            if (!actor) throw new Error("Active Owner audit attribution is required");
            for (const definition of missing) await sql`INSERT INTO conf_calendar_event_type (public_id_calendar_event_type,module_id_calendar_event_type,code_calendar_event_type,name_calendar_event_type,color_calendar_event_type,form_key_calendar_event_type,status_calendar_event_type) VALUES (${ulid()},${moduleId},${definition.code},${definition.label},${definition.color},'formalizacion.general.v1','active')`.execute(tx);
            // Retire the option without deleting or relabelling existing events.
            if (retireCita) await sql`UPDATE conf_calendar_event_type SET status_calendar_event_type='inactive' WHERE module_id_calendar_event_type=${moduleId} AND code_calendar_event_type='cita' AND status_calendar_event_type='active'`.execute(tx);
            const after = await readTypes();
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'calendar_event_types_synced',${actor.id},'Tipos de calendario de Formalización actualizados.','Solicitud del propietario: Formalización bancaria, Reunión, Tarea, Seguimiento y Adéndum.',${JSON.stringify({ migration: formalizationCalendarTypesMigration.name, moduleCode: "formalizacion", sectionCode: "calendar_event_types", changeSet: { version: 1, entity: "calendar_event_type", recordId: "formalizacion-calendar-types", action: "update", before: { eventTypes: before }, after: { eventTypes: after } } })})`.execute(
                tx,
            );
        });
    },
};
