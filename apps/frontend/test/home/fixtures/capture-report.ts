import type { CaptureFilters, CaptureRow, CaptureSeller, CaptureValues } from "../../../src/modules/marketing/lead-capture-report";
interface Named {
    readonly id: string;
    readonly name: string;
}
export const CAPTURE_SELLERS: readonly CaptureSeller[] = [
    { id: "ana", name: "Ana Solís", publicId: "01M5NC1CME889R260NYS7ASM7C" },
    { id: "carlos", name: "Carlos Vega", publicId: "01M5NC1DC90QQK5GG5ETJYC3YT" },
    { id: "diana", name: "Diana Mora", publicId: "01M5NC1JMG4HW718TWNZYXP715" },
];
export const CAPTURE_PROJECTS: readonly Named[] = [
    { id: "horizonte", name: "Proyecto Horizonte" },
    { id: "roble", name: "Proyecto Roble" },
    { id: "vista", name: "Proyecto Vista" },
];
const CAMPAIGN_NAMES = ["Lanzamiento", "Visitas de fin de semana"] as const;
const AD_NAMES = ["Recorrido en video", "Carrusel de espacios"] as const;

/** Which projects each seller attends: the banners of a seller show exactly these. */
const ASSIGNMENTS: Readonly<Record<string, readonly string[]>> = { ana: ["horizonte", "roble"], carlos: ["roble", "vista"], diana: ["horizonte", "roble", "vista"] };

export const CAPTURE_FIRST_DAY = "2026-09-01";
export const CAPTURE_LAST_DAY = "2026-10-26";

const campaignId = (project: string, index: number): string => `${project}-c${String(index)}`;
const adId = (project: string, campaign: number, ad: number): string => `${project}-c${String(campaign)}-a${String(ad)}`;

/** Every campaign and ad of the sample, with its readable name, so ids can be turned back into labels. */
export const CAPTURE_CAMPAIGNS: readonly Named[] = CAPTURE_PROJECTS.flatMap((project) => CAMPAIGN_NAMES.map((name, index) => ({ id: campaignId(project.id, index), name })));
export const CAPTURE_ADS: readonly Named[] = CAPTURE_PROJECTS.flatMap((project) => CAMPAIGN_NAMES.flatMap((_, campaign) => AD_NAMES.map((name, ad) => ({ id: adId(project.id, campaign, ad), name }))));

const DAY_MS = 86_400_000;

/** Splits `leads` into the three appointment states and a lost count, from the same hash, so the parts always add up. */
function splitLeads(leads: number, hash: number): CaptureValues {
    const completed = (hash >>> 3) % (leads + 1);
    const scheduled = (hash >>> 5) % (leads - completed + 1);
    return { leads, completed, scheduled, noAppointment: leads - completed - scheduled, lost: (hash >>> 9) % (Math.ceil(leads / 2) + 1) };
}

function demoRows(): CaptureRow[] {
    const start = new Date(`${CAPTURE_FIRST_DAY}T12:00:00Z`).getTime();
    const end = new Date(`${CAPTURE_LAST_DAY}T12:00:00Z`).getTime();
    const rows: CaptureRow[] = [];
    for (let time = start, day = 0; time <= end; time += DAY_MS, day += 1) {
        const date = new Date(time).toISOString().slice(0, 10);
        CAPTURE_SELLERS.forEach((seller, s) => {
            (ASSIGNMENTS[seller.id] ?? []).forEach((project, p) => {
                CAMPAIGN_NAMES.forEach((_, c) => {
                    AD_NAMES.forEach((__, a) => {
                        // A cheap integer hash gives uneven but repeatable counts; the seller/project offset makes some pairs consistently busier.
                        const hash = (Math.imul(day + 1, 2_654_435_761) ^ Math.imul(s * 131 + p * 31 + c * 17 + a * 7 + 1, 40_503)) >>> 0;
                        const leads = Math.max(0, (hash % 6) - ((s + p * 2 + c) % 3));
                        if (leads > 0) rows.push({ date, sellerId: seller.id, projectId: project, campaignId: campaignId(project, c), adId: adId(project, c, a), ...splitLeads(leads, hash) });
                    });
                });
            });
        });
    }
    return rows;
}

/** Fixed fictional sample: deterministic, so the screen and its tests always show the same figures. */
export const CAPTURE_DEMO_ROWS: readonly CaptureRow[] = demoRows();

export const defaultCaptureFilters = (): CaptureFilters => ({ from: "2026-10-01", to: CAPTURE_LAST_DAY, sellers: [] });

export const captureResponse = () => ({
    schemaVersion: 1 as const,
    observedAt: "2026-10-26T18:00:00.000Z",
    today: "2026-10-26",
    period: "month" as const,
    timeZone: "America/Costa_Rica" as const,
    range: { start: "2026-10-01", end: "2026-10-26" },
    coverage: { start: CAPTURE_FIRST_DAY, end: CAPTURE_LAST_DAY },
    rows: CAPTURE_DEMO_ROWS.filter((row) => row.date >= "2026-10-01"),
    sellers: CAPTURE_SELLERS,
    projects: CAPTURE_PROJECTS,
    campaigns: CAPTURE_CAMPAIGNS,
    ads: CAPTURE_ADS,
    sources: { native: 0, legacy: CAPTURE_DEMO_ROWS.filter((row) => row.date >= "2026-10-01").reduce((sum, row) => sum + row.leads, 0), duplicatesExcluded: 0, legacyEnabled: true },
    quality: { unresolvedSellers: 0, unresolvedCampaigns: 0, ambiguousLeadReferences: 0, unclassifiedAppointments: 0, invalidDates: 0 },
});
export const captureCatalogs = { sellers: CAPTURE_SELLERS, projects: CAPTURE_PROJECTS, campaigns: CAPTURE_CAMPAIGNS, ads: CAPTURE_ADS };
export const captureUser = { publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active" as const, permissionVersion: 1 };
