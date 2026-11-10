import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Transaction } from "kysely";

import { canReadFormalizationQueue } from "../../../../common/security/route-permission.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { IdentityService } from "../../identity/identity.service.js";
import { APPROVAL_LEGACY_READER, type ApprovalLegacyReader, SALES_ORDER_SUMMARY_PAGE_SIZE } from "./approval-summary.port.js";
import { ApprovalSummaryRepository } from "./approval-summary.repository.js";

/** Conteo canónico. Lo nativo prevalece sobre la identidad vieja que coincide. */
@Injectable()
export class ApprovalSummaryService {
    /** La autorización va antes de acceder a cualquiera de las dos bases. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ApprovalSummaryRepository) private readonly repository: ApprovalSummaryRepository,
        @Inject(APPROVAL_LEGACY_READER) private readonly legacy: ApprovalLegacyReader,
    ) {}

    /** No devuelve datos personales. Un fallo de la fuente no se informa como cero. */
    async summary(session?: string) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationQueue(profile, "approvals")) throw new ForbiddenException("No tiene permiso para ver pendientes de aprobacion.");
        try {
            return await this.repository.readSnapshot(async (tx) => {
                const native = await this.repository.countPending(tx);
                const legacy = await this.legacyCount(tx);
                return { schemaVersion: 1, observedAt: new Date().toISOString(), total: native + legacy.count, sources: { native, legacy: legacy.count, legacyEnabled: this.legacy.enabled(), duplicatesExcluded: legacy.duplicates } };
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar las fuentes de pendientes.");
        }
    }

    /** La lectura por clave está acotada. No acumula en memoria una lista de identidades sin tope. */
    private async legacyCount(tx: Transaction<CrmDatabase>) {
        let count = 0;
        let duplicates = 0;
        if (!this.legacy.enabled()) return { count, duplicates };
        let cursor = 0;
        for (;;) {
            const ids = await this.legacy.pendingIds(cursor, tx);
            if (ids.length === 0) break;
            const migrated = await this.repository.migratedIds(ids, tx);
            count += ids.length - migrated.length;
            duplicates += migrated.length;
            const last = ids.at(-1);
            if (last === undefined || last <= cursor) throw new Error("Invalid legacy cursor");
            if (ids.length < SALES_ORDER_SUMMARY_PAGE_SIZE) break;
            cursor = last;
        }
        return { count, duplicates };
    }
}
