import { z } from "zod";

import type { AppointmentState } from "./marketing-appointments.contract.js";
import type { LegacyMarketingOwner, MarketingDateRange, MarketingExternalIdentity, NativeMarketingProject, NativeMarketingUser } from "./marketing-home.contract.js";

export const marketingLeadsReportQuery = z.object({ period: z.enum(["day", "week", "month", "all"]).default("month") }).strict();
export type ReportPeriod = z.infer<typeof marketingLeadsReportQuery>["period"];
export interface ReportLead {
    id: string;
    date: string | null;
    sellerId: string;
    projectId: string;
    projectName?: string | null;
    campaignId: string;
    campaignName?: string | null;
    ad: string | null;
    lost: boolean;
    providerId?: string;
}
export interface ReportEvent {
    id: string;
    leadId: string;
    status: AppointmentState;
    invalidDate: boolean;
}
/** Internal read evidence, never serialized directly to clients. */
export interface ReportSource {
    leads: ReportLead[];
    events: ReportEvent[];
    users: NativeMarketingUser[];
    projects: NativeMarketingProject[];
    campaigns: NativeMarketingProject[];
    userAliases: MarketingExternalIdentity[];
    projectAliases: MarketingExternalIdentity[];
    campaignAliases: MarketingExternalIdentity[];
    leadAliases: MarketingExternalIdentity[];
    owners?: LegacyMarketingOwner[];
}
export interface ReportRow {
    date: string;
    sellerId: string;
    projectId: string;
    campaignId: string;
    adId: string;
    leads: number;
    noAppointment: number;
    scheduled: number;
    completed: number;
    lost: number;
}
export interface ReportCatalogItem {
    id: string;
    name: string;
}
export interface MarketingLeadsReport {
    schemaVersion: 1;
    observedAt: string;
    today: string;
    timeZone: "America/Costa_Rica";
    period: ReportPeriod;
    range: MarketingDateRange;
    coverage: MarketingDateRange;
    rows: ReportRow[];
    sellers: (ReportCatalogItem & { publicId: string | null })[];
    projects: ReportCatalogItem[];
    campaigns: ReportCatalogItem[];
    ads: ReportCatalogItem[];
    sources: { native: number; legacy: number; duplicatesExcluded: number; legacyEnabled: boolean };
    quality: { unresolvedSellers: number; unresolvedCampaigns: number; ambiguousLeadReferences: number; unclassifiedAppointments: number; invalidDates: number };
}
