import { BadRequestException } from "@nestjs/common";
import { plainToInstance, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches, Max, MaxLength, Min, validateSync } from "class-validator";

/** Cola de contrato: órdenes por enviar, o enviadas y pendientes de firma. */
export type ContractQueue = "send" | "signature";
/** Orden tal como se devuelve al cliente. */
export interface ContractOrderItem {
    source: "native" | "legacy";
    id: string;
    businessId: string;
    state: "contract_pending_send" | "contract_pending_signature";
    sequence: number;
}
/** Ítem más la clave del cursor para continuar la página. */
export interface ContractOrderPageRow extends ContractOrderItem {
    sortId: string;
}

/** Listado acotado por clave de fase. El cursor elige filas y no concede acceso. */
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

/** Lo reutilizan los servicios para que un llamador interno no se salte los límites de la consulta. */
export function validateContractOrdersQuery(input: unknown): ContractOrdersQuery {
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Invalid contract orders query");
    const query = plainToInstance(ContractOrdersQuery, input);
    if (validateSync(query, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Invalid contract orders query");
    parseContractCursor(query.cursor);
    return query;
}

/** El texto decimal conserva la precisión del BIGINT. No acepta un nombre SQL arbitrario. */
export function parseContractCursor(cursor?: string): { source: "native" | "legacy"; id: string } {
    if (!cursor) return { source: "native", id: "0" };
    const [source, id] = cursor.split(":");
    if ((source !== "native" && source !== "legacy") || id === undefined || !/^(0|[1-9]\d{0,19})$/.test(id)) throw new BadRequestException("Invalid contract cursor");
    const maximum = source === "legacy" ? 2147483647n : 18446744073709551615n;
    if (BigInt(id) > maximum) throw new BadRequestException("Invalid contract cursor");
    return { source, id };
}
