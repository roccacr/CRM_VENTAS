import { apiRequest } from "../api/api-client";
import type { CatalogContextModuleCode, CatalogItemStatus, ListCatalogItemsOptions } from "./catalog-service";

/** Identidad nativa del banco. No se fabrica una referencia del ERP ni un ítem genérico de catálogo. */
export interface Bank {
    readonly publicId: string;
    readonly name: string;
    readonly status: CatalogItemStatus;
    readonly version: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly advisorCount: number;
}
export interface BankAdvisor extends Omit<Bank, "advisorCount"> {
    readonly bankPublicId: string;
    readonly email: string;
    readonly phone: string;
    readonly area: string;
}
export interface BankPayload {
    readonly moduleCode: CatalogContextModuleCode;
    readonly name: string;
    readonly reason: string;
}
export interface AdvisorPayload extends BankPayload {
    readonly email: string;
    readonly phone: string;
    readonly area: string;
}
export interface BankStatusPayload {
    readonly moduleCode: CatalogContextModuleCode;
    readonly status: CatalogItemStatus;
    readonly reason: string;
    readonly expectedVersion: number;
}
export interface BankPage<T> {
    readonly items: readonly T[];
    readonly total: number;
}
const BASE = "/catalogs/banks/items";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const integer = (value: unknown, minimum: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const baseValid = (value: Record<string, unknown>) => nonempty(value.publicId) && nonempty(value.name) && (value.status === "active" || value.status === "inactive") && integer(value.version, 1) && [value.createdAt, value.updatedAt].every((value) => nonempty(value) && Number.isFinite(Date.parse(value)));
/** Rechaza un registro incompleto. No le otorga una identidad ni una versión falsas. */
export const parseBank = (value: unknown): Bank => {
    if (!record(value) || !baseValid(value) || !integer(value.advisorCount, 0)) throw new TypeError("Respuesta de banco inválida.");
    return value as unknown as Bank;
};
export const parseBankAdvisor = (value: unknown): BankAdvisor => {
    // La carga inicial autorizada conserva el área desconocida como texto vacío.
    if (!record(value) || !baseValid(value) || ![value.bankPublicId, value.email, value.phone].every(nonempty) || typeof value.area !== "string") throw new TypeError("Respuesta de ejecutivo inválida.");
    return value as unknown as BankAdvisor;
};
const parsePage = <T>(value: unknown, parse: (item: unknown) => T): BankPage<T> => {
    if (!record(value) || !Array.isArray(value.items) || !integer(value.total, 0)) throw new TypeError("Respuesta de listado inválida.");
    return { items: value.items.map(parse), total: value.total };
};
const query = (options: ListCatalogItemsOptions) => {
    const params = new URLSearchParams({ moduleCode: options.moduleCode });
    if (options.search?.trim()) params.set("search", options.search.trim());
    if (options.status && options.status !== "all") params.set("status", options.status);
    params.set("limit", String(options.limit ?? 25));
    params.set("offset", String(options.offset ?? 0));
    return params.toString();
};
const bankPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;
const advisorPath = (bankId: string, advisorId?: string) => `${bankPath(bankId)}/advisors${advisorId ? `/${encodeURIComponent(advisorId)}` : ""}`;
export const listBanks = async (options: ListCatalogItemsOptions): Promise<BankPage<Bank>> => parsePage(await apiRequest<unknown>(`${BASE}?${query(options)}`), parseBank);
export const getBank = async (id: string, moduleCode: CatalogContextModuleCode): Promise<Bank> => parseBank(await apiRequest<unknown>(`${bankPath(id)}?${new URLSearchParams({ moduleCode }).toString()}`));
export const listBankAdvisors = async (bankId: string, options: ListCatalogItemsOptions): Promise<BankPage<BankAdvisor>> => parsePage(await apiRequest<unknown>(`${advisorPath(bankId)}?${query(options)}`), parseBankAdvisor);
// La respuesta de una mutación no se repite después de renovar la sesión. Quien llama reconcilia un resultado desconocido con GET.
export const createBank = async (body: BankPayload, signal?: AbortSignal): Promise<Bank> => parseBank(await apiRequest<unknown>(BASE, { method: "POST", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
export const updateBank = async (id: string, body: BankPayload & { readonly expectedVersion: number }, signal?: AbortSignal): Promise<Bank> => parseBank(await apiRequest<unknown>(bankPath(id), { method: "PATCH", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
export const updateBankStatus = async (id: string, body: BankStatusPayload, signal?: AbortSignal): Promise<Bank> => parseBank(await apiRequest<unknown>(`${bankPath(id)}/status`, { method: "PATCH", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
export const createBankAdvisor = async (bankId: string, body: AdvisorPayload, signal?: AbortSignal): Promise<BankAdvisor> => parseBankAdvisor(await apiRequest<unknown>(advisorPath(bankId), { method: "POST", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
export const updateBankAdvisor = async (bankId: string, id: string, body: AdvisorPayload & { readonly expectedVersion: number }, signal?: AbortSignal): Promise<BankAdvisor> => parseBankAdvisor(await apiRequest<unknown>(advisorPath(bankId, id), { method: "PATCH", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
export const updateBankAdvisorStatus = async (bankId: string, id: string, body: BankStatusPayload, signal?: AbortSignal): Promise<BankAdvisor> => parseBankAdvisor(await apiRequest<unknown>(`${advisorPath(bankId, id)}/status`, { method: "PATCH", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
