import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, validateSync } from "class-validator";

/** ULID-style public id of native orders (Crockford base32, 26 chars, first char <= 7). */
const publicIdPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
/** Idempotency key: either a ULID or a UUID supplied by the client. */
const operationPattern = /^(?:[0-7][0-9A-HJKMNP-TV-Z]{25}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** Transitions available from the contract queues. */
export type ContractAction = "send" | "revert";

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
}

/** Internal callers receive the same validation as HTTP consumers, including source-specific IDs. */
export function validateContractTransition(input: unknown, action: ContractAction): ContractTransitionDto {
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Invalid contract transition");
    const dto = plainToInstance(ContractTransitionDto, input);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Invalid contract transition");
    assertContractIdentity(dto, action);
    return dto;
}

/** Native ids are public ULIDs; legacy ids are positive INT values. Reversals must explain themselves. */
function assertContractIdentity(dto: ContractTransitionDto, action: ContractAction): void {
    const validId = dto.source === "native" ? publicIdPattern.test(dto.id) : /^[1-9]\d{0,9}$/.test(dto.id) && Number(dto.id) <= 2147483647;
    if (!validId) throw new BadRequestException("Invalid order identity");
    if (!["send", "revert"].includes(action)) throw new BadRequestException("Invalid contract action");
    if (action === "revert" && !dto.reason?.trim()) throw new BadRequestException("Reversal reason required");
}
