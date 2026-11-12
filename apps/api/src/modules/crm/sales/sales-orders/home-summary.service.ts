import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationOrder, canReadFormalizationStages, formalizationReadAccess } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import { HOME_SUMMARY_LEGACY_READER, type HomeSummaryLegacyReader } from "./home-summary.port.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { aggregateNumber, emptyStageCounts, type HomeSummary, type HomeSummaryPeriod, OVERDUE_THRESHOLD_MINUTES, type OverdueSummary, type StageCounts } from "./home-summary.types.js";

/** Una etapa que el actor no puede leer no filtra su atraso: se enmascara igual que su conteo. */
const allow = (allowed: boolean, value: number) => (allowed ? value : 0);
function maskOverdue(raw: OverdueSummary["counts"], access: ReturnType<typeof formalizationReadAccess>): OverdueSummary["counts"] {
    return {
        contractsToSend: allow(access.contracts, raw.contractsToSend),
        contractsPendingSignature: allow(access.contracts, raw.contractsPendingSignature),
        banking: allow(access.bank, raw.banking),
        bankingInProgress: allow(access.bank, raw.bankingInProgress),
        balance: allow(access.balance, raw.balance),
        transferPending: allow(access.transfer, raw.transferPending),
        transferSigned: allow(access.signed, raw.transferSigned),
    };
}

/** Solo agregados frescos de la base. Una etapa posterior ya guardada no vuelve a exigir la aprobación. */
@Injectable()
export class HomeSummaryService {
    /** Autoriza antes de cualquiera de las dos fuentes y reutiliza el puerto viejo del dominio. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(HomeSummaryRepository) private readonly repository: HomeSummaryRepository,
        @Inject(HOME_SUMMARY_LEGACY_READER) private readonly legacy: HomeSummaryLegacyReader,
    ) {}

    /** Solo la sesión viva elige al actor. El feed cubre las dos fuentes y no duplica sus historias. */
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

    /** Costa Rica usa UTC-6. El crédito del cierre anual no depende de la última etapa. */
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
                        .filter(([key]) => key !== "approvals" && key !== "addendum" && !key.startsWith("finiquito_"))
                        .every(([, value]) => value)
                )
                    legacy.duplicatesExcluded = 0;
                /** Suma dos contadores y rechaza un desborde fuera de los enteros seguros. */
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

    /** Órdenes atrasadas por etapa. Mismo permiso y misma máscara que los conteos; una falla aquí no afecta al resumen. */
    async overdue(session?: string): Promise<OverdueSummary> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Se requiere el rol activo Formalizacion y el permiso de lectura de sus banners.");
        const access = formalizationReadAccess(profile);
        const now = new Date();
        const cutoff = new Date(now.getTime() - OVERDUE_THRESHOLD_MINUTES * 60_000).toISOString().slice(0, 19).replace("T", " ");
        try {
            const raw = await this.repository.readSnapshot((tx) => this.repository.overdue(tx, cutoff));
            const counts = maskOverdue(raw, access);
            return { schemaVersion: 1, observedAt: now.toISOString(), thresholdMinutes: OVERDUE_THRESHOLD_MINUTES, source: "native", counts };
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar el atraso de las etapas.");
        }
    }
}
