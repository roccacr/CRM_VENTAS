import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationStages } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import { HOME_SUMMARY_LEGACY_READER, type HomeSummaryLegacyReader } from "./home-summary.port.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { aggregateNumber, emptyStageCounts, type HomeSummary, type HomeSummaryPeriod, type StageCounts } from "./home-summary.types.js";

/** Fresh DB aggregates only; later persisted stages do not re-require approvals. */
@Injectable()
export class HomeSummaryService {
    /** Authorizes before either source and reuses the legacy domain port. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(HomeSummaryRepository) private readonly repository: HomeSummaryRepository,
        @Inject(HOME_SUMMARY_LEGACY_READER) private readonly legacy: HomeSummaryLegacyReader,
    ) {}

    /** Costa Rica uses UTC-6; annual closure credit is independent of the latest stage. */
    async summary(session?: string): Promise<HomeSummary> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Se requiere el rol activo Formalizacion y el permiso de lectura de sus banners.");
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(now));
        const period: HomeSummaryPeriod = { year, timeZone: "America/Costa_Rica", start: new Date(Date.UTC(year, 0, 1, 6)).toISOString(), endExclusive: new Date(Date.UTC(year + 1, 0, 1, 6)).toISOString() };
        try {
            const legacyEnabled = this.legacy.enabled();
            return await this.repository.readSnapshot(async (tx) => {
                const native = await this.repository.aggregate(tx, period);
                const legacy = legacyEnabled ? await this.legacy.aggregate(tx, period) : { counts: emptyStageCounts(), duplicatesExcluded: 0 };
                /** Adds two counters and rejects overflow beyond safe integers. */
                const add = (a: number, b: number) => aggregateNumber(a + b);
                const counts: StageCounts = {
                    contracts: { toSend: add(native.contracts.toSend, legacy.counts.contracts.toSend), pendingSignature: add(native.contracts.pendingSignature, legacy.counts.contracts.pendingSignature) },
                    banking: add(native.banking, legacy.counts.banking),
                    balance: add(native.balance, legacy.counts.balance),
                    transferPending: add(native.transferPending, legacy.counts.transferPending),
                    transferSigned: add(native.transferSigned, legacy.counts.transferSigned),
                    closedThisYear: add(native.closedThisYear, legacy.counts.closedThisYear),
                };
                return { schemaVersion: 1, observedAt: now.toISOString(), period, counts, sources: { native, legacy: legacy.counts, legacyEnabled, duplicatesExcluded: legacy.duplicatesExcluded } };
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar las fuentes de Formalizacion.");
        }
    }
}
