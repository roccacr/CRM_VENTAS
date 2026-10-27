import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { canReadFormalizationStages } from "../../common/security/route-permission.js";
import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import { formalizationPermissionScope } from "../../modules/crm/sales/sales-orders/follow-up.service.js";
import { orderTimingIdentity, type TimingOrder } from "../../modules/crm/sales/sales-orders/order-timing.contract.js";
import { NetsuiteOrderRepository } from "./netsuite-order.repository.js";
import { NetsuiteRestletClient } from "./netsuite-restlet.client.js";

/** Resolve authorized CRM identity before contacting a provider. No DB writes or ERP updates. */
@Injectable()
export class NetsuiteSalesOrderService {
    /**
     *
     */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NetsuiteOrderRepository) private readonly repository: NetsuiteOrderRepository,
        @Inject(NetsuiteRestletClient) private readonly client: NetsuiteRestletClient,
    ) {}
    /**
     *
     */
    async read(session: string | undefined, input: unknown) {
        const resolved = await this.authorized(session, input, (target, check) => this.repository.resolve(target, check));
        // Release the database snapshot before the external request.
        const data = await this.client.readSalesOrder(resolved.netsuiteId);
        return { schemaVersion: 1 as const, order: resolved, data };
    }
    /** Same role, deny and resource checks as the provider read, with no external request. */
    async readDatabase(session: string | undefined, input: unknown) {
        return this.authorized(session, input, (target, check) => this.repository.readDatabase(target, check));
    }
    private async authorized<T>(session: string | undefined, input: unknown, read: (target: { source: "native" | "legacy"; id: string }, check: (order: TimingOrder) => void) => Promise<T>): Promise<T> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Permiso insuficiente para consultar la orden.");
        const target = orderTimingIdentity.safeParse(input);
        if (!target.success) throw new BadRequestException("Identidad de orden invalida.");
        const access = formalizationPermissionScope(profile, "formalizacion.home.stages.read");
        const approvals = formalizationPermissionScope(profile, "formalizacion.home.approvals.read");
        return read(target.data, (order) => {
            this.assertVisible(order, profile.user.publicId, access.ownOnly, approvals);
        });
    }
    private assertVisible(order: TimingOrder, actor: string, ownOnly: boolean, approvals: { allowed: boolean; ownOnly: boolean }): void {
        if (ownOnly && order.ownerId !== actor) throw new ForbiddenException("La orden esta fuera de su alcance.");
        if (order.pendingApproval && (!approvals.allowed || (approvals.ownOnly && order.ownerId !== actor))) throw new ForbiddenException("Permiso de aprobaciones insuficiente.");
    }
}
