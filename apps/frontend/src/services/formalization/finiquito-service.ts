import { apiRequest } from "../api/api-client";
import type { FollowUpItem } from "./follow-up-service";

/** Una historia de finiquito conserva su identidad visual aunque NetSuite desmarque la caída. */
export function isFiniquitoOrder(item: Pick<FollowUpItem, "saleLost" | "finiquitoInFlow">): boolean {
    return item.saleLost === true || item.finiquitoInFlow === true;
}

export const FINIQUITO_SECTIONS = [
    { code: "validation", queue: "finiquito_validation", label: "Validación de saldo" },
    { code: "pending_send", queue: "finiquito_pending", label: "Finiquito pendiente" },
    { code: "waiting_signature", queue: "finiquito_signed", label: "Finiquito firmado" },
    { code: "formalized", queue: "finiquito_formalized", label: "Formalizada" },
] as const;
export type FiniquitoAction = "balance_validated" | "sent" | "signed";
export type FiniquitoSection = (typeof FINIQUITO_SECTIONS)[number]["code"] | "waiting_checks";
export type FiniquitoManualStage = (typeof FINIQUITO_SECTIONS)[number]["code"];
export const DEFAULT_FINIQUITO_REASON = "Actualización manual del estado del finiquito.";
export interface FiniquitoManualChange {
    targetStage: FiniquitoManualStage;
    reason: string;
}
export interface FiniquitoOperation {
    source: "native" | "legacy";
    id: string;
    status: FiniquitoAction | "set_stage";
    expectedVersion: number;
    operationId: string;
    targetStage?: FiniquitoManualStage;
    reason?: string;
}
/** La etapa local se deriva de las marcas persistidas, nunca de la etapa comercial. */
export function currentFiniquitoStage(flags: Pick<FiniquitoSnapshot, "balanceValidated" | "sent" | "received">): FiniquitoManualStage {
    if (!flags.balanceValidated) return "validation";
    if (flags.received) return "formalized";
    return flags.sent ? "waiting_signature" : "pending_send";
}
export interface FiniquitoSnapshot {
    eligible: boolean;
    balanceValidated: boolean;
    sent: boolean;
    received: boolean;
    saleLost: boolean;
    contractSigned: boolean;
    canUpdate: boolean;
    status: "pending_send" | "sent" | "signed" | null;
    version: number;
    originStage: string | null;
}
export interface FiniquitoOverviewRow {
    id: string;
    source: "native" | "legacy";
    number: string;
    section: FiniquitoSection;
    balanceValidated: boolean;
    sent: boolean;
    received: boolean;
    saleLost: boolean;
    contractSigned: boolean;
    reservationApplied: boolean;
    version: number;
}
export interface FiniquitoOverview {
    counts: Record<FiniquitoSection, number>;
    total: number;
    page: number;
    pageSize: number;
    items: FiniquitoOverviewRow[];
    canUpdate: boolean;
}
function object(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Respuesta de finiquito inválida.");
    return value as Record<string, unknown>;
}
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Contador de finiquito inválido.");
    return value;
}
function confirmed(value: unknown): boolean {
    if (typeof value !== "boolean") throw new Error("Check de finiquito inválido.");
    return value;
}
/** La respuesta anterior sin saldo propio no se interpreta como saldo validado ni como una cifra en cero. */
export function parseFiniquitoSnapshot(value: unknown): FiniquitoSnapshot {
    const data = object(value);
    const flags = { balanceValidated: confirmed(data.balanceValidated), sent: confirmed(data.sent), received: confirmed(data.received), saleLost: confirmed(data.saleLost), contractSigned: confirmed(data.contractSigned) };
    if (![null, "pending_send", "sent", "signed"].includes(data.status as string | null) || (data.originStage !== null && typeof data.originStage !== "string")) throw new Error("Etapa de finiquito inválida.");
    return { ...flags, eligible: confirmed(data.eligible), canUpdate: confirmed(data.canUpdate), version: count(data.version), status: data.status as FiniquitoSnapshot["status"], originStage: data.originStage };
}
/** La validación es una acción distinta de enviar/recibir y no altera Reserva Aplicada. */
export function nextFiniquitoAction(flags: Pick<FiniquitoSnapshot, "balanceValidated" | "sent" | "received">): FiniquitoAction | null {
    if (!flags.balanceValidated) return "balance_validated";
    if (!flags.sent) return "sent";
    return flags.received ? null : "signed";
}
function parseRow(value: unknown): FiniquitoOverviewRow {
    const row = object(value);
    if (typeof row.id !== "string" || typeof row.number !== "string" || !["native", "legacy"].includes(row.source as string) || ![...FINIQUITO_SECTIONS.map((section) => section.code), "waiting_checks"].includes(row.section as FiniquitoSection)) throw new Error("Orden de finiquito inválida.");
    return { id: row.id, source: row.source as "native" | "legacy", number: row.number, section: row.section as FiniquitoSection, version: count(row.version), balanceValidated: confirmed(row.balanceValidated), sent: confirmed(row.sent), received: confirmed(row.received), saleLost: confirmed(row.saleLost), contractSigned: confirmed(row.contractSigned), reservationApplied: confirmed(row.reservationApplied) };
}
/** Resumen agregado del servidor; nunca cuenta únicamente la página visible. */
export async function getFiniquitoOverview(section: FiniquitoSection | "all" = "all", page = 1): Promise<FiniquitoOverview> {
    const data = object(await apiRequest<unknown>(`/formalization/orders/finiquito/overview?${new URLSearchParams({ section, page: String(page) })}`));
    const counters = object(data.counts);
    if (!Array.isArray(data.items) || data.items.length > 25) throw new Error("Página de finiquito inválida.");
    const keys = [...FINIQUITO_SECTIONS.map((item) => item.code), "waiting_checks"] as const;
    return { counts: Object.fromEntries(keys.map((key) => [key, count(counters[key])])) as FiniquitoOverview["counts"], total: count(data.total), page: count(data.page), pageSize: count(data.pageSize), canUpdate: confirmed(data.canUpdate), items: data.items.map(parseRow) };
}
