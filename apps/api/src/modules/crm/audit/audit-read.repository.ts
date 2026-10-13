import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import { CATALOG_DEFINITIONS } from "../catalogs/catalogs.constants.js";
import type { AuditContextRow } from "./audit-read.context.js";
import type { AuditQueryDto } from "./audit-read.contract.js";

interface AuditRow extends AuditContextRow {
    id: number;
    publicId: string;
    eventType: string;
    summary: string;
    reason: string | null;
    actorName: string | null;
    targetName: string | null;
    createdAt: Date | string;
    recordedModule: string | null;
    catalogCode: string | null;
}
const moduleValue = sql<string | null>`NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, '$.moduleCode')), 'null')`;
const catalogValue = sql<string | null>`NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, '$.catalogCode')), 'null')`;
// Freeze the event's actor name; old or non-string snapshots retain the joined fallback.
const actorNameValue = sql<string | null>`case when JSON_TYPE(JSON_EXTRACT(e.metadata_security_event, '$.actor.name')) = 'STRING' then JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, '$.actor.name')) else ${sql.ref("actor.display_name_user")} end`;
// Paths are internal constants; typed scalar extraction excludes objects, arrays and JSON null.
const jsonString = (path: string) => sql<string | null>`case when JSON_TYPE(JSON_EXTRACT(e.metadata_security_event, ${sql.lit(path)})) = 'STRING' then NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, ${sql.lit(path)})), 'null') else null end`;
const sectionValue = jsonString("$.sectionCode");
const contextSelections = [
    moduleValue.as("recordedModule"),
    catalogValue.as("catalogCode"),
    jsonString("$.sectionCode").as("recordedSection"),
    sql<string | null>`COALESCE(${jsonString("$.actor.publicId")}, ${sql.ref("actor.public_id_user")})`.as("actorPublicId"),
    sql`JSON_EXTRACT(e.metadata_security_event, '$.actor.roles')`.as("actorRoles"),
    sql`JSON_EXTRACT(e.metadata_security_event, '$.changeSet.version')`.as("recordVersion"),
    jsonString("$.changeSet.recordId").as("recordId"),
    jsonString("$.changeSet.entity").as("recordEntity"),
    jsonString("$.changeSet.action").as("recordAction"),
    sql<string | null>`COALESCE(${jsonString("$.changeSet.after.name")}, ${jsonString("$.changeSet.after.displayName")}, ${jsonString("$.changeSet.before.name")}, ${jsonString("$.changeSet.before.displayName")})`.as("recordName"),
    jsonString("$.itemPublicId").as("legacyItemId"),
    jsonString("$.roleCode").as("legacyRoleCode"),
    sql<string | null>`${sql.ref("target.public_id_user")}`.as("targetPublicId"),
] as const;
const USER_EVENTS = ["user_created", "user_updated", "user_status_updated", "user_access_replaced"];
const ROLE_EVENTS = ["role_updated", "role_deleted", "role_permissions_replaced"];

/** Read-only, parameterized audit queries with a bounded primary-key seek. */
@Injectable()
export class AuditReadRepository {
    /** Reuses the approved new-database pool; legacy is never queried. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Fetch only public event fields and the versioned snapshot, never raw metadata. */
    async detail(publicId: string) {
        return this.database.db
            .selectFrom("audit_security_event as e")
            .leftJoin("sec_user as actor", "actor.id_user", "e.actor_user_id_security_event")
            .leftJoin("sec_user as target", "target.id_user", "e.target_user_id_security_event")
            .select(["e.public_id_security_event as publicId", "e.event_type_security_event as eventType", "e.summary_security_event as summary", "e.reason_security_event as reason", "e.created_at_security_event as createdAt", "target.display_name_user as targetName", actorNameValue.as("actorName")])
            .select(sql`JSON_EXTRACT(e.metadata_security_event, '$.changeSet')`.as("changeSet"))
            .select(contextSelections)
            .where("e.public_id_security_event", "=", publicId)
            .limit(1)
            .executeTakeFirst();
    }

    /** Fetch one look-ahead row without counting or materializing the full history. */
    async list(query: AuditQueryDto, before?: number): Promise<AuditRow[]> {
        let read = this.database.db
            .selectFrom("audit_security_event as e")
            .leftJoin("sec_user as actor", "actor.id_user", "e.actor_user_id_security_event")
            .leftJoin("sec_user as target", "target.id_user", "e.target_user_id_security_event")
            .select(["e.id_security_event as id", "e.public_id_security_event as publicId", "e.event_type_security_event as eventType", "e.summary_security_event as summary", "e.reason_security_event as reason", "e.created_at_security_event as createdAt", "target.display_name_user as targetName", actorNameValue.as("actorName")])
            .select(contextSelections);
        if (query.sectionCode === "catalogs") {
            const codes = CATALOG_DEFINITIONS.filter((catalog) => !query.catalogCode || catalog.routeCode === query.catalogCode).map((catalog) => catalog.routeCode);
            read = read
                .where(catalogValue, "in", codes)
                .where((eb) => eb.or([eb(moduleValue, "=", query.moduleCode), eb(moduleValue, "is", null)]))
                .where((eb) => eb.or([eb(sectionValue, "=", "catalogs"), eb(sectionValue, "is", null)]));
        } else if (query.moduleCode === "administration") {
            read = read
                .where((eb) => eb.or([eb(moduleValue, "=", "administration"), eb(moduleValue, "is", null)]))
                .where((eb) => {
                    let historical = eb.or([...["local_%", "microsoft_%", "refresh_%", "session_%"].map((prefix) => eb("e.event_type_security_event", "like", prefix)), eb("e.event_type_security_event", "in", ["logout", "unit_file_project_identity_prepared"])]);
                    if (query.sectionCode === "users") historical = eb("e.event_type_security_event", "in", USER_EVENTS);
                    if (query.sectionCode === "roles") historical = eb("e.event_type_security_event", "in", ROLE_EVENTS);
                    return eb.or([eb(sectionValue, "=", query.sectionCode), eb.and([eb(sectionValue, "is", null), historical])]);
                });
        } else {
            read = read.where(moduleValue, "=", query.moduleCode).where(sectionValue, "=", query.sectionCode);
        }
        if (before !== undefined) read = read.where("e.id_security_event", "<", before);
        const search = query.search?.trim();
        if (search)
            read = read.where((eb) =>
                eb.or([
                    ...["e.summary_security_event", "e.reason_security_event", "e.event_type_security_event", "target.display_name_user", "target.public_id_user"].map((column) => eb(sql<number>`LOCATE(${search}, ${sql.ref(column)})`, ">", 0)),
                    eb(sql<number>`LOCATE(${search}, ${actorNameValue})`, ">", 0),
                    ...["$.changeSet.recordId", "$.changeSet.after.name", "$.changeSet.after.displayName", "$.changeSet.before.name", "$.changeSet.before.displayName", "$.itemPublicId", "$.roleCode"].map((path) => eb(sql<number>`LOCATE(${search}, ${jsonString(path)})`, ">", 0)),
                ]),
            );
        return read
            .modifyFront(sql`/*+ MAX_EXECUTION_TIME(1500) */`)
            .orderBy("e.id_security_event", "desc")
            .limit(query.limit + 1)
            .execute();
    }
}
