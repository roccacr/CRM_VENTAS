import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, validateSync } from "class-validator";

/** ULID-style public id of native orders (Crockford base32, 26 chars, first char <= 7). */
const publicIdPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
/** Idempotency key: either a ULID or a UUID supplied by the client. */
const operationPattern = /^(?:[0-7][0-9A-HJKMNP-TV-Z]{25}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** Transitions available from the contract queues. */
export type ContractAction = "send" | "revert" | "set";
/** Ordered CRM stages after Formalization approval; this order also determines reversals. */
export const FORMALIZATION_STAGE_CODES = ["contract_pending_send", "contract_pending_signature", "bank_management", "bank_management_in_progress", "pending_balance", "pending_transfer", "transfer_signed", "closed"] as const;

export const PURCHASE_FUNDS_ORIGINS = ["own_funds", "bank_financing"] as const;
export type PurchaseFundsOrigin = (typeof PURCHASE_FUNDS_ORIGINS)[number];

/** The route fixes the action; source IDs never permit arbitrary SQL identifiers. */
export class ContractTransitionDto {
    @IsIn(["native", "legacy"])
    source!: "native" | "legacy";

    @IsString()
    @MaxLength(26)
    id!: string;

    @IsInt()
    @Min(0)
    @Max(4294967294)
    expectedSequence!: number;

    @IsString()
    @MaxLength(100)
    @Matches(operationPattern)
    operationId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;

    @IsOptional()
    @IsIn(PURCHASE_FUNDS_ORIGINS)
    purchaseFundsOrigin?: PurchaseFundsOrigin | undefined;

    @IsOptional()
    @IsIn(FORMALIZATION_STAGE_CODES)
    targetState?: (typeof FORMALIZATION_STAGE_CODES)[number] | undefined;
}

/** Fixed contract actions retain their destination; the selector accepts only known postapproval stages. */
export function contractTarget(command: { action: ContractAction; targetState?: string | undefined }): string {
    switch (command.action) {
        case "send":
            return "contract_pending_signature";
        case "revert":
            return "contract_pending_send";
        case "set": {
            const target = FORMALIZATION_STAGE_CODES.find((code) => code === command.targetState);
            if (target) return target;
        }
    }
    throw new BadRequestException("Invalid target stage");
}

/** Internal callers receive the same validation as HTTP consumers, including source-specific IDs. */
export function validateContractTransition(input: unknown, action: ContractAction): ContractTransitionDto {
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Invalid contract transition");
    const dto = plainToInstance(ContractTransitionDto, input);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Invalid contract transition");
    if (Reflect.get(input, "purchaseFundsOrigin") === null) throw new BadRequestException("Invalid purchase funds origin");
    contractTarget({ action, targetState: dto.targetState });
    if (action !== "set" && dto.targetState !== undefined) throw new BadRequestException("Target stage only applies to selection");
    assertContractIdentity(dto, action);
    return dto;
}

/** Native ids are public ULIDs; legacy ids are positive INT values. Reversals must explain themselves. */
function assertContractIdentity(dto: ContractTransitionDto, action: ContractAction): void {
    const validId = dto.source === "native" ? publicIdPattern.test(dto.id) : /^[1-9]\d{0,9}$/.test(dto.id) && Number(dto.id) <= 2147483647;
    if (!validId) throw new BadRequestException("Invalid order identity");
    if (action === "revert" && !dto.reason?.trim()) throw new BadRequestException("Reversal reason required");
}
