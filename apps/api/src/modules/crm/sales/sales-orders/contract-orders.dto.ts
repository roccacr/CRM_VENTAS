import { BadRequestException } from "@nestjs/common";
import { plainToInstance, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches, Max, MaxLength, Min, validateSync } from "class-validator";

/** Contract queue: orders to send, or sent and awaiting signature. */
export type ContractQueue = "send" | "signature";
/** Order as returned to the client. */
export interface ContractOrderItem {
    source: "native" | "legacy";
    id: string;
    businessId: string;
    state: "contract_pending_send" | "contract_pending_signature";
    sequence: number;
}
/** Item plus the cursor key used to continue the page. */
export interface ContractOrderPageRow extends ContractOrderItem {
    sortId: string;
}

/** Bounded, phase-keyset listing; cursors select rows but never grant access. */
export class ContractOrdersQuery {
    @IsIn(["send", "signature"])
    queue!: ContractQueue;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 50;

    @IsOptional()
    @MaxLength(64)
    @Matches(/^(native|legacy):(0|[1-9]\d{0,19})$/)
    cursor?: string;
}

/** Reused by services so internal callers cannot bypass query bounds. */
export function validateContractOrdersQuery(input: unknown): ContractOrdersQuery {
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Invalid contract orders query");
    const query = plainToInstance(ContractOrdersQuery, input);
    if (validateSync(query, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Invalid contract orders query");
    parseContractCursor(query.cursor);
    return query;
}

/** Decimal text preserves BIGINT identity precision without accepting arbitrary SQL names. */
export function parseContractCursor(cursor?: string): { source: "native" | "legacy"; id: string } {
    if (!cursor) return { source: "native", id: "0" };
    const [source, id] = cursor.split(":");
    if ((source !== "native" && source !== "legacy") || id === undefined || !/^(0|[1-9]\d{0,19})$/.test(id)) throw new BadRequestException("Invalid contract cursor");
    const maximum = source === "legacy" ? 2147483647n : 18446744073709551615n;
    if (BigInt(id) > maximum) throw new BadRequestException("Invalid contract cursor");
    return { source, id };
}
