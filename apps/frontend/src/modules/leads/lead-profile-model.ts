import type { LeadProfileEvent, LeadProfileField, LeadProfileOrder, LeadProfileResult } from "../../services/leads/lead-profile-service";

export const ORIGIN_LABEL = { native: "Nuevo", legacy: "Anterior" } as const;

export type ProfileTab = "log" | "events" | "opportunities" | "estimates" | "info" | "orders" | "files";
/** Same sections the client file has always had, in the same order. */
export const PROFILE_TABS: readonly { readonly id: ProfileTab; readonly label: string }[] = [
    { id: "log", label: "Bitácora de seguimiento" },
    { id: "events", label: "Lista de eventos" },
    { id: "opportunities", label: "Oportunidades" },
    { id: "estimates", label: "Estimaciones" },
    { id: "info", label: "Información completa" },
    { id: "orders", label: "Órdenes de venta" },
    { id: "files", label: "OneDrive" },
];
export const isProfileTab = (value: string | null): value is ProfileTab => PROFILE_TABS.some((tab) => tab.id === value);

type Section = LeadProfileResult["sections"][number];
export const fieldValue = (sections: readonly Section[], code: string): string | null => {
    const value = sections.flatMap((section) => section.fields).find((field) => field.code === code)?.value ?? null;
    return isBlank(value) ? null : value;
};

/** The legacy system fills empty values with "--" or "Sin dato"; both mean there is nothing to show. */
export const isBlank = (value: string | null | undefined): boolean => !value || ["--", "Sin dato", "N/A"].includes(value.trim());
export const filledFields = (fields: readonly LeadProfileField[]) => fields.filter((field) => !isBlank(field.value));

export interface InfoBlock {
    readonly id: string;
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly fields: readonly LeadProfileField[];
}
const BLOCKS: readonly { readonly id: string; readonly eyebrow: string; readonly title: string; readonly description: string; readonly codes: readonly string[] }[] = [
    {
        id: "base",
        eyebrow: "Resumen principal",
        title: "Información base del lead",
        description: "Datos generales del registro, campaña, contacto y trazabilidad comercial del cliente.",
        codes: ["fullName", "project", "campaign", "ad", "email", "phone", "subsidiary", "followUp", "comment"],
    },
    {
        id: "context",
        eyebrow: "Contexto comercial",
        title: "Información complementaria",
        description: "Perfil ampliado del comprador, datos adicionales y contexto cualitativo útil para operación y análisis posterior.",
        codes: ["identification", "nationality", "maritalStatus", "age", "profession", "children", "alternatePhone", "address", "residenceZone", "broker", "income", "purchaseReason", "purchaseTiming", "employment", "fundsOrigin", "buyerProfile", "additionalInformation", "relatedName", "relatedIdentification", "relatedProfession", "relatedMaritalStatus", "relatedPhone", "relatedNationality", "relatedEmail", "relatedResidence"],
    },
    {
        id: "trace",
        eyebrow: "Trazabilidad",
        title: "Estado y seguimiento del registro",
        description: "Estado operativo, responsable, fechas y acciones registradas sobre este cliente.",
        codes: ["status", "stage", "owner", "company", "currency", "createdAt", "updatedAt", "acquisitionSource", "interest", "followUpValue", "followUpReason", "contribution", "templateSent", "relatedLead", "action", "actionAt", "calendarFollowUp", "countryCode"],
    },
];
/** The extra person's fields share names with the client's, so they carry their own label once everything sits in one view. */
const LABEL: Readonly<Record<string, string>> = {
    relatedName: "Nombre de la persona adicional",
    relatedIdentification: "Identificación adicional",
    relatedProfession: "Profesión adicional",
    relatedMaritalStatus: "Estado civil adicional",
    relatedPhone: "Teléfono adicional",
    relatedNationality: "Nacionalidad adicional",
    relatedEmail: "Correo adicional",
    relatedResidence: "Residencia adicional",
    employment: "Lugar de trabajo",
    fundsOrigin: "Origen de fondos",
};
/**
 * Regroups the API sections into the consolidated view: base summary, complementary context and traceability.
 * A field the view does not know yet goes to the last block, so nothing the API sends is ever left out.
 */
export function infoBlocks(sections: readonly Section[]): InfoBlock[] {
    const byCode = new Map(sections.flatMap((section) => section.fields).map((field) => [field.code, field] as const));
    const used = new Set<string>();
    const blocks = BLOCKS.map((block) => ({
        ...block,
        fields: block.codes.flatMap((code) => {
            const field = byCode.get(code);
            if (!field) return [];
            used.add(code);
            return [{ ...field, label: LABEL[code] ?? field.label }];
        }),
    }));
    const rest = [...byCode.values()].filter((field) => !used.has(field.code));
    return blocks.map((block, index) => (index === blocks.length - 1 ? { ...block, fields: [...block.fields, ...rest] } : block)).filter((block) => block.fields.length > 0);
}

/**
 *
 */
export function initials(name: string): string {
    return name
        .split(/\s+/u)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase();
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const STAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/u;
/** Legacy dates keep their original wall time, so the text is reformatted and never converted between zones. */
export function formatStamp(value: string | null): string {
    const match = STAMP.exec(value ?? "");
    if (!match) return value ?? "Sin fecha";
    const [year, month, day, hour, minute] = match.slice(1);
    const date = `${String(Number(day))} ${MONTHS[Number(month) - 1] ?? String(month)} ${String(year)}`;
    return hour ? `${date} · ${hour}:${String(minute)}` : date;
}
/**
 *
 */
/** The date and the hour of a stamp apart, for cards that show them in two lines. */
export function stampParts(value: string | null): { readonly date: string; readonly time: string | null } {
    const [date = "", time] = formatStamp(value).split(" · ");
    return { date, time: time ?? null };
}
/**
 *
 */
export function formatAmount(amount: string | null): string {
    const number = Number(amount);
    if (!amount || !Number.isFinite(number)) return amount ?? "—";
    return new Intl.NumberFormat("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

export type HistoryEntry = LeadProfileResult["history"]["items"][number];
export type HistoryKind = "opportunity" | "estimate" | "reservation" | "lead" | "other";
export const HISTORY_KINDS: readonly { readonly id: HistoryKind; readonly label: string }[] = [
    { id: "opportunity", label: "Oportunidades" },
    { id: "estimate", label: "Estimaciones" },
    { id: "reservation", label: "Reservas" },
    { id: "lead", label: "Lead" },
    { id: "other", label: "Otros" },
];
const KIND_PATTERNS: readonly (readonly [HistoryKind, RegExp])[] = [
    ["opportunity", /oportu/u],
    ["estimate", /estimaci/u],
    ["reservation", /reserva/u],
    ["lead", /\blead\b/u],
];
const fold = (text: string) =>
    text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
/** Grouping by wording: the API does not send a record type yet, so the title decides and anything else is "Otros". */
export function historyKind(entry: HistoryEntry): HistoryKind {
    const text = fold(entry.action);
    return KIND_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}
export const historyDate = (entry: HistoryEntry): string | null => entry.sourceDate ?? entry.occurredAt ?? entry.recordedAt;
/**
 *
 */
export function matchesHistory(entry: HistoryEntry, query: string): boolean {
    const needle = fold(query.trim());
    return !needle || fold([entry.action, entry.detail ?? "", entry.actorName ?? ""].join(" ")).includes(needle);
}
export const historyOfKind = (history: LeadProfileResult["history"], kind: HistoryKind): HistoryEntry[] => history.items.filter((entry) => historyKind(entry) === kind);

export type OrderFilter = "all" | "native" | "legacy";
/**
 *
 */
export function profileOrders(orders: LeadProfileResult["orders"], filter: OrderFilter): LeadProfileOrder[] {
    const sources = filter === "all" ? (["native", "legacy"] as const) : ([filter] as const);
    return sources.flatMap((source) => [...orders[source].items]);
}

/** Opens the order in the orders view, which restores it from these two parameters. */
export const orderHref = (order: LeadProfileOrder): string => `/home/formalization/orders?${new URLSearchParams({ orderSource: order.source, orderId: order.id.replace(/^legacy:/u, "") }).toString()}`;
/** The orders read sends the ERP's status as a bare code; without its catalogue the code is shown as such instead of looking like a name. */
export function orderStatus(status: string | null): string | null {
    if (!status) return null;
    return /^\d+$/u.test(status) ? `Código ${status}` : status;
}

export type LabelTone = "ok" | "warn" | "danger" | "info" | "neutral";
const TONES: readonly (readonly [LabelTone, RegExp])[] = [
    ["danger", /perdid|cancel|rechaz|desist|descart/u],
    ["warn", /menos probable|inactiv|pendiente|espera|explorator|seguimiento/u],
    ["ok", /mas probable|contrato|firmad|ganad|cerrad|activ[oa]\b|aprobad|complet|realizad|atendid/u],
    ["info", /reserva|oportunidad|estimaci|cotiz|visita|cita|nuevo|programad|agendad/u],
];
/** Soft colour by meaning: lost or cancelled reads red, inactive or pending amber, contract or active green, reservation or opportunity blue. */
export function labelTone(label: string): LabelTone {
    const text = fold(label);
    return TONES.find(([, pattern]) => pattern.test(text))?.[0] ?? "neutral";
}

/** The newest linked order, the one a new event is scheduled against. */
export function latestOrder(orders: LeadProfileResult["orders"]): LeadProfileOrder | null {
    const all = profileOrders(orders, "all");
    return [...all].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0] ?? null;
}

/** Events of both databases in one list, newest first. */
export function profileEvents(events: NonNullable<LeadProfileResult["events"]>, filter: OrderFilter): LeadProfileEvent[] {
    const sources = filter === "all" ? (["native", "legacy"] as const) : ([filter] as const);
    const stamp = (event: LeadProfileEvent) => `${event.date ?? ""} ${event.startTime ?? ""}`;
    return sources.flatMap((source) => [...events[source].items]).sort((a, b) => stamp(b).localeCompare(stamp(a)));
}
