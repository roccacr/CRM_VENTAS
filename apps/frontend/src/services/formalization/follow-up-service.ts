import { apiRequest } from "../api/api-client";

export const FINIQUITO_QUEUES = ["finiquito_validation", "finiquito_pending", "finiquito_signed", "finiquito_formalized"] as const;
export type FiniquitoQueue = (typeof FINIQUITO_QUEUES)[number];
export const FOLLOW_UP_QUEUES = ["all", "approvals", "addendum", "contracts", "send", "signature", "bank", "balance", "transfer", "signed", "closed", ...FINIQUITO_QUEUES] as const;
export type FollowUpQueue = (typeof FOLLOW_UP_QUEUES)[number];
export interface FollowUpFilters {
    readonly recordId?: string;
    readonly projectIds?: readonly string[];
    readonly queues?: readonly FollowUpQueue[];
    readonly bankStages?: readonly ("bank_management" | "bank_management_in_progress")[];
    readonly search: string;
    readonly projectId: string;
    readonly queue: FollowUpQueue;
    readonly page: number;
    readonly pageSize: number;
}
export interface FollowUpItem {
    readonly id: string;
    readonly source: "native" | "legacy";
    readonly number: string;
    readonly nativeCode: string | null;
    readonly client: string | null;
    readonly clientEmail?: string | null;
    readonly addendumStatus?: "pending" | "completed" | "cancelled" | "sent" | null;
    readonly project: { id: string; name: string } | null;
    readonly unit: string | null;
    readonly responsible: { id: string | null; name: string } | null;
    /** El vendedor y quien hizo el cambio son distintos de la persona asignada a la etapa registrada. */
    readonly seller?: { id: string | null; name: string } | null;
    readonly changedBy?: { id: string | null; name: string } | null;
    readonly state: { code: string; label: string; since: string | null; days: number | null };
    readonly salesManagementApproved?: boolean | null;
    readonly developerApproved?: boolean | null;
    readonly formalizationApproved?: boolean | null;
    readonly commercialClosureSigned?: boolean | null;
    readonly contractSignedCheck?: boolean | null;
    readonly saleLostCheck?: boolean | null;
    readonly approvalsComplete?: boolean;
    readonly saleLost?: boolean;
    readonly finiquitoInFlow?: boolean;
    readonly contractSigned?: boolean | undefined;
    readonly installmentsFullyPaid?: boolean | null | undefined;
    readonly unitTransferred?: boolean | null | undefined;
    readonly keysDelivered?: boolean | null | undefined;
    readonly unitDelivered?: boolean | null | undefined;
    readonly stateVersion?: number;
    readonly purchaseFundsOrigin?: "own_funds" | "bank_financing" | null;
    readonly nextStep: string;
    readonly completedThisYear: boolean;
}
export interface FollowUp {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly filters: Pick<FollowUpFilters, "search" | "projectId" | "queue" | "projectIds" | "queues" | "bankStages">;
    readonly page: { number: number; size: number; total: number; totalPages: number };
    readonly counts: Record<Exclude<FollowUpQueue, "addendum" | FiniquitoQueue>, number> & Partial<Record<FiniquitoQueue, number>> & { readonly addendum?: number; readonly bankInProgress?: number };
    readonly projects: { id: string; name: string }[];
    readonly items: FollowUpItem[];
    readonly sources: { native: { total: number }; legacy: { total: number; enabled: boolean } };
}
const invalid = () => new Error("Invalid formalization follow-up");
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== "string") throw invalid();
    return value;
}
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
function bool(value: unknown): boolean {
    if (typeof value !== "boolean") throw invalid();
    return value;
}
function date(value: unknown): string {
    const result = text(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw invalid();
    return result;
}
function queue(value: unknown): FollowUpQueue {
    const result = FOLLOW_UP_QUEUES.find((item) => item === value);
    if (!result) throw invalid();
    return result;
}
function project(value: unknown): { id: string; name: string } {
    const item = record(value);
    return { id: text(item.id), name: text(item.name) };
}
function array<T>(value: unknown, parse: (entry: unknown) => T): T[] {
    if (!Array.isArray(value)) throw invalid();
    return value.map(parse);
}
function nullable<T>(value: unknown, parse: (entry: unknown) => T): T | null {
    return value === null ? null : parse(value);
}
function responsible(value: unknown): NonNullable<FollowUpItem["responsible"]> {
    const data = record(value);
    return { id: nullable(data.id, text), name: text(data.name) };
}
/** Solo un destinatario válido. Rechaza inyección de encabezados y listas de direcciones. */
function clientEmail(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const email = value.trim();
    return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : null;
}
function item(value: unknown): FollowUpItem {
    const data = record(value);
    const state = record(data.state);
    if (data.source !== "native" && data.source !== "legacy") throw invalid();
    return {
        id: text(data.id),
        source: data.source,
        number: text(data.number),
        nativeCode: nullable(data.nativeCode, text),
        client: nullable(data.client, text),
        clientEmail: clientEmail(data.clientEmail),
        ...optionalAddendum(data.addendumStatus),
        project: nullable(data.project, project),
        unit: nullable(data.unit, text),
        responsible: nullable(data.responsible, responsible),
        ...(data.seller === undefined ? {} : { seller: nullable(data.seller, responsible) }),
        ...(data.changedBy === undefined ? {} : { changedBy: nullable(data.changedBy, responsible) }),
        ...optionalFunds(data.purchaseFundsOrigin),
        state: { code: text(state.code), label: text(state.label), since: nullable(state.since, date), days: nullable(state.days, count) },
        ...optionalSaleLost(data.saleLost),
        ...optionalBooleanField("finiquitoInFlow", data.finiquitoInFlow),
        ...optionalBooleanField("contractSigned", data.contractSigned),
        ...optionalCompletionFlag("salesManagementApproved", data.salesManagementApproved),
        ...optionalCompletionFlag("developerApproved", data.developerApproved),
        ...optionalCompletionFlag("formalizationApproved", data.formalizationApproved),
        ...optionalCompletionFlag("commercialClosureSigned", data.commercialClosureSigned),
        ...optionalCompletionFlag("contractSignedCheck", data.contractSignedCheck),
        ...optionalCompletionFlag("saleLostCheck", data.saleLostCheck),
        ...optionalCompletionFlag("installmentsFullyPaid", data.installmentsFullyPaid),
        ...optionalCompletionFlag("unitTransferred", data.unitTransferred),
        ...optionalCompletionFlag("keysDelivered", data.keysDelivered),
        ...optionalCompletionFlag("unitDelivered", data.unitDelivered),
        ...(data.approvalsComplete === undefined ? {} : { approvalsComplete: bool(data.approvalsComplete) }),
        ...(data.stateVersion === undefined ? {} : { stateVersion: count(data.stateVersion) }),
        nextStep: text(data.nextStep),
        completedThisYear: bool(data.completedThisYear),
    };
}
function optionalCompletionFlag(field: "installmentsFullyPaid" | "unitTransferred" | "keysDelivered" | "unitDelivered" | "salesManagementApproved" | "developerApproved" | "formalizationApproved" | "commercialClosureSigned" | "contractSignedCheck" | "saleLostCheck", value: unknown) {
    return value === undefined ? {} : { [field]: nullable(value, bool) };
}
function optionalBooleanField(field: "finiquitoInFlow" | "contractSigned", value: unknown) {
    return value === undefined ? {} : { [field]: bool(value) };
}
function optionalFunds(value: unknown) {
    return value === undefined ? {} : { purchaseFundsOrigin: fundsOrigin(value) };
}
function optionalAddendum(value: unknown): Pick<FollowUpItem, "addendumStatus"> {
    if (value === undefined) return {};
    if (![null, "pending", "completed", "cancelled", "sent"].includes(value as string | null)) throw invalid();
    return { addendumStatus: value as Exclude<FollowUpItem["addendumStatus"], undefined> };
}
function readCounts(counts: Record<string, unknown>, appliedQueue: unknown): FollowUp["counts"] {
    const parsed = {} as Record<Exclude<FollowUpQueue, "addendum" | FiniquitoQueue>, number> & Partial<Record<FiniquitoQueue, number>> & { addendum?: number };
    for (const key of FOLLOW_UP_QUEUES) {
        if ((key === "addendum" || FINIQUITO_QUEUES.includes(key as FiniquitoQueue)) && counts[key] === undefined && appliedQueue !== key) continue;
        parsed[key] = count(counts[key]);
    }
    return { ...parsed, ...(counts.bankInProgress === undefined ? {} : { bankInProgress: count(counts.bankInProgress) }) };
}
function fundsOrigin(value: unknown): "own_funds" | "bank_financing" | null {
    if (value !== null && value !== "own_funds" && value !== "bank_financing") throw invalid();
    return value;
}
function positive(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
    const result = count(value);
    if (result < 1 || result > maximum) throw invalid();
    return result;
}
/** Valida y reconstruye el contrato canónico. Deja fuera campos arbitrarios del proveedor o del contacto. */
export async function getFollowUp(filters: FollowUpFilters): Promise<FollowUp> {
    positive(filters.page);
    positive(filters.pageSize, 100);
    const params = new URLSearchParams({ search: text(filters.search), projectId: text(filters.projectId), queue: queue(filters.queue), page: String(filters.page), pageSize: String(filters.pageSize) });
    appendMultipleFilters(params, filters);
    if (filters.recordId) params.set("recordId", filters.recordId);
    const data = record(await apiRequest<unknown>(`/formalization/home/follow-up?${params.toString()}`));
    const applied = record(data.filters);
    const page = record(data.page);
    const counts = record(data.counts);
    const sources = record(data.sources);
    const native = record(sources.native);
    const legacy = record(sources.legacy);
    if (data.schemaVersion !== 1) throw invalid();
    const result: FollowUp = {
        schemaVersion: 1,
        observedAt: date(data.observedAt),
        filters: readAppliedFollowUpFilters(applied),
        page: { number: positive(page.number), size: positive(page.size, 100), total: count(page.total), totalPages: count(page.totalPages) },
        counts: readCounts(counts, applied.queue),
        projects: array(data.projects, project),
        items: array(data.items, item),
        sources: { native: { total: count(native.total) }, legacy: { total: count(legacy.total), enabled: bool(legacy.enabled) } },
    };
    if (result.items.length > result.page.size) throw invalid();
    // El registro lleva solo el JSON canónico validado. No se copian credenciales ni campos crudos del proveedor o del contacto.
    if (import.meta.env.DEV) console.log("[Formalization API: home/follow-up]", JSON.stringify({ ...result, items: result.items.map(({ clientEmail: _clientEmail, ...entry }) => entry) }));
    return result;
}

/** Proyección exacta del registro, sin conteos de banner, catálogos de proyecto ni lecturas del proveedor. */
export async function getFormalizationOrderRecord(source: FollowUpItem["source"], id: string): Promise<FollowUpItem> {
    const valid = source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id) : /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id);
    if (!valid) throw invalid();
    return item(await apiRequest<unknown>(`/formalization/orders/${source}/${encodeURIComponent(id)}/record`));
}

function appendMultipleFilters(params: URLSearchParams, filters: FollowUpFilters): void {
    if (filters.projectIds?.length) params.set("projectIds", filters.projectIds.join(","));
    if (filters.queues?.length) params.set("queues", filters.queues.map(queue).join(","));
    if (filters.bankStages?.length) params.set("bankStages", filters.bankStages.join(","));
}

function readAppliedFollowUpFilters(value: Record<string, unknown>): FollowUp["filters"] {
    return {
        search: text(value.search),
        projectId: text(value.projectId),
        queue: queue(value.queue),
        ...(value.projectIds === undefined ? {} : { projectIds: array(value.projectIds, text) }),
        ...(value.queues === undefined ? {} : { queues: array(value.queues, queue) }),
        ...(value.bankStages === undefined
            ? {}
            : {
                  bankStages: array(value.bankStages, (entry) => {
                      if (entry !== "bank_management" && entry !== "bank_management_in_progress") throw invalid();
                      return entry;
                  }),
              }),
    };
}

function optionalSaleLost(value: unknown) {
    return value === undefined ? {} : { saleLost: bool(value) };
}
