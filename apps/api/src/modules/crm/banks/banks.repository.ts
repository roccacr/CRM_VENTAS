import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { type Kysely, sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { buildAuditChangeSet } from "../audit/audit-change-set.js";
import { type AuditActorSnapshot, SecurityAuditService } from "../audit/security-audit.service.js";
import type { ListBanksQueryDto } from "./banks.dto.js";
import type { AdvisorChange, Bank, BankAdvisor, BankAuditContext, BankChange } from "./banks.types.js";
import { BANKS_LEGACY_ACCESS, type BanksLegacyAccess } from "./banks-legacy.port.js";

type Executor = Kysely<CrmDatabase> | Transaction<CrmDatabase>;
type BankRow = Omit<Bank, "createdAt" | "updatedAt" | "version" | "advisorCount"> & { createdAt: Date | string; updatedAt: Date | string; version: number | string; advisorCount: number | string };
type AdvisorRow = Omit<BankAdvisor, "createdAt" | "updatedAt" | "version"> & { createdAt: Date | string; updatedAt: Date | string; version: number | string };
const bankColumns = sql`b.public_id_bank AS publicId,b.name_bank AS name,b.status_bank AS status,b.version_bank AS version,b.created_at_bank AS createdAt,b.updated_at_bank AS updatedAt,(SELECT COUNT(*) FROM crm_bank_advisor a WHERE a.bank_id_bank_advisor=b.id_bank) AS advisorCount`;
const advisorColumns = sql`a.public_id_bank_advisor AS publicId,b.public_id_bank AS bankPublicId,a.name_bank_advisor AS name,a.email_bank_advisor AS email,a.phone_bank_advisor AS phone,a.area_bank_advisor AS area,a.status_bank_advisor AS status,a.version_bank_advisor AS version,a.created_at_bank_advisor AS createdAt,a.updated_at_bank_advisor AS updatedAt`;
const iso = (value: Date | string): string => new Date(value).toISOString();
const mapBank = (row: BankRow): Bank => ({ ...row, version: Number(row.version), advisorCount: Number(row.advisorCount), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });
const mapAdvisor = (row: AdvisorRow): BankAdvisor => ({ ...row, version: Number(row.version), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });
/** Native authority; mirror and audit share one native transaction, with parent locks before child locks. */
@Injectable()
export class BanksRepository {
    /** Uses only the native connection, atomic audit and the optional mirror port. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
        @Optional() @Inject(BANKS_LEGACY_ACCESS) private readonly legacy?: BanksLegacyAccess,
    ) {}
    // eslint-disable-next-line complexity -- Independent bounds close both pagination inputs before SQL.
    private pagination(query: ListBanksQueryDto) {
        const limit = query.limit ?? 25,
            offset = query.offset ?? 0;
        if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || offset > 2147483647) throw new BadRequestException("Paginación inválida.");
        return { limit, offset };
    }
    /** Returns a bounded bank page with the complete filtered total. */
    async listBanks(query: ListBanksQueryDto) {
        const { limit, offset } = this.pagination(query);
        const status = query.status ? sql`AND b.status_bank=${query.status}` : sql``;
        const search = query.search ? sql`AND b.name_bank LIKE ${`%${query.search}%`}` : sql``;
        const count = await sql<{ total: string | number }>`SELECT COUNT(*) AS total FROM crm_bank b WHERE 1=1 ${status} ${search}`.execute(this.database.db);
        const rows = await sql<BankRow>`SELECT ${bankColumns} FROM crm_bank b WHERE 1=1 ${status} ${search} ORDER BY b.name_bank,b.public_id_bank LIMIT ${limit} OFFSET ${offset}`.execute(this.database.db);
        return { items: rows.rows.map(mapBank), total: Number(count.rows[0]?.total ?? 0) };
    }
    /** Finds the native authoritative bank, never a legacy fallback. */
    async getBank(id: string, executor: Executor = this.database.db): Promise<Bank> {
        const result = await sql<BankRow>`SELECT ${bankColumns} FROM crm_bank b WHERE b.public_id_bank=${id}`.execute(executor);
        const row = result.rows[0];
        if (!row) throw new NotFoundException("Banco no encontrado.");
        return mapBank(row);
    }
    /** Returns the bounded advisor page scoped to its bank. */
    async listAdvisors(id: string, query: ListBanksQueryDto) {
        await this.getBank(id);
        const { limit, offset } = this.pagination(query);
        const status = query.status ? sql`AND a.status_bank_advisor=${query.status}` : sql``;
        const pattern = `%${query.search ?? ""}%`;
        const search = query.search ? sql`AND (a.name_bank_advisor LIKE ${pattern} OR a.email_bank_advisor LIKE ${pattern} OR a.phone_bank_advisor LIKE ${pattern} OR a.area_bank_advisor LIKE ${pattern})` : sql``;
        const from = sql`FROM crm_bank_advisor a JOIN crm_bank b ON b.id_bank=a.bank_id_bank_advisor WHERE b.public_id_bank=${id} ${status} ${search}`;
        const count = await sql<{ total: string | number }>`SELECT COUNT(*) AS total ${from}`.execute(this.database.db);
        const rows = await sql<AdvisorRow>`SELECT ${advisorColumns} ${from} ORDER BY a.name_bank_advisor,a.public_id_bank_advisor LIMIT ${limit} OFFSET ${offset}`.execute(this.database.db);
        return { items: rows.rows.map(mapAdvisor), total: Number(count.rows[0]?.total ?? 0) };
    }
    private async lockBank(tx: Transaction<CrmDatabase>, id: string) {
        const result = await sql<{ id: string; version: number; status: string }>`SELECT CAST(id_bank AS CHAR) AS id,version_bank AS version,status_bank AS status FROM crm_bank WHERE public_id_bank=${id} FOR UPDATE`.execute(tx);
        const row = result.rows[0];
        if (!row) throw new NotFoundException("Banco no encontrado.");
        return row;
    }
    private async advisor(tx: Transaction<CrmDatabase>, ids: { bankId: string; advisorId: string }): Promise<BankAdvisor> {
        const result = await sql<AdvisorRow>`SELECT ${advisorColumns} FROM crm_bank_advisor a JOIN crm_bank b ON b.id_bank=a.bank_id_bank_advisor WHERE b.public_id_bank=${ids.bankId} AND a.public_id_bank_advisor=${ids.advisorId}`.execute(tx);
        const row = result.rows[0];
        if (!row) throw new NotFoundException("Ejecutivo no encontrado.");
        return mapAdvisor(row);
    }
    private async actor(tx: Transaction<CrmDatabase>, context: BankAuditContext) {
        const row = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", context.actorPublicId).where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
        const snapshot = await this.audit.captureActor(row.id_user, tx);
        if (!snapshot) throw new BadRequestException("Actor no disponible.");
        return { id: row.id_user, snapshot };
    }
    // eslint-disable-next-line max-params -- Audit binds trusted context, actor, snapshots and the business action.
    private async record(tx: Transaction<CrmDatabase>, context: BankAuditContext, actor: { id: number; snapshot: AuditActorSnapshot }, before: Bank | BankAdvisor | null, after: Bank | BankAdvisor, kind: BankChange["kind"]) {
        const entity = "bankPublicId" in after ? "bank_advisor" : "bank";
        await this.audit.record(
            {
                eventType: `catalog_bank_${kind}`,
                actorUserId: actor.id,
                actorSnapshot: actor.snapshot,
                summary: "Cambio de catálogo bancario.",
                reason: context.reason,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
                metadata: { catalogCode: "banks", sectionCode: "catalogs", moduleCode: context.moduleCode, changeSet: buildAuditChangeSet({ entity, recordId: after.publicId, action: kind === "status" ? (after.status === "inactive" ? "deactivate" : "reactivate") : kind, before: before ? { ...before } : null, after: { ...after } }) },
            },
            tx,
        );
    }
    private async duplicate<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") throw new ConflictException({ statusCode: 409, code: "BANK_DUPLICATE", message: "El nombre del banco o correo del ejecutivo ya existe." });
            throw error;
        }
    }
    private assertVersion(current: number, expected: number) {
        if (current !== expected || expected >= 4294967295) throw new ConflictException("El registro cambió; actualice la información.");
    }
    /** Commits native bank, mirror and actor audit together. */
    async mutateBank(id: string | undefined, change: BankChange, context: BankAuditContext): Promise<Bank> {
        this.legacy?.assertWritable();
        return this.duplicate(() =>
            this.database.db
                .transaction()
                .setIsolationLevel("read committed")
                .execute(async (tx) => {
                    const actor = await this.actor(tx, context);
                    let before: Bank | null = null;
                    const publicId = id ?? ulid();
                    if (change.kind !== "create") {
                        const locked = await this.lockBank(tx, publicId);
                        this.assertVersion(locked.version, change.expectedVersion);
                        before = await this.getBank(publicId, tx);
                        const fields = change.kind === "update" ? sql`name_bank=${change.name}` : sql`status_bank=${change.status}`;
                        const result = await sql`UPDATE crm_bank SET ${fields},version_bank=version_bank+1,updated_at_bank=UTC_TIMESTAMP(3) WHERE public_id_bank=${publicId} AND version_bank=${change.expectedVersion}`.execute(tx);
                        if (result.numAffectedRows !== 1n) throw new ConflictException("El registro cambió.");
                    } else await sql`INSERT INTO crm_bank (public_id_bank,name_bank,status_bank,version_bank,created_at_bank,updated_at_bank) VALUES (${publicId},${change.name},'active',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`.execute(tx);
                    const after = await this.getBank(publicId, tx);
                    await this.legacy?.writeBank(tx, after, change.kind === "create" ? undefined : change.expectedVersion);
                    await this.record(tx, context, actor, before, after, change.kind);
                    return after;
                }),
        );
    }
    /** Locks the native parent before editing a child and mirrors by public identity. */
    async mutateAdvisor(ids: { bankId: string; advisorId?: string }, change: AdvisorChange, context: BankAuditContext): Promise<BankAdvisor> {
        this.legacy?.assertWritable();
        return this.duplicate(() =>
            this.database.db
                .transaction()
                .setIsolationLevel("read committed")
                // eslint-disable-next-line complexity -- Create/edit/status share the same parent lock and atomic audit boundary.
                .execute(async (tx) => {
                    const actor = await this.actor(tx, context);
                    const parent = await this.lockBank(tx, ids.bankId);
                    const publicId = ids.advisorId ?? ulid();
                    let before: BankAdvisor | null = null;
                    if (change.kind === "create") {
                        if (parent.status !== "active") throw new ConflictException({ statusCode: 409, code: "BANK_INACTIVE", message: "El banco inactivo no admite nuevos ejecutivos." });
                        await sql`INSERT INTO crm_bank_advisor (public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor,status_bank_advisor,version_bank_advisor,created_at_bank_advisor,updated_at_bank_advisor) VALUES (${publicId},${parent.id},${change.name},${change.email},${change.phone},${change.area},'active',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`.execute(tx);
                    } else {
                        const locked = await sql<{ version: number }>`SELECT version_bank_advisor AS version FROM crm_bank_advisor WHERE public_id_bank_advisor=${publicId} AND bank_id_bank_advisor=${parent.id} FOR UPDATE`.execute(tx);
                        if (!locked.rows[0]) throw new NotFoundException("Ejecutivo no encontrado.");
                        this.assertVersion(locked.rows[0].version, change.expectedVersion);
                        before = await this.advisor(tx, { bankId: ids.bankId, advisorId: publicId });
                        const fields = change.kind === "status" ? sql`status_bank_advisor=${change.status}` : sql`name_bank_advisor=${change.name},email_bank_advisor=${change.email},phone_bank_advisor=${change.phone},area_bank_advisor=${change.area}`;
                        const result = await sql`UPDATE crm_bank_advisor SET ${fields},version_bank_advisor=version_bank_advisor+1,updated_at_bank_advisor=UTC_TIMESTAMP(3) WHERE public_id_bank_advisor=${publicId} AND bank_id_bank_advisor=${parent.id} AND version_bank_advisor=${change.expectedVersion}`.execute(tx);
                        if (result.numAffectedRows !== 1n) throw new ConflictException("El registro cambió.");
                    }
                    const after = await this.advisor(tx, { bankId: ids.bankId, advisorId: publicId });
                    await this.legacy?.writeAdvisor(tx, after, change.kind === "create" ? undefined : change.expectedVersion);
                    await this.record(tx, context, actor, before, after, change.kind);
                    return after;
                }),
        );
    }
}
