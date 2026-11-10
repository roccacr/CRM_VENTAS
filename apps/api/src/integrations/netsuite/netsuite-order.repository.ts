import { ConflictException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import { readAuditActor } from "../../modules/crm/audit/audit-actor.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import { HomeSummaryRepository } from "../../modules/crm/sales/sales-orders/home-summary.repository.js";
import { readOrderClientContext } from "../../modules/crm/sales/sales-orders/order-client-context.query.js";
import { readOrderHistory } from "../../modules/crm/sales/sales-orders/order-history.query.js";
import { readOrderRecord } from "../../modules/crm/sales/sales-orders/order-record.query.js";
import type { TimingOrder } from "../../modules/crm/sales/sales-orders/order-timing.contract.js";
import { ORDER_TIMING_LEGACY_READER, type OrderTimingLegacyReader } from "../../modules/crm/sales/sales-orders/order-timing.port.js";
import { OrderTimingRepository } from "../../modules/crm/sales/sales-orders/order-timing.repository.js";
import { missingImportRelation } from "./netsuite-order-import.relations.js";

/**
 *
 */
@Injectable()
export class NetsuiteOrderRepository {
    /**
     *
     */
    constructor(
        @Inject(OrderTimingRepository) private readonly native: OrderTimingRepository,
        @Inject(ORDER_TIMING_LEGACY_READER) private readonly legacy: OrderTimingLegacyReader,
        @Inject(HomeSummaryRepository) private readonly snapshot: HomeSummaryRepository,
    ) {}
    /**
     *
     */
    async resolve(target: { source: "native" | "legacy"; id: string }, checkAccess: (order: TimingOrder) => void) {
        return this.resolveSafely(async (tx) => {
            const { source, order } = await this.authoritative(tx, target, checkAccess);
            const netsuiteId = await this.reference(tx, source, order.id);
            return { source, id: order.publicId, netsuiteId };
        });
    }
    /** Database read is independent of provider configuration and never creates a native record. */
    async readDatabase(target: { source: "native" | "legacy"; id: string }, checkAccess: (order: TimingOrder) => void, cursor?: string) {
        return this.resolveSafely(async (tx) => {
            const { source, order } = await this.authoritative(tx, target, checkAccess);
            const data = await readOrderRecord(tx, source, order.id, order.publicId, { legacyEnabled: this.legacy.enabled() });
            const client = await readOrderClientContext(tx, data, { legacyEnabled: this.legacy.enabled(), ...(cursor ? { cursor } : {}) });
            return { ...data, lead: data.lead ? { ...data.lead, status: client.status, followUpReason: client.followUpReason } : null, clientHistory: client.history };
        });
    }
    /** History resolves authority and resource scope before querying either source. */
    async readHistory(target: { source: "native" | "legacy"; id: string }, checkAccess: (order: TimingOrder) => void, cursor?: string, canReadAddendum = false) {
        return this.resolveSafely(async (tx) => {
            const { source, order } = await this.authoritative(tx, target, checkAccess);
            return readOrderHistory(tx, source, order.id, { legacyEnabled: this.legacy.enabled(), canReadAddendum, ...(cursor ? { cursor } : {}) });
        });
    }
    /** Revalidate authority/reference while the writer holds the destination row lock. */
    async authorizeSynchronization(tx: Transaction<CrmDatabase>, command: { target: { source: "native" | "legacy"; id: string }; netsuiteId: string; destination: { destination: "native" | "legacy"; id: string }; check: (order: TimingOrder) => void; profile: IdentityProfile }) {
        const { target, netsuiteId, destination, check, profile } = command;
        const current = await this.authoritative(tx, target, check);
        if (current.source !== destination.destination || current.order.id !== destination.id || (await this.reference(tx, current.source, current.order.id)) !== netsuiteId) throw new ConflictException("La identidad de la orden cambio; recarga antes de sincronizar.");
        return this.captureSynchronizationActor(tx, profile);
    }
    /** Locks the live user/session version until the commercial transaction commits. */
    async captureSynchronizationActor(tx: Transaction<CrmDatabase>, profile: { user: Pick<IdentityProfile["user"], "publicId" | "permissionVersion">; session: Pick<IdentityProfile["session"], "publicId"> }) {
        const user = await tx.selectFrom("sec_user").select(["id_user", "permission_version_user"]).where("public_id_user", "=", profile.user.publicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
        if (!user || user.permission_version_user !== profile.user.permissionVersion) throw new ForbiddenException("Los permisos del usuario cambiaron durante la sincronizacion.");
        const session = await tx.selectFrom("sec_auth_session").select("id_auth_session").where("public_id_auth_session", "=", profile.session.publicId).where("user_id_auth_session", "=", user.id_user).where("status_auth_session", "=", "active").where("expires_at_auth_session", ">", new Date()).where("permission_version_auth_session", "=", user.permission_version_user).forUpdate().executeTakeFirst();
        if (!session) throw new ForbiddenException("La sesion ya no esta vigente.");
        const actor = await readAuditActor(tx, user.id_user, true);
        if (!actor) throw new ForbiddenException("El usuario solicitante ya no esta activo.");
        return actor;
    }
    /**
     *
     */
    async importNeedsRelation(domain: "lead" | "subsidiary" | "user" | "unit_file", id: string) {
        if (!this.legacy.enabled()) throw new ServiceUnavailableException("La base anterior no está disponible para conciliar al cliente.");
        return this.resolveSafely((tx) => missingImportRelation(tx, domain, id));
    }

    private async authoritative(tx: Transaction<CrmDatabase>, target: { source: "native" | "legacy"; id: string }, checkAccess: (order: TimingOrder) => void) {
        let source: "native" | "legacy" = "native";
        let order = await this.native.find(tx, target.source, target.id);
        if (!order && target.source === "legacy") {
            if (!this.legacy.enabled()) throw new ServiceUnavailableException("Fuente antigua no disponible.");
            source = "legacy";
            order = await this.legacy.find(tx, target.id);
        }
        if (!order || !order.active) throw new NotFoundException("Orden disponible no encontrada.");
        checkAccess(order);
        return { source, order };
    }
    private async resolveSafely<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        try {
            return await this.snapshot.readSnapshot(read);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException("No fue posible resolver la orden.");
        }
    }
    private async reference(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string): Promise<string> {
        const query =
            source === "native"
                ? sql<{ externalId: string | null }>`SELECT x.external_id_sales_order_external_reference AS externalId FROM crm_sales_order_external_reference x
                JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference
                WHERE x.sales_order_id_sales_order_external_reference=${id} AND s.code_external_system='netsuite' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active' LIMIT 2`
                : sql<{ externalId: string | null }>`SELECT CAST(id_ov_netsuite AS CHAR) AS externalId FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE id_ov=${id} LIMIT 2`;
        const { rows } = await query.execute(tx);
        if (rows.length > 1) throw new ConflictException("Referencia NetSuite ambigua.");
        const externalId = rows[0]?.externalId;
        if (!externalId || !/^[1-9][0-9]{0,19}$/.test(externalId)) throw new NotFoundException("La orden no tiene una referencia NetSuite valida.");
        return externalId;
    }
}
