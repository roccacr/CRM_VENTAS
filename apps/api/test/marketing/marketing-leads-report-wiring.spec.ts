import "reflect-metadata";

import { MODULE_METADATA, SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { REQUIRE_PERMISSION_METADATA } from "../../src/common/security/require-permission.decorator.js";
import { ROUTE_SECURITY_METADATA } from "../../src/common/security/route-security.decorator.js";
import { LegacyCrmModule } from "../../src/integrations/legacy-crm/legacy-crm.module.js";
import { LegacyMarketingLeadsReportReader } from "../../src/integrations/legacy-crm/legacy-marketing-leads-report.reader.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { MarketingHomeModule } from "../../src/modules/crm/marketing/marketing-home.module.js";
import { MarketingHomeRepository } from "../../src/modules/crm/marketing/marketing-home.repository.js";
import { MarketingLeadsReportController } from "../../src/modules/crm/marketing/marketing-leads-report.controller.js";
import { MARKETING_LEADS_REPORT_LEGACY_READER } from "../../src/modules/crm/marketing/marketing-leads-report.port.js";
import { MarketingLeadsReportRepository, readReportPages, REPORT_READ_PAGE_SIZE } from "../../src/modules/crm/marketing/marketing-leads-report.repository.js";
import { MarketingLeadsReportService } from "../../src/modules/crm/marketing/marketing-leads-report.service.js";

describe("capture API registration", () => {
    it("registers the independent protected route and optional legacy adapter", () => {
        expect(Reflect.getMetadata("path", MarketingLeadsReportController)).toBe("marketing/leads");
        const handler = Reflect.get(MarketingLeadsReportController.prototype, "report") as object;
        expect(Reflect.getMetadata("path", handler)).toBe("report");
        expect(Reflect.getMetadata(ROUTE_SECURITY_METADATA, handler)).toBe("permission");
        expect(Reflect.getMetadata(REQUIRE_PERMISSION_METADATA, handler)).toEqual({ kind: "all", codes: ["mercadeo.leads.read"] });
        expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, MarketingHomeModule)).toContain(MarketingLeadsReportController);
        expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, LegacyCrmModule)).toContain(MARKETING_LEADS_REPORT_LEGACY_READER);
        expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LegacyCrmModule)).toContainEqual({ provide: MARKETING_LEADS_REPORT_LEGACY_READER, useClass: LegacyMarketingLeadsReportReader });
    });
    it("resolves constructor dependencies using explicit injection under Vitest", async () => {
        const module = await Test.createTestingModule({
            controllers: [MarketingLeadsReportController],
            providers: [MarketingLeadsReportService, MarketingLeadsReportRepository, { provide: IdentityService, useValue: {} }, { provide: MarketingHomeRepository, useValue: {} }, { provide: MARKETING_LEADS_REPORT_LEGACY_READER, useValue: {} }],
        }).compile();
        expect(module.get(MarketingLeadsReportController)).toBeInstanceOf(MarketingLeadsReportController);
        expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, LegacyMarketingLeadsReportReader)).toHaveLength(1);
        await module.close();
    });
    it("consumes every page including data beyond the old evidence caps", async () => {
        const page = Array.from({ length: REPORT_READ_PAGE_SIZE }, (_, id) => id);
        const reader = vi.fn().mockImplementation((offset: number) => Promise.resolve(offset < REPORT_READ_PAGE_SIZE * 11 ? page : [99]));
        const result = await readReportPages(reader);
        expect(result).toHaveLength(REPORT_READ_PAGE_SIZE * 11 + 1);
        expect(reader).toHaveBeenLastCalledWith(REPORT_READ_PAGE_SIZE * 11);
    });
});
