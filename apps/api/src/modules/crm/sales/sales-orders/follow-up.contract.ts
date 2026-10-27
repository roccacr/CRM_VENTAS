import { z } from "zod";

/** Queue names are provider-neutral and shared by both read adapters. */
export const followUpQueues = ["all", "approvals", "contracts", "send", "signature", "bank", "balance", "transfer", "signed", "closed"] as const;
export type FollowUpQueue = (typeof followUpQueues)[number];
const boundedInteger = (max: number, fallback: number) => z.preprocess((value) => (value === undefined ? fallback : typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value), z.number().int().min(1).max(max));
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
        page: boundedInteger(100000, 1),
        pageSize: boundedInteger(100, 25),
    })
    .strict();
export type FollowUpQuery = z.infer<typeof followUpQuery>;
export type FollowUpRead = FollowUpQuery & { offset: number; limit: number };
export type FollowUpCounts = Record<FollowUpQueue, number>;
export interface FollowUpAccess {
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
const stateCodes = ["unclassified", "pending_approval", "contract_pending_send", "contract_pending_signature", "bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed"] as const;
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
    stateCode: z.enum(stateCodes),
    stateSince: z.iso.datetime().nullable(),
    completedThisYear: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean),
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
    bank_management: ["Gestión bancaria", "Dar seguimiento a la gestión bancaria"],
    pending_balance: ["Pendiente de saldo", "Revisar la condición financiera"],
    pending_transfer: ["Traspaso pendiente", "Coordinar el traspaso"],
    transfer_signed: ["Traspaso firmado", "Dar seguimiento a la entrega de llaves"],
    closed: ["Formalización cerrada", "Proceso finalizado"],
};
/** Unknown effective dates remain null: importing/observing a row is not a stage transition. */
export function presentFollowUpRow(row: FollowUpDatabaseRow, observedAt: Date) {
    const { stateCode, stateSince, ...identity } = row;
    const [label, nextStep] = descriptions[stateCode];
    return { ...identity, state: { code: stateCode, label, since: stateSince, days: stateSince ? Math.max(0, Math.floor((observedAt.getTime() - Date.parse(stateSince)) / 86400000)) : null }, nextStep };
}
export type FollowUpItem = ReturnType<typeof presentFollowUpRow>;
export interface FollowUpResponse {
    schemaVersion: 1;
    observedAt: string;
    filters: Pick<FollowUpQuery, "search" | "projectId" | "queue">;
    page: { number: number; size: number; total: number; totalPages: number };
    counts: FollowUpCounts;
    projects: { id: string; name: string }[];
    items: FollowUpItem[];
    sources: { native: { total: number }; legacy: { total: number; enabled: boolean } };
}
/** Zero source only when the legacy integration is explicitly disabled, never after a read failure. */
export const emptyFollowUpSource = (): FollowUpSourcePage => ({ total: 0, counts: Object.fromEntries(followUpQueues.map((queue) => [queue, 0])) as FollowUpCounts, projects: [], items: [] });
