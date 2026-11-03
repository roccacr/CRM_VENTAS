import { BadRequestException, ConflictException } from "@nestjs/common";
import { z } from "zod";

import { orderTimingIdentity } from "./order-timing.contract.js";

export const FINIQUITO_STATES = ["pending_send", "sent", "signed"] as const;
export const finiquitoSnapshot = z.object({ finiquitoStatus: z.enum(FINIQUITO_STATES), finiquitoOriginStage: z.string().min(1), finiquitoVersion: z.number().int().positive() });
export type FiniquitoStatus = (typeof FINIQUITO_STATES)[number];
/** Los indicadores deben estar confirmados; la etapa comercial no condiciona esta rama. */
export function finiquitoEligible(order: { available?: boolean; saleLost?: boolean | undefined; contractSigned?: boolean | undefined; stage?: string }): boolean {
    return order.available === true && order.saleLost === true && order.contractSigned === true;
}
/** La firma presupone envío; esta rama no permite saltos ni cambia la etapa comercial. */
export function assertFiniquitoTransition(before: FiniquitoStatus | null, after: FiniquitoStatus): void {
    const expected = before === null ? "pending_send" : before === "pending_send" ? "sent" : before === "sent" ? "signed" : null;
    if (after !== expected) throw new ConflictException("El finiquito cambió o la transición no es válida. Actualiza la orden.");
}

/** The public body never supplies actors, eligibility flags or a commercial destination. */
export function validateFiniquitoInput(input: unknown, write: boolean) {
    const fields = { source: z.enum(["native", "legacy"]), id: z.string() };
    const changeSchema = z.object({ status: z.enum(FINIQUITO_STATES), expectedVersion: z.number().int().min(0).max(4294967294), operationId: z.uuid() });
    const schema = write ? z.strictObject({ ...fields, ...changeSchema.shape }) : z.strictObject(fields);
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Solicitud de finiquito inválida.");
    const target = orderTimingIdentity.safeParse(parsed.data);
    if (!target.success) throw new BadRequestException("Identidad de orden inválida.");
    return { target: target.data, change: write ? changeSchema.parse(parsed.data) : undefined };
}
