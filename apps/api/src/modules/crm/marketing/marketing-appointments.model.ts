import type { AppointmentIdentityResolvers, LegacyAppointmentEvidence, LegacyAppointmentLead, MarketingAppointmentCohort, MarketingAppointmentEvent, MarketingAppointments, NativeAppointmentAlias, NativeAppointmentEvidence } from "./marketing-appointments.contract.js";
import type { MarketingEntity, MarketingWindow } from "./marketing-home.contract.js";

interface Sources {
    native: NativeAppointmentEvidence | undefined;
    legacy: LegacyAppointmentEvidence | undefined;
    provider: string;
}
interface Context {
    window: MarketingWindow;
    sellerScope?: ReadonlySet<string>;
}
interface ResolvedLead {
    key: string;
    seller: MarketingEntity;
    project: MarketingEntity;
}

/** Una referencia ambigua se queda sin lead nativo. La cita no se asigna a otro lead. */
function leadResolvers(sources: Sources, identities: AppointmentIdentityResolvers) {
    const aliases = new Map<string, NativeAppointmentAlias | null>();
    for (const alias of sources.native?.aliases ?? []) {
        const key = JSON.stringify([alias.system, alias.externalId]);
        aliases.set(key, aliases.has(key) && aliases.get(key)?.id !== alias.id ? null : alias);
    }
    const native = (row: { id: string; sellerId: string; projectId: string }): ResolvedLead => ({ key: `native:${row.id}`, seller: identities.nativeSeller(row.sellerId), project: identities.nativeProject(row.projectId) });
    const legacy = (row: LegacyAppointmentLead): ResolvedLead => {
        const alias = row.providerMatches === 1 ? aliases.get(JSON.stringify([sources.provider, row.providerId])) : null;
        return alias ? native(alias) : { key: `legacy:${row.id}`, seller: identities.legacySeller(row.sellerReference), project: identities.legacyProject(row.projectReference, row.projectName) };
    };
    return { native, legacy };
}

type EventRow = Pick<MarketingAppointmentEvent, "date" | "status" | "attendance"> & { eventId: string };

/** Las filas de origen se quedan adentro. La identidad del evento no es la conversión del lead captado. */
class AppointmentAccumulator {
    readonly sellers = new Map<string, MarketingEntity>();
    readonly projects = new Map<string, MarketingEntity>();
    readonly validLeads = new Set<string>();
    readonly cohorts = new Map<string, { lead: ResolvedLead; date: string }>();
    readonly events = new Map<string, MarketingAppointmentEvent>();
    readonly unresolved: Set<string>;
    constructor(
        private readonly context: Context,
        unresolved: readonly string[] = [],
    ) {
        this.unresolved = new Set(unresolved);
    }
    visible(lead: ResolvedLead): boolean {
        return this.context.sellerScope === undefined || this.context.sellerScope.has(lead.seller.id);
    }
    register(lead: ResolvedLead): void {
        this.sellers.set(lead.seller.id, lead.seller);
        this.projects.set(lead.project.id, lead.project);
    }
    cohort(lead: ResolvedLead, date: string): void {
        if (this.visible(lead)) this.cohorts.set(lead.key, { lead, date });
    }
    append(row: EventRow, lead: ResolvedLead, source: string): void {
        if (!this.visible(lead)) return;
        if (row.status === "scheduled" || row.status === "completed") this.validLeads.add(lead.key);
        if (row.date < this.context.window.from || row.date > this.context.window.to) return;
        this.register(lead);
        this.link(row, lead, `${source}:${row.eventId}`);
    }
    private link(row: EventRow, lead: ResolvedLead, id: string): void {
        const event = this.events.get(id) ?? { id, date: row.date, status: row.status, attendance: row.attendance, links: [] };
        if (event.date !== row.date || event.status !== row.status || event.attendance !== row.attendance) throw new Error("Inconsistent appointment identity");
        if (!event.links.some((link) => link.sellerId === lead.seller.id && link.projectId === lead.project.id)) event.links.push({ sellerId: lead.seller.id, projectId: lead.project.id });
        this.events.set(id, event);
    }
    conversions(): MarketingAppointmentCohort[] {
        const grouped = new Map<string, MarketingAppointmentCohort>();
        for (const [id, { lead, date }] of this.cohorts) {
            if (!this.validLeads.has(id)) continue;
            this.register(lead);
            const key = JSON.stringify([date, lead.seller.id, lead.project.id]);
            const previous = grouped.get(key)?.withAppointment ?? 0;
            grouped.set(key, { date, sellerId: lead.seller.id, projectId: lead.project.id, withAppointment: previous + 1 });
        }
        return [...grouped.values()];
    }
}

/**
 * Eventos y cohortes únicos. Lo nativo prevalece y el alcance es el del dueño del lead.
 * Si falta una de las dos evidencias, las citas quedan no disponibles. Una lectura con alcance no publica los contadores globales de vínculos sin resolver ni de fechas inválidas.
 */
export function buildMarketingAppointments(sources: Sources, identities: AppointmentIdentityResolvers, context: Context): { data: MarketingAppointments; sellers: MarketingEntity[]; projects: MarketingEntity[] } {
    if (!sources.native || !sources.legacy) return { data: { available: false }, sellers: [], projects: [] };
    const resolve = leadResolvers(sources, identities);
    const state = new AppointmentAccumulator(context, sources.legacy.unresolvedEventIds);
    for (const row of sources.native.cohorts) state.cohort(resolve.native(row), row.date);
    for (const row of sources.legacy.cohorts) {
        const lead = resolve.legacy(row);
        // La fecha de alta nativa manda. Un lead ya nativo no toma la fecha vieja, aunque esa caiga fuera de la cobertura.
        if (!lead.key.startsWith("native:")) state.cohort(lead, row.date);
    }
    for (const row of sources.native.events) state.append(row, resolve.native(row), "native");
    appendLegacyEvents(state, sources.legacy.events, resolve.legacy);
    return appointmentResult(state, sources.native, sources.legacy, context);
}
function appendLegacyEvents(state: AppointmentAccumulator, rows: LegacyAppointmentEvidence["events"], resolve: (row: LegacyAppointmentLead) => ResolvedLead): void {
    for (const row of rows) {
        if (row.providerMatches !== 1) {
            state.unresolved.add(row.eventId);
            continue;
        }
        state.append(row, resolve(row), "legacy");
    }
}
function appointmentResult(state: AppointmentAccumulator, native: NativeAppointmentEvidence, legacy: LegacyAppointmentEvidence, context: Context): { data: MarketingAppointments; sellers: MarketingEntity[]; projects: MarketingEntity[] } {
    const leadsWithAppointment = state.conversions();
    const events = [...state.events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    return { data: { available: true, events, leadsWithAppointment, quality: { unresolvedLinks: context.sellerScope === undefined ? state.unresolved.size : 0, invalidDates: context.sellerScope === undefined ? legacy.invalidDates : 0, unknownStatuses: events.filter((event) => event.status === "unknown").length, nativeTypeConfigured: native.typeCount > 0 } }, sellers: [...state.sellers.values()], projects: [...state.projects.values()] };
}
