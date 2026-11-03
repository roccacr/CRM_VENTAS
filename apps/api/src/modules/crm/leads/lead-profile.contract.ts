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

/** Evento del calendario vinculado al cliente; las dos fuentes comparten la misma forma. */
export interface LeadProfileEvent {
    id: string;
    source: LeadProfileOrigin;
    title: string | null;
    type: string | null;
    status: string | null;
    /** Día en hora de Costa Rica, YYYY-MM-DD. */
    date: string | null;
    startTime: string | null;
    endTime: string | null;
}
export interface LeadProfileEventPage {
    items: LeadProfileEvent[];
    hasMore: boolean;
    page: number;
}

/** Registros comerciales reales; la bitácora no se utiliza para inferir su existencia. */
export interface LeadProfileCommercialRecord {
    id: string;
    source: LeadProfileOrigin;
    fields: { code: string; label: string; value: string | null }[];
}
export interface LeadProfileCommercialPage {
    items: LeadProfileCommercialRecord[];
    total: number;
    hasMore: boolean;
    page: number;
    available: boolean;
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
    events: Record<LeadProfileOrigin, LeadProfileEventPage>;
    opportunities: LeadProfileCommercialPage;
    estimates: LeadProfileCommercialPage;
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
const commercialPageSchema: SchemaObject = {
    type: "object",
    required: ["items", "total", "hasMore", "page", "available"],
    properties: {
        items: { type: "array", maxItems: 50, items: { type: "object", required: ["id", "source", "fields"], properties: { id: { type: "string" }, source: originSchema, fields: { type: "array", items: { type: "object", required: ["code", "label", "value"], properties: { code: { type: "string" }, label: { type: "string" }, value: nullableText } } } } } },
        total: { type: "integer", minimum: 0 },
        hasMore: { type: "boolean" },
        page: { type: "integer", minimum: 1 },
        available: { type: "boolean" },
    },
};
const eventPageSchema: SchemaObject = {
    type: "object",
    required: ["items", "hasMore", "page"],
    properties: {
        items: { type: "array", maxItems: 50, items: { type: "object", required: ["id", "source", "title", "type", "status", "date", "startTime", "endTime"], properties: { id: { type: "string" }, source: originSchema, title: nullableText, type: nullableText, status: nullableText, date: nullableText, startTime: nullableText, endTime: nullableText } } },
        hasMore: { type: "boolean" },
        page: { type: "integer", minimum: 1 },
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
    required: ["schemaVersion", "observedAt", "id", "source", "sources", "sections", "history", "orders", "events", "opportunities", "estimates"],
    properties: {
        schemaVersion: { type: "integer", enum: [1] },
        observedAt: { type: "string", format: "date-time" },
        id: { type: "string" },
        source: originSchema,
        sources: { type: "array", items: originSchema, minItems: 1, maxItems: 2, uniqueItems: true },
        sections: { type: "array", items: { type: "object", required: ["title", "fields"], properties: { title: { type: "string" }, fields: { type: "array", items: profileFieldSchema } } } },
        history: { type: "object", required: ["items", "hasMore", "nextCursor"], properties: { items: { type: "array", maxItems: 50, items: historyItemSchema }, hasMore: { type: "boolean" }, nextCursor: nullableText, legacyAvailable: { type: "boolean" } } },
        opportunities: commercialPageSchema,
        estimates: commercialPageSchema,
        orders: { type: "object", required: ["native", "legacy"], properties: { native: orderPageSchema, legacy: orderPageSchema } },
        events: { type: "object", required: ["native", "legacy"], properties: { native: eventPageSchema, legacy: eventPageSchema } },
    },
};

/** Puerto de lectura: el dominio no conoce ni importa conexiones del CRM antiguo. */
export const LEAD_PROFILE_LEGACY_READER = Symbol("LEAD_PROFILE_LEGACY_READER");
