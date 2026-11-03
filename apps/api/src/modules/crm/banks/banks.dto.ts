import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

import { CATALOG_CONTEXT_MODULES, CATALOG_STATUSES, type CatalogContextModuleCode, type CatalogStatus } from "../catalogs/catalogs.constants.js";

const trim = ({ value }: { value: unknown }): unknown => (typeof value === "string" ? value.trim() : value);
/** Context chooses authorization only; banks are shared across modules. */
export class BankContextDto {
    @ApiProperty({ enum: CATALOG_CONTEXT_MODULES }) @Transform(trim) @IsIn(CATALOG_CONTEXT_MODULES) moduleCode!: CatalogContextModuleCode;
}
/** Server pagination; no unbounded list route exists. */
export class ListBanksQueryDto extends BankContextDto {
    @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 200 }) @Transform(({ value }: { value: unknown }) => Number(value)) @IsOptional() @IsInt() @Min(1) @Max(200) limit?: number;
    @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 2147483647 }) @Transform(({ value }: { value: unknown }) => Number(value)) @IsOptional() @IsInt() @Min(0) @Max(2147483647) offset?: number;
    @ApiPropertyOptional({ maxLength: 120 }) @Transform(trim) @IsOptional() @IsString() @MaxLength(120) search?: string;
    @ApiPropertyOptional({ enum: CATALOG_STATUSES }) @IsOptional() @IsIn(CATALOG_STATUSES) status?: CatalogStatus;
}
/** Required reason is recorded with the actor resolved from the session. */
export class BankMutationDto extends BankContextDto {
    @ApiProperty({ minLength: 3, maxLength: 255 }) @Transform(trim) @IsString() @MinLength(3) @MaxLength(255) reason!: string;
}
/** Bank name is required and bounded by its physical column. */
export class CreateBankDto extends BankMutationDto {
    @ApiProperty({ maxLength: 250 }) @Transform(trim) @IsString() @MinLength(1) @MaxLength(250) name!: string;
}
/** A name edit must carry the version last read by the client. */
export class UpdateBankDto extends CreateBankDto {
    @ApiProperty({ minimum: 1, maximum: 4294967295 }) @IsInt() @Min(1) @Max(4294967295) expectedVersion!: number;
}
/** State changes preserve the optimistic concurrency contract. */
export class BankStatusDto extends BankMutationDto {
    @ApiProperty({ enum: CATALOG_STATUSES }) @IsIn(CATALOG_STATUSES) status!: CatalogStatus;
    @ApiProperty({ minimum: 1, maximum: 4294967295 }) @IsInt() @Min(1) @Max(4294967295) expectedVersion!: number;
}
/** All advisor contact fields are mandatory and bounded by the schema. */
export class CreateBankAdvisorDto extends CreateBankDto {
    @ApiProperty({ maxLength: 254 }) @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(254) email!: string;
    @ApiProperty({ maxLength: 40 }) @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) phone!: string;
    @ApiProperty({ maxLength: 120 }) @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) area!: string;
}
/** Contact edits cannot carry a new parent bank. */
export class UpdateBankAdvisorDto extends CreateBankAdvisorDto {
    @ApiProperty({ minimum: 1, maximum: 4294967295 }) @IsInt() @Min(1) @Max(4294967295) expectedVersion!: number;
}
/** Only canonical ULIDs reach persistence, never local numeric PKs. */
export class BankIdDto {
    @ApiProperty() @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) bankId!: string;
}
/** Both route identities are canonical public ULIDs. */
export class BankAdvisorIdDto extends BankIdDto {
    @ApiProperty() @Matches(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/) advisorId!: string;
}
