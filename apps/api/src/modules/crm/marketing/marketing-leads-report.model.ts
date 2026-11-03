import { z } from "zod";

import { createMarketingWindow } from "./marketing-home.contract.js";
import type { MarketingLeadsReport, ReportCatalogItem, ReportEvent, ReportLead, ReportPeriod, ReportQualification, ReportRow, ReportSource } from "./marketing-leads-report.contract.js";
import { reportIdentityResolvers, uniqueReportIdentities } from "./marketing-leads-report.identities.js";

interface ReportContext {
    period: ReportPeriod;
    qualification?: ReportQualification;
    now: Date;
    legacyEnabled: boolean;
    sellerScope?: ReadonlySet<string>;
}
interface Cohort {
    row: ReportLead;
    native: boolean;
    events: ReportEvent[];
    ambiguous: boolean;
}
const providerKey = (id: string) => JSON.stringify(["netsuite", id]);
const reportDate = z.iso.date();
const normalizedLead = (row: ReportLead): ReportLead => ({ ...row, date: reportDate.safeParse(row.date).success ? row.date : null });
const selected = (date: string, range: { start: string; end: string }) => date >= range.start && date <= range.end;
const ordered = <T extends ReportCatalogItem>(items: Map<string, T>) => [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
const adName = (value: string | null) => (value?.trim() && !["undefined", "null", "none"].includes(value.trim().toLowerCase()) ? value.trim() : "Sin anuncio registrado");

function eventIndex(events: ReportEvent[]): Map<string, ReportEvent[]> {
    const result = new Map<string, ReportEvent[]>();
    for (const event of events) {
        const values = result.get(event.leadId) ?? [];
        if (!values.some((value) => value.id === event.id)) values.push(event);
        result.set(event.leadId, values);
    }
    return result;
}
function reportCohorts(native: ReportSource, legacy: ReportSource) {
    const nativeEvents = eventIndex(native.events);
    const oldEvents = eventIndex(legacy.events);
    const nativeCohort = (row: ReportLead): Cohort => ({ row, native: true, events: nativeEvents.get(row.id) ?? [], ambiguous: false });
    const cohorts = new Map<string, Cohort>(native.leads.map((row) => [row.id, nativeCohort(normalizedLead(row))]));
    const aliases = uniqueReportIdentities(native.leadAliases);
    const providerCounts = providerReferenceCounts(legacy.leads);
    const duplicates: { original: ReportLead; authoritative: Cohort }[] = [];
    const oldCohorts: Cohort[] = [];
    for (const original of legacy.leads) {
        const row = normalizedLead(original);
        const reference = row.providerId ?? "";
        const unique = uniqueProviderReference(reference, providerCounts);
        const id = unique ? aliases.get(providerKey(reference)) : null;
        const authoritative = cohorts.get(id ?? "");
        if (authoritative) {
            mergeCommercialEvidence(authoritative.row, row);
            authoritative.events.push(...leadEvents(row, true, oldEvents));
            duplicates.push({ original: row, authoritative });
        } else {
            oldCohorts.push(legacyCohort(row, unique, aliases.get(providerKey(reference)) === null, oldEvents));
        }
    }
    return { cohorts: [...cohorts.values(), ...oldCohorts], duplicates };
}
function mergeCommercialEvidence(target: ReportLead, evidence: ReportLead): void {
    target.hasEstimate = target.hasEstimate === true || evidence.hasEstimate === true;
    target.hasSalesOrder = target.hasSalesOrder === true || evidence.hasSalesOrder === true;
}
function legacyCohort(row: ReportLead, unique: boolean, ambiguousAlias: boolean, events: Map<string, ReportEvent[]>): Cohort {
    const eligible = unique && !ambiguousAlias;
    return { row: { ...row, hasEstimate: eligible && row.hasEstimate === true, hasSalesOrder: eligible && row.hasSalesOrder === true }, native: false, events: leadEvents(row, eligible, events), ambiguous: !unique || ambiguousAlias };
}
/** Exact legacy PK links are independent of ambiguous provider references. */
function leadEvents(row: ReportLead, unique: boolean, events: Map<string, ReportEvent[]>): ReportEvent[] {
    return [...referencedEvents(row.providerId ?? "", unique, events), ...(events.get(`legacy-pk:${row.id}`) ?? [])];
}
function referencedEvents(reference: string, unique: boolean, events: Map<string, ReportEvent[]>): ReportEvent[] {
    return unique ? (events.get(reference) ?? []) : [];
}
function providerReferenceCounts(rows: ReportLead[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) if (row.providerId) counts.set(row.providerId, (counts.get(row.providerId) ?? 0) + 1);
    return counts;
}
function uniqueProviderReference(reference: string, counts: Map<string, number>): boolean {
    return reference !== "" && reference !== "0" && counts.get(reference) === 1;
}
function cohortStatus(events: ReportEvent[]): "completed" | "scheduled" | "noAppointment" {
    if (events.some((event) => event.status === "completed")) return "completed";
    return events.some((event) => event.status === "scheduled") ? "scheduled" : "noAppointment";
}

/** Manual native authority is retained; only uniquely linked commercial evidence is merged. */
function effectiveQualified(cohort: Cohort): boolean {
    return cohort.row.qualified === true || cohortStatus(cohort.events.filter((event) => !event.invalidDate)) !== "noAppointment" || cohort.row.hasEstimate === true || cohort.row.hasSalesOrder === true;
}

/** Per-created-lead cohorts: completed > scheduled > none; attribution always comes from the authoritative lead. */
export function buildMarketingLeadsReport(native: ReportSource, legacy: ReportSource, context: ReportContext): MarketingLeadsReport {
    const window = createMarketingWindow(context.period === "all" ? "month" : context.period, context.now);
    const identities = reportIdentityResolvers(native, legacy);
    const evidence = reportCohorts(native, legacy);
    const visible = (cohort: Cohort) => context.sellerScope === undefined || context.sellerScope.has(identities.seller(cohort.row, cohort.native).id);
    const visibleCohorts = evidence.cohorts.filter(visible);
    const qualification = context.qualification ?? "all";
    const matches = (cohort: Cohort) => qualification === "all" || effectiveQualified(cohort) === (qualification === "qualified");
    const cohorts = visibleCohorts.filter(matches);
    const dates = visibleCohorts
        .map(({ row }) => row.date)
        .filter((date): date is string => date !== null && date <= window.today)
        .sort();
    const coverage = { start: dates[0] ?? window.today, end: window.today };
    const range = context.period === "all" ? coverage : window.selected;
    const result: MarketingLeadsReport = {
        schemaVersion: 1,
        observedAt: context.now.toISOString(),
        today: window.today,
        timeZone: "America/Costa_Rica",
        period: context.period,
        qualification,
        range,
        coverage,
        rows: [],
        sellers: [],
        projects: [],
        campaigns: [],
        ads: [],
        sources: { native: 0, legacy: 0, duplicatesExcluded: evidence.duplicates.filter(({ original, authoritative }) => visible(authoritative) && matches(authoritative) && original.date !== null && original.date <= window.today && (context.period === "all" || selected(original.date, range))).length, legacyEnabled: context.legacyEnabled },
        quality: { unresolvedSellers: 0, unresolvedCampaigns: 0, ambiguousLeadReferences: 0, unclassifiedAppointments: 0, invalidDates: cohorts.filter(({ row }) => row.date === null).length },
    };
    const catalogs = { sellers: new Map<string, MarketingLeadsReport["sellers"][number]>(), projects: new Map<string, ReportCatalogItem>(), campaigns: new Map<string, ReportCatalogItem>(), ads: new Map<string, ReportCatalogItem>() };
    const grouped = new Map<string, ReportRow>();
    for (const cohort of cohorts) {
        if (cohort.row.date === null || !selected(cohort.row.date, range)) continue;
        appendCohort(cohort, identities, { result, catalogs, grouped });
    }
    result.rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
    result.sellers = ordered(catalogs.sellers);
    result.projects = ordered(catalogs.projects);
    result.campaigns = ordered(catalogs.campaigns);
    result.ads = ordered(catalogs.ads);
    return result;
}
function appendCohort(cohort: Cohort, identities: ReturnType<typeof reportIdentityResolvers>, state: { result: MarketingLeadsReport; catalogs: { sellers: Map<string, MarketingLeadsReport["sellers"][number]>; projects: Map<string, ReportCatalogItem>; campaigns: Map<string, ReportCatalogItem>; ads: Map<string, ReportCatalogItem> }; grouped: Map<string, ReportRow> }) {
    const { row, native, events } = cohort;
    const { result, catalogs, grouped } = state;
    const seller = identities.seller(row, native);
    const project = identities.catalog(row, native, "project").item;
    const campaign = identities.catalog(row, native, "campaign");
    const name = adName(row.ad);
    const ad = { id: JSON.stringify([native ? "native" : "legacy", "ad", campaign.item.id, name]), name };
    catalogs.sellers.set(seller.id, seller);
    catalogs.projects.set(project.id, project);
    catalogs.campaigns.set(campaign.item.id, campaign.item);
    catalogs.ads.set(ad.id, ad);
    const key = JSON.stringify([row.date, seller.id, project.id, campaign.item.id, ad.id]);
    const aggregate = grouped.get(key) ?? { date: row.date as string, sellerId: seller.id, projectId: project.id, campaignId: campaign.item.id, adId: ad.id, leads: 0, noAppointment: 0, scheduled: 0, completed: 0, lost: 0, lossReasons: [] };
    const valid = events.filter((event) => !event.invalidDate);
    const status = cohortStatus(valid);
    aggregate.leads++;
    aggregate[status]++;
    aggregate.lost += Number(row.lost);
    // La misma autoridad y deduplicación del lead gobierna sus motivos; nunca se suma otra vez por existir en ambas BDs.
    if (row.lost) {
        const reason = row.lossReason ?? { code: "unrecorded", name: "Sin motivo registrado" };
        const existing = aggregate.lossReasons.find((item) => item.code === reason.code);
        if (existing) existing.count++;
        else aggregate.lossReasons.push({ ...reason, count: 1 });
    }
    grouped.set(key, aggregate);
    result.sources[native ? "native" : "legacy"]++;
    result.quality.unresolvedSellers += Number(seller.publicId === null);
    result.quality.unresolvedCampaigns += Number(campaign.unresolved);
    result.quality.ambiguousLeadReferences += Number(cohort.ambiguous);
    result.quality.unclassifiedAppointments += valid.filter((event) => event.status === "unknown").length;
    result.quality.invalidDates += events.filter((event) => event.invalidDate).length;
}
