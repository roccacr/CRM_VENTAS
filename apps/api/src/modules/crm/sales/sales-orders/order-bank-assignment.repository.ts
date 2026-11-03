import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { RecordAuditService } from "../../audit/record-audit.service.js";
import { BanksRepository } from "../../banks/banks.repository.js";
import type { BankAdvisor } from "../../banks/banks.types.js";
import { BANK_ASSIGNMENT_LEGACY, type BankAssignmentIdentity, type BankAssignmentLegacy, type BankAssignmentOrder } from "./order-bank-assignment.port.js";
export interface AssignmentChange {
    bankPublicId: string;
    advisorPublicId: string;
    expectedVersion: number;
    reason: string;
    actorPublicId: string;
}
export type AssignmentUnlink = Pick<AssignmentChange, "expectedVersion" | "reason" | "actorPublicId">;
/** Order lock serializes first assignments; CAS and audit share the same transaction. */
@Injectable()
export class OrderBankAssignmentRepository {
    /** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(BanksRepository) private readonly banks: BanksRepository,
        @Inject(BANK_ASSIGNMENT_LEGACY) private readonly legacy: BankAssignmentLegacy,
    ) {}
    private async native(tx: Transaction<CrmDatabase>, identity: BankAssignmentIdentity, lock: boolean): Promise<BankAssignmentOrder | undefined> {
        const filter =
            identity.source === "native"
                ? sql`o.public_id_sales_order=${identity.id}`
                : sql`(o.id_old_produccion_sales_order=${Number(identity.id)} OR EXISTS(SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE x.sales_order_id_sales_order_external_reference=o.id_sales_order AND s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active' AND x.external_id_sales_order_external_reference=${identity.id}))`;
        const ending = lock ? sql`FOR UPDATE` : sql``;
        const rows = (await sql<{ id: string; internalId: string; active: number | string }>`SELECT public_id_sales_order AS id,CAST(id_sales_order AS CHAR) AS internalId,(status_sales_order='active' AND cancelled_sales_order='no' AND deleted_at_sales_order IS NULL) AS active FROM crm_sales_order o WHERE ${filter} LIMIT 2 ${ending}`.execute(tx)).rows;
        if (rows.length > 1) throw new ConflictException("La identidad de la orden es ambigua.");
        const row = rows[0];
        return row ? { ...row, source: "native", active: Number(row.active) === 1 } : undefined;
    }
    private async resolve(tx: Transaction<CrmDatabase>, identity: BankAssignmentIdentity, lock: boolean) {
        let order = await this.native(tx, identity, false);
        if (order) order = lock ? await this.native(tx, identity, true) : order;
        else if (identity.source === "legacy") {
            const old = await this.legacy.read(tx, identity.id, lock);
            // Promotion locks the old order first; a current read prevents stale fallback writes.
            order = lock ? ((await this.native(tx, identity, true)) ?? old) : old;
        }
        if (!order?.active) throw new NotFoundException("Orden disponible no encontrada.");
        return order;
    }
    // eslint-disable-next-line complexity -- Nullable links preserve the persisted version and timestamp after unlink.
    private async snapshot(tx: Transaction<CrmDatabase>, order: BankAssignmentOrder) {
        const row = (
            await sql<{
                bankId: string | null;
                advisorId: string | null;
                version: number | string;
                changedAt: string;
            }>`SELECT b.public_id_bank AS bankId,a.public_id_bank_advisor AS advisorId,v.version_bank_assignment AS version,DATE_FORMAT(v.changed_at_bank_assignment,'%Y-%m-%dT%H:%i:%s.%fZ') AS changedAt FROM crm_sales_order_bank_assignment v LEFT JOIN crm_bank b ON b.id_bank=v.bank_id_bank_assignment LEFT JOIN crm_bank_advisor a ON a.id_bank_advisor=v.advisor_id_bank_assignment WHERE v.source_bank_assignment=${order.source} AND v.order_id_bank_assignment=${order.id}`.execute(tx)
        ).rows[0];
        const bank = row?.bankId ? await this.banks.getBank(row.bankId, tx) : null;
        const advisor = row?.advisorId ? await this.advisor(tx, row.advisorId) : null;
        return { source: order.source, id: order.id, version: Number(row?.version ?? 0), bank, advisor, changedAt: row?.changedAt ?? null };
    }
    private async advisor(tx: Transaction<CrmDatabase>, id: string): Promise<BankAdvisor> {
        const row = (
            await sql<
                Omit<BankAdvisor, "version"> & { version: number | string }
            >`SELECT a.public_id_bank_advisor AS publicId,b.public_id_bank AS bankPublicId,a.name_bank_advisor AS name,a.email_bank_advisor AS email,a.phone_bank_advisor AS phone,a.area_bank_advisor AS area,a.status_bank_advisor AS status,a.version_bank_advisor AS version,DATE_FORMAT(a.created_at_bank_advisor,'%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt,DATE_FORMAT(a.updated_at_bank_advisor,'%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt FROM crm_bank_advisor a JOIN crm_bank b ON b.id_bank=a.bank_id_bank_advisor WHERE a.public_id_bank_advisor=${id}`.execute(
                tx,
            )
        ).rows[0];
        if (!row) throw new NotFoundException("Ejecutivo no encontrado.");
        return { ...row, version: Number(row.version) };
    }
    /** Consulta la asignación sin escribir en la orden ni en su bitácora. */
    read(identity: BankAssignmentIdentity) {
        return this.database.db
            .transaction()
            .setAccessMode("read only")
            .execute(async (tx) => this.snapshot(tx, await this.resolve(tx, identity, false)));
    }
    /** Guarda una asignación autorizada con control optimista de versión. */
    change(identity: BankAssignmentIdentity, command: AssignmentChange) {
        return this.mutate(identity, command);
    }
    /** Conserva la fila central y avanza su versión al retirar ambos vínculos. */
    unlink(identity: BankAssignmentIdentity, command: AssignmentUnlink) {
        return this.mutate(identity, command);
    }
    private mutate(identity: BankAssignmentIdentity, command: AssignmentChange | AssignmentUnlink) {
        if (!this.audit.enabled) throw new ServiceUnavailableException("La asignación requiere bitácora habilitada.");
        return this.database.db
            .transaction()
            .setIsolationLevel("read committed")
            .execute(
                // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Assignment and unlink share one atomic lock, validation, CAS and audit boundary.
                async (tx) => {
                    const user = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", command.actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
                    if (!user) throw new ForbiddenException("Usuario no disponible.");
                    const actor = await this.audit.captureActor(tx, user.id_user);
                    const order = await this.resolve(tx, identity, true);
                    const before = await this.snapshot(tx, order);
                    if (before.version !== command.expectedVersion || before.version >= 4294967295) throw new ConflictException("La asignación cambió; recarga la orden.");
                    if ("bankPublicId" in command) {
                        const bank = (await sql<{ id: number; status: string }>`SELECT id_bank AS id,status_bank AS status FROM crm_bank WHERE public_id_bank=${command.bankPublicId} FOR UPDATE`.execute(tx)).rows[0];
                        if (!bank || bank.status !== "active") throw new ConflictException("Selecciona un banco activo.");
                        const advisor = (await sql<{ id: number; status: string }>`SELECT id_bank_advisor AS id,status_bank_advisor AS status FROM crm_bank_advisor WHERE public_id_bank_advisor=${command.advisorPublicId} AND bank_id_bank_advisor=${bank.id} FOR UPDATE`.execute(tx)).rows[0];
                        if (!advisor || advisor.status !== "active") throw new ConflictException("Selecciona un ejecutivo activo del banco.");
                        if (before.version === 0) await sql`INSERT INTO crm_sales_order_bank_assignment (source_bank_assignment,order_id_bank_assignment,bank_id_bank_assignment,advisor_id_bank_assignment,version_bank_assignment,changed_by_user_id_bank_assignment,changed_at_bank_assignment) VALUES (${order.source},${order.id},${bank.id},${advisor.id},1,${user.id_user},UTC_TIMESTAMP(3))`.execute(tx);
                        else {
                            const updated = await sql`UPDATE crm_sales_order_bank_assignment SET bank_id_bank_assignment=${bank.id},advisor_id_bank_assignment=${advisor.id},version_bank_assignment=version_bank_assignment+1,changed_by_user_id_bank_assignment=${user.id_user},changed_at_bank_assignment=UTC_TIMESTAMP(3) WHERE source_bank_assignment=${order.source} AND order_id_bank_assignment=${order.id} AND version_bank_assignment=${command.expectedVersion}`.execute(tx);
                            if (updated.numAffectedRows !== 1n) throw new ConflictException("La asignación cambió; recarga la orden.");
                        }
                    } else {
                        if (!before.bank || !before.advisor) throw new ConflictException("La orden no tiene una asignación bancaria vinculada.");
                        const updated = await sql`UPDATE crm_sales_order_bank_assignment SET bank_id_bank_assignment=NULL,advisor_id_bank_assignment=NULL,version_bank_assignment=version_bank_assignment+1,changed_by_user_id_bank_assignment=${user.id_user},changed_at_bank_assignment=UTC_TIMESTAMP(3) WHERE source_bank_assignment=${order.source} AND order_id_bank_assignment=${order.id} AND version_bank_assignment=${command.expectedVersion}`.execute(tx);
                        if (updated.numAffectedRows !== 1n) throw new ConflictException("La asignación cambió; recarga la orden.");
                    }
                    const after = await this.snapshot(tx, order);
                    const operationId = ulid();
                    await this.audit.append(tx, { source: { schema: order.source === "native" ? "CRM_THINK_V2" : "crmdatabase-api", table: order.source === "native" ? "crm_sales_order" : "ordenventa", entity: "sales_order", id: order.internalId }, actor, action: "update", module: "formalizacion", before: { bankAssignment: before }, after: { bankAssignment: after }, allowedFields: ["bankAssignment"], operationId, correlationId: operationId, reason: command.reason, snapshotScope: "partial" });
                    return after;
                },
            );
    }
}
