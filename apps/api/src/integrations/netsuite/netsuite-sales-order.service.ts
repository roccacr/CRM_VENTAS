import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { canReadFormalizationOrder } from "../../common/security/route-permission.js";
import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import { assertFormalizationOrderReadable } from "../../modules/crm/sales/sales-orders/formalization-read.policy.js";
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
    async readDatabase(session: string | undefined, input: unknown, query: unknown = {}) {
        return this.authorized(session, input, (target, check) => {
            const parsed = z
                .object({ historyCursor: z.string().max(2048).optional() })
                .strict()
                .safeParse(query);
            if (!parsed.success) throw new BadRequestException("Filtros de historial invalidos.");
            return this.repository.readDatabase(target, check, parsed.data.historyCursor);
        });
    }
    /** Read-only audit timeline shares the independent order permission and active-record gate. */
    async readHistory(session: string | undefined, input: unknown, query: unknown = {}) {
        return this.authorized(session, input, (target, check) => {
            const parsed = z
                .object({ cursor: z.string().min(1).max(2048).optional() })
                .strict()
                .safeParse(query);
            if (!parsed.success) throw new BadRequestException("Filtros de bitácora inválidos.");
            return this.repository.readHistory(target, check, parsed.data.cursor);
        });
    }
    private async authorized<T>(session: string | undefined, input: unknown, read: (target: { source: "native" | "legacy"; id: string }, check: (order: TimingOrder) => void) => Promise<T>): Promise<T> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("Permiso insuficiente para consultar la orden.");
        const target = orderTimingIdentity.safeParse(input);
        if (!target.success) throw new BadRequestException("Identidad de orden invalida.");
        return read(target.data, (order) => {
            assertFormalizationOrderReadable(profile, order);
        });
    }
}
