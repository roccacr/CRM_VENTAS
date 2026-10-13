/**
 * Persistencia del agregado de proyectos.
 *
 * El id del CRM es `public_id_project`. Un id de NetSuite u otro sistema vive
 * en `crm_project_external_reference` y no sustituye esa identidad. Alta,
 * edición, estado y auditoría comparten una transacción.
 */
import { BadRequestException, ConflictException, Inject, Injectable, Optional } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { buildAuditChangeSet } from "../audit/audit-change-set.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import type { CatalogReadInput } from "../catalogs/catalog-fallback.js";
import type { CatalogExternalReference, CatalogExternalReferenceInput, CatalogItem, CatalogItemsResponse, CatalogMutationInput, CatalogStatusMutationInput } from "../catalogs/catalogs.types.js";
import { PROJECTS_LEGACY_ACCESS, type ProjectsLegacyAccess } from "./projects-legacy.port.js";

/** Fila nativa ya aliasada. `legacyId` es el id de producción viejo, no el público. */
interface ProjectRow {
    id: number;
    publicId: string;
    nativeCode: string;
    name: string;
    detail: string | null;
    status: "active" | "inactive";
    updatedAt: Date | string;
    legacyId: number | null;
}

/** Proyección fija de `crm_project`. Los nombres físicos no salen del request. */
const columns = sql`id_project AS id, public_id_project AS publicId, native_code_project AS nativeCode, name_project AS name, detail_project AS detail, status_project AS status, updated_at_project AS updatedAt, id_old_produccion_project AS legacyId`;

/**
 * Rechaza paginación que no quepa en un entero de MySQL.
 *
 * El tope de 200 evita traer el catálogo completo en una sola respuesta.
 */
const validatePagination = (limit: number, offset: number): void => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || offset > 2147483647) throw new BadRequestException("Invalid project pagination.");
};

/** La clave única de la referencia choca cuando otro proyecto ya posee ese id externo. */
const isDuplicateKeyError = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";

/** Persists projects, provider references and their transactional changelog. */
@Injectable()
export class ProjectsRepository {
    /**
     * Ids viejos que ya tienen fila nativa, borrados incluidos.
     *
     * Excluir también los borrados evita que el fallback vuelva a mostrar un proyecto que se eliminó aquí.
     */
    async listMigratedProjectIds(): Promise<readonly number[]> {
        const result = await sql<{ legacyId: number }>`SELECT id_old_produccion_project AS legacyId FROM crm_project WHERE id_old_produccion_project IS NOT NULL`.execute(this.database.db);
        return result.rows.map((row) => row.legacyId);
    }

    /**
     * @param database - Base del CRM nuevo
     * @param audit - Bitácora que debe escribirse en la misma transacción
     * @param legacy - Adaptador opcional. Sin él no se copia nada al CRM viejo
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
        @Optional() @Inject(PROJECTS_LEGACY_ACCESS) private readonly legacy?: ProjectsLegacyAccess,
    ) {}

    /**
     * Lista solo `crm_project` y sus referencias vivas.
     *
     * La búsqueda también mira el id externo, pero no devuelve referencias ya archivadas.
     */
    async listCatalogItems(input: CatalogReadInput): Promise<CatalogItemsResponse> {
        const limit = input.limit ?? 100;
        const offset = input.offset ?? 0;
        validatePagination(limit, offset);
        const status = input.status ? sql`AND p.status_project = ${input.status}` : sql``;
        const pattern = `%${input.search ?? ""}%`;
        const search = input.search ? sql`AND (p.name_project LIKE ${pattern} OR p.detail_project LIKE ${pattern} OR EXISTS (SELECT 1 FROM crm_project_external_reference r WHERE r.project_id_project_external_reference=p.id_project AND r.deleted_at_project_external_reference IS NULL AND r.external_id_project_external_reference LIKE ${pattern}))` : sql``;
        const where = sql`WHERE p.deleted_at_project IS NULL ${status} ${search}`;
        const count = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_project p ${where}`.execute(this.database.db);
        const rows = await sql<ProjectRow>`SELECT ${columns} FROM crm_project p ${where} ORDER BY p.name_project, p.id_project LIMIT ${limit} OFFSET ${offset}`.execute(this.database.db);
        const references = await this.loadReferences(
            rows.rows.map((row) => row.id),
            this.database.db,
        );
        const items = await Promise.all(rows.rows.map((row) => this.mapItem(row, this.database.db, references.get(row.id) ?? [])));
        return { catalog: { code: "projects", label: "Proyectos", moduleCode: "catalog_project" }, items, total: Number(count.rows[0]?.total ?? 0) };
    }

    /**
     * Crea el proyecto nativo, sus referencias y la auditoría en una transacción.
     *
     * Si el puerto legacy está activo, primero inserta allá y guarda ese id en
     * `id_old_produccion_project`. El ULID sigue siendo la identidad del CRM nuevo.
     */
    async createCatalogItem(input: CatalogMutationInput): Promise<CatalogItem> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.actor(transaction, input.actorPublicId);
            const auditInput = { ...input, actorSnapshot: await this.audit.captureActor(actor, transaction) };
            const publicId = ulid();
            const legacyId = this.legacy?.enabled() ? await this.legacy.create(transaction, { name: input.name, status: "active", externalReferences: input.externalReferences }) : null;
            const result = await sql`INSERT INTO crm_project (public_id_project,native_code_project,id_old_produccion_project,name_project,detail_project,created_by_user_id_project,updated_by_user_id_project) VALUES (${publicId},${`projects_${publicId.toLowerCase()}`},${legacyId},${input.name},${input.detail ?? null},${actor},${actor})`.execute(transaction);
            await this.replaceReferences(transaction, Number(result.insertId), input.externalReferences);
            const item = await this.find(transaction, publicId);
            if (!item) throw new BadRequestException("Created project could not be read.");
            const after = await this.mapItem(item, transaction);
            await this.recordAudit(transaction, actor, auditInput, "catalog_item_created", { externalReferences: input.externalReferences.map((reference) => reference.systemCode), changeSet: buildAuditChangeSet({ entity: "catalog", recordId: publicId, action: "create", before: null, after: { ...after } }) });
            return after;
        });
    }

    /**
     * Reemplaza referencias y actualiza el nombre.
     *
     * Una referencia que no viene en el cuerpo se archiva, no se borra en físico,
     * para conservar quién fue dueño de ese id externo.
     */
    async updateCatalogItem(publicId: string, input: CatalogMutationInput): Promise<CatalogItem | null> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.actor(transaction, input.actorPublicId);
            const auditInput = { ...input, actorSnapshot: await this.audit.captureActor(actor, transaction) };
            const current = await this.resolveForMutation(transaction, publicId, actor);
            if (!current) return null;
            const before = await this.mapItem(current, transaction, (await this.loadReferences([current.id], transaction, true)).get(current.id) ?? []);
            await this.replaceReferences(transaction, current.id, input.externalReferences);
            await sql`UPDATE crm_project SET name_project=${input.name}, detail_project=${input.detail ?? null}, updated_by_user_id_project=${actor}, updated_at_project=CURRENT_TIMESTAMP(3) WHERE id_project=${current.id}`.execute(transaction);
            await this.synchronize(transaction, { ...current, name: input.name }, input.externalReferences);
            const updated = await this.find(transaction, current.publicId);
            if (!updated) throw new BadRequestException("Updated project could not be read.");
            const after = await this.mapItem(updated, transaction, (await this.loadReferences([current.id], transaction, true)).get(current.id) ?? []);
            await this.recordAudit(transaction, actor, auditInput, "catalog_item_updated", { itemPublicId: current.publicId, changeSet: buildAuditChangeSet({ entity: "catalog", recordId: current.publicId, action: "update", before: { ...before }, after: { ...after } }) });
            return after;
        });
    }

    /**
     * Cambia el estado nativo y, si hay pareja vieja, el estado legacy.
     *
     * Inactivar guarda quién y cuándo. Reactivar limpia esos dos campos.
     */
    async updateCatalogItemStatus(input: CatalogStatusMutationInput): Promise<CatalogItem | null> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.actor(transaction, input.actorPublicId);
            const auditInput = { ...input, actorSnapshot: await this.audit.captureActor(actor, transaction) };
            const current = await this.resolveForMutation(transaction, input.itemPublicId, actor);
            if (!current) return null;
            const references = (await this.loadReferences([current.id], transaction, true)).get(current.id) ?? [];
            const before = await this.mapItem(current, transaction, references);
            const inactive = input.status === "inactive";
            await sql`UPDATE crm_project SET status_project=${input.status}, inactivated_at_project=${inactive ? new Date() : null}, inactivated_by_user_id_project=${inactive ? actor : null}, updated_by_user_id_project=${actor}, updated_at_project=CURRENT_TIMESTAMP(3) WHERE id_project=${current.id}`.execute(transaction);
            await this.synchronize(transaction, { ...current, status: input.status }, references);
            const updated = await this.find(transaction, current.publicId);
            if (!updated) throw new BadRequestException("Updated project could not be read.");
            const after = await this.mapItem(updated, transaction, references);
            await this.recordAudit(transaction, actor, auditInput, "catalog_item_status_changed", { itemPublicId: current.publicId, nextStatus: input.status, previousStatus: current.status, changeSet: buildAuditChangeSet({ entity: "catalog", recordId: current.publicId, action: inactive ? "deactivate" : "reactivate", before: { ...before }, after: { ...after } }) });
            return after;
        });
    }

    /**
     * Resuelve un id nativo o promueve uno legacy.
     *
     * Si `legacy:projects:N` ya tiene fila nativa, las ediciones siguientes usan
     * esa fila y no crean otra. Una fila nativa borrada no se revive por este camino.
     */
    private async resolveForMutation(transaction: Transaction<CrmDatabase>, publicId: string, actor: number): Promise<ProjectRow | null> {
        const match = /^legacy:projects:([1-9]\d*)$/.exec(publicId);
        if (!match) return this.find(transaction, publicId);
        const legacyId = Number(match[1]);
        if (!Number.isSafeInteger(legacyId) || legacyId > 2147483647) throw new BadRequestException("Invalid legacy project identity.");
        const existing = await sql<ProjectRow & { deletedAt: Date | null }>`SELECT ${columns}, deleted_at_project AS deletedAt FROM crm_project WHERE id_old_produccion_project=${legacyId} FOR UPDATE`.execute(transaction);
        if (existing.rows[0]) return existing.rows[0].deletedAt === null ? existing.rows[0] : null;
        return this.promoteLegacy(transaction, legacyId, actor);
    }

    /**
     * Copia un proyecto viejo a `crm_project` y le asigna un ULID nuevo.
     *
     * El id viejo queda solo como vínculo. Las siguientes ediciones ya no dependen de ese texto `legacy:`.
     */
    private async promoteLegacy(transaction: Transaction<CrmDatabase>, legacyId: number, actor: number): Promise<ProjectRow | null> {
        if (!this.legacy?.enabled()) return null;
        const legacy = await this.legacy.find(transaction, legacyId);
        if (!legacy) return null;
        const nativeId = ulid();
        const inserted = await sql`INSERT INTO crm_project (public_id_project,native_code_project,id_old_produccion_project,name_project,detail_project,status_project,created_by_user_id_project,updated_by_user_id_project) VALUES (${nativeId},${`projects_${nativeId.toLowerCase()}`},${legacyId},${legacy.name},${legacy.detail},${legacy.status},${actor},${actor})`.execute(transaction);
        await this.replaceReferences(transaction, Number(inserted.insertId), legacy.externalReferences);
        return this.find(transaction, nativeId);
    }

    /**
     * Refleja el cambio en el CRM viejo solo si el proyecto ya nació con pareja.
     *
     * Una edición de un proyecto solo nativo no crea la fila vieja. Eso lo hace el alta.
     */
    private async synchronize(transaction: Transaction<CrmDatabase>, row: ProjectRow, references: readonly CatalogExternalReferenceInput[]): Promise<void> {
        if (row.legacyId === null || !this.legacy?.enabled()) return;
        await this.legacy.update(transaction, row.legacyId, { name: row.name, status: row.status, externalReferences: references });
    }

    /** Traduce el `publicId` de la sesión al id interno. Un usuario borrado no puede auditar el cambio. */
    private async actor(transaction: Transaction<CrmDatabase>, publicId: string): Promise<number> {
        const actor = await transaction.selectFrom("sec_user").select("id_user").where("public_id_user", "=", publicId).where("deleted_at_user", "is", null).executeTakeFirst();
        if (!actor) throw new BadRequestException("Actor unavailable for project administration.");
        return actor.id_user;
    }

    /** Lee y bloquea la fila viva. El bloqueo evita que dos ediciones promuevan el mismo legado. */
    private async find(transaction: Transaction<CrmDatabase>, publicId: string): Promise<ProjectRow | null> {
        const result = await sql<ProjectRow>`SELECT ${columns} FROM crm_project WHERE public_id_project=${publicId} AND deleted_at_project IS NULL FOR UPDATE`.execute(transaction);
        return result.rows[0] ?? null;
    }

    /** Arma el contrato público. `id_old_produccion` solo sale si el vínculo existe. */
    private async mapItem(row: ProjectRow, executor: DatabaseService["db"], loadedReferences?: readonly CatalogExternalReference[]): Promise<CatalogItem> {
        const references = loadedReferences ?? (await this.loadReferences([row.id], executor)).get(row.id) ?? [];
        return { publicId: row.publicId, nativeCode: row.nativeCode, name: row.name, detail: row.detail, status: row.status, updatedAt: new Date(row.updatedAt).toISOString(), externalReferences: references, ...(row.legacyId === null ? {} : { id_old_produccion: row.legacyId }) };
    }

    /** Referencias activas de la página, agrupadas por proyecto para no consultar una por fila. */
    // Mutation snapshots need current reads even when an earlier actor lookup established REPEATABLE READ.
    private async loadReferences(ids: readonly number[], executor: DatabaseService["db"], lock = false): Promise<Map<number, CatalogExternalReference[]>> {
        const grouped = new Map<number, CatalogExternalReference[]>();
        if (ids.length === 0) return grouped;
        const result = await sql<
            CatalogExternalReference & { projectId: number }
        >`SELECT r.project_id_project_external_reference AS projectId, r.external_id_project_external_reference AS externalId, r.status_project_external_reference AS status, s.code_external_system AS systemCode, s.name_external_system AS systemName FROM crm_project_external_reference r JOIN int_external_system s ON s.id_external_system=r.external_system_id_project_external_reference WHERE r.project_id_project_external_reference IN (${sql.join(ids)}) AND r.deleted_at_project_external_reference IS NULL ORDER BY s.code_external_system ${lock ? sql`FOR UPDATE OF r` : sql``}`.execute(
            executor,
        );
        for (const { projectId, ...reference } of result.rows) grouped.set(projectId, [...(grouped.get(projectId) ?? []), reference]);
        return grouped;
    }

    /**
     * Deja activas solo las referencias recibidas.
     *
     * El sistema externo tiene que existir y estar activo. Un mismo par sistema
     * e id no puede repetirse en el cuerpo ni pertenecer a otro proyecto.
     */
    private async replaceReferences(transaction: Transaction<CrmDatabase>, projectId: number, references: readonly CatalogExternalReferenceInput[]): Promise<void> {
        const seen = new Set<string>();
        const retained: number[] = [];
        for (const reference of references) {
            const key = `${reference.systemCode}:${reference.externalId}`;
            if (seen.has(key)) throw new ConflictException("Duplicate external references.");
            seen.add(key);
            const system = await transaction.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", reference.systemCode).where("status_external_system", "=", "active").executeTakeFirst();
            if (!system) throw new BadRequestException(`External system not configured: ${reference.systemCode}.`);
            retained.push(await this.retainReference(transaction, { projectId, systemId: system.id_external_system, externalId: reference.externalId }));
        }
        const keep = retained.length ? sql`AND id_project_external_reference NOT IN (${sql.join(retained)})` : sql``;
        await sql`UPDATE crm_project_external_reference SET deleted_at_project_external_reference=CURRENT_TIMESTAMP(3), status_project_external_reference='inactive' WHERE project_id_project_external_reference=${projectId} AND deleted_at_project_external_reference IS NULL ${keep}`.execute(transaction);
    }

    /**
     * Reutiliza la fila de referencia si el id externo ya existe.
     *
     * Si estaba archivada y sigue siendo de este proyecto, se reactiva. Si es de otro, se rechaza.
     */
    private async retainReference(transaction: Transaction<CrmDatabase>, reference: { projectId: number; systemId: number; externalId: string }): Promise<number> {
        const existing = await sql<{ id: number; projectId: number; deletedAt: Date | null; status: string }>`SELECT id_project_external_reference AS id, project_id_project_external_reference AS projectId, deleted_at_project_external_reference AS deletedAt, status_project_external_reference AS status FROM crm_project_external_reference WHERE external_system_id_project_external_reference=${reference.systemId} AND external_id_project_external_reference=${reference.externalId} FOR UPDATE`.execute(
            transaction,
        );
        const row = existing.rows[0];
        if (row) {
            if (row.projectId !== reference.projectId) throw new ConflictException("External reference belongs to another project.");
            if (row.deletedAt !== null || row.status !== "active") await sql`UPDATE crm_project_external_reference SET deleted_at_project_external_reference=NULL, status_project_external_reference='active' WHERE id_project_external_reference=${row.id}`.execute(transaction);
            return row.id;
        }
        try {
            const result = await sql`INSERT INTO crm_project_external_reference (project_id_project_external_reference,external_system_id_project_external_reference,external_id_project_external_reference) VALUES (${reference.projectId},${reference.systemId},${reference.externalId})`.execute(transaction);
            return Number(result.insertId);
        } catch (error) {
            if (isDuplicateKeyError(error)) throw new ConflictException("External reference belongs to another project.");
            throw error;
        }
    }

    /** La auditoría entra en la transacción del cambio. Si el cambio revierte, el evento también. */
    // eslint-disable-next-line max-params -- Audit shares the same transaction as the domain mutation.
    private async recordAudit(transaction: Transaction<CrmDatabase>, actor: number, input: CatalogMutationInput | CatalogStatusMutationInput, eventType: string, metadata: Record<string, unknown> = {}): Promise<void> {
        await this.audit.record({ actorUserId: actor, actorSnapshot: input.actorSnapshot, eventType, reason: input.reason, summary: `Project ${eventType}.`, metadata: { catalogCode: "projects", moduleCode: input.moduleCode ?? null, sectionCode: "catalogs", ...metadata }, ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}), ...(input.userAgent ? { userAgent: input.userAgent } : {}) }, transaction);
    }
}
