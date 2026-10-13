import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";

import { UNIT_FIELDS, type UnitDetail, type UnitFacet, type UnitFacetFilter, type UnitFilter, type UnitOptionFilter } from "../../../modules/crm/unit-files/unit-files.contract.js";
import { mapUnitDetail, mapUnitSummary, type UnitReadRow, unitText } from "../../../modules/crm/unit-files/unit-files.mapper.js";
import type { UnitFilesLegacy, UnitProjectBinding, UnitSeekRow } from "../../../modules/crm/unit-files/unit-files-legacy.port.js";
import { unitFileCriteria } from "../../../modules/crm/unit-files/unit-files-search.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "../legacy-crm-database.service.js";

// This historical column belongs to one namespace. Other provider IDs are never ORed into it.
const projectNamespace = "netsuite";
const facetFields = { code: "e.codigo_exp", projectIds: "p.public_id_project", housingType: "e.tipoDeVivienda_exp", status: "e.estado_exp" };
const from = sql`FROM \`crmdatabase-api\`.expedientes e
 JOIN (SELECT id_ProNetsuite FROM \`crmdatabase-api\`.proyectos WHERE id_ProNetsuite IS NOT NULL GROUP BY id_ProNetsuite HAVING COUNT(*)=1) verified ON verified.id_ProNetsuite=e.idProyectoPrincipal_exp
 JOIN CRM_THINK_V2.int_external_system s ON s.code_external_system=${projectNamespace}
 JOIN CRM_THINK_V2.crm_project_external_reference r ON r.external_system_id_project_external_reference=s.id_external_system AND r.external_id_project_external_reference=CAST(e.idProyectoPrincipal_exp AS CHAR) AND r.deleted_at_project_external_reference IS NULL AND r.status_project_external_reference='active'
 JOIN CRM_THINK_V2.crm_project p ON p.id_project=r.project_id_project_external_reference AND p.deleted_at_project IS NULL`;
const identities = sql`e.id_expediente AS position,CONCAT('legacy:unit-files:',e.id_expediente) AS id,NULL AS nativeCode,e.id_expediente AS legacyId,p.public_id_project AS projectId,p.name_project AS projectName,e.idProyectoPrincipal_exp AS projectReference,e.ID_interno_expediente AS externalId`;
const summaryFields = ["code", "housingType", "sourceStatus", "advertisedSalePrice", "habitableArea", "estimatedDelivery", "totalArea", "lotArea", "approximateParkingArea", "modifiedAt"] as const;

/** Source-specific translation and indexed anti-join are isolated here for clean removal. */
@Injectable()
export class LegacyUnitFilesReader implements UnitFilesLegacy {
    /** Reuses the independent read-only pool and the one global legacy gate. */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService,
    ) {}

    /** Checked immediately before every operation, not merely at construction. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /** Distinct choices share the native project bridge, anti-join and global source gate. */
    async options(filter: UnitOptionFilter, take: number): Promise<string[]> {
        if (!this.enabled()) return [];
        const field = sql`CONVERT(${sql.ref(`e.${UNIT_FIELDS[filter.kind].source}`)} USING utf8mb4) COLLATE utf8mb4_bin`;
        const status = filter.status ? sql`AND e.estado_exp=${filter.status}` : sql``;
        const match = filter.codeMatch ? sql`AND LOCATE(LOWER(${filter.codeMatch}),LOWER(e.codigo_exp))>0` : sql``;
        const type = filter.kind === "code" && filter.housingType ? sql`AND e.tipoDeVivienda_exp=${filter.housingType}` : sql``;
        try {
            return await this.database.db.transaction().execute(async (transaction) => {
                const result = await sql<{ value: string }>`SELECT /*+ MAX_EXECUTION_TIME(1500) */ DISTINCT ${field} AS value ${from}
                    WHERE p.public_id_project IN (${sql.join(filter.projectIds)})
                    AND ${field} IS NOT NULL AND ${field}<>'' AND ${field}>${filter.after ?? ""}
                    AND LOCATE(LOWER(${filter.search ?? ""}),LOWER(${field}))>0 ${status} ${type} ${match}
                    AND NOT EXISTS (SELECT 1 FROM CRM_THINK_V2.crm_unit_file n WHERE n.id_old_produccion_unit_file=e.id_expediente)
                    ORDER BY value LIMIT ${take}`.execute(transaction);
                return result.rows.map((row) => row.value);
            });
        } catch {
            throw new ServiceUnavailableException("No pudimos cargar las opciones de expedientes.");
        }
    }

    /** Only projected fields are fetched, with bounded criteria and no global ID array. */
    async list(filter: UnitFilter, projects: UnitProjectBinding[], after: number, take: number): Promise<UnitSeekRow[]> {
        if (!this.enabled()) return [];
        if (!projects.length) return [];
        const criteria = unitFileCriteria(filter, facetFields);
        const fields = sql.join(summaryFields.map((key) => sql`${sql.ref(`e.${UNIT_FIELDS[key].source}`)} AS ${sql.id(key)}`));
        try {
            return await this.database.db.transaction().execute(async (transaction) => {
                const result = await sql<UnitReadRow>`SELECT /*+ MAX_EXECUTION_TIME(1500) */ ${identities},${fields} ${from}
                  WHERE p.public_id_project IN (${sql.join(projects.map((project) => project.id))}) AND e.id_expediente>${after} ${criteria}
                  AND NOT EXISTS (SELECT 1 FROM CRM_THINK_V2.crm_unit_file n WHERE n.id_old_produccion_unit_file=e.id_expediente)
                  ORDER BY e.id_expediente LIMIT ${take}`.execute(transaction);
                return result.rows.map((row) => ({ position: row.position, item: mapUnitSummary(row) }));
            });
        } catch {
            throw new ServiceUnavailableException("No pudimos consultar los expedientes de la fuente temporal.");
        }
    }

    /** Full-scope facet counts retain native precedence and the read-only transaction boundary. */
    async facets(filter: UnitFacetFilter, take: number): Promise<UnitFacet[]> {
        if (!this.enabled()) return [];
        const field = sql`CONVERT(COALESCE(${sql.ref(facetFields[filter.kind])},'') USING utf8mb4) COLLATE utf8mb4_bin`;
        const after = filter.after === undefined ? sql`` : sql`AND ${field}>${filter.after}`;
        const criteria = unitFileCriteria(filter, facetFields, filter.kind);
        try {
            return await this.database.db.transaction().execute(async (transaction) => {
                const result = await sql<{ value: string; count: string | number }>`SELECT /*+ MAX_EXECUTION_TIME(1500) */ ${field} AS value,COUNT(*) AS count ${from}
                    WHERE p.public_id_project IN (${sql.join(filter.projectIds)}) ${criteria} ${after}
                    AND NOT EXISTS (SELECT 1 FROM CRM_THINK_V2.crm_unit_file n WHERE n.id_old_produccion_unit_file=e.id_expediente)
                    GROUP BY value ORDER BY value LIMIT ${take}`.execute(transaction);
                return result.rows.map((row) => ({ value: row.value, count: Number(row.count) }));
            });
        } catch {
            throw new ServiceUnavailableException("No pudimos cargar los filtros de expedientes.");
        }
    }

    /** Detail retains all business fields, and uses the same verified project mapping. */
    async detail(legacyId: number): Promise<UnitDetail | null> {
        if (!this.enabled()) return null;
        const fields = sql.join(Object.entries(UNIT_FIELDS).map(([key, field]) => sql`${sql.ref(`e.${field.source}`)} AS ${sql.id(key)}`));
        try {
            return await this.database.db.transaction().execute(async (transaction) => {
                const result = await sql<UnitReadRow>`SELECT /*+ MAX_EXECUTION_TIME(1500) */ ${identities},${fields} ${from} WHERE e.id_expediente=${legacyId} LIMIT 1`.execute(transaction);
                const row = result.rows[0];
                if (!row) return null;
                const externalId = unitText(row.externalId);
                return mapUnitDetail(row, externalId ? [{ systemCode: projectNamespace, externalId, status: "active" }] : []);
            });
        } catch {
            throw new ServiceUnavailableException("No pudimos consultar el detalle del expediente.");
        }
    }
}
