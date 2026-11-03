import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Transaction } from "kysely";

import { canReadFormalizationQueue } from "../../../../common/security/route-permission.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { IdentityService } from "../../identity/identity.service.js";
import { type ContractOrderPageRow, type ContractOrdersQuery, parseContractCursor, validateContractOrdersQuery } from "./contract-orders.dto.js";
import { CONTRACT_ORDERS_LEGACY_READER, type ContractOrdersLegacyReader } from "./contract-orders.port.js";
import { ContractOrdersRepository } from "./contract-orders.repository.js";
import { ContractSummaryRepository } from "./contract-summary.repository.js";

/** Strips internal sort keys; `nextCursor` is emitted only when the probe row proves more data exists. */
const pageResponse = (rows: ContractOrderPageRow[], more: boolean) => {
    const last = rows.at(-1);
    return { items: rows.map(({ source, id, businessId, state, sequence }) => ({ source, id, businessId, state, sequence })), nextCursor: more && last ? `${last.source}:${last.sortId}` : null };
};

/** No global order listing: only role-authorized, bounded contract queues are exposed. */
@Injectable()
export class ContractOrdersService {
    /** Reuses the exact same snapshot mechanism as the banner totals. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ContractSummaryRepository) private readonly snapshot: ContractSummaryRepository,
        @Inject(ContractOrdersRepository) private readonly repository: ContractOrdersRepository,
        @Inject(CONTRACT_ORDERS_LEGACY_READER) private readonly legacy: ContractOrdersLegacyReader,
    ) {}

    /** Membership is revalidated before lookup; unavailable sources do not become empty pages. */
    async list(session: string | undefined, input: ContractOrdersQuery) {
        const profile = await this.identity.getCurrentUser(session);
        const query = validateContractOrdersQuery(input);
        if (!canReadFormalizationQueue(profile, query.queue)) throw new ForbiddenException("No tiene permiso para consultar esta bandeja.");
        try {
            return await this.snapshot.readSnapshot((tx) => this.readPage(tx, query));
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar las ordenes de contratos.");
        }
    }

    /**
     * Native rows are exhausted before legacy ones so the combined cursor stays monotonic.
     * Each source is read with limit+1 to detect a next page without an extra count query.
     */
    private async readPage(tx: Transaction<CrmDatabase>, query: ContractOrdersQuery) {
        const cursor = parseContractCursor(query.cursor);
        const native = cursor.source === "native" ? await this.repository.page(tx, query.queue, cursor.id, query.limit + 1) : [];
        if (native.length > query.limit) return pageResponse(native.slice(0, query.limit), true);
        const remaining = query.limit - native.length;
        const after = cursor.source === "legacy" ? cursor.id : "0";
        const legacy = this.legacy.enabled() ? await this.legacy.orders(tx, query.queue, after, remaining + 1) : [];
        return pageResponse([...native, ...legacy.slice(0, remaining)], legacy.length > remaining);
    }
}
