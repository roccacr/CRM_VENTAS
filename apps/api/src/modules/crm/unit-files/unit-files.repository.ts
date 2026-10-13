import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import { UNIT_COLUMNS } from "./unit-files.columns.js";
import { type UnitDetail, type UnitFacet, type UnitFacetFilter, type UnitFilter, type UnitOptionFilter } from "./unit-files.contract.js";
import { mapUnitDetail, mapUnitSummary, type UnitReadRow } from "./unit-files.mapper.js";
import type { UnitProjectBinding, UnitSeekRow } from "./unit-files-legacy.port.js";
import { unitFileCriteria } from "./unit-files-search.js";

const summaryFields = ["code", "housingType", "sourceStatus", "advertisedSalePrice", "habitableArea", "estimatedDelivery", "totalArea", "lotArea", "approximateParkingArea", "modifiedAt"] as const;
const identities = sql`u.id_unit_file AS position,u.public_id_unit_file AS id,u.native_code_unit_file AS nativeCode,u.id_old_produccion_unit_file AS legacyId,p.public_id_project AS projectId,p.name_project AS projectName,u.source_project_reference_unit_file AS projectReference`;
const facetFields = { code: "u.code_unit_file", projectIds: "p.public_id_project", housingType: "u.housing_type_unit_file", status: "u.source_status_unit_file" };

/** Native-only persistence boundary; no legacy imports or legacy SQL. */
@Injectable()
export class UnitFilesRepository {
    /** Uses the existing native pool. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Small project selector, independent of unit volume. */
    async projects(): Promise<UnitProjectBinding[]> {
        const result = await sql<{
            id: string;
            name: string;
            systemCode: string | null;
            externalId: string | null;
        }>`SELECT p.public_id_project AS id,p.name_project AS name,s.code_external_system AS systemCode,r.external_id_project_external_reference AS externalId FROM crm_project p LEFT JOIN crm_project_external_reference r ON r.project_id_project_external_reference=p.id_project AND r.deleted_at_project_external_reference IS NULL AND r.status_project_external_reference='active' LEFT JOIN int_external_system s ON s.id_external_system=r.external_system_id_project_external_reference WHERE p.deleted_at_project IS NULL ORDER BY p.name_project,p.id_project`.execute(
            this.database.db,
        );
        const projects = new Map<string, UnitProjectBinding>();
        for (const row of result.rows) {
            const project = projects.get(row.id) ?? { id: row.id, name: row.name, externalReferences: [] };
            if (row.systemCode !== null && row.externalId !== null) project.externalReferences.push({ systemCode: row.systemCode, externalId: row.externalId });
            projects.set(row.id, project);
        }
        return [...projects.values()];
    }

    /** Distinct choices are scoped before binary seek pagination; no full rows are fetched. */
    async options(filter: UnitOptionFilter, take: number): Promise<string[]> {
        const field = sql`${sql.ref(`u.${UNIT_COLUMNS[filter.kind]}`)} COLLATE utf8mb4_bin`;
        const status = filter.status ? sql`AND u.source_status_unit_file=${filter.status}` : sql``;
        const match = filter.codeMatch ? sql`AND LOCATE(LOWER(${filter.codeMatch}),LOWER(u.code_unit_file))>0` : sql``;
        const type = filter.kind === "code" && filter.housingType ? sql`AND u.housing_type_unit_file=${filter.housingType}` : sql``;
        const result = await sql<{ value: string }>`SELECT DISTINCT ${field} AS value FROM crm_unit_file u JOIN crm_project p ON p.id_project=u.project_id_unit_file
            WHERE p.deleted_at_project IS NULL AND p.public_id_project IN (${sql.join(filter.projectIds)})
            AND ${field} IS NOT NULL AND ${field}<>'' AND ${field}>${filter.after ?? ""}
            AND LOCATE(LOWER(${filter.search ?? ""}),LOWER(${field}))>0 ${status} ${type} ${match}
            ORDER BY value LIMIT ${take}`.execute(this.database.db);
        return result.rows.map((row) => row.value);
    }

    /** Seek pagination applies criteria before returning at most take rows. */
    async list(filter: UnitFilter, after: number, take: number): Promise<UnitSeekRow[]> {
        const criteria = unitFileCriteria(filter, facetFields);
        const fields = sql.join(summaryFields.map((field) => sql`${sql.ref(`u.${UNIT_COLUMNS[field]}`)} AS ${sql.id(field)}`));
        const result = await sql<UnitReadRow>`SELECT ${identities},${fields} FROM crm_unit_file u JOIN crm_project p ON p.id_project=u.project_id_unit_file WHERE p.deleted_at_project IS NULL AND p.public_id_project IN (${sql.join(filter.projectIds)}) AND u.id_unit_file>${after} ${criteria} ORDER BY u.id_unit_file LIMIT ${take}`.execute(this.database.db);
        return result.rows.map((row) => ({ position: row.position, item: mapUnitSummary(row) }));
    }

    /** Aggregate only labels/counts across the complete scope, never full inventory rows. */
    async facets(filter: UnitFacetFilter, take: number): Promise<UnitFacet[]> {
        const field = sql`COALESCE(${sql.ref(facetFields[filter.kind])},'') COLLATE utf8mb4_bin`;
        const after = filter.after === undefined ? sql`` : sql`AND ${field}>${filter.after}`;
        const criteria = unitFileCriteria(filter, facetFields, filter.kind);
        const result = await sql<{ value: string; count: string | number }>`SELECT /*+ MAX_EXECUTION_TIME(1500) */ ${field} AS value,COUNT(*) AS count
            FROM crm_unit_file u JOIN crm_project p ON p.id_project=u.project_id_unit_file
            WHERE p.deleted_at_project IS NULL AND p.public_id_project IN (${sql.join(filter.projectIds)}) ${criteria} ${after}
            GROUP BY value ORDER BY value LIMIT ${take}`.execute(this.database.db);
        return result.rows.map((row) => ({ value: row.value, count: Number(row.count) }));
    }

    /** Full detail uses one row and one bounded reference query. */
    async detail(id: string): Promise<UnitDetail | null> {
        if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) throw new BadRequestException("Identidad de expediente invalida.");
        const fields = sql.join(Object.entries(UNIT_COLUMNS).map(([key, column]) => sql`${sql.ref(`u.${column}`)} AS ${sql.id(key)}`));
        const result = await sql<UnitReadRow>`SELECT ${identities},${fields} FROM crm_unit_file u JOIN crm_project p ON p.id_project=u.project_id_unit_file WHERE p.deleted_at_project IS NULL AND u.public_id_unit_file=${id} LIMIT 1`.execute(this.database.db);
        const row = result.rows[0];
        if (!row) return null;
        const references = await sql<UnitDetail["externalReferences"][number]>`SELECT s.code_external_system AS systemCode,r.external_id_unit_file_external_reference AS externalId,r.status_unit_file_external_reference AS status FROM crm_unit_file_external_reference r JOIN int_external_system s ON s.id_external_system=r.external_system_id_unit_file_external_reference WHERE r.unit_file_id_unit_file_external_reference=${row.position}`.execute(this.database.db);
        return mapUnitDetail(row, references.rows);
    }

    /** Prevents legacy detail links from bypassing an existing native replacement. */
    async findPromotedId(legacyId: number): Promise<string | null> {
        const result = await sql<{ id: string }>`SELECT public_id_unit_file AS id FROM crm_unit_file WHERE id_old_produccion_unit_file=${legacyId} LIMIT 1`.execute(this.database.db);
        return result.rows[0]?.id ?? null;
    }
}
