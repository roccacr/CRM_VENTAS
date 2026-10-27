import type { LegacyMarketingOwner, MarketingExternalIdentity, NativeMarketingUser } from "./marketing-home.contract.js";
import type { ReportLead, ReportSource } from "./marketing-leads-report.contract.js";

/** Collisions remain unresolved; never let row order choose an identity. */
export function uniqueReportIdentities(rows: readonly MarketingExternalIdentity[]): Map<string, string | null> {
    const result = new Map<string, string | null>();
    for (const row of rows) {
        const key = JSON.stringify([row.system, row.externalId]);
        result.set(key, result.has(key) && result.get(key) !== row.id ? null : row.id);
    }
    return result;
}
const aliasKey = (id: string) => JSON.stringify(["netsuite", id]);
const scoped = (source: string, kind: string, id: string) => JSON.stringify([source, kind, id || "missing"]);
const normalizedEmail = (email: string) => email.trim().toLowerCase();

/** Seller email bridging is allowed only when no configured alias exists and both sides are unique. */
export function reportIdentityResolvers(native: ReportSource, legacy: ReportSource) {
    const project = catalogResolver(native, legacy, "project");
    const campaign = catalogResolver(native, legacy, "campaign");
    return { seller: sellerResolver(native, legacy), catalog: (row: ReportLead, isNative: boolean, kind: "project" | "campaign") => (kind === "project" ? project(row, isNative) : campaign(row, isNative)) };
}
function sellerResolver(native: ReportSource, legacy: ReportSource) {
    const users = new Map(native.users.map((user) => [user.id, user]));
    const owners = new Map((legacy.owners ?? []).map((owner) => [owner.reference, owner]));
    const emails = uniqueReportIdentities(native.users.map((user) => ({ id: user.id, system: "email", externalId: normalizedEmail(user.email) })));
    const ownerEmails = uniqueReportIdentities((legacy.owners ?? []).map((owner) => ({ id: owner.reference, system: "email", externalId: normalizedEmail(owner.email ?? "") })));
    const userAliases = uniqueReportIdentities(native.userAliases);
    return (row: ReportLead, isNative: boolean) => {
        const owner = owners.get(row.sellerId);
        const key = JSON.stringify(["email", normalizedEmail(owner?.email ?? "")]);
        const fallback = ownerEmails.get(key) === row.sellerId ? emails.get(key) : null;
        const bridged = userAliases.has(aliasKey(row.sellerId)) ? userAliases.get(aliasKey(row.sellerId)) : fallback;
        const id = isNative ? row.sellerId : bridged;
        const user = id ? users.get(id) : undefined;
        return sellerItem(user, owner, row.sellerId, isNative);
    };
}
function sellerItem(user: NativeMarketingUser | undefined, owner: LegacyMarketingOwner | undefined, id: string, isNative: boolean) {
    if (user) return { id: user.id, publicId: user.id, name: user.name };
    return { id: scoped(isNative ? "native" : "legacy", "seller", id), publicId: null, name: owner?.name ?? "Sin vendedor vinculado" };
}
function catalogResolver(native: ReportSource, legacy: ReportSource, kind: "project" | "campaign") {
    const aliases = uniqueReportIdentities(kind === "project" ? native.projectAliases : native.campaignAliases);
    const nativeCatalog = new Map((kind === "project" ? native.projects : native.campaigns).map((item) => [item.id, item]));
    const oldCatalog = new Map((kind === "project" ? legacy.projects : legacy.campaigns).map((item) => [item.id, item]));
    const missing = kind === "project" ? "Sin proyecto registrado" : "Sin campaña registrada";
    return (row: ReportLead, isNative: boolean) => {
        const reference = kind === "project" ? row.projectId : row.campaignId;
        const nativeId = isNative ? reference : aliases.get(aliasKey(reference));
        const item = nativeId ? nativeCatalog.get(nativeId) : undefined;
        if (item) return { item: { id: scoped("native", kind, item.id), name: item.name }, unresolved: false };
        const old = oldCatalog.get(reference);
        const caption = kind === "project" ? row.projectName : row.campaignName;
        return { item: { id: scoped(isNative ? "native" : "legacy", kind, reference), name: catalogCaption(old, caption, missing) }, unresolved: !old };
    };
}
function catalogCaption(item: { name: string | null } | undefined, caption: string | null | undefined, missing: string): string {
    return item?.name?.trim() || caption?.trim() || missing;
}
