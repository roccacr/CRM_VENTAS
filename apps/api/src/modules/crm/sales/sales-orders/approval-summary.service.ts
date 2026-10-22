import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { IdentityService } from "../../identity/identity.service.js";
import { APPROVAL_LEGACY_READER, type ApprovalLegacyReader } from "./approval-summary.port.js";
import { ApprovalSummaryRepository } from "./approval-summary.repository.js";

/** Canonical count: native data takes precedence over matching legacy identities. */
@Injectable()
export class ApprovalSummaryService {
    /** Authorization precedes access to either database. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ApprovalSummaryRepository) private readonly repository: ApprovalSummaryRepository,
        @Inject(APPROVAL_LEGACY_READER) private readonly legacy: ApprovalLegacyReader,
    ) {}

    /** Returns no personal data and never treats source failure as zero. */
    async summary(session?: string) {
        const profile = await this.identity.getCurrentUser(session);
        const entries = profile.permissions.filter((p) => p.code === "formalizacion.home.approvals.read");
        if (!entries.some((p) => p.effect === "allow") || entries.some((p) => p.effect === "deny")) {
            throw new ForbiddenException("No tiene permiso para ver pendientes de aprobacion.");
        }
        try {
            const native = await this.repository.countPending();
            const legacy = await this.legacyCount();
            return { schemaVersion: 1, observedAt: new Date().toISOString(), total: native + legacy.count, sources: { native, legacy: legacy.count, legacyEnabled: this.legacy.enabled(), duplicatesExcluded: legacy.duplicates } };
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar las fuentes de pendientes.");
        }
    }

    /** Bounded keyset reads avoid an unbounded identity list in memory. */
    private async legacyCount() {
        let count = 0;
        let duplicates = 0;
        if (!this.legacy.enabled()) return { count, duplicates };
        let cursor = 0;
        for (;;) {
            const ids = await this.legacy.pendingIds(cursor);
            if (ids.length === 0) break;
            const migrated = await this.repository.migratedIds(ids);
            count += ids.length - migrated.length;
            duplicates += migrated.length;
            const last = ids.at(-1);
            if (last === undefined || last <= cursor) throw new Error("Invalid legacy cursor");
            cursor = last;
        }
        return { count, duplicates };
    }
}
