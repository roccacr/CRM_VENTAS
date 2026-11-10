import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Transaction } from "kysely";

import { canReadFormalizationQueue } from "../../../../common/security/route-permission.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { IdentityService } from "../../identity/identity.service.js";
import { SALES_ORDER_SUMMARY_PAGE_SIZE } from "./approval-summary.port.js";
import { ApprovalSummaryRepository } from "./approval-summary.repository.js";
import { CONTRACT_SUMMARY_LEGACY_READER, type ContractCounts, type ContractSummaryLegacyReader, type LegacyContractRow } from "./contract-summary.port.js";
import { ContractSummaryRepository } from "./contract-summary.repository.js";

/** Cuenta una página vieja y omite los ids ya migrados. Una etapa desconocida o posterior no entra en ninguna cola. Los dos totales siguen siendo excluyentes. */
function addLegacyRows(counts: ContractCounts, rows: LegacyContractRow[], migrated: Set<number>): void {
    for (const row of rows) {
        if (migrated.has(row.id)) continue;
        if (row.state === "contract_pending_signature") counts.pendingSignature++;
        if (["contract_pending_send", "unclassified", "pending_approval"].includes(row.state)) counts.toSend++;
    }
}

/** La identidad nativa tapa lo viejo aunque la fila nativa actual ya no califique. */
@Injectable()
export class ContractSummaryService {
    /** Usa la autorización existente y la búsqueda de identidades migradas. No abre otro pool nativo. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ContractSummaryRepository) private readonly repository: ContractSummaryRepository,
        @Inject(ApprovalSummaryRepository) private readonly migrated: ApprovalSummaryRepository,
        @Inject(CONTRACT_SUMMARY_LEGACY_READER) private readonly legacy: ContractSummaryLegacyReader,
    ) {}

    /** Autoriza antes de cualquiera de las dos fuentes y devuelve solo conteos agregados. */
    async summary(session?: string) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationQueue(profile, "contracts")) throw new ForbiddenException("Se requiere el rol activo Formalizacion y el permiso de lectura de sus banners.");
        try {
            return await this.repository.readSnapshot(async (tx) => {
                const native = await this.repository.countNative(tx);
                const legacy = await this.legacyCount(tx);
                const toSend = native.toSend + legacy.counts.toSend;
                const pendingSignature = native.pendingSignature + legacy.counts.pendingSignature;
                return { schemaVersion: 1, observedAt: new Date().toISOString(), total: toSend + pendingSignature, toSend, pendingSignature, sources: { native, legacy: legacy.counts, legacyEnabled: this.legacy.enabled(), duplicatesExcluded: legacy.duplicates } };
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar las fuentes de contratos.");
        }
    }

    /** Pagina el diario viejo por clave y descarta los ids ya migrados, para que nada se cuente dos veces. */
    private async legacyCount(tx: Transaction<CrmDatabase>) {
        const counts: ContractCounts = { toSend: 0, pendingSignature: 0 };
        let duplicates = 0;
        let cursor = 0;
        if (!this.legacy.enabled()) return { counts, duplicates };
        for (;;) {
            const rows = await this.legacy.pending(cursor, tx);
            if (rows.length === 0) return { counts, duplicates };
            const ids = rows.map((row) => row.id);
            const migrated = new Set(await this.migrated.migratedIds(ids, tx));
            duplicates += migrated.size;
            addLegacyRows(counts, rows, migrated);
            const last = ids.at(-1);
            if (last === undefined || last <= cursor) throw new Error("Invalid legacy cursor");
            if (rows.length < SALES_ORDER_SUMMARY_PAGE_SIZE) return { counts, duplicates };
            cursor = last;
        }
    }
}
