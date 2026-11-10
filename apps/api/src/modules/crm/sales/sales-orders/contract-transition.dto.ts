import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, validateSync } from "class-validator";

/** Id público de la orden nativa, estilo ULID: Crockford, 26 caracteres y el primero no pasa de 7. */
const publicIdPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
/** Clave de idempotencia: un ULID o un UUID que trae el cliente. */
const operationPattern = /^(?:[0-7][0-9A-HJKMNP-TV-Z]{25}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** Transiciones disponibles desde las colas de contrato. */
export type ContractAction = "send" | "revert" | "set";
/** Etapas ordenadas del CRM después de la aprobación de formalización. Ese orden también define las reversas. */
export const FORMALIZATION_STAGE_CODES = ["contract_pending_send", "contract_pending_signature", "bank_management", "bank_management_in_progress", "pending_balance", "pending_transfer", "transfer_signed", "closed"] as const;

export const PURCHASE_FUNDS_ORIGINS = ["own_funds", "bank_financing"] as const;
export type PurchaseFundsOrigin = (typeof PURCHASE_FUNDS_ORIGINS)[number];

/** La ruta fija la acción. El id de origen no se vuelve un identificador SQL arbitrario. */
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

/** Las acciones fijas de contrato conservan su destino. El selector acepta solo etapas posteriores conocidas. */
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

/** Un llamador interno recibe la misma validación que HTTP, incluido el id propio de cada fuente. */
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

/** El id nativo es un ULID público. El id viejo es un entero positivo. Una reversa tiene que explicar el motivo. */
function assertContractIdentity(dto: ContractTransitionDto, action: ContractAction): void {
    const validId = dto.source === "native" ? publicIdPattern.test(dto.id) : /^[1-9]\d{0,9}$/.test(dto.id) && Number(dto.id) <= 2147483647;
    if (!validId) throw new BadRequestException("Invalid order identity");
    if (action === "revert" && !dto.reason?.trim()) throw new BadRequestException("Reversal reason required");
}
