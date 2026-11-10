import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

import { CATALOG_CONTEXT_MODULES, CATALOG_STATUSES, type CatalogContextModuleCode, type CatalogStatus } from "../catalogs/catalogs.constants.js";

const trim = ({ value }: { value: unknown }): unknown => (typeof value === "string" ? value.trim() : value);
/** El módulo solo elige el permiso. El banco es el mismo en todos los módulos. */
export class BankContextDto {
    @ApiProperty({ enum: CATALOG_CONTEXT_MODULES }) @Transform(trim) @IsIn(CATALOG_CONTEXT_MODULES) moduleCode!: CatalogContextModuleCode;
}
/** Página acotada: límite de 1 a 500 y desplazamiento hasta el tope de 32 bits con signo. No hay un listado sin tope. */
export class ListBanksQueryDto extends BankContextDto {
    @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 500 }) @Transform(({ value }: { value: unknown }) => Number(value)) @IsOptional() @IsInt() @Min(1) @Max(500) limit?: number;
    @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 2147483647 }) @Transform(({ value }: { value: unknown }) => Number(value)) @IsOptional() @IsInt() @Min(0) @Max(2147483647) offset?: number;
    @ApiPropertyOptional({ maxLength: 120 }) @Transform(trim) @IsOptional() @IsString() @MaxLength(120) search?: string;
    @ApiPropertyOptional({ enum: CATALOG_STATUSES }) @IsOptional() @IsIn(CATALOG_STATUSES) status?: CatalogStatus;
}
/** El motivo es obligatorio. El actor sale de la sesión, no de este cuerpo. */
export class BankMutationDto extends BankContextDto {
    @ApiProperty({ minLength: 3, maxLength: 255 }) @Transform(trim) @IsString() @MinLength(3) @MaxLength(255) reason!: string;
}
/** El nombre es obligatorio y cabe en la columna física de 250. */
export class CreateBankDto extends BankMutationDto {
    @ApiProperty({ maxLength: 250 }) @Transform(trim) @IsString() @MinLength(1) @MaxLength(250) name!: string;
}
/** Editar el nombre exige la versión que el cliente leyó. Sin ella no hay actualización optimista. */
export class UpdateBankDto extends CreateBankDto {
    @ApiProperty({ minimum: 1, maximum: 4294967295 }) @IsInt() @Min(1) @Max(4294967295) expectedVersion!: number;
}
/** Cambiar el estado también exige la versión leída. Activar e inactivar no comparten permiso. */
export class BankStatusDto extends BankMutationDto {
    @ApiProperty({ enum: CATALOG_STATUSES }) @IsIn(CATALOG_STATUSES) status!: CatalogStatus;
    @ApiProperty({ minimum: 1, maximum: 4294967295 }) @IsInt() @Min(1) @Max(4294967295) expectedVersion!: number;
}
/** Nombre, correo, teléfono y área son obligatorios y caben en su columna. El correo se guarda en minúsculas. */
export class CreateBankAdvisorDto extends CreateBankDto {
    @ApiProperty({ maxLength: 254 }) @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(254) email!: string;
    @ApiProperty({ maxLength: 40 }) @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) phone!: string;
    @ApiProperty({ maxLength: 120 }) @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) area!: string;
}
/** Editar el contacto no trae otro banco padre. Trasladar al ejecutivo no cabe en este cuerpo. */
export class UpdateBankAdvisorDto extends CreateBankAdvisorDto {
    @ApiProperty({ minimum: 1, maximum: 4294967295 }) @IsInt() @Min(1) @Max(4294967295) expectedVersion!: number;
}
/** Solo entra un ULID canónico. Una llave numérica local no llega a la persistencia. */
export class BankIdDto {
    @ApiProperty() @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) bankId!: string;
}
/** Banco y ejecutivo viajan como ULID públicos. El id interno del padre no sale en la ruta. */
export class BankAdvisorIdDto extends BankIdDto {
    @ApiProperty() @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) advisorId!: string;
}
