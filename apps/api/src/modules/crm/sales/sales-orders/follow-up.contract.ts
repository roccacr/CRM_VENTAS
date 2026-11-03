import { z } from "zod";

import { COMPLETION_STAGES, formalizationCompletionTarget } from "./formalization-completion.policy.js";

/** Queue names are provider-neutral and shared by both read adapters. */
export const followUpQueues = ["all", "approvals", "contracts", "send", "signature", "bank", "balance", "transfer", "signed", "closed", "addendum"] as const;
export type FollowUpQueue = (typeof followUpQueues)[number];
const boundedInteger = (max: number, fallback: number) => z.preprocess((value) => (value === undefined ? fallback : typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value), z.number().int().min(1).max(max));
const projectIdentity = z.string().regex(/^(?:[0-9A-HJKMNP-TV-Z]{26}|legacy-project:[1-9][0-9]{0,19})$/);
const selections = <T extends z.ZodType>(item: T, max: number) => z.preprocess((value) => (typeof value === "string" ? value.split(",") : value), z.array(item).max(max)).optional();
/** Strict query limits prevent unbounded reads and reject misspelled filters. */
export const followUpQuery = z
    .object({
        recordId: z
            .string()
            .regex(/^(?:legacy:[1-9][0-9]{0,9}|[0-7][0-9A-HJKMNP-TV-Z]{25})$/)
            .optional(),
        search: z.string().trim().max(120).default(""),
        projectId: z
            .string()
            .regex(/^(?:[0-9A-HJKMNP-TV-Z]{26}|legacy-project:[1-9][0-9]{0,19})?$/)
            .default(""),
        queue: z.enum(followUpQueues).default("all"),
        projectIds: selections(projectIdentity, 50),
        queues: selections(z.enum(followUpQueues), 12),
        bankStages: selections(z.enum(["bank_management", "bank_management_in_progress"]), 2),
        page: boundedInteger(100000, 1),
        pageSize: boundedInteger(100, 25),
    })
    .strict();
export type FollowUpQuery = z.infer<typeof followUpQuery>;
export type FollowUpRead = FollowUpQuery & { offset: number; limit: number };
export type FollowUpCounts = Record<Exclude<FollowUpQueue, "addendum">, number> & { addendum?: number; bankInProgress?: number };
export interface FollowUpAccess {
    /** Independent order-read grant, never inferred from a queue grant. */
    finiquito?: boolean;
    queues?: Partial<Record<FollowUpQueue, boolean>>;
    approvals: boolean;
    actorId: string;
    ownOnly: boolean;
    approvalOwnOnly: boolean;
}
export interface FollowUpPeriod {
    start: string;
    endExclusive: string;
}
const named = z.object({ id: z.string().min(1), name: z.string().min(1) });
const stateCodes = ["unclassified", "pending_approval", "contract_pending_send", "contract_pending_signature", "bank_management", "bank_management_in_progress", "pending_balance", "pending_transfer", "transfer_signed", "closed"] as const;
/** Only the requested projection crosses the boundary; only the explicitly requested client email, never raw contact payload. */
export const followUpRow = z.object({
    id: z.string().min(1),
    source: z.enum(["native", "legacy"]),
    number: z.string().min(1),
    nativeCode: z.string().nullable(),
    client: z.string().nullable(),
    clientEmail: z
        .string()
        .nullable()
        .optional()
        .transform((value) => {
            const email = value?.trim();
            return email && z.email().safeParse(email).success ? email : null;
        }),
    project: named.nullable(),
    unit: z.string().nullable(),
    responsible: z.object({ id: z.string().nullable(), name: z.string().min(1) }).nullable(),
    seller: z
        .object({ id: z.string().nullable(), name: z.string().min(1) })
        .nullable()
        .optional(),
    changedBy: z
        .object({ id: z.string().nullable(), name: z.string().min(1) })
        .nullable()
        .optional(),
    purchaseFundsOrigin: z.enum(["own_funds", "bank_financing"]).nullable().optional(),
    addendumStatus: z.enum(["pending", "completed", "cancelled", "sent"]).nullable().optional(),
    installmentsFullyPaid: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .nullable()
        .optional()
        .transform((value) => (value == null ? null : Boolean(value))),
    unitTransferred: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .nullable()
        .optional()
        .transform((value) => (value == null ? null : Boolean(value))),
    keysDelivered: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .nullable()
        .optional()
        .transform((value) => (value == null ? null : Boolean(value))),
    unitDelivered: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .nullable()
        .optional()
        .transform((value) => (value == null ? null : Boolean(value))),
    stateCode: z.enum(stateCodes),
    stateSince: z.iso.datetime().nullable(),
    completedThisYear: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean),
    saleLost: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .transform(Boolean)
        .optional(),
    contractSigned: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .transform(Boolean)
        .optional(),
    stateVersion: z.number().int().min(0).max(4294967295).optional(),
    approvalsComplete: z
        .union([z.boolean(), z.literal(0), z.literal(1)])
        .transform(Boolean)
        .optional(),
});
export type FollowUpDatabaseRow = z.infer<typeof followUpRow>;
export interface FollowUpSourcePage {
    total: number;
    counts: FollowUpCounts;
    projects: { id: string; name: string }[];
    items: FollowUpDatabaseRow[];
}
/** Labels/next steps describe the process, never authorize or execute a transition. */
const descriptions: Record<FollowUpDatabaseRow["stateCode"], readonly [string, string]> = {
    unclassified: ["Sin etapa de Formalización", "Completar las aprobaciones previas"],
    pending_approval: ["Pendiente de aprobación", "Revisar la aprobación de Formalización"],
    contract_pending_send: ["Por enviar", "Registrar el envío del contrato"],
    contract_pending_signature: ["Pendiente de firma", "Dar seguimiento a la firma del contrato"],
    bank_management_in_progress: ["Gestión bancaria en proceso", "Dar seguimiento a la gestión bancaria"],
    bank_management: ["Gestión bancaria", "Dar seguimiento a la gestión bancaria"],
    pending_balance: ["Pendiente de saldo", "Revisar la condición financiera"],
    pending_transfer: ["Traspaso pendiente", "Coordinar el traspaso"],
    transfer_signed: ["Traspaso firmado", "Dar seguimiento a la entrega de llaves"],
    closed: ["Formalización cerrada", "Proceso finalizado"],
};
const completionGuidance = { pending_transfer: "Cuotas pagadas: pasar a Traspasos pendientes", transfer_signed: "Traspaso confirmado: pasar a Traspaso firmado", closed: "Unidad entregada: pasar a Formalización cerrada" };
/** Guidance never changes the stored stage and unknown flags cannot stand in for unchecked values. */
function followUpNextStep(row: FollowUpDatabaseRow, description: string): string {
    const target = formalizationCompletionTarget(row);
    if (row.stateCode === "pending_balance") {
        if (target) return completionGuidance[target];
        return row.installmentsFullyPaid === true ? "Avance bloqueado: revisar la combinación de indicadores de traspaso, llaves y entrega en NetSuite" : "Cuotas pendientes: confirmar el pago completo en NetSuite";
    }
    const currentCompletionIndex = (COMPLETION_STAGES as readonly string[]).indexOf(row.stateCode);
    if (currentCompletionIndex < 0) return description;
    if (target === row.stateCode) return description;
    if (target && COMPLETION_STAGES.indexOf(target) > currentCompletionIndex) return completionGuidance[target];
    return "Avance bloqueado: revisar los indicadores de cuotas, traspaso, llaves y entrega en NetSuite; la etapa guardada se conserva";
}
/** Unknown effective dates remain null: importing/observing a row is not a stage transition. */
export function presentFollowUpRow(row: FollowUpDatabaseRow, observedAt: Date) {
    const { stateCode, stateSince, ...identity } = row;
    const [label, description] = descriptions[stateCode];
    return { ...identity, state: { code: stateCode, label, since: stateSince, days: stateSince ? Math.max(0, Math.floor((observedAt.getTime() - Date.parse(stateSince)) / 86400000)) : null }, nextStep: row.saleLost === true && row.contractSigned === true ? "Gestionar finiquito de venta caída" : followUpNextStep(row, description) };
}
export type FollowUpItem = ReturnType<typeof presentFollowUpRow>;
export interface FollowUpResponse {
    schemaVersion: 1;
    observedAt: string;
    filters: Pick<FollowUpQuery, "search" | "projectId" | "queue" | "projectIds" | "queues" | "bankStages">;
    page: { number: number; size: number; total: number; totalPages: number };
    counts: FollowUpCounts;
    projects: { id: string; name: string }[];
    items: FollowUpItem[];
    sources: { native: { total: number }; legacy: { total: number; enabled: boolean } };
}
/** Zero source only when the legacy integration is explicitly disabled, never after a read failure. */
export const emptyFollowUpSource = (): FollowUpSourcePage => ({ total: 0, counts: { ...Object.fromEntries(followUpQueues.map((queue) => [queue, 0])), bankInProgress: 0 } as FollowUpCounts, projects: [], items: [] });
