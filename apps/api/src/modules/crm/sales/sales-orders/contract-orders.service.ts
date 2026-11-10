import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Transaction } from "kysely";

import { canReadFormalizationQueue } from "../../../../common/security/route-permission.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { IdentityService } from "../../identity/identity.service.js";
import { type ContractOrderPageRow, type ContractOrdersQuery, parseContractCursor, validateContractOrdersQuery } from "./contract-orders.dto.js";
import { CONTRACT_ORDERS_LEGACY_READER, type ContractOrdersLegacyReader } from "./contract-orders.port.js";
import { ContractOrdersRepository } from "./contract-orders.repository.js";
import { ContractSummaryRepository } from "./contract-summary.repository.js";

/** Quita las claves internas de orden. `nextCursor` sale solo si la fila de sonda demuestra que hay más datos. */
const pageResponse = (rows: ContractOrderPageRow[], more: boolean) => {
    const last = rows.at(-1);
    return { items: rows.map(({ source, id, businessId, state, sequence }) => ({ source, id, businessId, state, sequence })), nextCursor: more && last ? `${last.source}:${last.sortId}` : null };
};

/** No hay un listado global de órdenes. Salen solo las colas de contrato autorizadas por rol y acotadas. */
@Injectable()
export class ContractOrdersService {
    /** Reutiliza el mismo mecanismo de foto que los totales del banner. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ContractSummaryRepository) private readonly snapshot: ContractSummaryRepository,
        @Inject(ContractOrdersRepository) private readonly repository: ContractOrdersRepository,
        @Inject(CONTRACT_ORDERS_LEGACY_READER) private readonly legacy: ContractOrdersLegacyReader,
    ) {}

    /** La membresía se vuelve a validar antes de buscar. Una fuente no disponible no se convierte en una página vacía. */
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
     * Primero se agotan las filas nativas y después las viejas, para que el cursor combinado siga siendo monótono.
     * Cada fuente se lee con límite más uno y así se detecta otra página sin una consulta extra de conteo.
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
