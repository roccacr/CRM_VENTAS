import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional, type SchemaObject } from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches, MaxLength, validateSync } from "class-validator";

import type { ClientHistoryItem } from "../sales/sales-orders/order-client-context.query.js";

export const LEAD_PROFILE_PERMISSION = "lead.profile.read";
export type LeadProfileOrigin = "native" | "legacy";

/** La identidad siempre incluye origen; un número antiguo nunca es un publicId nativo. */
export class LeadProfileQueryDto {
    @ApiProperty({ enum: ["native", "legacy"] })
    @IsIn(["native", "legacy"])
    source!: LeadProfileOrigin;
    @ApiProperty({ description: "PublicId nativo o PK legacy, sin prefijo legacy:" })
    @IsString()
    @Matches(/^(?:[0-9A-HJKMNP-TV-Z]{26}|[1-9][0-9]{0,19})$/u)
    id!: string;
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    cursor?: string;
    @ApiPropertyOptional({ description: "Página de órdenes, comenzando en 1" })
    @IsOptional()
    @Matches(/^[1-9][0-9]{0,4}$/u)
    orderPage?: string;
}

/** Valida también bajo tsx: no depende de los metadatos de tipos emitidos únicamente por tsc. */
export function validateLeadProfileQuery(input: unknown): LeadProfileQueryDto {
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Parámetros del perfil inválidos.");
    const query = plainToInstance(LeadProfileQueryDto, input);
    if (validateSync(query, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Parámetros del perfil inválidos.");
    const validId = query.source === "native" ? /^[0-9A-HJKMNP-TV-Z]{26}$/u.test(query.id) : /^[1-9][0-9]{0,19}$/u.test(query.id);
    if (!validId) throw new BadRequestException("Identificador inválido para el origen del lead.");
    return query;
}

/** Proyección permitida: nunca se serializan filas completas ni snapshots de auditoría. */
export interface LeadProfileSource {
    source: LeadProfileOrigin;
    id: string;
    internalId: string;
    reference: string | null;
    values: Record<string, string | null>;
}
export interface LeadProfileField {
    code: string;
    label: string;
    value: string | null;
    source: LeadProfileOrigin | null;
    legacyValue: string | null;
}
export interface LeadProfileOrder {
    id: string;
    source: LeadProfileOrigin;
    number: string | null;
    status: string | null;
    date: string | null;
    currency: string | null;
    amount: string | null;
}
export interface LeadProfileOrderPage {
    items: LeadProfileOrder[];
    hasMore: boolean;
    page: number;
}

/** Contrato único de salida, independiente de las columnas y tablas de cada origen. */
export interface LeadProfileResponseDto {
    schemaVersion: 1;
    observedAt: string;
    id: string;
    source: LeadProfileOrigin;
    sources: LeadProfileOrigin[];
    sections: { title: string; fields: LeadProfileField[] }[];
    history: { items: ClientHistoryItem[]; hasMore: boolean; nextCursor: string | null; legacyAvailable?: boolean };
    orders: Record<LeadProfileOrigin, LeadProfileOrderPage>;
}

const nullableText: SchemaObject = { type: "string", nullable: true };
const originSchema: SchemaObject = { type: "string", enum: ["native", "legacy"] };
const profileFieldSchema: SchemaObject = { type: "object", required: ["code", "label", "value", "source", "legacyValue"], properties: { code: { type: "string" }, label: { type: "string" }, value: nullableText, source: { ...originSchema, nullable: true }, legacyValue: nullableText } };
const historyItemSchema: SchemaObject = {
    type: "object",
    required: ["id", "source", "action", "detail", "reason", "actorName", "actorCoverage", "occurredAt", "sourceDate", "recordedAt", "evidence", "fromStatus", "toStatus"],
    properties: {
        id: { type: "string" },
        source: originSchema,
        action: { type: "string" },
        detail: nullableText,
        reason: { type: "object", nullable: true, required: ["code", "name"], properties: { code: { type: "string" }, name: { type: "string" } } },
        actorName: nullableText,
        actorCoverage: { type: "string", enum: ["at_event", "current_directory"] },
        occurredAt: nullableText,
        sourceDate: nullableText,
        recordedAt: nullableText,
        evidence: { type: "string", enum: ["native_event", "legacy_observation"] },
        fromStatus: nullableText,
        toStatus: nullableText,
    },
};
const orderPageSchema: SchemaObject = {
    type: "object",
    required: ["items", "hasMore", "page"],
    properties: { items: { type: "array", maxItems: 50, items: { type: "object", required: ["id", "source", "number", "status", "date", "currency", "amount"], properties: { id: { type: "string" }, source: originSchema, number: nullableText, status: nullableText, date: nullableText, currency: nullableText, amount: nullableText } } }, hasMore: { type: "boolean" }, page: { type: "integer", minimum: 1 } },
};

/** Esquema explícito porque las interfaces desaparecen al compilar y Swagger también debe funcionar en tsx. */
export const LEAD_PROFILE_RESPONSE_SCHEMA: SchemaObject = {
    type: "object",
    required: ["schemaVersion", "observedAt", "id", "source", "sources", "sections", "history", "orders"],
    properties: {
        schemaVersion: { type: "integer", enum: [1] },
        observedAt: { type: "string", format: "date-time" },
        id: { type: "string" },
        source: originSchema,
        sources: { type: "array", items: originSchema, minItems: 1, maxItems: 2, uniqueItems: true },
        sections: { type: "array", items: { type: "object", required: ["title", "fields"], properties: { title: { type: "string" }, fields: { type: "array", items: profileFieldSchema } } } },
        history: { type: "object", required: ["items", "hasMore", "nextCursor"], properties: { items: { type: "array", maxItems: 50, items: historyItemSchema }, hasMore: { type: "boolean" }, nextCursor: nullableText, legacyAvailable: { type: "boolean" } } },
        orders: { type: "object", required: ["native", "legacy"], properties: { native: orderPageSchema, legacy: orderPageSchema } },
    },
};

/** Puerto de lectura: el dominio no conoce ni importa conexiones del CRM antiguo. */
export const LEAD_PROFILE_LEGACY_READER = Symbol("LEAD_PROFILE_LEGACY_READER");
