import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { readNativeAppointments } from "./marketing-appointments.repository.js";
import { marketingCount, type MarketingDailyRow, type MarketingExternalIdentity, type MarketingWindow, type NativeMarketingData, type NativeMarketingProject, type NativeMarketingUser } from "./marketing-home.contract.js";

/** Native data is read first, inside one repeatable-read/read-only report snapshot. */
@Injectable()
export class MarketingHomeRepository {
    /**
     *
     */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
    /**
     *
     */
    readSnapshot<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(read);
    }
    /** Resolve permitted sellers by active organizational membership; unresolved legacy owners never gain area access. */
    async visibleSellers(tx: Transaction<CrmDatabase>, profile: IdentityProfile, scopes: readonly string[]): Promise<ReadonlySet<string>> {
        const visible = new Set([profile.user.publicId]);
        if (!scopes.some((scope) => scope === "own_area" || scope === "own_area_and_children")) return visible;
        const units = await tx.selectFrom("sec_org_unit").select(["id_org_unit", "public_id_org_unit", "parent_org_unit_id_org_unit"]).where("status_org_unit", "=", "active").where("deleted_at_org_unit", "is", null).execute();
        const assigned = new Set(profile.orgUnits.filter((unit) => unit.status === "active").map((unit) => unit.publicId));
        const permitted = new Set(units.filter((unit) => assigned.has(unit.public_id_org_unit)).map((unit) => unit.id_org_unit));
        if (scopes.includes("own_area_and_children")) includeDescendants(units, permitted);
        if (permitted.size === 0) return visible;
        const members = await tx
            .selectFrom("sec_user_org_unit as m")
            .innerJoin("sec_user as u", "u.id_user", "m.user_id_user_org_unit")
            .select("u.public_id_user")
            .where("m.status_user_org_unit", "=", "active")
            .where("m.revoked_at_user_org_unit", "is", null)
            .where("m.org_unit_id_user_org_unit", "in", [...permitted])
            .execute();
        for (const member of members) visible.add(member.public_id_user);
        return visible;
    }
    /**
     *
     */
    async readNative(tx: Transaction<CrmDatabase>, window: MarketingWindow): Promise<NativeMarketingData> {
        const start = new Date(window.startEpoch * 1000).toISOString().slice(0, 23).replace("T", " ");
        const end = new Date(window.endEpoch * 1000).toISOString().slice(0, 23).replace("T", " ");
        const rows = await sql<MarketingDailyRow>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ DATE_FORMAT(DATE_SUB(l.created_at_lead,INTERVAL 6 HOUR),'%Y-%m-%d') AS date,
            COALESCE(u.public_id_user,'unassigned') AS sellerId,p.public_id_project AS projectId,COUNT(*) AS leads
            FROM crm_lead l LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead JOIN crm_project p ON p.id_project=l.project_id_lead
            WHERE l.created_at_lead>=${start} AND l.created_at_lead<${end}
            GROUP BY date,sellerId,projectId ORDER BY date,sellerId,projectId LIMIT 50001`.execute(tx);
        if (rows.rows.length > 50000) throw new Error("Marketing aggregate limit exceeded");
        const users = await sql<NativeMarketingUser>`SELECT public_id_user AS id,display_name_user AS name,normalized_email_user AS email FROM sec_user`.execute(tx);
        const projects = await sql<NativeMarketingProject>`SELECT public_id_project AS id,name_project AS name FROM crm_project`.execute(tx);
        const userAliases = await sql<MarketingExternalIdentity>`SELECT u.public_id_user AS id,s.code_external_system AS ${sql.ref("system")},x.external_user_id_user_external_identity AS externalId
            FROM int_user_external_identity x JOIN sec_user u ON u.id_user=x.user_id_user_external_identity JOIN int_external_system s ON s.id_external_system=x.external_system_id_user_external_identity
            WHERE x.status_user_external_identity='active' AND x.deleted_at_user_external_identity IS NULL AND s.status_external_system='active'`.execute(tx);
        const projectAliases = await sql<MarketingExternalIdentity>`SELECT p.public_id_project AS id,s.code_external_system AS ${sql.ref("system")},x.external_id_project_external_reference AS externalId
            FROM crm_project_external_reference x JOIN crm_project p ON p.id_project=x.project_id_project_external_reference JOIN int_external_system s ON s.id_external_system=x.external_system_id_project_external_reference
            WHERE x.status_project_external_reference='active' AND x.deleted_at_project_external_reference IS NULL AND s.status_external_system='active'`.execute(tx);
        return { appointmentEvidence: await readNativeAppointments(tx, window), rows: rows.rows.map((row) => ({ ...row, leads: marketingCount(row.leads) })), users: users.rows, projects: projects.rows, userAliases: userAliases.rows, projectAliases: projectAliases.rows };
    }
}

/** Iterative closure also terminates if historical organizational data contains a cycle. */
export function includeDescendants(units: readonly { id_org_unit: number; parent_org_unit_id_org_unit: number | null }[], permitted: Set<number>): void {
    let changed = true;
    while (changed) {
        changed = false;
        for (const unit of units) {
            if (unit.parent_org_unit_id_org_unit === null || !permitted.has(unit.parent_org_unit_id_org_unit) || permitted.has(unit.id_org_unit)) continue;
            permitted.add(unit.id_org_unit);
            changed = true;
        }
    }
}
