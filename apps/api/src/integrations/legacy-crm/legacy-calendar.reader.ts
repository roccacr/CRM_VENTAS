import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { CalendarRow } from "../../modules/crm/calendar/calendar.contract.js";
import type { CalendarLegacyReader, CalendarReadScope } from "../../modules/crm/calendar/calendar-legacy.port.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/** Unclassified historical events remain untouched; only explicitly owned/module-tagged legacy events can be shown. */
@Injectable()
export class LegacyCalendarReader implements CalendarLegacyReader {
    /** Injects the existing identity, persistence or audit dependencies. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly legacy: LegacyCrmDatabaseService) {}
    /** Checks whether the optional legacy source is configured. */
    enabled(): boolean {
        return this.legacy.isConfigured();
    }
    /** Reads bounded, authorized events without inventing historical module ownership. */
    async list(tx: Transaction<CrmDatabase>, scope: CalendarReadScope): Promise<CalendarRow[]> {
        if (!scope.modules.length || !this.enabled()) return [];
        const broad = scope.broadModules.length ? sql`c.module_code IN (${sql.join(scope.broadModules)})` : sql`FALSE`;
        const rows =
            await sql<CalendarRow>`SELECT c.calendar_id AS internalId,CONCAT('legacy:',c.calendar_id) AS id,'legacy' AS source,c.module_code AS originModule,t.public_id_calendar_event_type AS typeId,t.code_calendar_event_type AS typeCode,t.form_key_calendar_event_type AS formKey,v.nombre_calendar AS title,v.decrip_calendar AS description,NULL AS location,CONCAT(DATE_FORMAT(c.starts_at,'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(c.starts_at,'%f'),3),'Z') AS start,CONCAT(DATE_FORMAT(c.ends_at,'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(c.ends_at,'%f'),3),'Z') AS end,c.all_day AS allDay,c.status AS status,c.version AS version,c.details AS details,c.owner_user_public_id AS ownerPublicId FROM ${sql.table("crmdatabase-api.crm_calendar_event_context")} c JOIN ${sql.table("crmdatabase-api.calendars")} v ON v.id_calendar=c.calendar_id JOIN sec_org_unit o ON o.code_org_unit=c.module_code JOIN conf_calendar_event_type t ON t.module_id_calendar_event_type=o.id_org_unit AND t.code_calendar_event_type=c.event_type_code WHERE c.module_code IN (${sql.join(scope.modules)}) AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL AND c.starts_at < ${new Date(scope.end).toISOString().slice(0, 23).replace("T", " ")} AND c.ends_at > ${new Date(scope.start).toISOString().slice(0, 23).replace("T", " ")} AND (${broad} OR c.owner_user_public_id=${scope.actorPublicId}) AND NOT EXISTS(SELECT 1 FROM crm_calendar_event n WHERE n.legacy_calendar_id_calendar_event=c.calendar_id) ORDER BY c.starts_at,c.calendar_id LIMIT 501`.execute(
                tx,
            );
        return rows.rows;
    }
}
