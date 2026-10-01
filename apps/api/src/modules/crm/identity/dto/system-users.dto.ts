import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

const SYSTEM_USER_STATUSES = ["active", "blocked", "inactive", "pending"] as const;
const CREATE_SYSTEM_USER_STATUSES = ["active", "inactive", "pending"] as const;
const CREATE_SYSTEM_USER_EXTERNAL_SYSTEMS = ["netsuite", "odoo"] as const;
const CREATE_SYSTEM_USER_ACCESS_METHODS = ["microsoft", "local"] as const;
const SYSTEM_USER_SORT_KEYS = ["lastActivity", "name", "status"] as const;
const SYSTEM_USER_SORT_DIRECTIONS = ["asc", "desc"] as const;

export type SystemUserStatusFilter = (typeof SYSTEM_USER_STATUSES)[number];
export type CreateSystemUserStatus = (typeof CREATE_SYSTEM_USER_STATUSES)[number];
export type CreateSystemUserExternalSystem = (typeof CREATE_SYSTEM_USER_EXTERNAL_SYSTEMS)[number];
export type CreateSystemUserAccessMethod = (typeof CREATE_SYSTEM_USER_ACCESS_METHODS)[number];
export type SystemUserSortKey = (typeof SYSTEM_USER_SORT_KEYS)[number];
export type SystemUserSortDirection = (typeof SYSTEM_USER_SORT_DIRECTIONS)[number];

/**
 * Vacío o solo espacios no es una búsqueda.
 *
 * Así el query no filtra por un string vacío que el API trataría como texto.
 */
const toOptionalTrimmedString = ({ value }: { readonly value: unknown }): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const toTrimmedString = ({ value }: { readonly value: unknown }): unknown => (typeof value === "string" ? value.trim() : value);

const toTrimmedStringArray = ({ value }: { readonly value: unknown }): unknown =>
    Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
        : value;

/** El querystring llega como texto. Un valor ausente no se convierte en NaN. */
const toInteger = ({ value }: { readonly value: unknown }): number | undefined => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    return Number(value);
};

/**
 * Querystring controlado para el directorio de usuarios.
 */
export class ListSystemUsersQueryDto {
    @ApiPropertyOptional({ description: "Estado operativo a filtrar.", enum: SYSTEM_USER_STATUSES })
    @IsOptional()
    @IsIn(SYSTEM_USER_STATUSES)
    status?: SystemUserStatusFilter;

    @ApiPropertyOptional({ description: "Busqueda por nombre, correo, rol o area.", maxLength: 120 })
    @Transform(toOptionalTrimmedString)
    @IsOptional()
    @IsString()
    @MaxLength(120)
    search?: string;

    @ApiPropertyOptional({ description: "Cantidad maxima de usuarios por pagina.", minimum: 1, maximum: 100, default: 25 })
    @Transform(toInteger)
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiPropertyOptional({ description: "Cursor opaco devuelto por la pagina anterior.", maxLength: 500 })
    @Transform(toOptionalTrimmedString)
    @IsOptional()
    @IsString()
    @MaxLength(500)
    cursor?: string;

    @ApiPropertyOptional({ description: "Columna logica de ordenamiento.", enum: SYSTEM_USER_SORT_KEYS, default: "name" })
    @IsOptional()
    @IsIn(SYSTEM_USER_SORT_KEYS)
    sort?: SystemUserSortKey;

    @ApiPropertyOptional({ description: "Direccion de ordenamiento.", enum: SYSTEM_USER_SORT_DIRECTIONS, default: "asc" })
    @IsOptional()
    @IsIn(SYSTEM_USER_SORT_DIRECTIONS)
    direction?: SystemUserSortDirection;
}

/**
 * Referencia externa opcional de un usuario interno.
 *
 * El contrato HTTP usa `systemCode` genérico. NetSuite/Odoo no se vuelven IDs
 * principales del CRM; solo quedan como crosswalks auditables.
 */
export class CreateSystemUserExternalReferenceDto {
    @ApiProperty({ description: "Sistema externo al que pertenece la referencia.", enum: CREATE_SYSTEM_USER_EXTERNAL_SYSTEMS })
    @IsIn(CREATE_SYSTEM_USER_EXTERNAL_SYSTEMS)
    systemCode!: CreateSystemUserExternalSystem;

    @ApiProperty({ description: "Identificador del usuario en el sistema externo.", maxLength: 180 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(1)
    @MaxLength(180)
    externalUserId!: string;
}

/**
 * Alta administrativa de usuario interno del CRM.
 */
export class CreateSystemUserDto {
    @ApiProperty({ description: "Nombre visible del usuario.", maxLength: 180 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(2)
    @MaxLength(180)
    displayName!: string;

    @ApiProperty({ description: "Correo corporativo principal.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsEmail()
    @MaxLength(255)
    email!: string;

    @ApiPropertyOptional({ description: "Metodos de acceso habilitados en el alta.", enum: CREATE_SYSTEM_USER_ACCESS_METHODS, isArray: true })
    @Transform(toTrimmedStringArray)
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(2)
    @IsIn(CREATE_SYSTEM_USER_ACCESS_METHODS, { each: true })
    accessMethods?: CreateSystemUserAccessMethod[];

    @ApiProperty({ description: "Rol inicial que recibira el usuario.", maxLength: 80 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    roleCode!: string;

    @ApiPropertyOptional({ description: "Roles iniciales que recibira el usuario. Se mantiene roleCode como compatibilidad.", maxItems: 20, type: [String] })
    @Transform(toTrimmedStringArray)
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MinLength(1, { each: true })
    @MaxLength(80, { each: true })
    roleCodes?: string[];

    @ApiPropertyOptional({ description: "Area inicial del usuario. Se mantiene por compatibilidad; preferir orgUnitCodes.", maxLength: 80 })
    @Transform(toTrimmedString)
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    orgUnitCode?: string;

    @ApiPropertyOptional({ description: "Areas iniciales que puede administrar o donde queda asignado.", maxItems: 20, type: [String] })
    @Transform(toTrimmedStringArray)
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MinLength(1, { each: true })
    @MaxLength(80, { each: true })
    orgUnitCodes?: string[];

    @ApiProperty({ description: "Estado operativo inicial.", enum: CREATE_SYSTEM_USER_STATUSES })
    @IsIn(CREATE_SYSTEM_USER_STATUSES)
    initialStatus!: CreateSystemUserStatus;

    @ApiProperty({ description: "Motivo auditable del alta.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(5)
    @MaxLength(255)
    reason!: string;

    @ApiPropertyOptional({ description: "Referencias externas opcionales.", type: [CreateSystemUserExternalReferenceDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(2)
    @ValidateNested({ each: true })
    @Type(() => CreateSystemUserExternalReferenceDto)
    externalReferences?: CreateSystemUserExternalReferenceDto[];
}
