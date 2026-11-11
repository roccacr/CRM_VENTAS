import { z } from "zod";

const nativeId = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
/** La identidad de la URL vieja es el id de origen del CRM, no el número de transacción del ERP. */
export const orderTimingIdentity = z.discriminatedUnion("source", [
    z.object({ source: z.literal("native"), id: z.string().regex(nativeId) }),
    z.object({
        source: z.literal("legacy"),
        id: z
            .string()
            .regex(/^(?:legacy:)?[1-9][0-9]{0,9}$/)
            .transform((value) => value.replace(/^legacy:/, ""))
            .refine((value) => Number(value) <= 2147483647),
    }),
]);
const integer = (maximum: number, fallback: number) => z.preprocess((value) => (value === undefined ? fallback : typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value), z.number().int().positive().max(maximum));
export const orderTimingQuery = z.object({ page: integer(100000, 1), pageSize: integer(100, 50) }).strict();
export interface TimingOrder {
    id: string;
    publicId: string;
    active: boolean;
    /** Borrado lógico distinto de inactivación: nunca se publica en la ficha. */
    deleted?: boolean;
    pendingApproval: boolean;
    ownerId: string | null;
    rawStage?: string | null;
    approved?: number;
    contractSigned?: number;
    completedThisYear?: number;
}
export interface TimingPerson {
    id: string | null;
    name: string;
}
export interface TimingVisit {
    sequence: number;
    state: { code: string; label: string };
    enteredAt: string | null;
    leftAt: string | null;
    seconds: number | null;
    isCurrent: boolean;
    changedBy: TimingPerson | null;
    responsible: TimingPerson | null;
    recordedAt: string;
}
export interface TimingSummary {
    startedAt: string | null;
    finishedAt: string | null;
    totalSeconds: number | null;
    knownSeconds: number;
    complete: boolean;
}
export interface TimingPage {
    total: number;
    summary: TimingSummary;
    items: TimingVisit[];
}
export interface TimingPagination {
    offset: number;
    limit: number;
}
function parseJsonOrNull(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return null;
    }
}
/** La foto conserva los nombres históricos. Una evidencia vieja que solo es referencia no se atribuye por adivinación. */
export function timingPerson(snapshot: unknown, reference: unknown): TimingPerson | null {
    // Un snapshot historico danado (texto no JSON) no debe tumbar toda la lectura del historial: se trata como sin datos.
    const value = typeof snapshot === "string" ? parseJsonOrNull(snapshot) : snapshot;
    const person = z
        .looseObject({ publicId: z.string().optional(), name: z.string().trim().min(1).optional() })
        .catch({})
        .parse(value);
    const referenceId = typeof reference === "string" && reference.startsWith("CRM_THINK_V2:") ? reference.slice("CRM_THINK_V2:".length) : null;
    const id = person.publicId ?? referenceId;
    const name = person.name;
    return name || id ? { id, name: name ?? "Nombre histórico no registrado" } : null;
}
