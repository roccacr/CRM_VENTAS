import "dotenv/config";

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { validateEnv } from "../src/config/env.validation.js";
import { DatabaseService } from "../src/database/database.service.js";
import type { CrmDatabase } from "../src/database/database.types.js";
import { createLegacyCrmDatabase } from "../src/integrations/legacy-crm/legacy-crm.config.js";
import { SecurityAuditService } from "../src/modules/crm/audit/security-audit.service.js";

interface LegacyProject {
    id_proyecto: number;
    id_ProNetsuite: number;
    Nombre_proyecto: string | null;
    estado_proyecto: number;
}

interface Project {
    externalId: string;
    name: string;
    status: "active" | "inactive";
    legacyIds: number[];
}

const legacyProjectSchema = z.object({
    id_proyecto: z.number().int().positive(),
    id_ProNetsuite: z.number().int().positive(),
    Nombre_proyecto: z.string().trim().min(2).max(180),
    estado_proyecto: z.union([z.literal(0), z.literal(1)]),
});

/** Validate the entire source before writes; a provider identifier has exactly one owner. */
export const mapProjects = (rows: readonly LegacyProject[]): Project[] => {
    const mapped = new Map<string, Project>();
    const sourceIds = new Set<number>();
    for (const row of rows) {
        const validated = legacyProjectSchema.parse(row);
        const name = validated.Nombre_proyecto;
        if (sourceIds.has(row.id_proyecto)) throw new Error("Duplicate legacy project identity");
        sourceIds.add(row.id_proyecto);
        const externalId = String(row.id_ProNetsuite);
        const status = row.estado_proyecto === 1 ? "active" : "inactive";
        const existing = mapped.get(externalId);
        if (existing) {
            if (existing.name !== name || existing.status !== status) throw new Error(`Conflicting source records for NetSuite ${externalId}`);
            existing.legacyIds.push(row.id_proyecto);
        } else mapped.set(externalId, { externalId, name, status, legacyIds: [row.id_proyecto] });
    }
    return [...mapped.values()];
};

const readCurrentProject = (transaction: Transaction<CrmDatabase>, systemId: number, externalId: string) =>
    transaction
        .selectFrom("crm_catalog_item_external_reference as r")
        .innerJoin("crm_catalog_item as i", "i.id_catalog_item", "r.catalog_item_id_catalog_item_external_reference")
        .select(["i.id_catalog_item as id", "i.public_id_catalog_item as publicId", "i.catalog_code_catalog_item as catalog", "i.name_catalog_item as name", "i.status_catalog_item as status", "i.deleted_at_catalog_item as deleted", "r.id_catalog_item_external_reference as referenceId", "r.deleted_at_catalog_item_external_reference as referenceDeleted", "r.status_catalog_item_external_reference as referenceStatus", "r.metadata_catalog_item_external_reference as metadata"])
        .where("r.catalog_code_catalog_item_external_reference", "=", "projects")
        .where("r.external_system_id_catalog_item_external_reference", "=", systemId)
        .where("r.external_id_catalog_item_external_reference", "=", externalId)
        .forUpdate()
        .executeTakeFirst();

type CurrentProject = NonNullable<Awaited<ReturnType<typeof readCurrentProject>>>;

const assertCurrentProject = (current: CurrentProject | undefined, externalId: string): void => {
    if (current && (current.deleted || current.referenceDeleted || current.catalog !== "projects")) throw new Error(`Archived or inconsistent reference for NetSuite ${externalId}`);
};

const parseMetadata = (value: unknown): Record<string, unknown> => {
    if (!value) return {};
    return z.record(z.string(), z.unknown()).parse(typeof value === "string" ? JSON.parse(value) : value);
};

const isUnchanged = (current: CurrentProject | undefined, project: Project, previousMetadata: Record<string, unknown>, metadata: Record<string, unknown>): boolean => !!current && current.name === project.name && current.status === project.status && current.referenceStatus === "active" && JSON.stringify(previousMetadata) === JSON.stringify(metadata);

const persistProject = async (transaction: Transaction<CrmDatabase>, project: Project, context: { current: CurrentProject | undefined; actorId: number; systemId: number; publicId: string; metadata: Record<string, unknown> }): Promise<void> => {
    const { current, actorId, systemId, publicId, metadata } = context;
    const now = new Date();
    const inactivation = { inactivated_at_catalog_item: project.status === "inactive" ? now : null, inactivated_by_user_id_catalog_item: project.status === "inactive" ? actorId : null };
    if (current) {
        await transaction
            .updateTable("crm_catalog_item")
            .set({ name_catalog_item: project.name, status_catalog_item: project.status, updated_at_catalog_item: now, updated_by_user_id_catalog_item: actorId, ...(current.status !== project.status ? inactivation : {}) })
            .where("id_catalog_item", "=", current.id)
            .executeTakeFirstOrThrow();
        await transaction
            .updateTable("crm_catalog_item_external_reference")
            .set({ metadata_catalog_item_external_reference: JSON.stringify(metadata), status_catalog_item_external_reference: "active", updated_at_catalog_item_external_reference: now })
            .where("id_catalog_item_external_reference", "=", current.referenceId)
            .executeTakeFirstOrThrow();
        return;
    }
    const inserted = await transaction
        .insertInto("crm_catalog_item")
        .values({ public_id_catalog_item: publicId, native_code_catalog_item: `projects_${publicId.toLowerCase()}`, catalog_code_catalog_item: "projects", name_catalog_item: project.name, detail_catalog_item: null, status_catalog_item: project.status, created_at_catalog_item: now, updated_at_catalog_item: now, created_by_user_id_catalog_item: actorId, updated_by_user_id_catalog_item: actorId, ...inactivation })
        .executeTakeFirstOrThrow();
    await transaction
        .insertInto("crm_catalog_item_external_reference")
        .values({ catalog_item_id_catalog_item_external_reference: Number(inserted.insertId), catalog_code_catalog_item_external_reference: "projects", external_system_id_catalog_item_external_reference: systemId, external_id_catalog_item_external_reference: project.externalId, status_catalog_item_external_reference: "active", metadata_catalog_item_external_reference: JSON.stringify(metadata), created_at_catalog_item_external_reference: now, updated_at_catalog_item_external_reference: now })
        .executeTakeFirstOrThrow();
};

/** Caller owns the transaction, including rollback-only verification. No missing-source deletion. */
export const syncProjects = async (transaction: Transaction<CrmDatabase>, projects: readonly Project[], actorEmail: string, audit: SecurityAuditService): Promise<{ inserted: number; updated: number; skipped: number }> => {
    const actor = await transaction.selectFrom("sec_user").select("id_user").where("normalized_email_user", "=", actorEmail.trim().toLowerCase()).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
    const system = await transaction.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", "netsuite").where("status_external_system", "=", "active").executeTakeFirstOrThrow();
    // Serialize sync runs using an existing provider row; uniqueness remains the final concurrency guard.
    await transaction.selectFrom("int_external_system").select("id_external_system").where("id_external_system", "=", system.id_external_system).forUpdate().executeTakeFirstOrThrow();
    const result = { inserted: 0, updated: 0, skipped: 0 };
    for (const project of projects) {
        const current = await readCurrentProject(transaction, system.id_external_system, project.externalId);
        assertCurrentProject(current, project.externalId);
        const metadata = { source: "crmdatabase-api.proyectos", legacyProjectIds: project.legacyIds };
        const previousMetadata = parseMetadata(current?.metadata);
        const mergedMetadata = { ...previousMetadata, ...metadata };
        if (isUnchanged(current, project, previousMetadata, mergedMetadata)) {
            result.skipped++;
            continue;
        }
        const publicId = current ? current.publicId : ulid();
        await persistProject(transaction, project, { current, actorId: actor.id_user, systemId: system.id_external_system, publicId, metadata: mergedMetadata });
        result[current ? "updated" : "inserted"]++;
        await audit.record(
            {
                actorUserId: actor.id_user,
                eventType: current ? "catalog_item_updated" : "catalog_item_created",
                summary: `Project ${project.name} synchronized.`,
                reason: "Approved legacy project import keyed by NetSuite identifier",
                metadata: { catalogCode: "projects", itemPublicId: publicId, externalId: project.externalId, source: metadata.source, legacyProjectIds: project.legacyIds, previous: current ? { name: current.name, status: current.status } : null, next: { name: project.name, status: project.status } },
            },
            transaction,
        );
    }
    return result;
};

const readSourceProjects = async (): Promise<LegacyProject[]> => {
    const config = validateEnv(process.env);
    const sourcePath = process.argv.find((arg) => arg.startsWith("--source-json="))?.slice(14);
    if (process.env.LEGACY_CRM_DB_NAME !== "crmdatabase-api") throw new Error("Approved legacy database required");
    if (sourcePath) return JSON.parse(await readFile(sourcePath, "utf8")) as LegacyProject[];
    const source = createLegacyCrmDatabase(new ConfigService({ ...process.env, ...config }));
    if (!source) throw new Error("Read-only source is not configured");
    try {
        return (await sql<LegacyProject>`SELECT * FROM \`crmdatabase-api\`.proyectos ORDER BY id_proyecto`.execute(source)).rows;
    } finally {
        await source.destroy();
    }
};

const run = async (): Promise<void> => {
    const config = validateEnv(process.env);
    const actorEmail = process.argv.find((arg) => arg.startsWith("--actor="))?.slice(8);
    if (!actorEmail) throw new Error("An explicit --actor=email is required");
    const database = new DatabaseService(new ConfigService(config));
    const dryRun = new Error("Dry run rollback");
    const apply = process.argv.includes("--apply");
    try {
        const rows = await readSourceProjects();
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("A non-empty project snapshot is required");
        const projects = mapProjects(rows);
        const engines = await sql<{ ENGINE: string }>`SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('crm_catalog_item','crm_catalog_item_external_reference','audit_security_event')`.execute(database.db);
        if (engines.rows.length !== 3 || engines.rows.some((row) => row.ENGINE !== "InnoDB")) throw new Error("Transactional target tables required");
        await database.db
            .transaction()
            .execute(async (transaction) => {
                const result = await syncProjects(transaction, projects, actorEmail, new SecurityAuditService(database));
                console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", sourceRows: rows.length, uniqueProjects: projects.length, ...result }));
                if (!apply) throw dryRun;
            })
            .catch((error: unknown) => {
                if (error !== dryRun) throw error;
            });
        console.log(apply ? "Transaction committed." : "Dry run rolled back; no project changes persisted.");
    } finally {
        await database.onModuleDestroy();
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    void run().catch(() => {
        console.error("Project sync failed; transaction rolled back. Check validation, connectivity and reference integrity.");
        process.exitCode = 1;
    });
