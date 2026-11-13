import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

function selection({ value }: { value: unknown }): unknown {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return value;
    }
}

/**
 * Criterio acotado del servidor. El inventario exige al menos un proyecto y un límite de 1 a 500; si no viene, es 50.
 * Una selección que no es JSON se deja como llegó para que el validador la rechace.
 */
export class UnitFilesQueryDto {
    @IsIn(["administration", "ventas", "mercadeo", "formalizacion"])
    moduleCode!: string;

    @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.split(",") : value))
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @Matches(/^[0-9A-HJKMNP-TV-Z]{26}$/, { each: true })
    projectIds!: string[];

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit = 50;

    @IsOptional()
    @IsString()
    @MaxLength(250)
    status?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    housingType?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    code?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    codeMatch?: string;

    @IsOptional()
    @IsString()
    @MaxLength(512)
    cursor?: string;

    @IsOptional()
    @Transform(selection)
    @IsArray()
    @ArrayMaxSize(500)
    @ArrayUnique()
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    codes?: string[];

    @IsOptional()
    @Transform(selection)
    @IsArray()
    @ArrayMaxSize(500)
    @ArrayUnique()
    @IsString({ each: true })
    @MaxLength(200, { each: true })
    housingTypes?: string[];

    @IsOptional()
    @Transform(selection)
    @IsArray()
    @ArrayMaxSize(500)
    @ArrayUnique()
    @IsString({ each: true })
    @MaxLength(250, { each: true })
    statuses?: string[];

    @IsOptional()
    @Transform(selection)
    @IsArray()
    @ArrayMaxSize(500)
    @ArrayUnique()
    @Matches(/^[0-9A-HJKMNP-TV-Z]{26}$/, { each: true })
    paneProjectIds?: string[];
}

/** El agregado tiene su propia página por clave. No reutiliza el cursor del inventario. */
export class UnitFilesFacetsDto extends UnitFilesQueryDto {
    @IsIn(["code", "projectIds", "housingType", "status"])
    kind!: "code" | "projectIds" | "housingType" | "status";

    @IsOptional()
    @IsString()
    @MaxLength(250)
    after?: string;
}

/** Las opciones distintas usan el mismo tope de proyectos que el inventario y no devuelven el expediente. */
export class UnitFilesOptionsDto extends UnitFilesQueryDto {
    @IsIn(["housingType", "code"])
    kind!: "housingType" | "code";

    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    after?: string;
}

/** El contexto solo trae el módulo. No dispara una consulta de inventario. */
export class UnitFilesContextDto {
    @IsIn(["administration", "ventas", "mercadeo", "formalizacion"])
    moduleCode!: string;
}
