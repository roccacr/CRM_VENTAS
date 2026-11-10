import { buildMarketingAppointments } from "./marketing-appointments.model.js";
import { inMarketingRange, type LegacyMarketingData, marketingCount, type MarketingDailyRow, type MarketingEntity, type MarketingHomeSummary, type MarketingWindow, type NativeMarketingData } from "./marketing-home.contract.js";

/** Una clave repetida queda sin resolver. La última fila no gana la identidad. */
function uniqueIds<T>(rows: readonly T[], key: (row: T) => string, id: (row: T) => string) {
    const result = new Map<string, string | null>();
    for (const row of rows) {
        const value = key(row);
        if (!value) continue;
        result.set(value, result.has(value) && result.get(value) !== id(row) ? null : id(row));
    }
    return result;
}
const normalizedEmail = (value: string) => value.trim().toLowerCase();
const aliasKey = (system: string, externalId: string) => JSON.stringify([system, externalId]);
const countIn = (rows: readonly { date: string; leads: number }[], range: { start: string; end: string }) => marketingCount(rows.filter((row) => inMarketingRange(row.date, range)).reduce((sum, row) => sum + row.leads, 0));

/**
 * La identidad nativa gana. El correo solo une cuando el alias configurado no resuelve a un usuario.
 * Un correo repetido entre usuarios nativos no elige a ninguno. El proyecto no se puentea por correo.
 */
function identityResolvers(native: NativeMarketingData, legacy: LegacyMarketingData) {
    const users = new Map(native.users.map((user) => [user.id, user]));
    const projects = new Map(native.projects.map((project) => [project.id, project]));
    const emails = uniqueIds(
        native.users,
        (user) => normalizedEmail(user.email),
        (user) => user.id,
    );
    const userAliases = uniqueIds(
        native.userAliases,
        (alias) => aliasKey(alias.system, alias.externalId),
        (alias) => alias.id,
    );
    const projectAliases = uniqueIds(
        native.projectAliases,
        (alias) => aliasKey(alias.system, alias.externalId),
        (alias) => alias.id,
    );
    const owners = new Map(legacy.owners.map((owner) => [owner.reference, owner]));
    return {
        nativeSeller: (id: string): MarketingEntity => ({ id, publicId: users.has(id) ? id : null, name: users.get(id)?.name ?? "Sin vendedor asignado" }),
        nativeProject: (id: string): MarketingEntity => ({ id, publicId: projects.has(id) ? id : null, name: projects.get(id)?.name ?? "Sin proyecto asignado" }),
        legacySeller: (reference: string): MarketingEntity => {
            const owner = owners.get(reference);
            const configured = userAliases.get(aliasKey(legacy.provider, reference));
            const id = configured ?? (owner?.email ? emails.get(normalizedEmail(owner.email)) : null);
            const user = id ? users.get(id) : null;
            return user ? { id: user.id, publicId: user.id, name: user.name } : { id: `legacy-seller:${reference}`, publicId: null, name: owner?.name ?? "Sin vendedor vinculado" };
        },
        legacyProject: (reference: string, name: string | null): MarketingEntity => {
            const id = projectAliases.get(aliasKey(legacy.provider, reference));
            const project = id ? projects.get(id) : null;
            return project ? { id: project.id, publicId: project.id, name: project.name } : { id: `legacy-project:${reference}`, publicId: null, name: name ?? "Sin proyecto asignado" };
        },
    };
}

/** Un JSON de agregados. De aquí no salen registros de negocio, correos ni citas adivinadas. */
export function buildMarketingHome(native: NativeMarketingData, legacy: LegacyMarketingData, window: MarketingWindow, context: { observedAt: Date; legacyEnabled: boolean; sellerScope?: ReadonlySet<string> }): MarketingHomeSummary {
    const { observedAt, legacyEnabled, sellerScope } = context;
    const identities = identityResolvers(native, legacy);
    const visibleNative = native.rows.filter((row) => sellerScope === undefined || sellerScope.has(identities.nativeSeller(row.sellerId).id));
    const visibleLegacy = legacy.rows.filter((row) => sellerScope === undefined || sellerScope.has(identities.legacySeller(row.sellerReference).id));
    const sellers = new Map<string, MarketingEntity>();
    const projects = new Map<string, MarketingEntity>();
    const grouped = new Map<string, MarketingDailyRow>();
    const append = (date: string, leads: number, seller: MarketingEntity, project: MarketingEntity) => {
        if (leads === 0) return;
        sellers.set(seller.id, seller);
        projects.set(project.id, project);
        const key = JSON.stringify([date, seller.id, project.id]);
        const previous = grouped.get(key)?.leads ?? 0;
        grouped.set(key, { date, sellerId: seller.id, projectId: project.id, leads: marketingCount(previous + leads) });
    };
    for (const row of visibleNative) append(row.date, row.leads, identities.nativeSeller(row.sellerId), identities.nativeProject(row.projectId));
    for (const row of visibleLegacy) append(row.date, row.leads, identities.legacySeller(row.sellerReference), identities.legacyProject(row.projectReference, row.projectName));
    const rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sellerId.localeCompare(b.sellerId) || a.projectId.localeCompare(b.projectId));
    const selectedLegacy = visibleLegacy.filter((row) => inMarketingRange(row.date, window.selected));
    const appointments = buildMarketingAppointments({ native: native.appointmentEvidence, legacy: legacy.appointmentEvidence ?? (!legacyEnabled ? { cohorts: [], events: [], invalidDates: 0 } : undefined), provider: legacy.provider }, identities, { window, ...(sellerScope ? { sellerScope } : {}) });
    for (const seller of appointments.sellers) sellers.set(seller.id, seller);
    for (const project of appointments.projects) projects.set(project.id, project);
    const ordered = (values: Map<string, MarketingEntity>) => [...values.values()].sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
    return {
        schemaVersion: 1,
        observedAt: observedAt.toISOString(),
        today: window.today,
        period: window.period,
        timeZone: "America/Costa_Rica",
        selected: window.selected,
        comparison: window.comparison,
        coverage: { start: window.from, end: window.to },
        rows,
        sellers: ordered(sellers),
        projects: ordered(projects),
        counts: { leads: countIn(rows, window.selected), previousLeads: countIn(rows, window.comparison) },
        appointments: appointments.data,
        sources: { native: countIn(visibleNative, window.selected), legacy: countIn(visibleLegacy, window.selected), legacyEnabled, duplicatesExcluded: marketingCount(selectedLegacy.reduce((sum, row) => sum + row.duplicates, 0)), ambiguousOverlaps: marketingCount(selectedLegacy.reduce((sum, row) => sum + row.ambiguous, 0)) },
    };
}
