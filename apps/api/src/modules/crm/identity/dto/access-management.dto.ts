import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from "class-validator";

const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const AUDIT_REASON_PATTERN = /\S+\s+\S+/u;

const toTrimmedString = ({ value }: { readonly value: unknown }): unknown => (typeof value === "string" ? value.trim() : value);

/**
 * Edicion del nombre visible de un rol. El codigo estable no se renombra.
 */
export class UpdateIdentityRoleDto {
    @ApiProperty({ description: "Nombre visible del rol.", maxLength: 120 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name!: string;

    @ApiPropertyOptional({ description: "Descripcion funcional del rol.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @ApiProperty({ description: "Motivo auditable del cambio.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(5)
    @Matches(AUDIT_REASON_PATTERN, { message: "El motivo auditable debe tener al menos dos palabras." })
    @MaxLength(255)
    reason!: string;
}

/**
 * Reemplazo completo de permisos activos de un rol.
 */
export class ReplaceIdentityRolePermissionsDto {
    @ApiProperty({ description: "Codigos de permisos que quedaran activos en el rol.", maxLength: 500, type: [String] })
    @IsArray()
    @ArrayMaxSize(500)
    @IsString({ each: true })
    @Matches(PERMISSION_CODE_PATTERN, { each: true })
    permissionCodes!: string[];

    @ApiProperty({ description: "Motivo auditable del cambio de permisos.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(5)
    @Matches(AUDIT_REASON_PATTERN, { message: "El motivo auditable debe tener al menos dos palabras." })
    @MaxLength(255)
    reason!: string;
}

/**
 * Override directo de un permiso para un usuario.
 */
export class ReplaceIdentityUserPermissionOverrideDto {
    @ApiProperty({ description: "Codigo estable del permiso directo." })
    @Transform(toTrimmedString)
    @IsString()
    @Matches(PERMISSION_CODE_PATTERN)
    code!: string;

    @ApiProperty({ description: "Efecto directo del permiso.", enum: ["allow", "deny"] })
    @IsIn(["allow", "deny"])
    effect!: "allow" | "deny";
}

/**
 * Reemplazo completo del acceso directo de un usuario.
 *
 * `roleCodes` define roles activos, `orgUnitCodes` define modulos visibles y
 * `permissionOverrides` conserva diferencias personales sobre lo que hereda
 * por rol. Las acciones y modulos siguen naciendo por migracion.
 */
export class ReplaceIdentityUserAccessDto {
    @ApiProperty({ description: "Roles activos que tendra el usuario.", maxLength: 20, type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @Matches(/^[a-z][a-z0-9_]*$/u, { each: true })
    roleCodes!: string[];

    @ApiProperty({ description: "Modulos o areas operativas activos para el usuario.", maxLength: 20, type: [String] })
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @Matches(/^[a-z][a-z0-9_]*$/u, { each: true })
    orgUnitCodes!: string[];

    @ApiProperty({ description: "Permisos directos que diferencian a este usuario del rol.", maxLength: 500, type: [ReplaceIdentityUserPermissionOverrideDto] })
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => ReplaceIdentityUserPermissionOverrideDto)
    permissionOverrides!: ReplaceIdentityUserPermissionOverrideDto[];

    @ApiProperty({ description: "Motivo auditable del cambio de acceso.", maxLength: 255 })
    @Transform(toTrimmedString)
    @IsString()
    @MinLength(5)
    @Matches(AUDIT_REASON_PATTERN, { message: "El motivo auditable debe tener al menos dos palabras." })
    @MaxLength(255)
    reason!: string;
}
