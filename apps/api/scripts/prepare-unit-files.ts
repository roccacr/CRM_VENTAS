import { pathToFileURL } from "node:url";

import type { PoolOptions } from "mysql2";
import { type Connection, createConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { ulid } from "ulid";

import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { UNIT_FIELDS } from "../src/modules/crm/unit-files/unit-files.contract.js";

interface SourceProject {
    legacyId: number;
    externalId: number | null;
    name: string;
    status: number;
}
interface SourceGroup extends RowDataPacket {
    reference: number | null;
    sourceName: string;
    units: number | string;
}
interface Column extends RowDataPacket {
    Field: string;
    Type: string;
    Null: string;
}
interface NativeMapping extends RowDataPacket {
    id: number;
    legacyId: number | null;
    deleted: unknown;
    externalId: string | null;
}

/** Only unambiguous historical provider references can produce native identities. */
export function selectVerifiedProjects(rows: SourceProject[], required: number[]): SourceProject[] {
    return rows.filter((row) => row.externalId !== null && required.includes(row.externalId) && rows.filter((other) => other.externalId === row.externalId).length === 1);
}
/** Fails closed on names, capacities, types or nullability drift. */
export function validateSourceColumns(columns: Pick<Column, "Field" | "Type" | "Null">[]): void {
    const expected = [["id_expediente", "int", "NO"], ["ID_interno_expediente", "int", "NO"], ["idProyectoPrincipal_exp", "int", "YES"], ...Object.values(UNIT_FIELDS).map((field) => [field.source, field.length === "TEXT" ? "text" : `varchar(${String(field.length)})`, "YES"])];
    for (const row of expected) {
        if (row[0] === "fecha_mod") row[1] = "timestamp";
        if (row[0] === "cron_value") row[1] = "int";
    }
    const matches = expected.every(([name, type, nullable]) => columns.some((column) => column.Field === name && column.Type === type && column.Null === nullable));
    if (columns.length !== expected.length || !matches) throw new Error("Source schema drift: review names, types, capacities and nullability");
}
/** Never silently accept a missing/deleted mapping or steal another native project's provider ID. */
export function mappingConflicts(projects: SourceProject[], native: Pick<NativeMapping, "legacyId" | "deleted" | "externalId">[]): number[] {
    return projects
        .filter((project) => {
            const existing = native.filter((row) => row.legacyId === project.legacyId);
            const owners = native.filter((row) => row.externalId === String(project.externalId));
            if (existing.length === 0) return owners.length > 0;
            return !existing.some((row) => row.deleted === null && row.externalId === String(project.externalId)) || owners.some((owner) => owner.legacyId !== project.legacyId);
        })
        .map((project) => project.legacyId);
}
async function sourceReport(options: PoolOptions) {
    const connection = await createConnection({ ...options, database: "crmdatabase-api" });
    try {
        await connection.query("SET SESSION TRANSACTION READ ONLY");
        await connection.query("SET SESSION MAX_EXECUTION_TIME=2000");
        await connection.beginTransaction();
        const [columns] = await connection.query<Column[]>("SHOW COLUMNS FROM expedientes");
        validateSourceColumns(columns);
        const [projects] = await connection.query<(RowDataPacket & SourceProject)[]>("SELECT id_proyecto AS legacyId,id_ProNetsuite AS externalId,Nombre_proyecto AS name,estado_proyecto AS status FROM proyectos");
        const [groups] = await connection.query<SourceGroup[]>("SELECT idProyectoPrincipal_exp AS reference,MIN(proyectoPrincipal_exp) AS sourceName,COUNT(*) AS units FROM expedientes GROUP BY idProyectoPrincipal_exp");
        await connection.rollback();
        const verified = selectVerifiedProjects(
            projects,
            groups.map((row) => Number(row.reference)),
        );
        const unresolved = groups.filter((group) => !verified.some((project) => project.externalId === group.reference));
        return { verified, unresolved, units: groups.reduce((total, row) => total + Number(row.units), 0) };
    } finally {
        await connection.end();
    }
}
async function insertProject(connection: Connection, project: SourceProject, actor: number, system: number): Promise<number> {
    const [existing] = await connection.query<RowDataPacket[]>("SELECT id_project FROM crm_project WHERE id_old_produccion_project=? FOR UPDATE", [project.legacyId]);
    if (existing.length) return 0;
    if (!project.name || project.name.length > 180 || ![0, 1].includes(project.status)) throw new Error("Source project does not satisfy native validation");
    const publicId = ulid();
    const [result] = await connection.execute<ResultSetHeader>("INSERT INTO crm_project (public_id_project,native_code_project,id_old_produccion_project,name_project,status_project,created_by_user_id_project,updated_by_user_id_project) VALUES (?,?,?,?,?,?,?)", [publicId, `projects_${publicId.toLowerCase()}`, project.legacyId, project.name, project.status === 1 ? "active" : "inactive", actor, actor]);
    await connection.execute("INSERT INTO crm_project_external_reference (project_id_project_external_reference,external_system_id_project_external_reference,external_id_project_external_reference) VALUES (?,?,?)", [result.insertId, system, String(project.externalId)]);
    return 1;
}
async function applyProjects(connection: Connection, projects: SourceProject[]): Promise<void> {
    await connection.beginTransaction();
    try {
        const [actors] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT DISTINCT u.id_user AS id FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE u.normalized_email_user='rzuniga@roccacr.com' AND u.status_user='active' AND u.deleted_at_user IS NULL AND r.code_role='owner' AND r.status_role='active' AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL");
        const [systems] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id_external_system AS id FROM int_external_system WHERE code_external_system='netsuite' AND status_external_system='active'");
        const actor = actors[0];
        const system = systems[0];
        if (actors.length !== 1 || !actor || systems.length !== 1 || !system) throw new Error("Exactly one active Roberto Owner and historical provider required");
        let inserted = 0;
        for (const project of projects) inserted += await insertProject(connection, project, actor.id, system.id);
        if (inserted) await connection.execute("INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (?,?,?,?,?,?)", [ulid(), "unit_file_project_identity_prepared", actor.id, "Prepared verified CRM project identities for Unit Files", "Owner approved Unit Files migration preparation", JSON.stringify({ insertedProjects: inserted })]);
        await connection.commit();
        console.log(JSON.stringify({ insertedProjects: inserted, legacyWrites: 0 }));
    } catch (error) {
        await connection.rollback();
        throw error;
    }
}
/** Validates the explicit native target before opening either connection. */
function preparationOptions(): PoolOptions {
    const { DB_HOST, DB_USER, DB_PASSWORD } = process.env;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD) throw new Error("Missing secure database configuration");
    if (process.env.DB_NAME !== "CRM_THINK_V2" || process.env.ENABLE_LEGACY_FALLBACK !== "true") throw new Error("Requires CRM_THINK_V2 and enabled legacy fallback");
    return buildMysqlPoolOptions({ host: DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: DB_USER, password: DB_PASSWORD, database: "CRM_THINK_V2", connectionLimit: 1, ssl: process.env.DB_SSL === "true", ...(process.env.DB_SSL_CA ? { sslCaPath: process.env.DB_SSL_CA } : {}) });
}
/** Report-only by default; explicit apply writes solely verified project identities in the native DB. */
async function prepareUnitFiles(): Promise<void> {
    await import("dotenv/config");
    const options = preparationOptions();
    const report = await sourceReport(options);
    const native = await createConnection(options);
    try {
        const [identity] = await native.query<(RowDataPacket & { db: string })[]>("SELECT DATABASE() AS db");
        if (identity[0]?.db !== "CRM_THINK_V2") throw new Error("Native target mismatch");
        const [mappings] = await native.query<NativeMapping[]>(
            "SELECT p.id_project AS id,p.id_old_produccion_project AS legacyId,p.deleted_at_project AS deleted,r.external_id_project_external_reference AS externalId FROM crm_project p LEFT JOIN crm_project_external_reference r ON r.project_id_project_external_reference=p.id_project AND r.deleted_at_project_external_reference IS NULL AND r.status_project_external_reference='active' AND r.external_system_id_project_external_reference=(SELECT id_external_system FROM int_external_system WHERE code_external_system='netsuite')",
        );
        const conflicts = mappingConflicts(report.verified, mappings);
        console.log(JSON.stringify({ sourceColumns: 30, units: report.units, eligibleProjects: report.verified.length, unresolvedGroups: report.unresolved, unresolvedUnits: report.unresolved.reduce((total, row) => total + Number(row.units), 0), nativeMappingConflicts: conflicts }, null, 2));
        if (!process.argv.includes("--apply-project-identities")) return;
        if (conflicts.length) throw new Error("Native mapping conflicts require explicit reconciliation");
        await applyProjects(native, report.verified);
    } finally {
        await native.end();
    }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    prepareUnitFiles().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : "Unit Files preparation failed");
        process.exitCode = 1;
    });
}
