import { BadRequestException, ConflictException } from "@nestjs/common";
import { z } from "zod";

import { orderTimingIdentity } from "./order-timing.contract.js";

export const FINIQUITO_STATES = ["pending_send", "sent", "signed"] as const;
export const DEFAULT_FINIQUITO_REASON = "Actualización manual del estado del finiquito.";
export const FINIQUITO_ACTIONS = ["balance_validated", "sent", "signed", "set_stage"] as const;
export const FINIQUITO_MANUAL_STAGES = ["validation", "pending_send", "waiting_signature", "formalized"] as const;
export type FiniquitoManualStage = (typeof FINIQUITO_MANUAL_STAGES)[number];
export interface FiniquitoChange {
    status: FiniquitoAction;
    expectedVersion: number;
    targetStage?: FiniquitoManualStage | undefined;
    reason?: string | undefined;
}
export const finiquitoSnapshot = z.object({ finiquitoStatus: z.enum(FINIQUITO_STATES), finiquitoOriginStage: z.string().min(1), finiquitoVersion: z.number().int().positive(), finiquitoAction: z.enum(FINIQUITO_ACTIONS).optional(), finiquitoManualStage: z.enum(FINIQUITO_MANUAL_STAGES).optional(), finiquitoReason: z.string().optional() });
export type FiniquitoStatus = (typeof FINIQUITO_STATES)[number];
export type FiniquitoAction = (typeof FINIQUITO_ACTIONS)[number];
export interface FiniquitoFlags {
    balanceValidated: boolean;
    sent: boolean;
    received: boolean;
}
/** La evidencia histórica de envío/firma no equivale a validar el saldo. */
export function planFiniquitoChange(before: FiniquitoStatus | null, flags: FiniquitoFlags, action: Exclude<FiniquitoAction, "set_stage">, contractSigned: boolean): { flag: keyof FiniquitoFlags; status: FiniquitoStatus } {
    if (action === "balance_validated") {
        if (flags.balanceValidated) throw new ConflictException("El saldo ya fue validado. Actualiza la orden.");
        return { flag: "balanceValidated", status: before ?? "pending_send" };
    }
    if (!flags.balanceValidated || !contractSigned) throw new ConflictException("Se requiere Saldo validado y Contrato firmado para gestionar el finiquito.");
    assertFiniquitoTransition(before, action);
    assertFiniquitoStep(flags, action);
    return { flag: action === "sent" ? "sent" : "received", status: action };
}
function assertFiniquitoStep(flags: FiniquitoFlags, action: "sent" | "signed"): void {
    const expectedSent = action === "signed";
    if (flags.sent !== expectedSent || flags.received) throw new ConflictException("Los checks del finiquito no permiten saltar o repetir pasos.");
}
/** La validación financiera es propia del CRM y no presupone contrato firmado. */
export function finiquitoValidationEligible(order: { available?: boolean; saleLost?: boolean | undefined; reservationApplied?: boolean | undefined }): boolean {
    return order.available === true && order.saleLost === true && order.reservationApplied === true;
}
/** Los indicadores deben estar confirmados; la etapa comercial no condiciona esta rama. */
export function finiquitoEligible(order: { available?: boolean; saleLost?: boolean | undefined; contractSigned?: boolean | undefined; reservationApplied?: boolean | undefined; stage?: string }): boolean {
    return order.available === true && order.saleLost === true && order.reservationApplied === true && order.contractSigned === true;
}
/** La firma presupone envío; esta rama no permite saltos ni cambia la etapa comercial. */
export function assertFiniquitoTransition(before: FiniquitoStatus | null, after: FiniquitoStatus): void {
    const expected = before === null ? "pending_send" : before === "pending_send" ? "sent" : before === "sent" ? "signed" : null;
    if (after !== expected) throw new ConflictException("El finiquito cambió o la transición no es válida. Actualiza la orden.");
}

/** El cuerpo público no trae actores, banderas de elegibilidad ni un destino comercial. */
export function validateFiniquitoInput(input: unknown, write: boolean) {
    const fields = { source: z.enum(["native", "legacy"]), id: z.string() };
    const changeSchema = z.object({ status: z.enum(FINIQUITO_ACTIONS), expectedVersion: z.number().int().min(0).max(4294967294), operationId: z.uuid(), targetStage: z.enum(FINIQUITO_MANUAL_STAGES).optional(), reason: z.string().trim().max(1000).optional() });
    const schema = write ? z.strictObject({ ...fields, ...changeSchema.shape }) : z.strictObject(fields);
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Solicitud de finiquito inválida.");
    if (write) {
        const change = changeSchema.parse(parsed.data);
        assertFiniquitoChangeFields(change);
    }
    const target = orderTimingIdentity.safeParse(parsed.data);
    if (!target.success) throw new BadRequestException("Identidad de orden inválida.");
    const change = write ? changeSchema.parse(parsed.data) : undefined;
    if (change && change.status === "set_stage") change.reason = normalizedFiniquitoReason(change.reason);
    return { target: target.data, change };
}

function assertFiniquitoChangeFields(change: FiniquitoChange): void {
    const valid = change.status === "set_stage" ? Boolean(change.targetStage) : change.targetStage === undefined && change.reason === undefined;
    if (!valid) throw new BadRequestException("El cambio manual requiere una etapa válida; las acciones normales no admiten destino ni motivo.");
}

/** Evidencia separada de las marcas; permite distinguir el ajuste histórico de los pasos ordinarios. */
export function finiquitoManualEvidence(change: FiniquitoChange) {
    return change.status === "set_stage" ? { finiquitoManualStage: change.targetStage, finiquitoReason: normalizedFiniquitoReason(change.reason) } : {};
}

/** Reconciliación manual explícita; no declara que se enviaron correos ni altera checks del ERP. */
export function manualFiniquitoPlan(stage: FiniquitoManualStage): { flags: FiniquitoFlags; status: FiniquitoStatus } {
    const index = FINIQUITO_MANUAL_STAGES.indexOf(stage);
    if (index < 0) throw new BadRequestException("Etapa de finiquito inválida.");
    return { flags: { balanceValidated: index >= 1, sent: index >= 2, received: index >= 3 }, status: index >= 3 ? "signed" : index >= 2 ? "sent" : "pending_send" };
}

/** El ajuste histórico es una acción diferenciada; los botones normales conservan sus prerrequisitos. */
export function planFiniquitoUpdate(before: FiniquitoStatus | null, flags: FiniquitoFlags, change: FiniquitoChange, contractSigned: boolean) {
    if (change.status === "set_stage") {
        if (!change.targetStage || (change.reason?.length ?? 0) > 1000) throw new BadRequestException("El cambio manual requiere etapa válida y un motivo de hasta 1000 caracteres.");
        return { ...manualFiniquitoPlan(change.targetStage), flag: null };
    }
    const plan = planFiniquitoChange(before, flags, change.status, contractSigned);
    return { status: plan.status, flags: { ...flags, [plan.flag]: true }, flag: plan.flag };
}

/** Siempre conserva un motivo auditable aun cuando el campo opcional llegue vacío. */
export function normalizedFiniquitoReason(reason: string | undefined): string {
    return reason?.trim() || DEFAULT_FINIQUITO_REASON;
}
