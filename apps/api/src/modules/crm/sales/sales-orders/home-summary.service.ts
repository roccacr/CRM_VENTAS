import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationOrder, canReadFormalizationStages, formalizationReadAccess } from "../../../../common/security/route-permission.js";
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

    /** Only the live session selects the actor. The feed covers both sources without duplicating their histories. */
    async recentActivity(session?: string) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("No tiene permiso para consultar movimientos de órdenes.");
        try {
            const items = await this.repository.readSnapshot(async (tx) => {
                const events = await this.repository.recentActivity(tx, profile.user.publicId);
                const ids = (source: "native" | "legacy") => [...new Set(events.filter((event) => event.source === source).map((event) => event.orderId))];
                const native = await this.repository.nativeOrderLabels(tx, ids("native"));
                const legacy = this.legacy.enabled() ? await this.legacy.orderLabels(tx, ids("legacy")) : [];
                const labels = new Map([...native.map((row) => [`native:${row.id}`, row.number] as const), ...legacy.map((row) => [`legacy:${row.id}`, row.number] as const)]);
                return events.map(({ source, orderId, ...event }) => ({ ...event, orderNumber: labels.get(`${source}:${orderId}`) ?? `Orden ${orderId}` }));
            });
            return { schemaVersion: 1 as const, observedAt: new Date().toISOString(), items };
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar tus movimientos recientes.");
        }
    }

    /** Costa Rica uses UTC-6; annual closure credit is independent of the latest stage. */
    async summary(session?: string): Promise<HomeSummary> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Se requiere el rol activo Formalizacion y el permiso de lectura de sus banners.");
        const access = formalizationReadAccess(profile);
        const mask = (counts: StageCounts): StageCounts => ({
            contracts: access.contracts ? counts.contracts : { toSend: 0, pendingSignature: 0 },
            ...(access.bank ? { banking: counts.banking, bankingInProgress: counts.bankingInProgress ?? 0 } : { banking: 0, bankingInProgress: 0 }),
            balance: access.balance ? counts.balance : 0,
            transferPending: access.transfer ? counts.transferPending : 0,
            transferSigned: access.signed ? counts.transferSigned : 0,
            closedThisYear: access.closed ? counts.closedThisYear : 0,
        });
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(now));
        const period: HomeSummaryPeriod = { year, timeZone: "America/Costa_Rica", start: new Date(Date.UTC(year, 0, 1, 6)).toISOString(), endExclusive: new Date(Date.UTC(year + 1, 0, 1, 6)).toISOString() };
        try {
            const legacyEnabled = this.legacy.enabled();
            return await this.repository.readSnapshot(async (tx) => {
                const native = mask(await this.repository.aggregate(tx, period));
                const legacy = legacyEnabled ? await this.legacy.aggregate(tx, period) : { counts: emptyStageCounts(), duplicatesExcluded: 0 };
                legacy.counts = mask(legacy.counts);
                if (
                    !Object.entries(access)
                        .filter(([key]) => key !== "approvals" && key !== "addendum")
                        .every(([, value]) => value)
                )
                    legacy.duplicatesExcluded = 0;
                /** Adds two counters and rejects overflow beyond safe integers. */
                const add = (a: number, b: number) => aggregateNumber(a + b);
                const counts: StageCounts = {
                    contracts: { toSend: add(native.contracts.toSend, legacy.counts.contracts.toSend), pendingSignature: add(native.contracts.pendingSignature, legacy.counts.contracts.pendingSignature) },
                    banking: add(native.banking, legacy.counts.banking),
                    bankingInProgress: add(native.bankingInProgress ?? 0, legacy.counts.bankingInProgress ?? 0),
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
