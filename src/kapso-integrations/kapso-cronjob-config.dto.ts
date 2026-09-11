import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Min } from "class-validator";

const CRONJOB_ID_PATTERN = /^[a-zA-Z0-9._:-]{3,80}$/;

/** Body para crear/editar un cronjob general Kapso. */
export class KapsoCronjobConfigBodyDto {
    @IsString()
    @Matches(CRONJOB_ID_PATTERN)
    readonly cronjobId!: string;

    @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
    @IsBoolean()
    readonly isActive!: boolean;

    @IsObject()
    @IsOptional()
    readonly config?: Record<string, unknown>;
}

/** Body para habilitar un proyecto CRM dentro de un cronjob Kapso. */
export class KapsoCronjobProjectConfigBodyDto {
    @IsString()
    readonly kapsoIntegracionNumeroWhatsappId!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    readonly idproyectoLead!: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    readonly idnetsuiteAdmin?: number | null;

    @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
    @IsBoolean()
    readonly isActive!: boolean;

    @IsObject()
    @IsOptional()
    readonly config?: Record<string, unknown>;
}
