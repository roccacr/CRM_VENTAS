import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { IdentityService } from "../identity/identity.service.js";
import { MarketingHomeRepository } from "./marketing-home.repository.js";
import { type MarketingLeadsReport, marketingLeadsReportQuery, type ReportSource } from "./marketing-leads-report.contract.js";
import { buildMarketingLeadsReport } from "./marketing-leads-report.model.js";
import { MARKETING_LEADS_REPORT_LEGACY_READER, type MarketingLeadsReportLegacyReader } from "./marketing-leads-report.port.js";
import { MarketingLeadsReportRepository } from "./marketing-leads-report.repository.js";

/** Enforces the report's independent permission before either source is touched. */
@Injectable()
export class MarketingLeadsReportService {
    /** Reuses the stable read-only snapshot and organizational seller-scope implementation. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(MarketingHomeRepository) private readonly snapshot: MarketingHomeRepository,
        @Inject(MarketingLeadsReportRepository) private readonly repository: MarketingLeadsReportRepository,
        @Inject(MARKETING_LEADS_REPORT_LEGACY_READER) private readonly legacy: MarketingLeadsReportLegacyReader,
    ) {}
    /** Aggregate cohorts/catalogs only; no customer or seller contact data is serialized. */
    async report(session: string | undefined, query: unknown): Promise<MarketingLeadsReport> {
        const profile = await this.identity.getCurrentUser(session);
        const grants = profile.permissions.filter((permission) => permission.code === "mercadeo.leads.read");
        if (!grants.some((permission) => permission.effect === "allow") || grants.some((permission) => permission.effect === "deny")) throw new ForbiddenException("Permiso insuficiente para Captacion de leads.");
        const scopes = grants.filter((permission) => permission.effect === "allow").map((permission) => permission.scope);
        if (!scopes.every((scope) => ["self", "assigned", "own_area", "own_area_and_children", "all_areas"].includes(scope))) throw new ForbiddenException("Alcance de Mercadeo no reconocido.");
        const parsed = marketingLeadsReportQuery.safeParse(query);
        if (!parsed.success) throw new BadRequestException("Periodo de Captacion de leads invalido.");
        const now = new Date();
        try {
            return await this.snapshot.readSnapshot(async (tx) => {
                const sellerScope = scopes.includes("all_areas") ? undefined : await this.snapshot.visibleSellers(tx, profile, scopes);
                const native = await this.repository.readNative(tx);
                const enabled = this.legacy.enabled();
                const legacy: ReportSource = enabled ? await this.legacy.read(tx) : { leads: [], events: [], users: [], projects: [], campaigns: [], userAliases: [], projectAliases: [], campaignAliases: [], leadAliases: [] };
                return buildMarketingLeadsReport(native, legacy, { period: parsed.data.period, now, legacyEnabled: enabled, ...(sellerScope ? { sellerScope } : {}) });
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar la captacion de leads.");
        }
    }
}
