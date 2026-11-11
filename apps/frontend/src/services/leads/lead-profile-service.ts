import { ApiClientError, apiRequest } from "../api/api-client";
import type { ClientHistoryPage } from "../formalization/database-order-service";

export const LEAD_PROFILE_PERMISSION = "lead.profile.read";
export const LEAD_PROFILE_PATH = "/home/formalization/perfil";
export interface LeadIdentity {
    readonly source: "native" | "legacy";
    readonly id: string;
}
type Permission = { readonly code: string; readonly effect: string };
/** Capacidad global efectiva; Owner y los grants no evitan un deny. */
export const canReadLeadProfile = (permissions: readonly Permission[] = []): boolean => permissions.some((entry) => entry.code === LEAD_PROFILE_PERMISSION && entry.effect === "allow") && !permissions.some((entry) => entry.code === LEAD_PROFILE_PERMISSION && entry.effect === "deny");
export const leadProfilePath = (identity: LeadIdentity): string => `${LEAD_PROFILE_PATH}?${new URLSearchParams({ source: identity.source, id: identity.id })}`;
export interface LeadProfileField {
    readonly code: string;
    readonly label: string;
    readonly value: string | null;
    readonly source: "native" | "legacy" | null;
    readonly legacyValue: string | null;
}
export interface LeadProfileOrder {
    readonly id: string;
    readonly source: "native" | "legacy";
    readonly number: string | null;
    readonly status: string | null;
    readonly date: string | null;
    readonly currency: string | null;
    readonly amount: string | null;
}
export interface LeadProfileEvent {
    readonly id: string;
    readonly source: "native" | "legacy";
    readonly title: string | null;
    readonly type: string | null;
    readonly status: string | null;
    readonly date: string | null;
    readonly startTime: string | null;
    readonly endTime: string | null;
}
export interface LeadProfileEventPage {
    readonly items: readonly LeadProfileEvent[];
    readonly hasMore: boolean;
    readonly page: number;
}
export interface LeadProfileCommercialPage {
    readonly items: readonly { readonly id: string; readonly source: "native" | "legacy"; readonly fields: readonly { readonly code: string; readonly label: string; readonly value: string | null }[] }[];
    readonly total: number;
    readonly page: number;
    readonly hasMore: boolean;
    readonly available: boolean;
}
export interface LeadProfileResult extends LeadIdentity {
    readonly events?: Readonly<Record<"native" | "legacy", LeadProfileEventPage>>;
    readonly opportunities?: LeadProfileCommercialPage;
    readonly estimates?: LeadProfileCommercialPage;
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly sources: readonly ("native" | "legacy")[];
    readonly sections: readonly { readonly title: string; readonly fields: readonly LeadProfileField[] }[];
    readonly history: ClientHistoryPage;
    readonly orders: Readonly<Record<"native" | "legacy", { readonly items: readonly LeadProfileOrder[]; readonly hasMore: boolean; readonly page: number }>>;
}

/** Validación de la URL separada de permisos: un parámetro inválido nunca dispara una lectura. */
export function readLeadIdentity(search: string): LeadIdentity | null {
    const params = new URLSearchParams(search);
    const source = params.get("source");
    const id = params.get("id");
    if (params.getAll("source").length !== 1 || params.getAll("id").length !== 1 || !id) return null;
    if (source === "legacy" && /^[1-9][0-9]{0,19}$/u.test(id)) return { source, id };
    if (source === "native" && /^[0-9A-HJKMNP-TV-Z]{26}$/u.test(id)) return { source, id };
    return null;
}

/** El cliente BFF conserva cookies y recuperación de sesión; ningún secreto forma parte de la URL. */
export async function getLeadProfile(identity: LeadIdentity, cursor?: string, orderPage = 1): Promise<LeadProfileResult> {
    const params = new URLSearchParams({ ...identity, orderPage: String(orderPage), ...(cursor ? { cursor } : {}) });
    const result = await apiRequest<LeadProfileResult | null>(`/leads/profile?${params}`);
    // Un proxy mal configurado puede responder HTML con 200; no dejar el perfil en carga infinita.
    if (!result) throw new ApiClientError("La API no devolvió los datos del perfil.", 502, null);
    return result;
}
