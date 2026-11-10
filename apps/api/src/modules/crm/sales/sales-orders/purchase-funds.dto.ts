import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

import { PURCHASE_FUNDS_ORIGINS, validateContractTransition } from "./contract-transition.dto.js";

const schema = z.object({ source: z.enum(["native", "legacy"]), id: z.string(), expectedSequence: z.number().int().min(0).max(4294967294), expectedAuditSequence: z.number().int().min(0).max(4294967294), operationId: z.string(), purchaseFundsOrigin: z.enum(PURCHASE_FUNDS_ORIGINS), expectedPurchaseFundsOrigin: z.enum(PURCHASE_FUNDS_ORIGINS).nullable() }).strict();
export type PurchaseFundsDto = z.infer<typeof schema>;

/** Comparte la validación de identidad e idempotencia de la orden. No acepta una transición ni un actor enviado por quien llama. */
export function validatePurchaseFunds(input: unknown): PurchaseFundsDto {
    const result = schema.safeParse(input);
    if (!result.success) throw new BadRequestException("Origen de fondos inválido");
    const { source, id, expectedSequence, operationId } = result.data;
    validateContractTransition({ source, id, expectedSequence, operationId }, "send");
    return result.data;
}
