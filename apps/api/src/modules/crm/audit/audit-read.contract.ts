import { BadRequestException } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { CATALOG_DEFINITIONS } from "../catalogs/catalogs.constants.js";

const catalogs = { code: "catalogs", name: "Catálogos" };
/** Modulos y secciones que ya existen en la navegacion. No se inventan registros de auditoria para rellenar el menu. Catalogos aparece en cada modulo. */
export const AUDIT_MODULES = [
    { code: "administration", name: "Administración", sections: [{ code: "users", name: "Usuarios" }, { code: "roles", name: "Roles y seguridad" }, { code: "audit", name: "Auditoría y sistema" }, catalogs] },
    { code: "ventas", name: "Ventas", sections: [{ code: "estimates", name: "Estimaciones" }, { code: "leads", name: "Leads" }, { code: "opportunities", name: "Oportunidades" }, catalogs] },
    { code: "mercadeo", name: "Mercadeo", sections: [{ code: "campaigns", name: "Campañas" }, { code: "sources", name: "Fuentes" }, catalogs] },
    { code: "formalizacion", name: "Formalización", sections: [{ code: "contracts", name: "Contratos" }, { code: "files", name: "Expedientes" }, { code: "signatures", name: "Firmas" }, catalogs] },
] as const;

/** Alcance obligatorio y pagina acotada. No hay un listado sin modulo ni seccion. */
export class AuditQueryDto {
    @IsIn(AUDIT_MODULES.map((module) => module.code))
    moduleCode!: string;
    @IsString()
    @MaxLength(40)
    sectionCode!: string;
    @IsOptional()
    @IsIn(CATALOG_DEFINITIONS.map((catalog) => catalog.routeCode))
    catalogCode?: string;
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit = 100;
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    cursor?: string;
}
const scope = (query: AuditQueryDto) => JSON.stringify([query.moduleCode, query.sectionCode, query.catalogCode ?? "", query.search?.trim() ?? ""]);
/** El cursor busca por llave dentro del mismo alcance. No es un offset y no sirve para otro modulo, seccion, catalogo o busqueda. */
export const encodeAuditCursor = (query: AuditQueryDto, before: number): string => Buffer.from(JSON.stringify({ scope: scope(query), before })).toString("base64url");
/** Un cursor mal formado o de otro alcance es 400, antes de abrir la consulta. */
export function decodeAuditCursor(query: AuditQueryDto): number | undefined {
    if (!query.cursor) return undefined;
    try {
        const parsed = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")) as { scope?: unknown; before?: unknown };
        if (parsed.scope === scope(query) && typeof parsed.before === "number" && Number.isSafeInteger(parsed.before) && parsed.before > 0) return parsed.before;
    } catch {
        /* El token mal formado es error del cliente, no de la base. */
    }
    throw new BadRequestException("Cursor de auditoría inválido.");
}
