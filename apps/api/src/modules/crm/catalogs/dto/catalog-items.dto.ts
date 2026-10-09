import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

import { CATALOG_CONTEXT_MODULES, CATALOG_STATUSES, type CatalogContextModuleCode, type CatalogStatus } from "../catalogs.constants.js";

const toOptionalTrimmedString = ({ value }: { readonly value: unknown }): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const toTrimmedString = ({ value }: { readonly value: unknown }): unknown => (typeof value === "string" ? value.trim() : value);

const toInteger = ({ value }: { readonly value: unknown }): number | undefined => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    return Number(value);
};

/**
 *
 */
export class ListCatalogItemsQueryDto {
    @ApiPropertyOptional({ description: "Desplazamiento de la siguiente tanda del catálogo.", minimum: 0, maximum: 2147483647 })
    @Transform(toInteger)
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(2147483647)
    offset?: number;

    @ApiProperty({ description: "Módulo desde el que se consume el catálogo.", enum: CATALOG_CONTEXT_MODULES })
    @Transform(toTrimmedString)
    @IsString()
    @IsIn(CATALOG_CONTEXT_MODULES)
    moduleCode!: CatalogContextModuleCode;

    @ApiPropertyOptional({ description: "Estado a filtrar.", enum: CATALOG_STATUSES })
    @IsOptional()
    @IsIn(CATALOG_STATUSES)
    status?: CatalogStatus;

    @ApiPropertyOptional({ description: "Búsqueda por nombre, detalle o referencia externa.", maxLength: 120 })
    @Transform(toOptionalTrimmedString)
    @IsOptional()
    @IsString()
    @MaxLength(120)
    search?: string;

    @ApiPropertyOptional({ description: "Cantidad máxima de filas.", minimum: 1, maximum: 200, default: 100 })
    @Transform(toInteger)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number;
}

/**
 *
 */
export class CatalogExternalReferenceDto {
    @ApiProperty({ description: "Código del sistema externo configurado en CRM.", maxLength: 80 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    systemCode!: string;

    @ApiPropertyOptional({ description: "Identificador externo opcional. Null, vacío u omitido no asignan una referencia.", type: String, maxLength: 180, nullable: true })
    @Transform(({ value }: { readonly value: unknown }) => (typeof value === "string" ? value.trim() || undefined : value))
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(180)
    externalId?: string | null;
}

/**
 *
 */
export class CreateCatalogItemDto {
    @ApiProperty({ description: "Módulo desde el que se administra el catálogo.", enum: CATALOG_CONTEXT_MODULES })
    @Transform(toTrimmedString)
    @IsString()
    @IsIn(CATALOG_CONTEXT_MODULES)
    moduleCode!: CatalogContextModuleCode;

    @ApiProperty({ description: "Nombre visible del valor nativo CRM.", maxLength: 180 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(2)
    @MaxLength(180)
    name!: string;

    @ApiPropertyOptional({ description: "Detalle operativo del catálogo.", maxLength: 500 })
    @Transform(toOptionalTrimmedString)
    @IsOptional()
    @IsString()
    @MaxLength(500)
    detail?: string;

    @ApiProperty({ description: "Motivo auditable de la creación.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(5)
    @MaxLength(255)
    reason!: string;

    @ApiPropertyOptional({ description: "Referencias externas opcionales.", type: [CatalogExternalReferenceDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => CatalogExternalReferenceDto)
    externalReferences?: CatalogExternalReferenceDto[];
}

/**
 *
 */
export class UpdateCatalogItemDto extends CreateCatalogItemDto {}

/**
 *
 */
export class UpdateCatalogItemStatusDto {
    @ApiProperty({ description: "Módulo desde el que se administra el catálogo.", enum: CATALOG_CONTEXT_MODULES })
    @Transform(toTrimmedString)
    @IsString()
    @IsIn(CATALOG_CONTEXT_MODULES)
    moduleCode!: CatalogContextModuleCode;

    @ApiProperty({ description: "Estado operativo del valor.", enum: CATALOG_STATUSES })
    @IsIn(CATALOG_STATUSES)
    status!: CatalogStatus;

    @ApiProperty({ description: "Motivo auditable del cambio de estado.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(5)
    @MaxLength(255)
    reason!: string;
}
